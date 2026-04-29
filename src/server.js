import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const appName = process.env.APP_NAME || "9router";
const port = Number(process.env.PORT || 3000);
const projectDir = fileURLToPath(new URL("..", import.meta.url));
const rootDir = join(projectDir, "public");
const defaultDataFile = process.env.DATA_FILE || join(projectDir, "data", "state.json");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

const defaultState = {
  providers: [
    {
      id: "openai",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      models: ["gpt-4.1", "gpt-4.1-mini", "o4-mini"],
      priority: 1,
      enabled: true,
      fallback: true,
      status: "healthy",
      apiKey: ""
    },
    {
      id: "anthropic",
      name: "Anthropic",
      baseUrl: "https://api.anthropic.com",
      models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
      priority: 2,
      enabled: true,
      fallback: true,
      status: "healthy",
      apiKey: ""
    },
    {
      id: "google",
      name: "Google AI",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      models: ["gemini-1.5-pro", "gemini-1.5-flash"],
      priority: 3,
      enabled: false,
      fallback: true,
      status: "paused",
      apiKey: ""
    }
  ],
  tracker: {
    totals: {
      requests: 18420,
      tokens: 9824000,
      costUsd: 142.36,
      errorRate: 1.8,
      avgLatencyMs: 842
    },
    series: [
      { label: "00:00", requests: 820, latencyMs: 760, errors: 9 },
      { label: "04:00", requests: 640, latencyMs: 710, errors: 7 },
      { label: "08:00", requests: 1680, latencyMs: 890, errors: 31 },
      { label: "12:00", requests: 2440, latencyMs: 940, errors: 48 },
      { label: "16:00", requests: 2140, latencyMs: 830, errors: 34 },
      { label: "20:00", requests: 1880, latencyMs: 810, errors: 23 }
    ],
    providers: [
      { id: "openai", requests: 10840, avgLatencyMs: 790, errorRate: 1.2, costUsd: 96.44 },
      { id: "anthropic", requests: 6120, avgLatencyMs: 910, errorRate: 2.1, costUsd: 40.31 },
      { id: "google", requests: 1460, avgLatencyMs: 720, errorRate: 3.4, costUsd: 5.61 }
    ],
    events: [
      { id: "evt-1", level: "info", message: "Fallback enabled for Anthropic", at: "2026-04-29T00:42:00.000Z" },
      { id: "evt-2", level: "warning", message: "Google AI provider is paused", at: "2026-04-29T00:31:00.000Z" },
      { id: "evt-3", level: "info", message: "OpenAI health check passed", at: "2026-04-29T00:18:00.000Z" }
    ]
  }
};

export function createApp(options = {}) {
  const dataFile = options.dataFile || defaultDataFile;

  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://localhost");

    if (url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/status") {
      sendJson(response, 200, {
        app: appName,
        ok: true,
        environment: process.env.NODE_ENV || "development"
      });
      return;
    }

    if (url.pathname === "/api/providers") {
      if (request.method === "GET") {
        const state = await loadState(dataFile);
        sendJson(response, 200, { providers: state.providers.map(maskProvider) });
        return;
      }

      if (request.method === "PUT") {
        const body = await readJson(request, response);
        if (!body) return;

        const validationError = validateProviders(body.providers);
        if (validationError) {
          sendJson(response, 422, { error: validationError });
          return;
        }

        const state = await loadState(dataFile);
        state.providers = body.providers.map((provider) => {
          const existing = state.providers.find((item) => item.id === provider.id);
          return normalizeProvider(provider, existing);
        });
        await saveState(dataFile, state);
        sendJson(response, 200, { providers: state.providers.map(maskProvider) });
        return;
      }
    }

    if (url.pathname === "/api/providers/test" && request.method === "POST") {
      const body = await readJson(request, response);
      if (!body) return;

      const state = await loadState(dataFile);
      const provider = state.providers.find((item) => item.id === body.id);

      if (!provider) {
        sendJson(response, 404, { error: "Provider not found" });
        return;
      }

      provider.status = provider.enabled ? "healthy" : "paused";
      await saveState(dataFile, state);
      sendJson(response, 200, {
        id: provider.id,
        ok: provider.enabled,
        status: provider.status,
        latencyMs: provider.enabled ? 420 + provider.priority * 120 : null
      });
      return;
    }

    if (url.pathname === "/api/tracker" && request.method === "GET") {
      const state = await loadState(dataFile);
      sendJson(response, 200, { tracker: state.tracker });
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    const filePath = getStaticFilePath(url.pathname);

    if (!filePath) {
      sendJson(response, 400, { error: "Bad request" });
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": contentTypes.get(extname(filePath)) || "application/octet-stream"
      });

      if (request.method !== "HEAD") {
        response.end(body);
      } else {
        response.end();
      }
    } catch {
      sendJson(response, 404, { error: "Not found" });
    }
  });
}

async function loadState(dataFile) {
  try {
    const body = await readFile(dataFile, "utf8");
    return { ...defaultState, ...JSON.parse(body) };
  } catch {
    await saveState(dataFile, defaultState);
    return structuredClone(defaultState);
  }
}

async function saveState(dataFile, state) {
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, `${JSON.stringify(state, null, 2)}\n`);
}

function maskProvider(provider) {
  return {
    ...provider,
    apiKey: provider.apiKey ? "********" : ""
  };
}

function normalizeProvider(provider, existing = {}) {
  return {
    id: String(provider.id).trim(),
    name: String(provider.name).trim(),
    baseUrl: String(provider.baseUrl).trim(),
    models: provider.models.map((model) => String(model).trim()).filter(Boolean),
    priority: Number(provider.priority),
    enabled: Boolean(provider.enabled),
    fallback: Boolean(provider.fallback),
    status: provider.enabled ? provider.status || "healthy" : "paused",
    apiKey: provider.apiKey === "********" ? existing.apiKey || "" : String(provider.apiKey || "")
  };
}

function validateProviders(providers) {
  if (!Array.isArray(providers)) return "providers must be an array";

  for (const provider of providers) {
    if (!provider.id || !provider.name || !provider.baseUrl) {
      return "provider id, name, and baseUrl are required";
    }

    if (!Array.isArray(provider.models)) {
      return "provider models must be an array";
    }

    try {
      new URL(provider.baseUrl);
    } catch {
      return `${provider.name} baseUrl must be a valid URL`;
    }
  }

  return null;
}

async function readJson(request, response) {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    sendJson(response, 400, { error: "Invalid JSON" });
    return null;
  }
}

function getStaticFilePath(pathname) {
  try {
    const requestPath = pathname === "/" ? "/index.html" : pathname;
    const decodedPath = decodeURIComponent(requestPath);
    const safePath = normalize(decodedPath).replace(/^[/\\]+/, "");
    const filePath = join(rootDir, safePath);

    return filePath.startsWith(rootDir) ? filePath : null;
  } catch {
    return null;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  createApp().listen(port, () => {
    console.log(`${appName} listening on port ${port}`);
  });
}
