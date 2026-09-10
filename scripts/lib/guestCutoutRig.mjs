import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

export const CUTOUT_DIRECTIONS = ["down", "left", "right", "up"];

const identityMatrix = () => [1, 0, 0, 1, 0, 0];

function multiplyMatrices(first, second) {
  const [a1, b1, c1, d1, e1, f1] = first;
  const [a2, b2, c2, d2, e2, f2] = second;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1
  ];
}

function translationMatrix(x, y) {
  return [1, 0, 0, 1, x, y];
}

function rotationMatrix(degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [cosine, sine, -sine, cosine, 0, 0];
}

function localBoneMatrix(pivot, transform = {}) {
  const translate = translationMatrix(transform.translateX ?? 0, transform.translateY ?? 0);
  const rotateAroundPivot = multiplyMatrices(
    translationMatrix(pivot.x, pivot.y),
    multiplyMatrices(
      rotationMatrix(transform.rotate ?? 0),
      translationMatrix(-pivot.x, -pivot.y)
    )
  );
  return multiplyMatrices(translate, rotateAroundPivot);
}

function matrixText(matrix) {
  return matrix
    .map((value) => Math.abs(value) < 1e-10 ? 0 : Number(value.toFixed(6)))
    .join(" ");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function loadRigDefinition(rigPath) {
  const sourceRig = await readJson(rigPath);
  if (!sourceRig.extends) return { rig: sourceRig, sourceRig, baseRigPath: null, baseRig: null };
  const baseRigPath = path.resolve(path.dirname(rigPath), sourceRig.extends);
  const base = await loadRigDefinition(baseRigPath);
  const rig = structuredClone({ ...base.rig, ...sourceRig });
  for (const [direction, frames] of Object.entries(sourceRig.animationOverrides?.frames ?? {})) {
    for (const [frameIndex, override] of frames.entries()) {
      if (!override) continue;
      rig.animation.frames[direction][frameIndex] = {
        ...rig.animation.frames[direction][frameIndex],
        ...override
      };
    }
  }
  return {
    rig,
    sourceRig,
    baseRigPath,
    baseRig: base.rig
  };
}

async function rasterPartDefinitions(rigRoot, rasterPartsPath, rasterParts) {
  const symbols = [];
  const fileHashes = {};
  for (const direction of CUTOUT_DIRECTIONS) {
    for (const [partId, placement] of Object.entries(rasterParts.directions?.[direction] ?? {})) {
      const file = path.resolve(rigRoot, placement.file);
      const input = await readFile(file);
      const metadata = await sharp(input).metadata();
      if (!metadata.hasAlpha) throw new Error(`${file} 원본 파츠에 알파 채널이 없습니다.`);
      fileHashes[path.relative(rigRoot, file)] = sha256(input);
      symbols.push(`<g id="${direction}-${partId}" data-source="${escapeXml(placement.file)}"><image href="data:image/png;base64,${input.toString("base64")}" x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" preserveAspectRatio="none"/></g>`);
    }
  }
  return {
    definitions: symbols.join("\n"),
    hash: sha256(JSON.stringify({ layout: rasterParts, files: fileHashes })),
    fileHashes,
    rasterPartsPath
  };
}

export async function loadGuestCutoutRig(rigPath) {
  const definition = await loadRigDefinition(rigPath);
  const { rig } = definition;
  const rigRoot = path.dirname(rigPath);
  const skeletonPath = path.resolve(rigRoot, rig.skeleton);
  const artworkPath = path.resolve(rigRoot, rig.artwork);
  const appearancePath = rig.appearance ? path.resolve(rigRoot, rig.appearance) : null;
  const [skeleton, artwork, appearance] = await Promise.all([
    readJson(skeletonPath),
    readFile(artworkPath, "utf8"),
    appearancePath ? readJson(appearancePath) : Promise.resolve(null)
  ]);
  const vectorDefinitions = artwork.match(/<defs>([\s\S]*?)<\/defs>/u)?.[1];
  if (!vectorDefinitions) throw new Error(`${artworkPath}에서 SVG 파츠 정의를 찾지 못했습니다.`);
  const rasterPartsPath = typeof rig.rasterParts === "string"
    ? path.resolve(rigRoot, rig.rasterParts)
    : null;
  const rasterParts = rasterPartsPath ? await readJson(rasterPartsPath) : rig.rasterParts;
  const rasterBundle = rasterParts
    ? await rasterPartDefinitions(rigRoot, rasterPartsPath, rasterParts)
    : null;
  const definitions = `${vectorDefinitions}\n${rasterBundle?.definitions ?? ""}`;
  return {
    rig,
    sourceRig: definition.sourceRig,
    skeleton,
    artwork,
    appearance,
    rasterParts,
    definitions,
    paths: {
      rigPath,
      baseRigPath: definition.baseRigPath,
      skeletonPath,
      artworkPath,
      appearancePath,
      rasterPartsPath
    },
    hashes: {
      rig: sha256(JSON.stringify(definition.sourceRig)),
      baseRig: definition.baseRig ? sha256(JSON.stringify(definition.baseRig)) : null,
      skeleton: sha256(JSON.stringify(skeleton)),
      artwork: sha256(artwork),
      appearance: appearance ? sha256(JSON.stringify(appearance)) : null,
      rasterParts: rasterBundle?.hash ?? null,
      rasterPartFiles: rasterBundle?.fileHashes ?? null
    }
  };
}

function directionPivot(skeleton, directionConfig, boneId) {
  const pivot = skeleton.bones[boneId]?.pivot;
  if (!pivot) throw new Error(`공용 골격에 ${boneId} 관절이 없습니다.`);
  const offset = directionConfig.pivotOffsets?.[boneId] ?? { x: 0, y: 0 };
  return { x: pivot.x + (offset.x ?? 0), y: pivot.y + (offset.y ?? 0) };
}

function computeBoneMatrices(bundle, direction, frameIndex) {
  const { rig, skeleton } = bundle;
  const directionConfig = rig.directions[direction];
  const frame = rig.animation.frames[direction][frameIndex];
  const matrices = new Map();
  const resolve = (boneId) => {
    if (matrices.has(boneId)) return matrices.get(boneId);
    const bone = skeleton.bones[boneId];
    if (!bone) throw new Error(`알 수 없는 관절: ${boneId}`);
    const parent = bone.parent ? resolve(bone.parent) : identityMatrix();
    const local = localBoneMatrix(
      directionPivot(skeleton, directionConfig, boneId),
      frame.bones?.[boneId]
    );
    const global = multiplyMatrices(parent, local);
    matrices.set(boneId, global);
    return global;
  };
  for (const boneId of Object.keys(skeleton.bones)) resolve(boneId);
  return matrices;
}

export function validateGuestCutoutSource(bundle) {
  const { rig, skeleton, artwork, definitions } = bundle;
  const errors = [];
  const requiredRoles = new Set([
    "face", "backHair", "frontHair", "neck", "torso", "jacketOrTop",
    "upperArmLeft", "upperArmRight", "lowerArmLeft", "lowerArmRight",
    "handLeft", "handRight", "pelvisOrSkirt", "thighLeft", "thighRight",
    "calfLeft", "calfRight", "shoeLeft", "shoeRight", "outfitDetail",
    "bagOrAccessory", "shadow"
  ]);
  const partIds = new Set(rig.parts.map((part) => part.id));
  const partRoles = new Set(rig.parts.map((part) => part.role ?? part.id));
  for (const role of requiredRoles) {
    if (!partRoles.has(role)) errors.push(`필수 파츠 역할 누락: ${role}`);
  }
  for (const part of rig.parts) {
    if (!skeleton.bones[part.bone]) errors.push(`${part.id}의 부모 관절 ${part.bone} 누락`);
  }
  for (const direction of CUTOUT_DIRECTIONS) {
    const config = rig.directions[direction];
    if (!config) {
      errors.push(`방향 누락: ${direction}`);
      continue;
    }
    if (config.drawOrder.length !== rig.parts.length) {
      errors.push(`${direction} 방향 파츠 순서가 전체 파츠 수와 다릅니다.`);
    }
    for (const part of rig.parts) {
      if (!definitions.includes(`id="${direction}-${part.id}"`)) {
        errors.push(`${direction}-${part.id} 편집 파츠 누락`);
      }
    }
    const frames = rig.animation.frames[direction];
    if (frames?.length !== 4) errors.push(`${direction} 키프레임은 4개여야 합니다.`);
    for (const [index, frame] of (frames ?? []).entries()) {
      for (const [boneId, transform] of Object.entries(frame.bones ?? {})) {
        if (!skeleton.bones[boneId]) errors.push(`${direction}/${index + 1} 알 수 없는 관절 ${boneId}`);
        const forbidden = Object.keys(transform).filter((key) => ![
          "rotate", "translateX", "translateY"
        ].includes(key));
        if (forbidden.length > 0) {
          errors.push(`${direction}/${index + 1}/${boneId} 금지 변형: ${forbidden.join(", ")}`);
        }
      }
    }
  }
  if (JSON.stringify(rig.animation.frames.down[1]) !== JSON.stringify(rig.animation.frames.down[3])) {
    errors.push("정면 2·4번 중립 키프레임이 다릅니다.");
  }
  for (const direction of CUTOUT_DIRECTIONS) {
    if (JSON.stringify(rig.animation.frames[direction][1]) !== JSON.stringify(
      rig.animation.frames[direction][3]
    )) errors.push(`${direction} 2·4번 중립 키프레임이 다릅니다.`);
  }
  if (/scale\s*\(\s*-|matrix\s*\(\s*-/u.test(artwork)) {
    errors.push("SVG 원본에 좌우 반전 변형이 있습니다.");
  }
  if (rig.sourcePolicy.directionMirroring !== false) errors.push("방향 반전 금지 정책이 꺼져 있습니다.");
  if (errors.length > 0) throw new Error(errors.join("\n"));
  return { passed: true, partCount: rig.parts.length, directionCount: CUTOUT_DIRECTIONS.length };
}

export function renderGuestCutoutFrameSvg(bundle, direction, frameIndex) {
  const { rig, skeleton, definitions } = bundle;
  const directionConfig = rig.directions[direction];
  const matrices = computeBoneMatrices(bundle, direction, frameIndex);
  const partById = new Map(rig.parts.map((part) => [part.id, part]));
  const uses = directionConfig.drawOrder.map((partId) => {
    const part = partById.get(partId);
    if (!part) throw new Error(`${direction} 파츠 순서에 알 수 없는 ${partId}가 있습니다.`);
    return `<use href="#${direction}-${part.id}" data-part="${part.id}" data-bone="${part.bone}" transform="matrix(${matrixText(matrices.get(part.bone))})"/>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${skeleton.canvas.width}" height="${skeleton.canvas.height}" viewBox="0 0 ${skeleton.canvas.width} ${skeleton.canvas.height}">
  <title>${escapeXml(rig.characterId)} ${escapeXml(direction)} frame ${frameIndex + 1}</title>
  <defs>${definitions}</defs>
  <g data-direction="${direction}" data-frame="${frameIndex + 1}">${uses}</g>
</svg>`;
}

async function renderFramePng(svg) {
  return sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function transparentSheet(width, height, composites) {
  return sharp({
    create: { width, height, channels: 4, background: "#00000000" }
  }).composite(composites).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function resizeWholeFrame(frame, width, height) {
  return sharp(frame)
    .resize(width, height, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function reviewBackground(bundle) {
  const { skeleton, rig } = bundle;
  const cellWidth = 216;
  const cellHeight = 326;
  const padding = 24;
  const headerHeight = 76;
  const width = padding * 2 + cellWidth * 4;
  const height = headerHeight + padding + cellHeight * 4;
  const labels = { down: "정면", left: "왼쪽", right: "오른쪽", up: "뒷면" };
  const cards = CUTOUT_DIRECTIONS.flatMap((direction, row) => (
    [0, 1, 2, 3].map((column) => {
      const x = padding + column * cellWidth;
      const y = headerHeight + row * cellHeight;
      const frameTop = y + 26;
      const headLine = frameTop + skeleton.proportions.characterTop + skeleton.proportions.headHeight;
      const baseline = frameTop + skeleton.proportions.footBaseline;
      const fill = (row + column) % 2 === 0 ? "#f7f2ea" : "#eee8df";
      return `<g>
        <rect x="${x + 4}" y="${y + 4}" width="208" height="314" rx="10" fill="${fill}" stroke="#d7cabd"/>
        <text x="${x + 12}" y="${y + 20}" font-family="sans-serif" font-size="11" font-weight="700" fill="#514750">${labels[direction]} · ${column + 1} ${escapeXml(rig.animation.frameLabels[column])}</text>
        <line x1="${x + 12}" y1="${headLine}" x2="${x + 204}" y2="${headLine}" stroke="#be8a93" stroke-width="0.8" stroke-dasharray="4 3" opacity="0.7"/>
        <line x1="${x + 12}" y1="${baseline}" x2="${x + 204}" y2="${baseline}" stroke="#657f6c" stroke-width="0.9" stroke-dasharray="4 3" opacity="0.8"/>
      </g>`;
    })
  )).join("\n");
  return {
    width,
    height,
    svg: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#fffaf4"/>
      <text x="24" y="31" font-family="sans-serif" font-size="20" font-weight="800" fill="#332e3b">${escapeXml(rig.label ?? rig.characterId)} · 컷아웃 리그 16프레임 검수표</text>
      <text x="24" y="55" font-family="sans-serif" font-size="12" fill="#6d6268">192×288 · 머리 84 · 몸 168 · 발 기준선 y=264 · 2/4 중립 동일</text>
      ${cards}
    </svg>`),
    cellWidth,
    cellHeight,
    padding,
    headerHeight
  };
}

async function renderReviewSheet(bundle, framesByDirection, output) {
  const background = reviewBackground(bundle);
  const composites = [{ input: background.svg, left: 0, top: 0 }];
  for (let row = 0; row < CUTOUT_DIRECTIONS.length; row += 1) {
    const direction = CUTOUT_DIRECTIONS[row];
    for (let column = 0; column < 4; column += 1) {
      composites.push({
        input: framesByDirection[direction][column].png,
        left: background.padding + column * background.cellWidth + 12,
        top: background.headerHeight + row * background.cellHeight + 26
      });
    }
  }
  await sharp({
    create: {
      width: background.width,
      height: background.height,
      channels: 4,
      background: "#fffaf4"
    }
  }).composite(composites).png({ compressionLevel: 9 }).toFile(output);
}

function reviewHtml(bundle, relativeSheetPath) {
  const rows = Object.fromEntries(CUTOUT_DIRECTIONS.map((direction) => [
    direction,
    bundle.rig.directions[direction].row
  ]));
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeXml(bundle.rig.label ?? bundle.rig.characterId)} 컷아웃 검수</title>
  <style>
    :root{color:#352e38;background:#f7f1e9;font-family:-apple-system,BlinkMacSystemFont,"Noto Sans KR",sans-serif}*{box-sizing:border-box}body{margin:0;padding:16px;background:linear-gradient(#fbf7f1,#eee5dc);min-height:100vh}.panel{max-width:358px;margin:auto;padding:16px;border:1px solid #d7c7bd;border-radius:18px;background:#fffdf9;box-shadow:0 14px 38px #5a465522}h1{margin:0;font-size:18px}p{margin:7px 0 14px;color:#766870;font-size:12px;line-height:1.5}.stage{display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{display:grid;min-height:188px;place-items:center;border:1px solid #dfd1c6;border-radius:14px;background:linear-gradient(145deg,#f1e9df,#fffaf4)}.card strong{font-size:11px}.sprite{width:96px;height:144px;background-image:url("${relativeSheetPath}");background-size:384px 576px;background-repeat:no-repeat;filter:drop-shadow(1px 2px 1px #3d313744)}.world{width:48px;height:72px;background-size:192px 288px}.sizes{display:flex;align-items:end;justify-content:center;gap:22px;margin:18px 0;padding:14px;border-radius:14px;background:#273043;color:#fff}.size-label{display:grid;place-items:center;gap:6px;font-size:10px}.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.controls button{min-height:44px;border:1px solid #b9919a;border-radius:12px;background:#fff6f5;color:#5d414a;font-weight:750}.status{margin-top:12px;padding-top:12px;border-top:1px solid #eadfd6;font-size:11px;color:#6d6268}.status b{color:#3f7658}@media(max-width:360px){body{padding:8px}.panel{padding:12px}.stage{gap:6px}}
  </style>
</head>
<body>
  <main class="panel">
    <h1>${escapeXml(bundle.rig.label ?? bundle.rig.characterId)} · 컷아웃 리그</h1>
    <p>아래 네 방향은 각각 별도 원본 파츠입니다. 재생 중 1·3번은 반대 발, 2·4번은 같은 중립 자세입니다.</p>
    <section class="stage">
      ${CUTOUT_DIRECTIONS.map((direction) => `<div class="card"><strong>${({down:"정면",left:"왼쪽",right:"오른쪽",up:"뒷면"})[direction]}</strong><div class="sprite" data-direction="${direction}"></div></div>`).join("")}
    </section>
    <section class="sizes" aria-label="실제 표시 크기 비교">
      <div class="size-label"><span>선택 화면 96×144</span><div class="sprite" data-direction="down"></div></div>
      <div class="size-label"><span>게임 48×72</span><div class="sprite world" data-direction="down"></div></div>
    </section>
    <div class="controls"><button id="toggle">정지</button><button id="previous">이전 프레임</button><button id="next">다음 프레임</button></div>
    <div class="status">프레임 <b id="frame">1</b>/4 · <span id="label">왼발 전진</span></div>
  </main>
  <script>
    const rows=${JSON.stringify(rows)};const labels=["왼발 전진","중립","오른발 전진","중립"];let frame=0;let playing=true;let timer;
    function draw(){document.querySelectorAll('.sprite').forEach(el=>{const scale=el.classList.contains('world')?.25:.5;const x=-frame*192*scale;const y=-rows[el.dataset.direction]*288*scale;el.style.backgroundPosition=x+'px '+y+'px'});document.querySelector('#frame').textContent=String(frame+1);document.querySelector('#label').textContent=labels[frame]}
    function start(){clearInterval(timer);if(playing)timer=setInterval(()=>{frame=(frame+1)%4;draw()},240)}
    document.querySelector('#toggle').onclick=event=>{playing=!playing;event.currentTarget.textContent=playing?'정지':'재생';start()};document.querySelector('#previous').onclick=()=>{frame=(frame+3)%4;draw()};document.querySelector('#next').onclick=()=>{frame=(frame+1)%4;draw()};draw();start();
  </script>
</body>
</html>`;
}

export async function buildGuestCutoutCharacter({ rigPath, outputRoot, reviewRoot }) {
  const bundle = await loadGuestCutoutRig(rigPath);
  validateGuestCutoutSource(bundle);
  await Promise.all([
    mkdir(outputRoot, { recursive: true }),
    mkdir(reviewRoot, { recursive: true }),
    mkdir(path.join(outputRoot, "frames"), { recursive: true })
  ]);
  const framesByDirection = {};
  for (const direction of CUTOUT_DIRECTIONS) {
    framesByDirection[direction] = [];
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const svg = renderGuestCutoutFrameSvg(bundle, direction, frameIndex);
      const png = await renderFramePng(svg);
      const basename = `${direction}-${String(frameIndex + 1).padStart(2, "0")}`;
      await Promise.all([
        writeFile(path.join(outputRoot, "frames", `${basename}.svg`), svg),
        writeFile(path.join(outputRoot, "frames", `${basename}.png`), png)
      ]);
      framesByDirection[direction].push({ svg, png });
    }
  }
  const highComposites = CUTOUT_DIRECTIONS.flatMap((direction, row) => (
    framesByDirection[direction].map((frame, column) => ({
      input: frame.png,
      left: column * bundle.skeleton.canvas.width,
      top: row * bundle.skeleton.canvas.height
    }))
  ));
  const highSheet = await transparentSheet(
    bundle.skeleton.canvas.width * 4,
    bundle.skeleton.canvas.height * 4,
    highComposites
  );
  const runtimeFramesByDirection = {};
  for (const direction of CUTOUT_DIRECTIONS) {
    runtimeFramesByDirection[direction] = [];
    for (const frame of framesByDirection[direction]) {
      runtimeFramesByDirection[direction].push(await resizeWholeFrame(
        frame.png,
        bundle.skeleton.canvas.width / 2,
        bundle.skeleton.canvas.height / 2
      ));
    }
  }
  const runtimeSheet = await transparentSheet(
    bundle.skeleton.canvas.width * 2,
    bundle.skeleton.canvas.height * 2,
    CUTOUT_DIRECTIONS.flatMap((direction, row) => (
      runtimeFramesByDirection[direction].map((frame, column) => ({
        input: frame,
        left: column * bundle.skeleton.canvas.width / 2,
        top: row * bundle.skeleton.canvas.height / 2
      }))
    ))
  );
  const neutralHigh = framesByDirection.down[1].png;
  const neutralRuntime = runtimeFramesByDirection.down[1];
  const highIdle = await transparentSheet(bundle.skeleton.canvas.width * 2, bundle.skeleton.canvas.height, [
    { input: neutralHigh, left: 0, top: 0 },
    { input: neutralHigh, left: bundle.skeleton.canvas.width, top: 0 }
  ]);
  const runtimeIdle = await transparentSheet(bundle.skeleton.canvas.width, bundle.skeleton.canvas.height / 2, [
    { input: neutralRuntime, left: 0, top: 0 },
    { input: neutralRuntime, left: bundle.skeleton.canvas.width / 2, top: 0 }
  ]);
  const outputName = bundle.rig.outputName ?? bundle.rig.characterId;
  const outputs = {
    highWalk: path.join(outputRoot, `${outputName}__walk-hd.png`),
    highIdle: path.join(outputRoot, `${outputName}__idle-hd.png`),
    runtimeWalk: path.join(outputRoot, `${outputName}__walk-runtime.png`),
    runtimeIdle: path.join(outputRoot, `${outputName}__idle-runtime.png`),
    manifest: path.join(outputRoot, "build-manifest.json"),
    reviewSheet: path.join(reviewRoot, `${outputName}-hd-16-frame-review.png`),
    reviewHtml: path.join(reviewRoot, `${outputName}-actual-size-animation.html`)
  };
  await Promise.all([
    writeFile(outputs.highWalk, highSheet),
    writeFile(outputs.highIdle, highIdle),
    writeFile(outputs.runtimeWalk, runtimeSheet),
    writeFile(outputs.runtimeIdle, runtimeIdle),
    renderReviewSheet(bundle, framesByDirection, outputs.reviewSheet),
    writeFile(outputs.reviewHtml, reviewHtml(bundle, path.relative(reviewRoot, outputs.highWalk)))
  ]);
  const manifest = {
    version: 1,
    characterId: bundle.rig.characterId,
    sourceKind: bundle.rig.sourcePolicy.kind,
    inputs: {
      rig: path.relative(outputRoot, bundle.paths.rigPath),
      baseRig: bundle.paths.baseRigPath
        ? path.relative(outputRoot, bundle.paths.baseRigPath)
        : null,
      skeleton: path.relative(outputRoot, bundle.paths.skeletonPath),
      artwork: path.relative(outputRoot, bundle.paths.artworkPath),
      rasterParts: bundle.paths.rasterPartsPath
        ? path.relative(outputRoot, bundle.paths.rasterPartsPath)
        : null,
      appearance: bundle.paths.appearancePath
        ? path.relative(outputRoot, bundle.paths.appearancePath)
        : null,
      hashes: bundle.hashes
    },
    outputs: Object.fromEntries(Object.entries(outputs).map(([key, value]) => [
      key,
      path.relative(outputRoot, value)
    ])),
    pipeline: [
      bundle.rasterParts ? "editable high-detail raster cutout parts" : "editable vector parts",
      "direction-specific cutout animation",
      "automatic SVG frame render",
      "192x288 PNG frames",
      "768x1152 high-density sheet",
      "whole-frame game downscale"
    ],
    forbiddenOperationsUsed: []
  };
  await writeFile(outputs.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  return { bundle, framesByDirection, runtimeFramesByDirection, outputs, manifest };
}

export const buildGuestCutoutPilot = buildGuestCutoutCharacter;

function alphaBounds(data, info, threshold = 96) {
  let left = info.width;
  let top = info.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error("프레임의 캐릭터 알파를 찾지 못했습니다.");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
}

function weightedCenterX(data, info, threshold = 64) {
  let total = 0;
  let weighted = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const alpha = data[(y * info.width + x) * info.channels + 3];
      if (alpha < threshold) continue;
      total += alpha;
      weighted += x * alpha;
    }
  }
  return weighted / total;
}

function pixelDifference(first, second) {
  let alpha = 0;
  let rgba = 0;
  const pixels = first.length / 4;
  for (let index = 0; index < first.length; index += 4) {
    alpha += Math.abs(first[index + 3] - second[index + 3]) / 255;
    rgba += (
      Math.abs(first[index] - second[index])
      + Math.abs(first[index + 1] - second[index + 1])
      + Math.abs(first[index + 2] - second[index + 2])
      + Math.abs(first[index + 3] - second[index + 3])
    ) / (255 * 4);
  }
  return { alpha: alpha / pixels, rgba: rgba / pixels };
}

function luminance(red, green, blue) {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const bright = Math.max(first, second);
  const dark = Math.min(first, second);
  return (bright + 0.05) / (dark + 0.05);
}

async function mapReadability(projectRoot) {
  const files = [
    "client/public/assets/maps/v2/home/background.webp",
    "client/public/assets/maps/v2/ceremony-hall/background.webp",
    "client/public/assets/maps/v2/banquet/background.webp"
  ];
  const outlineLuminance = luminance(41, 40, 58);
  const lightLuminance = luminance(246, 197, 168);
  const samples = [];
  for (const relative of files) {
    const { data } = await sharp(path.join(projectRoot, relative)).resize(1, 1).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const backgroundLuminance = luminance(data[0], data[1], data[2]);
    const outlineContrast = contrastRatio(backgroundLuminance, outlineLuminance);
    const lightContrast = contrastRatio(backgroundLuminance, lightLuminance);
    samples.push({
      map: relative,
      averageRgb: [...data.subarray(0, 3)],
      outlineContrast,
      lightDetailContrast: lightContrast,
      bestContrast: Math.max(outlineContrast, lightContrast),
      passed: Math.max(outlineContrast, lightContrast) >= 2.4
    });
  }
  return { samples, passed: samples.every((sample) => sample.passed) };
}

function hexRgb(hex) {
  const normalized = hex.replace("#", "");
  return [0, 2, 4].map((index) => Number.parseInt(normalized.slice(index, index + 2), 16));
}

export async function auditGuestCutoutCharacter({ rigPath, outputRoot, projectRoot }) {
  const bundle = await loadGuestCutoutRig(rigPath);
  const source = validateGuestCutoutSource(bundle);
  const outputName = bundle.rig.outputName ?? bundle.rig.characterId;
  const highWalkPath = path.join(outputRoot, `${outputName}__walk-hd.png`);
  const runtimeWalkPath = path.join(outputRoot, `${outputName}__walk-runtime.png`);
  const [highMetadata, runtimeMetadata] = await Promise.all([
    sharp(highWalkPath).metadata(),
    sharp(runtimeWalkPath).metadata()
  ]);
  const dimensions = {
    highWalk: { width: highMetadata.width, height: highMetadata.height, passed: highMetadata.width === 768 && highMetadata.height === 1152 },
    runtimeWalk: { width: runtimeMetadata.width, height: runtimeMetadata.height, passed: runtimeMetadata.width === 384 && runtimeMetadata.height === 576 }
  };
  const directionReports = {};
  const allBounds = [];
  let neutralPairsExact = true;
  let oppositeStepsDistinct = true;
  let oppositeFeetDeclared = true;
  let maximumCenterDriftWorldPx = 0;
  let continuityPassed = true;
  let lightGarmentPassed = true;
  let transparentRgbContamination = 0;
  let borderOpaquePixels = 0;
  const headWidths = [];
  const rawFrames = {};
  const declaredGarmentRgb = bundle.appearance?.outfit?.secondary
    ? hexRgb(bundle.appearance.outfit.secondary)
    : null;
  const minimumGarmentPixelsByDirection = { down: 25, left: 20, right: 20, up: 16 };
  for (const direction of CUTOUT_DIRECTIONS) {
    rawFrames[direction] = [];
    const frames = [];
    for (let frameIndex = 0; frameIndex < 4; frameIndex += 1) {
      const file = path.join(outputRoot, "frames", `${direction}-${String(frameIndex + 1).padStart(2, "0")}.png`);
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      rawFrames[direction].push({ data, info });
      const bounds = alphaBounds(data, info);
      const centerX = weightedCenterX(data, info);
      allBounds.push(bounds);
      let headLeft = info.width;
      let headRight = -1;
      let declaredGarmentPixels = 0;
      const headBottom = bundle.skeleton.proportions.characterTop + bundle.skeleton.proportions.headHeight - 1;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          const offset = (y * info.width + x) * info.channels;
          const alpha = data[offset + 3];
          if (alpha === 0 && (data[offset] !== 0 || data[offset + 1] !== 0 || data[offset + 2] !== 0)) {
            transparentRgbContamination += 1;
          }
          if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && alpha > 0) {
            borderOpaquePixels += 1;
          }
          if (alpha >= 96 && y <= headBottom) {
            headLeft = Math.min(headLeft, x);
            headRight = Math.max(headRight, x);
          }
          if (alpha >= 180 && declaredGarmentRgb) {
            const distance = Math.abs(data[offset] - declaredGarmentRgb[0])
              + Math.abs(data[offset + 1] - declaredGarmentRgb[1])
              + Math.abs(data[offset + 2] - declaredGarmentRgb[2]);
            if (distance <= 105) declaredGarmentPixels += 1;
          }
        }
      }
      const probe = bundle.rig.directions[direction].continuityProbe;
      const disconnectedRows = [];
      for (let y = probe.top; y <= probe.bottom; y += 1) {
        let connected = false;
        for (let x = probe.left; x <= probe.right; x += 1) {
          if (data[(y * info.width + x) * info.channels + 3] >= 80) {
            connected = true;
            break;
          }
        }
        if (!connected) disconnectedRows.push(y);
      }
      const headWidth = headRight - headLeft + 1;
      headWidths.push(headWidth);
      continuityPassed = continuityPassed && disconnectedRows.length === 0;
      lightGarmentPassed = lightGarmentPassed && (
        declaredGarmentRgb === null
          ? true
          : declaredGarmentPixels >= minimumGarmentPixelsByDirection[direction]
      );
      frames.push({ bounds, centerX, headWidth, declaredGarmentPixels, disconnectedRows });
    }
    const neutralExact = rawFrames[direction][1].data.equals(rawFrames[direction][3].data);
    const oppositeDifference = pixelDifference(rawFrames[direction][0].data, rawFrames[direction][2].data);
    const forwardFeet = bundle.rig.animation.frames[direction].map((frame) => frame.forwardFoot);
    const centers = frames.map((frame) => frame.centerX);
    const centerDriftWorldPx = Math.max(...centers.map((center) => Math.abs(center - centers[1]))) * 0.25;
    neutralPairsExact = neutralPairsExact && neutralExact;
    oppositeStepsDistinct = oppositeStepsDistinct && oppositeDifference.rgba >= 0.004;
    oppositeFeetDeclared = oppositeFeetDeclared
      && forwardFeet[0] === "left" && forwardFeet[2] === "right"
      && forwardFeet[1] === null && forwardFeet[3] === null;
    maximumCenterDriftWorldPx = Math.max(maximumCenterDriftWorldPx, centerDriftWorldPx);
    directionReports[direction] = {
      frames,
      neutralExact,
      oppositeDifference,
      forwardFeet,
      centerDriftWorldPx,
      passed: neutralExact
        && oppositeDifference.rgba >= 0.004
        && centerDriftWorldPx <= 1
        && frames.every((frame) => frame.disconnectedRows.length === 0)
    };
  }
  const mirroredLeft = await sharp(path.join(outputRoot, "frames/left-02.png"))
    .flop().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rightNeutral = rawFrames.right[1].data;
  const profileDirectionDifference = pixelDifference(mirroredLeft.data, rightNeutral);
  const characterTopSet = [...new Set(allBounds.map((bounds) => bounds.top))];
  const baselineSet = [...new Set(allBounds.map((bounds) => bounds.bottom))];
  const heightSet = [...new Set(allBounds.map((bounds) => bounds.height))];
  const headWidthSpreadRatio = (Math.max(...headWidths) - Math.min(...headWidths))
    / (headWidths.reduce((sum, value) => sum + value, 0) / headWidths.length);
  const proportions = {
    declared: bundle.skeleton.proportions,
    measuredCharacterTops: characterTopSet,
    measuredFootBaselines: baselineSet,
    measuredCharacterHeights: heightSet,
    headWidths,
    headWidthSpreadRatio,
    passed: bundle.skeleton.proportions.headHeight === 84
      && bundle.skeleton.proportions.bodyHeight === 168
      && bundle.skeleton.proportions.characterHeight === 252
      && characterTopSet.length === 1
      && baselineSet.length === 1
      && heightSet.length === 1
      && baselineSet[0] === bundle.skeleton.proportions.footBaseline
      && heightSet[0] === bundle.skeleton.proportions.characterHeight
      && headWidthSpreadRatio <= 0.1
  };
  const alpha = {
    transparentRgbContamination,
    borderOpaquePixels,
    declaredGarmentColor: bundle.appearance?.outfit?.secondary ?? "pilot-shirt-white",
    minimumGarmentPixelsByDirection,
    lightGarmentPassed,
    passed: transparentRgbContamination === 0 && borderOpaquePixels === 0 && lightGarmentPassed
  };
  const asymmetry = {
    profileMirrorDifference: profileDirectionDifference,
    directionSymbolsAreUnique: CUTOUT_DIRECTIONS.every((direction) => (
      bundle.rig.parts.every((part) => bundle.definitions.includes(`id="${direction}-${part.id}"`))
    )),
    accessoryPlacement: Object.fromEntries(CUTOUT_DIRECTIONS.map((direction) => [
      direction,
      bundle.rig.directions[direction].asymmetry
    ])),
    passed: profileDirectionDifference.rgba >= 0.01
      && bundle.rig.sourcePolicy.directionMirroring === false
  };
  const mapContrast = await mapReadability(projectRoot);
  const checks = {
    source,
    dimensions,
    proportions,
    motion: {
      neutralPairsExact,
      oppositeStepsDistinct,
      oppositeFeetDeclared,
      maximumCenterDriftWorldPx,
      continuityPassed,
      passed: neutralPairsExact && oppositeStepsDistinct && oppositeFeetDeclared
        && maximumCenterDriftWorldPx <= 1 && continuityPassed
    },
    alpha,
    asymmetry,
    mapContrast
  };
  const passed = Object.values(dimensions).every((item) => item.passed)
    && proportions.passed
    && checks.motion.passed
    && alpha.passed
    && asymmetry.passed
    && mapContrast.passed
    && Object.values(directionReports).every((direction) => direction.passed);
  const report = {
    version: 1,
    characterId: bundle.rig.characterId,
    policy: {
      frame: { width: 192, height: 288 },
      headHeight: 84,
      bodyHeight: 168,
      characterHeight: 252,
      footBaseline: 264,
      maximumCenterDriftWorldPx: 1,
      maximumHeadWidthSpreadRatio: 0.1,
      minimumOppositeStepRgbaDifference: 0.004,
      minimumProfileMirrorDifference: 0.01,
      minimumMapContrast: 2.4
    },
    summary: { passed },
    checks,
    directions: directionReports
  };
  const reportPath = path.join(outputRoot, "audit.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (!passed) {
    throw new Error(`${bundle.rig.characterId} 컷아웃 자동 검수 실패: ${reportPath}`);
  }
  return { report, reportPath };
}

export const auditGuestCutoutPilot = auditGuestCutoutCharacter;
