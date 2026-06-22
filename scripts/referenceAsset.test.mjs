import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const imageUrl = new URL("../character-assets/reference/approved-couple.png", import.meta.url);
const metadataUrl = new URL("../character-assets/reference/approved-couple.json", import.meta.url);
const sourceLockUrl = new URL("../character-assets/reference/couple-source-lock.json", import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));

const approvedMetadata = {
  sourceSessionId: "019eabf9-3872-7d40-9d46-157edc38abc5",
  width: 1536,
  height: 1024,
  sha256: "2b15858e5e16a7210181b79cbf94aa1041df3bc5cb255a76f41a36c1d553458a",
  artDirection: "ornate romantic fashion pixel art",
  proportion: "A2 balanced compact",
  face: "F1 clear and refined",
  groom: ["black fitted tuxedo", "satin lapels", "white boutonniere", "layered dark hair"],
  bride: [
    "waist-length dark-brown waves",
    "ivory lace gown",
    "pearl and floral ornament",
    "pastel bouquet"
  ]
};

test("approved couple reference matches its recorded provenance and image properties", async () => {
  assert.ok(existsSync(imageUrl), "approved couple reference image is missing");
  assert.ok(existsSync(metadataUrl), "approved couple reference metadata is missing");

  const image = await readFile(imageUrl);
  const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));
  const imageMetadata = await sharp(image).metadata();
  const sha256 = createHash("sha256").update(image).digest("hex");

  assert.deepEqual(metadata, approvedMetadata);
  assert.equal(sha256, approvedMetadata.sha256);
  assert.equal(imageMetadata.width, approvedMetadata.width);
  assert.equal(imageMetadata.height, approvedMetadata.height);
  assert.equal(metadata.sourceSessionId, "019eabf9-3872-7d40-9d46-157edc38abc5");
});

test("couple source sprites are locked to the approved art direction", async () => {
  assert.ok(existsSync(sourceLockUrl), "couple source lock metadata is missing");

  const lock = JSON.parse(await readFile(sourceLockUrl, "utf8"));
  assert.equal(lock.sourceSessionId, approvedMetadata.sourceSessionId);
  assert.equal(lock.approvedReferenceSha256, approvedMetadata.sha256);
  assert.equal(lock.artDirection, approvedMetadata.artDirection);
  assert.equal(lock.proportion, approvedMetadata.proportion);
  assert.equal(lock.face, approvedMetadata.face);
  assert.equal(lock.idlePose, "standing portrait pose from the approved upper-row reference");
  assert.equal(lock.walkPose, "compact gameplay walking pose from the approved lower-row reference");
  assert.equal(
    lock.lockPolicy,
    "Bride and groom source sprites must preserve the approved ornate romantic fashion reference; do not replace with simplified block art."
  );

  for (const [relative, expectedSha] of Object.entries(lock.sourceSha256)) {
    const file = join(root, relative);
    assert.ok(existsSync(file), `${relative} is missing`);
    const actualSha = createHash("sha256").update(await readFile(file)).digest("hex");
    assert.equal(actualSha, expectedSha, `${relative} no longer matches the locked couple art source`);
  }
});
