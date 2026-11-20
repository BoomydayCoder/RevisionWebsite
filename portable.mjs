import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dist = path.join(root, 'dist');

function installPortableArchive(courseIds) {
  window.FOLIO_PORTABLE = true;
  const stores = ['sources', 'blobs', 'notes'];
  let connection;
  function database() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const open = indexedDB.open('folio-mit-portable', 1);
        open.onupgradeneeded = () => {
          for (const store of stores) open.result.createObjectStore(store);
        };
        open.onsuccess = () => {
          open.result.onversionchange = () => { open.result.close(); connection = null; };
          resolve(open.result);
        };
        open.onerror = () => reject(open.error);
        open.onblocked = () => reject(new Error('Close other Folio tabs and reopen this file.'));
      }).catch(error => { connection = null; throw error; });
    }
    return connection;
  }
  function completed(tx) {
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onabort = () => reject(tx.error || new Error('The browser could not save the changes.'));
      tx.onerror = () => reject(tx.error);
    });
  }
  function result(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  function check(test, message, status = 400) {
    if (!test) throw Object.assign(new Error(message), { status });
  }
  async function digest(bytes) {
    const value = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(value, n => n.toString(16).padStart(2, '0')).join('');
  }
  // All reads/conditional writes for a duplicate import happen in a single transaction.
  async function insertIfNew(store, id, entry, pdf) {
    const db = await database();
    const tx = db.transaction(pdf ? [store, 'blobs'] : [store], 'readwrite');
    const done = completed(tx);
    const items = tx.objectStore(store);
    const existing = await result(items.get(id));
    if (!existing) {
      items.add(entry, id);
      if (pdf) tx.objectStore('blobs').add(pdf, id);
    }
    await done;
    return existing || entry;
  }
  function normalized(draft) {
    const field = (val, name) => {
      check(typeof val === 'string' && val.trim(), name + ' is required.');
      return val.trim();
    };
    function rows(entries, name, keys, min = 0) {
      check(Array.isArray(entries) && entries.length >= min && entries.length <= 64, 'Check the number of ' + name + '.');
      return entries.map(entry => Object.fromEntries(keys.map(key => [key, field(entry?.[key], name + ': ' + key)])));
    }
    check(draft && courseIds.includes(draft.courseId), 'Select an available course.');
    check(Array.isArray(draft.sources) && draft.sources.length > 0 && draft.sources.length <= 256, 'Cite at least one uploaded source.');
    const sources = draft.sources.map(ref => {
      check(Number.isSafeInteger(ref?.page) && ref.page > 0, 'Use a physical PDF page number starting at 1.');
      return { sourceId: field(ref.sourceId, 'Source identifier'), page: ref.page };
    });
    const extensions = draft.extensions ?? [];
    check(Array.isArray(extensions) && extensions.length <= 64, 'Check the extensions.');
    return {
      courseId: draft.courseId, title: field(draft.title, 'Title'), summary: field(draft.summary, 'Summary'),
      kind: field(draft.kind ?? 'Revision note', 'Note type'),
      sections: rows(draft.sections, 'sections', ['heading', 'body'], 1), sources,
      corrections: rows(draft.corrections ?? [], 'corrections', ['original', 'revised', 'reason']),
      extensions: extensions.map(value => field(value, 'Extension')),
      questions: rows(draft.questions ?? [], 'questions', ['question', 'answer'])
    };
  }
  async function localAPI(route, method, headers, body) {
    if (route === '/api/generate') return Response.json({ error: 'Use ChatGPT to create a draft in the portable edition.' }, { status: 503 });
    const db = await database();
    if (route === '/api/state' && method === 'GET') {
      const tx = db.transaction(['sources', 'notes']);
      const [sources, notes] = await Promise.all(['sources','notes'].map(store => result(tx.objectStore(store).getAll())));
      sources.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      notes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return Response.json({ sources, notes, aiConfigured: false, storageMode: 'browser' });
    }
    if (route === '/api/sources' && method === 'POST') {
      const blob = body instanceof Blob ? body : await new Response(body).blob();
      check(blob.size > 0 && blob.size <= 24 * 1024 * 1024, 'Each PDF must be between 1 byte and 24 MiB.', 413);
      check(/%PDF-\d\.\d/.test(await blob.slice(0, 1024).text()), 'This file does not have a PDF header.', 415);
      const name = decodeURIComponent(headers.get('x-file-name') || '').split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g, '').trim();
      check(name.length <= 240 && /\.pdf$/i.test(name), 'Choose a PDF with a filename of at most 240 characters.');
      const id = await digest(await blob.arrayBuffer());
      const source = { id, name, size: blob.size, createdAt: new Date().toISOString() };
      const stored = await insertIfNew('sources', id, source, blob.slice(0, blob.size, 'application/pdf'));
      return Response.json({ source: stored }, { status: 201 });
    }
    if (route.startsWith('/api/sources/') && method === 'GET') {
      const id = decodeURIComponent(route.slice('/api/sources/'.length));
      const pdf = await result(db.transaction('blobs').objectStore('blobs').get(id));
      check(pdf, 'This PDF is unavailable in this browser.', 404);
      return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
    }
    if (route === '/api/notes' && method === 'POST') {
      const input = typeof body === 'string' ? body : await new Response(body).text();
      check(input.length <= 512 * 1024, 'Split this draft into smaller notes.', 413);
      const draft = normalized(JSON.parse(input).draft);
      const ids = [...new Set(draft.sources.map(s => s.sourceId))];
      const sources = db.transaction('sources').objectStore('sources');
      const present = await Promise.all(ids.map(id => result(sources.count(id))));
      check(present.every(Boolean), 'A citation refers to a PDF outside this archive.');
      const id = 'note-' + await digest(new TextEncoder().encode(JSON.stringify(draft)));
      const note = await insertIfNew('notes', id, { id, ...draft, updatedAt: new Date().toISOString() });
      return Response.json({ note }, { status: 201 });
    }
    return Response.json({ error: 'This operation is unavailable in the portable edition.' }, { status: 404 });
  }

  const signature = 'FOLIO01\n';
  async function exportBackup() {
    const db = await database();
    const meta = db.transaction(['notes','sources']);
    const [sources, notes] = await Promise.all(['sources','notes'].map(name => result(meta.objectStore(name).getAll())));
    const manifest = new TextEncoder().encode(JSON.stringify({sources,notes}));
    check(manifest.byteLength <= 64 * 1024 * 1024, 'This archive exceeds the backup metadata limit.');
    const size = new DataView(new ArrayBuffer(4));
    size.setUint32(0, manifest.byteLength, true);
    const parts = [signature,size.buffer,manifest];
    for (const source of sources) {
      const pdf = await result(db.transaction('blobs').objectStore('blobs').get(source.id));
      check(pdf && pdf.size === source.size, 'Could not read the original for ' + source.name);
      parts.push(pdf);
    }
    return new Blob(parts,{type:'application/octet-stream'});
  }
  async function restoreBackup(file) {
    check(await file.slice(0,8).text() === signature && file.size >= 12, 'Choose a Folio archive backup.');
    const length = new DataView(await file.slice(8,12).arrayBuffer()).getUint32(0,true);
    let offset = 12 + length;
    check(length > 0 && length <= 64 * 1024 * 1024 && offset <= file.size, 'The backup header is incomplete.');
    const {sources,notes} = JSON.parse(await file.slice(12,offset).text());
    check(Array.isArray(sources) && Array.isArray(notes), 'The backup manifest is invalid.');
    const stamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
    const pdfs = new Map(), restoredNotes = new Map();
    for (const entry of sources) {
      check(entry && typeof entry.name === 'string' && entry.name.length <= 240 && /\.pdf$/i.test(entry.name) && !/[\/\\\x00-\x1f]/.test(entry.name), 'Invalid PDF filename in backup.');
      check(Number.isSafeInteger(entry.size) && entry.size > 0 && entry.size <= 24*1024*1024 && offset + entry.size <= file.size && stamp(entry.createdAt), 'Invalid or truncated PDF in backup.');
      const pdf = file.slice(offset, offset + entry.size, 'application/pdf');
      offset += entry.size;
      check(!pdfs.has(entry.id) && await digest(await pdf.arrayBuffer()) === entry.id && /%PDF-\d\.\d/.test(await pdf.slice(0,1024).text()), 'A backed-up PDF failed its integrity check.');
      pdfs.set(entry.id,{source:{id:entry.id,name:entry.name,size:entry.size,createdAt:entry.createdAt},pdf});
    }
    check(offset === file.size, 'Unexpected data after the last PDF.');
    for (const entry of notes) {
      const draft = normalized(entry);
      const bytes = new TextEncoder().encode(JSON.stringify(draft));
      check(bytes.length <= 512*1024 && entry.id === 'note-' + await digest(bytes) && stamp(entry.updatedAt), 'A backed-up note failed its integrity check.');
      check(draft.sources.every(ref=>pdfs.has(ref.sourceId)), 'The backup is missing a referenced PDF.');
      restoredNotes.set(entry.id,{...draft,id:entry.id,updatedAt:entry.updatedAt});
    }
    const db = await database();
    const tx = db.transaction(stores,'readwrite'), done = completed(tx);
    let newPdfs=0,newNotes=0;
    const sourceStore=tx.objectStore('sources'), blobStore=tx.objectStore('blobs'), noteStore=tx.objectStore('notes');
    for(const [id,{source,pdf}] of pdfs) {
      const exists=sourceStore.count(id);
      exists.onsuccess=()=>{if(!exists.result){sourceStore.add(source,id);blobStore.add(pdf,id);newPdfs++}};
    }
    for(const [id,note] of restoredNotes) {
      const exists=noteStore.count(id);
      exists.onsuccess=()=>{if(!exists.result){noteStore.add(note,id);newNotes++}};
    }
    await done;
    return {sources:newPdfs,notes:newNotes};
  }
  window.folioArchive = { exportBackup, restoreBackup };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init = {}) {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    try {
      const req = input instanceof Request ? input : null;
      return await localAPI(url.pathname, (init.method || req?.method || 'GET').toUpperCase(),
        new Headers(init.headers || req?.headers), init.body ?? req?.body);
    } catch (err) {
      const message = err.name === 'QuotaExceededError' ? 'Browser storage is full. Free space or use the hosted edition.'
        : (err.name === 'SecurityError' ? 'Allow browser storage for this file, or open it in another browser.' : err.message);
      return Response.json({ error: message }, { status: err.status || 400 });
    }
  };

  // Make ordinary PDF anchors work with keyboard navigation, browser menus and page fragments.
  const pdfUrls = new Map();
  const selector = 'a[href^="/api/sources/"]';
  function bindPDF(anchor) {
    const url = new URL(anchor.getAttribute('href'), location.href);
    if (!pdfUrls.has(url.pathname)) {
      pdfUrls.set(url.pathname, fetch(url.pathname).then(async response => {
        if (!response.ok) throw new Error('This original PDF is unavailable.');
        return URL.createObjectURL(await response.blob());
      }).catch(error => { pdfUrls.delete(url.pathname); throw error; }));
    }
    return pdfUrls.get(url.pathname).then(blobUrl => { anchor.href = blobUrl + url.hash; });
  }
  function updatePDFs(root) {
    const links = root.matches?.(selector) ? [root] : root.querySelectorAll?.(selector) || [];
    for (const anchor of links) bindPDF(anchor).catch(() => {});
  }
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) updatePDFs(node);
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.(selector);
    if (!anchor) return;
    event.preventDefault();
    const tab = window.open('about:blank', '_blank');
    if (tab) tab.opener = null;
    bindPDF(anchor).then(() => {
      if (tab) tab.location.replace(anchor.href);
      else location.assign(anchor.href);
    }).catch(error => { tab?.close(); alert(error.message); });
  }, true);
}

