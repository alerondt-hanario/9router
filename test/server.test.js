import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";

import { createApp } from "../src/server.js";

let server;
let baseUrl;
let tempDir;

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "9router-test-"));
  server = createApp({ dataFile: join(tempDir, "state.json") });
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(tempDir, { recursive: true, force: true });
});

test("serves the landing page", async () => {
  const response = await fetch(`${baseUrl}/`);
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(body, /9router is online/);
});

test("returns health status", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true });
});

test("returns API status", async () => {
  const response = await fetch(`${baseUrl}/api/status`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.app, "9router");
  assert.equal(body.ok, true);
});

test("returns editable providers without exposing API keys", async () => {
  const response = await fetch(`${baseUrl}/api/providers`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.providers.length, 3);
  assert.equal(body.providers[0].id, "openai");
  assert.equal(body.providers[0].apiKey, "");
});

test("updates providers", async () => {
  const providersResponse = await fetch(`${baseUrl}/api/providers`);
  const { providers } = await providersResponse.json();
  const [firstProvider, ...rest] = providers;

  const response = await fetch(`${baseUrl}/api/providers`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providers: [
        {
          ...firstProvider,
          enabled: false,
          apiKey: "secret-key"
        },
        ...rest
      ]
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.providers[0].enabled, false);
  assert.equal(body.providers[0].status, "paused");
  assert.equal(body.providers[0].apiKey, "********");
});

test("returns tracker metrics", async () => {
  const response = await fetch(`${baseUrl}/api/tracker`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.tracker.totals.requests, "number");
  assert.ok(body.tracker.series.length > 0);
});

test("tests provider connectivity", async () => {
  const response = await fetch(`${baseUrl}/api/providers/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: "anthropic" })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.id, "anthropic");
  assert.equal(body.ok, true);
});

test("rejects malformed paths", async () => {
  const response = await fetch(`${baseUrl}/%E0%A4%A`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "Bad request" });
});
