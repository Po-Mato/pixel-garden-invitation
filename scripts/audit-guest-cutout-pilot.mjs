#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";

import { auditGuestCutoutPilot } from "./lib/guestCutoutRig.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = await auditGuestCutoutPilot({
  rigPath: path.join(root, "character-assets/rigs/guest-03/navy-suit-v3/rig.json"),
  outputRoot: path.join(root, "character-assets/generated/cutout-pilot-v3/guest-03"),
  projectRoot: root
});

console.log(`3번 컷아웃 파일럿 자동 검수 통과: ${result.reportPath}`);
