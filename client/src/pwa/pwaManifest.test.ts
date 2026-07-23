import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
};

type PwaManifest = {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  icons: ManifestIcon[];
};

function publicFile(path: string): Buffer {
  return readFileSync(resolve(process.cwd(), "public", path));
}

function pngDimensions(file: Buffer) {
  expect(file.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

describe("PWA manifest", () => {
  it("defines a scoped standalone invitation with exact 192px and 512px icons", () => {
    const manifest = JSON.parse(publicFile("manifest.webmanifest").toString("utf8")) as PwaManifest;

    expect(manifest).toMatchObject({ id: "./", start_url: "./", scope: "./", display: "standalone" });
    expect(manifest.icons.map(({ sizes }) => sizes)).toEqual(["192x192", "512x512"]);
    expect(manifest.icons[1].purpose).toContain("maskable");

    manifest.icons.forEach((icon) => {
      const file = publicFile(icon.src);
      const size = Number(icon.sizes.split("x")[0]);
      expect(icon.type).toBe("image/png");
      expect(pngDimensions(file)).toEqual({ width: size, height: size });
      expect(file.includes(Buffer.from("tRNS"))).toBe(false);
    });
  });
});
