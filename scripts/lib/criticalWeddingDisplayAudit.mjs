import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

export const criticalWeddingDisplaySourceCommit = "73fc2ff52147e34a74804b500cf89ca219eac55d";

export const criticalWeddingDisplaySourceFiles = Object.freeze([
  "client/src/components/EntryScreen.tsx",
  "client/src/components/QuickInvitation.tsx",
  "client/src/components/FamilyContactSheet.tsx",
  "client/src/components/InvitationShareAccess.tsx",
  "client/src/components/GuestInformationAccess.tsx",
  "client/src/components/DirectionsSheet.tsx",
  "client/src/components/GiftAccountSheet.tsx",
  "client/src/components/WeddingDayQuickAccess.tsx",
  "client/src/components/CalendarSaveSheet.tsx",
  "client/src/components/ViewSettingsAccess.tsx",
  "client/src/components/CharacterCustomizer.tsx",
  "client/src/components/GameWorld.tsx",
  "client/src/components/WeddingPhotoBooth.tsx",
  "client/src/components/WeddingPhotoAlbum.tsx",
  "client/src/components/CelebrationCollectionGuide.tsx",
  "client/src/components/CompanionWaitingRoom.tsx",
  "client/src/components/GameMemoryAlbum.tsx",
  "client/src/components/GameFirstVisitGuide.tsx",
  "client/src/components/CompanionDestinationSheet.tsx",
  "client/src/components/WorldMiniMap.tsx",
  "client/src/components/JourneyCompletion.tsx",
  "client/src/game/world.ts",
  "shared/src/content.ts"
]);

const componentTitleProps = new Map([
  ["BottomSheet", new Set(["title"])],
  ["SectionHeading", new Set(["title"])]
]);
const worldCallLabelIndexes = new Map([
  ["spot", 1],
  ["portal", 1],
  ["photoSpot", 2],
  ["decoration", 2],
  ["foregroundDecoration", 3]
]);
const sharedContentProperties = new Set(["bride", "groom", "name", "hall", "title", "label"]);

