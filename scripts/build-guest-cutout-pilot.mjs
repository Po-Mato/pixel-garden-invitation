#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGuestCutoutPilot } from "./lib/guestCutoutRig.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await buildGuestCutoutPilot({
  rigPath: path.join(root, "character-assets/rigs/guest-03/navy-suit-v3/rig.json"),
  outputRoot: path.join(root, "character-assets/generated/cutout-pilot-v3/guest-03"),
  reviewRoot: path.join(root, ".superpowers/character-review/guest-03-cutout-pilot-v3")
});

console.log(`3번 컷아웃 파일럿 렌더링 완료: ${result.outputs.highWalk}`);
console.log(`16프레임 검수표: ${result.outputs.reviewSheet}`);
console.log(`실제 크기 애니메이션: ${result.outputs.reviewHtml}`);
