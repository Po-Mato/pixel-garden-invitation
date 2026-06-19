import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import sharp from "sharp";

const imageUrl = new URL("../character-assets/reference/approved-couple.png", import.meta.url);
const metadataUrl = new URL("../character-assets/reference/approved-couple.json", import.meta.url);

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