const modules = new Map();
const allowedPath = (from, reference) => {
  const absolute = reference.startsWith('/') ? path.join(dist, reference) : path.resolve(from, reference);
  if (!absolute.startsWith(dist + path.sep)) throw new Error('Asset outside dist: ' + reference);
  return absolute;
};
const types = { '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.ico':'image/x-icon' };
async function inlineFiles(text, regex, replacer) {
  const matches = [...text.matchAll(regex)];
  const replacements = await Promise.all(matches.map(m => replacer(...m)));
  let result = '', end = 0;
  for (const [i, match] of matches.entries()) {
    result += text.slice(end, match.index) + replacements[i];
    end = match.index + match[0].length;
  }
  return result + text.slice(end);
}
const dataUri = (str, type) => 'data:' + type + ';base64,' + Buffer.from(str).toString('base64');
async function inlineCss(file, parents = []) {
  if (parents.includes(file)) throw new Error('Circular stylesheet import: ' + file);
  const raw = await readFile(file, 'utf8');
  const css = await inlineFiles(raw, /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*;/gi, async (_, ref) => {
    if (/^https?:/i.test(ref)) return '';
    return inlineCss(allowedPath(path.dirname(file),ref), [...parents, file]);
  });
  const result = await inlineFiles(css, /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/g, async (whole, quoted, singleQuoted, bare) => {
    const ref = quoted ?? singleQuoted ?? bare;
    if (ref.startsWith('data:') || ref.startsWith('#')) return whole;
    if (/^https?:/.test(ref)) throw new Error('Portable edition needs a local CSS asset: ' + ref);
    const dest = allowedPath(path.dirname(file), ref);
    const mime = types[path.extname(dest)];
    if (!mime) throw new Error('Unknown CSS asset: ' + ref);
    return 'url("' + dataUri(await readFile(dest), mime) + '")';
  });
  return result.replace(/<\/style/gi, '<\\/style');
}
// Restrict bundling to the static relative imports used by the client entry point.
// Bare module names let an import map resolve dependencies between inline data URLs.
async function moduleKey(file) {
  const key = '@folio/' + path.relative(dist, file).split(path.sep).join('/');
  if (modules.has(key)) return key;
  modules.set(key, '');
  const js = await readFile(file, 'utf8');
  const linked = await inlineFiles(js, /((?:^|\n)\s*(?:import|export)\s+(?:[^'";]*?\s+from\s*)?["'])(\.\.?\/[^'"]+)(["'])/g,
    async (_, prefix, ref, end) => prefix + await moduleKey(allowedPath(path.dirname(file),ref)) + end);
  modules.set(key, dataUri(linked, 'text/javascript'));
  return key;
}

export async function buildPortable(output = path.join(root, 'portable', 'Folio.html')) {
  modules.clear();
  const { courses } = await import(pathToFileURL(path.join(dist, 'content.js')));
  let html = await readFile(path.join(dist, 'index.html'), 'utf8');
  html = await inlineFiles(html, /<link\b[^>]*>/gi, async tag => {
    const href = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href) return tag;
    if (/\brel\s*=\s*["']stylesheet["']/i.test(tag)) {
      if (/^https?:\/\//i.test(href)) return '';
      return '<style>' + await inlineCss(allowedPath(dist, href)) + '</style>';
    }
    if (/\brel\s*=\s*["'](?:preconnect|dns-prefetch|modulepreload|preload)["']/i.test(tag)) return '';
    if (/\brel\s*=\s*["'](?:icon|apple-touch-icon)["']/i.test(tag) && !href.startsWith('data:')) {
      const file = allowedPath(dist, href);
      return tag.replace(href, dataUri(await readFile(file), types[path.extname(file)]));
    }
    return tag;
  });
  let count = 0;
  html = await inlineFiles(html, /<script\b([^>]*)>\s*<\/script\s*>/gi, async (tag, attrs) => {
    const src = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src || !/\btype\s*=\s*["']module["']/i.test(attrs)) return tag;
    count++;
    const main = await moduleKey(allowedPath(dist, src));
    return '<script>('+installPortableArchive.toString()+')('+JSON.stringify(courses.map(c => c.id))+');</script>\n'
      + '<script type="importmap">'+JSON.stringify({ imports: Object.fromEntries(modules) })+'</script>\n'
      + '<script type="module">import '+JSON.stringify(main)+';</script>';
  });
  if (count !== 1) throw new Error('Expected one module entry point; found ' + count);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, html);
  return { output, modules: modules.size, bytes: Buffer.byteLength(html) };
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  console.log(await buildPortable(process.argv[2] && path.resolve(process.argv[2])));
}
