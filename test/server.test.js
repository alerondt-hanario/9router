import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { createApp } from "../src/server.js";

let server;
let baseUrl;

before(async () => {
  server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
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

test("rejects malformed paths", async () => {
  const response = await fetch(`${baseUrl}/%E0%A4%A`);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.deepEqual(body, { error: "Bad request" });
});
