import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const appName = process.env.APP_NAME || "9router";
const port = Number(process.env.PORT || 3000);
const rootDir = join(fileURLToPath(new URL("..", import.meta.url)), "public");

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

export function createApp() {
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
