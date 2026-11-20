import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

async function collectAssets(directory, assets, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
  for (const entry of entries) {
    if (entry.name.startsWith('.') || (!prefix && entry.name === 'server')) continue;
    const url = prefix + '/' + entry.name;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectAssets(path, assets, url);
      continue;
    }
    const mime = types[extname(entry.name).toLowerCase()];
    if (!entry.isFile() || !mime) continue;
    const binary = !mime.startsWith('text/') && mime !== 'application/json' && mime !== 'image/svg+xml';
    assets[url] = { mime, binary, body: await readFile(path, binary ? 'base64' : 'utf8') };
  }
}

// This function is copied into the emitted Worker. Keep it independent of Node APIs.
function serveStatic(request, assets, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const spaRoute = !pathname.split('/').some(part => part.includes('.')) &&
    (request.headers.get('accept') || '').includes('text/html');
  const file = assets[pathname] || ((pathname === '/' || spaRoute) && assets['/index.html']);
  if (!file || !file.mime) return new Response('File not found', { status: 404 });
  const headers = {
    'Content-Type': file.mime,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
    'Referrer-Policy': 'same-origin'
  };
  if (request.method === 'HEAD') return new Response(null, { headers });
  const body = file.binary ? Uint8Array.from(atob(file.body), character => character.charCodeAt(0)) : file.body;
  return new Response(body, { headers });
}

export async function build() {
  const assets = Object.create(null);
  const dir = resolve(root, 'dist');
  await collectAssets(dir, assets);
  assert.ok(assets['/index.html'], 'Missing dist/index.html.');
  const server = await readFile(resolve(root, 'server.mjs'), 'utf8');
  assert.match(server, /^export default /m, 'server.mjs must default-export a Worker.');
  const manifest = await readFile(resolve(root, '.openai/hosting.json'), 'utf8');
  const config = JSON.parse(manifest);
  assert.ok(config.project_id && config.d1 === 'DB' && config.r2 === 'BUCKET' && !config.static);
  const worker = [
    server.replace(/^export default /m, 'const folioApi = '),
    'const folioPublicFiles = ' + JSON.stringify(assets) + ';',
    serveStatic.toString(),
    `export default {
      fetch(request, env, ctx) {
        const pathname = new URL(request.url).pathname;
        if (pathname === '/api' || pathname.startsWith('/api/')) return folioApi.fetch(request, env, ctx);
        return serveStatic(request, folioPublicFiles, pathname);
      }
    };`
  ].join('\n');
  await Promise.all([mkdir(resolve(dir, 'server'), { recursive: true }), mkdir(resolve(dir, '.openai'), { recursive: true })]);
  // Verify Worker syntax and its shell before replacing a previous build.
  const module = await import('data:text/javascript;base64,' + Buffer.from(worker).toString('base64'));
  const shell = await module.default.fetch(new Request('http://localhost/'), {});
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('content-type'), /text\/html/);
  const output = resolve(dir, 'server/index.js');
  const temp = output + '.' + process.pid + '.tmp';
  await writeFile(temp, worker);
  await rename(temp, output);
  await writeFile(resolve(dir, '.openai/hosting.json'), manifest);
  return { assets: Object.keys(assets).length, output };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { assets, output } = await build();
  console.log(`Built and checked ${output} with ${assets} frontend files.`);
}
