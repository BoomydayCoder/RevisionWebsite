# Folio · MIT Revision

Folio turns a collection of notes and problem sets into a private, searchable course library. It starts with original revision pages for Algebra I, Real Analysis, The Early Universe and Introduction to Linguistics.

## From PDF to revision page

1. Add PDFs to your source collection. The archive keeps the original file so you can check a proof or a transcription later.
2. In the import studio, choose a course and the PDFs to use. Describe the result you want, for example, “Compare the two proofs of compactness, explain why each hypothesis is needed, and give me two retrieval questions.”
3. Generate a draft with the configured OpenAI API connection, or use the ChatGPT handoff. For the handoff, copy the prompt into ChatGPT, attach the selected PDFs, and paste the returned JSON into the studio.
4. Review the sections, proposed corrections, extensions and page references before adding the page to your course.

PDFs can be up to 24 MiB each. Direct generation accepts up to 16 selected PDFs totalling 12 MiB per request. For a long course pack, use chapter-sized batches and narrow the prompt. A citation points to the physical PDF page, counting the cover as page 1.

## Local preview

Use Node.js 24 or later. The app has no package dependencies.

```sh
node dev.mjs
```

Open the printed local URL. The preview binds to loopback and keeps a single development workspace in `.local-data/`. Restart the preview after changing source files. Set `PORT` to change the port or `FOLIO_DATA_DIR` to use another data directory. Back up that directory to preserve your local sources and notes together.

To enable direct generation, supply `OPENAI_API_KEY` in the server process environment. The optional `OPENAI_MODEL` selects a Responses API model that supports PDF input and structured outputs. API usage is billed to the configured account. The default ChatGPT handoff works without a server key. Keep secrets in your environment or the host’s secret manager.

```sh
node --test
node build.mjs
```

## Hosting and source layout

The application is a Cloudflare Worker ES module. The build embeds browser assets into `dist/server/index.js` and validates that it can serve the app shell. Browser source lives directly under `dist/`. Generated files live under `dist/server/` and `dist/.openai/`.

Private ChatGPT Sites hosting provides the authenticated visitor identity, D1 binding `DB` and R2 binding `BUCKET`. The archive scopes each source and note to its owner. The SQL migration and journal live in `drizzle/`. The deployable archive includes the migration alongside the built hosting manifest. For another hosting environment, provide equivalent bindings and have a trusted authentication gateway set the identity header after discarding any value sent by the client.

GitHub holds the application source. Uploaded PDFs and published revision pages are stored in the archive database and file store. A server runtime is required to serve uploads and generated notes.
