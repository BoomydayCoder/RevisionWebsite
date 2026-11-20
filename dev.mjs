import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from './build.mjs';

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
  return { DB, BUCKET, close: () => db.close() };
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
      const response = await worker.fetch(new Request(url, init), env, {});
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
