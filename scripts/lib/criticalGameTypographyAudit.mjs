import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

export function codePointsFromRanges(ranges) {
  const result = new Set();
  for (const match of ranges.matchAll(/U\+([\da-f]+)(?:-([\da-f]+))?/gi)) {
    const start = parseInt(match[1], 16), end = parseInt(match[2] ?? match[1], 16);
    for (let cp = start; cp <= end; cp++) result.add(cp);
  }
  return result;
}
export function fontFaces(css) {
  return [...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, body]) => ({
    url: body.match(/url\(([^)]+)\)/)[1],
    codePoints: codePointsFromRanges(body.match(/unicode-range:\s*([^;]+)/)[1])
  }));
}
export function extractFixedHangul(source, fileName) {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const glyphs = new Set();
  function visit(node) {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      for (const c of node.text.normalize('NFC').match(/\p{Script=Hangul}/gu) ?? []) glyphs.add(c.codePointAt(0));
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return glyphs;
}
export async function collectFixedGameHangul(root) {
  const glyphs = new Set(), files = [];
  async function scan(dir) {
    for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await scan(file);
      else if (/\.(ts|tsx)$/.test(file) && !/\.(test|spec|d)\./.test(file) && !/gameTypography|gameTypographyGlyphs/.test(file)) {
        const chars = extractFixedHangul(await readFile(path.join(root, file), 'utf8'), file);
        if (chars.size) files.push(file);
        for (const cp of chars) glyphs.add(cp);
      }
    }
  }
  await scan('client/src'); await scan('shared/src');
  return { glyphs, files: files.sort() };
}
