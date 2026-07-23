import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { coupleThreeHeadLayout } from "./build-couple-three-head-sprites.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const directions = ["down", "left", "right", "up"];

test("couple source frames use an exact one-to-two head-to-body layout", async () => {
  const audit = JSON.parse(await readFile(join(root, "character-assets/reference/couple-three-head-redraw-sources/v1/ratio-audit.json"), "utf8"));
  assert.deepEqual(audit.layout, coupleThreeHeadLayout);
  assert.equal(audit.frames.length, 24);
  for (const frame of audit.frames) {
    assert.equal(frame.targetHeadHeight, 42);
    assert.equal(frame.targetBodyHeight, 84);
    assert.equal(frame.bodyToHeadRatio, 2);
    assert.equal(frame.contentTop, 7);
    assert.equal(frame.contentBottom, 132);
  }
});

test("couple walk sheets keep every frame on the shared baseline", async () => {
  for (const character of ["bride", "groom"]) {
    const source = join(root, `character-assets/source/npc/${character}-walk.png`);
    const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 288);
    assert.equal(info.height, 576);
    for (let row = 0; row < directions.length; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        let top = 144;
        let bottom = -1;
        const opaque = new Uint8Array(96 * 144);
        for (let y = 0; y < 144; y += 1) {
          for (let x = 0; x < 96; x += 1) {
            const globalX = column * 96 + x;
            const globalY = row * 144 + y;
            if (data[(globalY * info.width + globalX) * 4 + 3] <= 24) continue;
            opaque[y * 96 + x] = 1;
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
        assert.equal(top, coupleThreeHeadLayout.contentTop, `${character} ${directions[row]} ${column + 1} top`);
        assert.equal(bottom, coupleThreeHeadLayout.contentBottom, `${character} ${directions[row]} ${column + 1} bottom`);

        const visited = new Uint8Array(opaque.length);
        let components = 0;
        for (let pixel = 0; pixel < opaque.length; pixel += 1) {
          if (!opaque[pixel] || visited[pixel]) continue;
          components += 1;
          const queue = [pixel];
          visited[pixel] = 1;
          for (let index = 0; index < queue.length; index += 1) {
            const current = queue[index];
            const x = current % 96;
            const y = Math.floor(current / 96);
            for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
              for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
                const nextX = x + offsetX;
                const nextY = y + offsetY;
                if (nextX < 0 || nextX >= 96 || nextY < 0 || nextY >= 144) continue;
                const next = nextY * 96 + nextX;
                if (!opaque[next] || visited[next]) continue;
                visited[next] = 1;
                queue.push(next);
              }
            }
          }
        }
        assert.equal(components, 1, `${character} ${directions[row]} ${column + 1} detached pixels`);
      }
    }
  }
});
