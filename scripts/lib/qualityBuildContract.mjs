import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const requiredRootFiles = Object.freeze(["index.html", "manifest.webmanifest", "service-worker.js"]);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(entryPath) : entry.isFile() ? [entryPath] : [];
  }));
  return nested.flat();
}

async function sha256File(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function logicalPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function safeTarget(root, requestPath) {
  const pathname = decodeURIComponent(new URL(requestPath, "http://quality.test").pathname);
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const target = path.resolve(root, relative);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`unsafe runtime path: ${pathname}`);
  return target;
}

function runtimeReferences(html) {
  return [...String(html).matchAll(/(?:src|href)=["'](?:\.\/|\/)?([^"'#?]+)["']/g)]
    .map(([, value]) => value)
    .filter((value) => value.startsWith("assets/") || value.startsWith("src/"));
}

export async function validateQualityBuildPackage({ packageDir, expectedSha }) {
  const manifest = JSON.parse(await readFile(path.join(packageDir, "quality-build-manifest.json"), "utf8"));
  if (manifest.version !== 1 || manifest.sha !== expectedSha) {
    throw new Error(`공통 빌드 manifest 불일치: ${manifest.sha ?? "missing"} != ${expectedSha}`);
  }
  if (!Array.isArray(manifest.variants) || !["production", "device"].every((item) => manifest.variants.includes(item))) {
    throw new Error("공통 빌드 production/device 변형이 완전하지 않습니다.");
  }
  for (const variant of ["production", "device"]) {
    if (!Number.isFinite(manifest.buildDurationsMs?.[variant]) || manifest.buildDurationsMs[variant] <= 0) {
      throw new Error(`공통 빌드 ${variant} 생성 시간 누락`);
    }
  }
  const generatedDir = path.join(packageDir, "generated-characters");
  const generatedFiles = (await filesBelow(generatedDir)).sort();
  if (generatedFiles.length === 0) throw new Error("공통 빌드 generated 캐릭터가 비어 있습니다.");
  const generated = await Promise.all(generatedFiles.map(async (filePath) => ({
    logicalPath: logicalPath(generatedDir, filePath),
    size: (await stat(filePath)).size,
    sha256: await sha256File(filePath)
  })));
  const variants = {};
  for (const variant of manifest.variants) {
    const variantDir = path.join(packageDir, variant);
    for (const required of requiredRootFiles) await stat(path.join(variantDir, required));
    const indexHtml = await readFile(path.join(variantDir, "index.html"), "utf8");
    const references = runtimeReferences(indexHtml).filter((reference) => reference.startsWith("assets/"));
    if (references.length === 0) throw new Error(`${variant} 빌드 진입 번들이 없습니다.`);
    for (const reference of references) await stat(path.join(variantDir, reference));
    for (const asset of generated) {
      const target = path.join(variantDir, "characters/generated", asset.logicalPath);
      const targetStat = await stat(target).catch(() => null);
      if (!targetStat || targetStat.size !== asset.size || await sha256File(target) !== asset.sha256) {
        throw new Error(`${variant} 런타임 캐릭터 불일치: ${asset.logicalPath}`);
      }
    }
    variants[variant] = { references, generatedAssets: generated.length };
  }
  return { manifest, generated, variants };
}

export async function probeQualityRuntime({ baseUrl, generatedPaths, requireServiceWorker }) {
  const request = async (relative) => {
    const response = await fetch(new URL(relative, baseUrl), { headers: { "cache-control": "no-cache" } });
    if (!response.ok) throw new Error(`runtime HTTP ${response.status}: ${relative}`);
    return response;
  };
  const html = await (await request("./")).text();
  if (!/<div\s+id=["']root["']/.test(html)) throw new Error("runtime root 누락");
  const references = runtimeReferences(html);
  if (references.length === 0) throw new Error("runtime 진입 번들 누락");
  for (const reference of references.slice(0, 8)) await request(reference);
  await request("manifest.webmanifest");
  if (requireServiceWorker) await request("service-worker.js");
  const samples = [...new Set([generatedPaths[0], generatedPaths.at(-1)].filter(Boolean))];
  for (const generatedPath of samples) await request(`characters/generated/${generatedPath}`);
  return { referencesChecked: Math.min(8, references.length), generatedSamplesChecked: samples.length };
}

export async function withStaticQualityServer(rootDir, callback) {
  const server = http.createServer(async (request, response) => {
    try {
      const target = safeTarget(rootDir, request.url ?? "/");
      const body = await readFile(target);
      response.writeHead(200, { "cache-control": "no-store" });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/`;
  try {
    return await callback(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
