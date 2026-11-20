import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localFetch, localHandler } from './dev.mjs';

test('only installed regular course files appear in the local notebook catalogue', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'folio-notebooks-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const env = { notebooksDirectory: join(dir, 'notebooks') };
  const worker = { fetch: () => Response.json({ sources: [], notes: [], aiConfigured: false }) };
  const get = (path, method = 'GET') => localFetch(worker, new Request('http://localhost' + path, { method }), env);
  assert.deepEqual((await (await get('/api/state')).json()).notebookCourses, []);
  await mkdir(env.notebooksDirectory);
  await writeFile(join(env.notebooksDirectory, 'analysis.html'), '<h1>Course notebook</h1>');
  await writeFile(join(env.notebooksDirectory, 'other.html'), '<p>Private scratch</p>');
  await symlink(join(env.notebooksDirectory, 'other.html'), join(env.notebooksDirectory, 'algebra.html'));
  assert.deepEqual(await (await get('/api/state')).json(), {
    sources: [], notes: [], aiConfigured: false, notebookCourses: ['analysis']
  });
  const notebook = await get('/notebooks/analysis');
  assert.equal(notebook.headers.get('content-type'), 'text/html; charset=utf-8');
  assert.equal(notebook.headers.get('cache-control'), 'private, no-store');
  assert.equal(await notebook.text(), '<h1>Course notebook</h1>');
  assert.equal(await (await get('/notebooks/analysis', 'HEAD')).text(), '');
  assert.equal((await get('/notebooks/analysis', 'POST')).status, 405);
  for (const path of ['/notebooks/other','/notebooks/algebra','/notebooks/analysis.html','/notebooks/analysis/extra']) {
    assert.equal((await get(path)).status, 404);
  }

  const rejected = { writeHead(code) { this.status = code; return this; }, end() {} };
  const request = { headers: { host: 'outside.example' }, socket: { address: () => ({ port: 4173 }) }, url: '/notebooks/analysis' };
  await localHandler(worker, env)(request, rejected);
  assert.equal(rejected.status, 403);
});