function stringParts(node) {
  if (ts.isStringLiteralLike(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    return [node.head.text, ...node.templateSpans.flatMap((span) => [span.literal.text])];
  }
  if (ts.isJsxExpression(node) && node.expression) return stringParts(node.expression);
  if (ts.isJsxText(node)) return [node.getText()];
  return [];
}

function jsxTagName(node) {
  return ts.isIdentifier(node.tagName) ? node.tagName.text : node.tagName.getText();
}

function propertyName(node) {
  return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : node.getText();
}

export function normalizeCriticalCodePoints(text) {
  return [...new Set([...text].filter((character) => !/\s/u.test(character)))].sort().join("");
}

export function extractCriticalWeddingDisplayText(sourceText, fileName = "source.tsx") {
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const values = [];
  const collectJsxChildren = (children) => {
    for (const child of children) {
      values.push(...stringParts(child));
      if (ts.isJsxElement(child)) collectJsxChildren(child.children);
      if (ts.isJsxFragment(child)) collectJsxChildren(child.children);
    }
  };
  const visit = (node) => {
    if (ts.isJsxElement(node)) {
      const tag = jsxTagName(node.openingElement);
      if (tag === "h1" || tag === "h2") collectJsxChildren(node.children);
    }
    if (ts.isJsxOpeningLikeElement(node)) {
      const tag = jsxTagName(node);
      const allowed = componentTitleProps.get(tag);
      if (allowed) {
        for (const attribute of node.attributes.properties) {
          if (!ts.isJsxAttribute(attribute) || !attribute.initializer || !allowed.has(attribute.name.text)) continue;
          values.push(...stringParts(attribute.initializer));
        }
      }
    }
    if (fileName.endsWith("client/src/game/world.ts") && ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const labelIndex = worldCallLabelIndexes.get(node.expression.text);
      if (labelIndex !== undefined && node.arguments[labelIndex]) values.push(...stringParts(node.arguments[labelIndex]));
    }
    if (fileName.endsWith("client/src/game/world.ts") && ts.isPropertyAssignment(node) && propertyName(node.name) === "label") {
      values.push(...stringParts(node.initializer));
    }
    if (fileName.endsWith("shared/src/content.ts") && ts.isPropertyAssignment(node) && sharedContentProperties.has(propertyName(node.name))) {
      values.push(...stringParts(node.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return values.join("\n");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export async function collectCriticalWeddingDisplaySources(rootDir) {
  const sourceEntries = await Promise.all(criticalWeddingDisplaySourceFiles.map(async (relativePath) => {
    const sourceText = await readFile(path.join(rootDir, relativePath), "utf8");
    return { relativePath, text: extractCriticalWeddingDisplayText(sourceText, relativePath) };
  }));
  const requiredCodePoints = normalizeCriticalCodePoints(sourceEntries.map(({ text }) => text).join("\n"));
  return { sourceEntries, requiredCodePoints, requiredTextSha256: sha256(requiredCodePoints) };
}

export function createCriticalWeddingDisplayManifest({ corpus, font, requiredCodePoints, sourceFileCount }) {
  const normalizedCorpus = normalizeCriticalCodePoints(corpus);
  return {
    version: 1,
    sourceCommit: criticalWeddingDisplaySourceCommit,
    corpusSha256: sha256(corpus),
    fontSha256: sha256(font),
    requiredTextSha256: sha256(requiredCodePoints),
    corpusCodePointCount: [...normalizedCorpus].length,
    requiredCodePointCount: [...requiredCodePoints].length,
    sourceFileCount
  };
}

export function auditCriticalWeddingDisplay({ corpus, font, manifest, requiredCodePoints }) {
  const issues = [];
  const normalizedCorpus = normalizeCriticalCodePoints(corpus);
  const corpusSet = new Set(normalizedCorpus);
  const missingCodePoints = [...requiredCodePoints].filter((character) => !corpusSet.has(character));
  if (missingCodePoints.length > 0) issues.push(`디스플레이 글꼴 코퍼스 누락: ${missingCodePoints.join("")}`);
  const expected = createCriticalWeddingDisplayManifest({
    corpus,
    font,
    requiredCodePoints,
    sourceFileCount: criticalWeddingDisplaySourceFiles.length
  });
  if (manifest.version !== expected.version) issues.push("디스플레이 글꼴 매니페스트 버전 불일치");
  if (manifest.sourceCommit !== expected.sourceCommit) issues.push("디스플레이 글꼴 원본 커밋 불일치");
  if (manifest.corpusSha256 !== expected.corpusSha256) issues.push("디스플레이 글꼴 코퍼스 해시 드리프트");
  if (manifest.fontSha256 !== expected.fontSha256) issues.push("디스플레이 글꼴 WOFF2 해시 드리프트");
  if (manifest.requiredTextSha256 !== expected.requiredTextSha256) issues.push("디스플레이 제목 글자 집합 드리프트");
  if (manifest.corpusCodePointCount !== expected.corpusCodePointCount) issues.push("디스플레이 글꼴 코퍼스 글자 수 불일치");
  if (manifest.requiredCodePointCount !== expected.requiredCodePointCount) issues.push("디스플레이 글꼴 필수 글자 수 불일치");
  if (manifest.sourceFileCount !== expected.sourceFileCount) issues.push("디스플레이 글꼴 추적 소스 수 불일치");
  return { issues, missingCodePoints, expected };
}

export async function readCriticalWeddingDisplayAuditInputs(rootDir) {
  const fontDir = path.join(rootDir, "client/src/assets/fonts");
  const [corpus, font, manifestText, sources] = await Promise.all([
    readFile(path.join(fontDir, "gowun-dodum-critical.txt"), "utf8"),
    readFile(path.join(fontDir, "gowun-dodum-critical.woff2")),
    readFile(path.join(fontDir, "gowun-dodum-critical.manifest.json"), "utf8"),
    collectCriticalWeddingDisplaySources(rootDir)
  ]);
  return { corpus, font, manifest: JSON.parse(manifestText), ...sources };
}

export async function writeCriticalWeddingDisplayManifest(rootDir) {
  const fontDir = path.join(rootDir, "client/src/assets/fonts");
  const [corpus, font, sources] = await Promise.all([
    readFile(path.join(fontDir, "gowun-dodum-critical.txt"), "utf8"),
    readFile(path.join(fontDir, "gowun-dodum-critical.woff2")),
    collectCriticalWeddingDisplaySources(rootDir)
  ]);
  const manifest = createCriticalWeddingDisplayManifest({
    corpus,
    font,
    requiredCodePoints: sources.requiredCodePoints,
    sourceFileCount: sources.sourceEntries.length
  });
  const manifestPath = path.join(fontDir, "gowun-dodum-critical.manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, manifestPath, ...sources };
}
