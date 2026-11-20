import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from './server.mjs';

function environment() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./drizzle/0000_archive.sql', import.meta.url), 'utf8'));
  const files = new Map();
  return {
    DB: { prepare(sql) {
      const stmt = db.prepare(sql);
      return { bind(...params) {
        return {
          first: async () => stmt.get(...params),
          all: async () => ({ results: stmt.all(...params) }),
          run: async () => stmt.run(...params),
        };
      } };
    } },
    BUCKET: {
      async put(id, bytes) { files.set(id, bytes.slice()); },
      async get(id) {
        const bytes = files.get(id);
        return bytes && { body: bytes, arrayBuffer: async () => bytes.buffer };
      },
    },
  };
}
const fakePdf = '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF';

function api(env, path, { user = 'learner', raw, data, name, origin } = {}) {
  const headers = new Headers();
  if (user) headers.set('oai-authenticated-user-id', user);
  if (origin) headers.set('origin', origin);
  let body;
  if (raw !== undefined) {
    headers.set('x-file-name', encodeURIComponent(name ?? 'Semidirect products.pdf'));
    headers.set('content-type', 'application/pdf');
    body = raw;
  } else if (data !== undefined) {
    headers.set('content-type', 'application/json');
    body = JSON.stringify(data);
  }
  return worker.fetch(new Request('https://archive.example' + path, { headers, method: body === undefined ? 'GET' : 'POST', body }), env);
}
function example(id) {
  return {
    courseId: 'algebra', title: 'Actions and products', summary: 'An action gives a semidirect product.',
    sections: [{ heading: 'Group law', body: 'Apply the action to the normal factor.' }],
    sources: [{ sourceId: id, page: 1 }],
  };
}

test('upload, cite, publish and reopen a note across archive sessions', async () => {
  const env = environment();
  assert.equal((await api(env, '/api/state', { user: null })).status, 401);
  assert.equal((await api(env, '/api/sources', { raw: fakePdf, origin: 'https://outside.example' })).status, 403);
  assert.equal((await api(env, '/api/sources', { raw: 'not a PDF' })).status, 415);
  const file = await api(env, '/api/sources', { raw: fakePdf, name: "Artiń's notes.pdf" });
  assert.equal(file.status, 201);
  const { source } = await file.json();
  assert.equal(source.name, "Artiń's notes.pdf");
  const retry = await api(env, '/api/sources', { raw: fakePdf });
  assert.deepEqual((await retry.json()).source, source);
  const resource = await api(env, '/api/sources/' + source.id);
  assert.match(resource.headers.get('content-disposition'), /%27/);
  assert.equal(await resource.text(), fakePdf);
  const draft = example(source.id);
  assert.equal((await api(env, '/api/notes', { data: { draft: { ...draft, sources: [{ sourceId: source.id, page: 0 }] } } })).status, 400);
  const result = await api(env, '/api/notes', { data: { draft } });
  assert.equal(result.status, 201);
  const { note } = await result.json();
  const second = await api(env, '/api/notes', { data: { draft } });
  assert.deepEqual((await second.json()).note, note);
  const archive = await (await api(env, '/api/state')).json();
  assert.deepEqual(archive.notes, [note]);
  assert.deepEqual(archive.sources, [source]);
  assert.equal(archive.aiConfigured, false);
  assert.equal((await api(env, '/api/generate', { data: {} })).status, 503);
  assert.equal((await api(env, '/api/sources/' + source.id, { user: 'someone-else' })).status, 404);
  assert.equal((await api(env, '/api/notes', { user: 'someone-else', data: { draft } })).status, 400);
  assert.deepEqual((await (await api(env, '/api/state', { user: 'someone-else' })).json()).notes, []);
});

test('generate submits PDF bytes and prompt to Responses, preserves citations, and leaves publication to review', async t => {
  const env = { ...environment(), OPENAI_API_KEY: 'fixture-key', OPENAI_MODEL: 'fixture-model' };
  const { source } = await (await api(env, '/api/sources', { raw: fakePdf })).json();
  const generated = example(source.id);
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const request = JSON.parse(init.body);
    assert.equal(request.model, 'fixture-model');
    assert.equal(request.store, false);
    assert.equal(request.text.format.strict, true);
    const pdf = request.input[0].content.find(part => part.type === 'input_file');
    assert.equal(pdf.filename, source.name);
    assert.equal(Buffer.from(pdf.file_data.split(',')[1], 'base64').toString(), fakePdf);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(generated) }] }] });
  });
  const data = { sourceIds: [source.id], courseId: 'algebra', prompt: 'Explain the action.' };
  const answer = await api(env, '/api/generate', { data });
  assert.equal(answer.status, 200);
  assert.deepEqual((await answer.json()).draft.sources, generated.sources);
  generated.sources = [{ sourceId: 'uncited-file', page: 1 }];
  assert.equal((await api(env, '/api/generate', { data })).status, 422);
  const empty = await (await api(env, '/api/state')).json();
  assert.equal(empty.notes.length, 0);
  assert.equal(empty.aiConfigured, true);
});
