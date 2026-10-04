import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectCriticalWeddingDisplaySources,
  criticalWeddingDisplaySourceCommit,
  writeCriticalWeddingDisplayManifest
} from "./lib/criticalWeddingDisplayAudit.mjs";

const googleFontsCommit = criticalWeddingDisplaySourceCommit;
const sourceBase = `https://raw.githubusercontent.com/google/fonts/${googleFontsCommit}/ofl/gowundodum`;
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fontDir = path.join(rootDir, "client/src/assets/fonts");
const corpusPath = path.join(fontDir, "gowun-dodum-critical.txt");
const extendedPath = path.join(fontDir, "gowun-dodum-extended.woff2");
const outputPath = path.join(fontDir, "gowun-dodum-critical.woff2");
const licensePath = path.join(fontDir, "gowun-dodum-OFL.txt");

async function download(url, output) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed: ${response.status} ${url}`);
  await writeFile(output, Buffer.from(await response.arrayBuffer()));
}

async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

async function subsetFont(args) {
  try {
    await run("pyftsubset", args);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await run("uvx", ["--with", "brotli", "--from", "fonttools", "pyftsubset", ...args]);
  }
}

await mkdir(fontDir, { recursive: true });
const currentCorpus = await readFile(corpusPath, "utf8");
const { requiredCodePoints } = await collectCriticalWeddingDisplaySources(rootDir);
// Spaces and printable Latin are used in every heading. Keep them in the
// critical face so its same-family full fallback is genuinely on demand.
const commonText = String.fromCodePoint(...Array.from({length:95},(_,i)=>i+32), 0xa0);
const missingCodePoints = [...new Set([...requiredCodePoints, ...commonText])].filter((character) => !currentCorpus.includes(character));
if (missingCodePoints.length > 0) {
  await writeFile(corpusPath, `${currentCorpus.trimEnd()}\n${missingCodePoints.join("")}\n`);
}
const temporaryDir = await mkdtemp(path.join(os.tmpdir(), "wedding-display-"));
try {
  const sourcePath = path.join(temporaryDir, "GowunDodum-Regular.ttf");
  await download(`${sourceBase}/GowunDodum-Regular.ttf`, sourcePath);
  await subsetFont([
    sourcePath,
    `--output-file=${outputPath}`,
    `--text-file=${corpusPath}`,
    "--flavor=woff2",
    "--no-ignore-missing-unicodes",
    "--layout-features=*",
    "--name-IDs=*",
    "--name-languages=*",
    "--drop-tables+=DSIG"
  ]);
  await subsetFont([
    sourcePath,
    `--output-file=${extendedPath}`,
    "--unicodes=*",
    "--flavor=woff2",
    "--layout-features=*",
    "--name-IDs=*",
    "--name-languages=*",
    "--drop-tables+=DSIG"
  ]);
  const hash = data => createHash("sha256").update(data).digest("hex");
  await writeFile(path.join(fontDir, "gowun-dodum-extended.manifest.json"), JSON.stringify({
    sourceCommit: googleFontsCommit,
    sourceSha256: hash(await readFile(sourcePath)),
    fontSha256: hash(await readFile(extendedPath))
  }, null, 2)+"\n");
  await download(`${sourceBase}/OFL.txt`, licensePath);
  const licenseText = await readFile(licensePath, "utf8");
  await writeFile(licensePath, licenseText.replace(/[ \t]+$/gmu, ""));
  await writeCriticalWeddingDisplayManifest(rootDir);
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}

console.log(`Critical wedding display font and manifest generated: ${path.relative(rootDir, outputPath)}`);
