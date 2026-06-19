import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 41731;
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json"
};

export function resolveRequestPath(projectRoot, requestUrl = "/") {
  const rawPathname = requestUrl.split("?")[0] || "/";
  let pathname;
  try {
    pathname = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  const route = pathname === "/" ? "/tools/character-pixel-editor/index.html" : pathname;
  const file = resolve(projectRoot, `.${route.startsWith("/") ? route : `/${route}`}`);
  const relativePath = relative(projectRoot, file);
  if (relativePath.startsWith("..") || isAbsolute(relativePath)) return null;
  return file;
}

export function createCharacterEditorServer(projectRoot = root) {
  return createServer(async (request, response) => {
    const file = resolveRequestPath(projectRoot, request.url);
    if (!file) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const metadata = await stat(file);
      if (!metadata.isFile()) throw new Error("Not a file");
      response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
      createReadStream(file).pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  createCharacterEditorServer().listen(port, "127.0.0.1", () => {
    console.log(`Character pixel editor: http://127.0.0.1:${port}`);
  });
}
