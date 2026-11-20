import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from './build.mjs';
import { courses } from './dist/content.js';

const root = fileURLToPath(new URL('.', import.meta.url));

// The hosted Worker receives D1 and R2 bindings from Sites. The local preview
// matches the small subset of those APIs used by the archive.
export async function localBindings(dataDir) {
  await mkdir(resolve(dataDir, 'files'), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(resolve(dataDir, 'archive.sqlite'));
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('CREATE TABLE IF NOT EXISTS local_migrations (tag TEXT PRIMARY KEY NOT NULL)');
    const journal = JSON.parse(await readFile(resolve(root, 'drizzle/meta/_journal.json'), 'utf8'));
    for (const { tag } of journal.entries) {
      const sql = await readFile(resolve(root, 'drizzle', tag + '.sql'), 'utf8');
      db.exec('BEGIN IMMEDIATE');
      try {
        if (!db.prepare('SELECT tag FROM local_migrations WHERE tag = ?').get(tag)) {
          db.exec(sql);
          db.prepare('INSERT INTO local_migrations (tag) VALUES (?)').run(tag);
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  } catch (error) {
    db.close();
    throw error;
  }
  const DB = {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...values) {
          return {
            first: async () => statement.get(...values) ?? null,
            all: async () => ({ results: statement.all(...values) }),
            run: async () => { statement.run(...values); return { success: true }; }
          };
        }
      };
    }
  };
  const objectPath = key => resolve(dataDir, 'files', createHash('sha256').update(key).digest('hex'));
  const BUCKET = {
    async put(key, bytes) {
      const destination = objectPath(key);
      const temporary = destination + '.' + randomUUID() + '.tmp';
      await writeFile(temporary, bytes, { mode: 0o600 });
      await rename(temporary, destination);
    },
    async get(key) {
      try {
        const bytes = await readFile(objectPath(key));
        return {
          body: bytes,
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
        };
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }
  };
  return { DB, BUCKET, notebooksDirectory: resolve(dataDir, 'notebooks'), close: () => db.close() };
}

// The operator installs optional authored notebooks in the local archive. Uploaded
// PDFs and notes have separate storage and cannot create a notebook HTML route.
export async function localFetch(worker, request, env) {
  const { pathname } = new URL(request.url);
  const isNotebook = pathname === '/notebooks' || pathname.startsWith('/notebooks/');
  const isState = pathname === '/api/state' && request.method === 'GET';
  if (!isNotebook && !isState) return worker.fetch(request, env, {});
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  let entries = [];
  if (env.notebooksDirectory) {
    try { entries = await readdir(env.notebooksDirectory, { withFileTypes: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const files = new Set(entries.filter(entry => entry.isFile()).map(entry => entry.name));
  const notebookCourses = courses.map(course => course.id).filter(id => files.has(id + '.html'));
  if (isState) {
    const response = await worker.fetch(request, env, {});
    if (!response.ok) return response;
    return Response.json({ ...await response.json(), notebookCourses }, { headers });
  }
  const id = notebookCourses.find(course => pathname === '/notebooks/' + course);
  if (!id) return new Response('Notebook unavailable', { status: 404, headers });
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
  }
  headers['Content-Type'] = 'text/html; charset=utf-8';
  if (request.method === 'HEAD') return new Response(null, { headers });
  try { return new Response(await readFile(resolve(env.notebooksDirectory, id + '.html')), { headers }); }
  catch (error) {
    if (error.code === 'ENOENT') return new Response('Notebook unavailable', { status: 404, headers });
    throw error;
  }
}

export function localHandler(worker, env) {
  return async (incoming, outgoing) => {
    try {
      const { port } = incoming.socket.address();
      const host = incoming.headers.host;
      if (host !== '127.0.0.1:' + port && host !== 'localhost:' + port) {
        outgoing.writeHead(403).end('Use the local preview URL.');
        return;
      }
      if (!incoming.url.startsWith('/') || incoming.url.startsWith('//')) {
        outgoing.writeHead(400).end('Invalid path');
        return;
      }
      const url = new URL(incoming.url, 'http://' + host);
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value != null) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      // Only the loopback preview has a fixed development identity.
      headers.set('oai-authenticated-user-id', 'local-student');
      const init = { method: incoming.method, headers };
      if (!['GET', 'HEAD'].includes(incoming.method)) {
        init.body = Readable.toWeb(incoming);
        init.duplex = 'half';
      }
      const response = await localFetch(worker, new Request(url, init), env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
    } catch (error) {
      if (!outgoing.headersSent) outgoing.writeHead(500);
      outgoing.end();
      if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.error('Local preview failed:', error.message);
    }
  };
}

async function startPreview() {
  const port = Number(process.env.PORT || 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT.');
  const { output } = await build();
  const { default: worker } = await import(pathToFileURL(output));
  const storage = await localBindings(resolve(process.env.FOLIO_DATA_DIR || resolve(root, '.local-data')));
  const env = { ...storage, OPENAI_API_KEY: process.env.OPENAI_API_KEY, OPENAI_MODEL: process.env.OPENAI_MODEL };
  const server = createServer(localHandler(worker, env));
  server.on('close', storage.close);
  try {
    await new Promise((ok, fail) => {
      server.once('error', fail);
      server.listen(port, '127.0.0.1', ok);
    });
  } catch (error) {
    storage.close();
    throw error;
  }
  console.log(`Local: http://127.0.0.1:${server.address().port}/`);
  process.once('SIGINT', () => server.close());
  process.once('SIGTERM', () => server.close());
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startPreview();
}
