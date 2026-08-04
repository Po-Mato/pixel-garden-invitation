import { describe, expect, it, vi } from "vitest";
import {
  captureWorldDiagnosticScreenshot,
  canonicalDiagnosticJson,
  createWorldDiagnosticDeltaBundle,
  createWorldDiagnosticBundle,
  downloadJsonArtifact,
  isWorldDiagnosticDeltaBundle,
  normalizeSrgbColorFunctions,
  verifyWorldDiagnosticBundleIntegrity,
  verifyWorldDiagnosticDeltaBundleIntegrity,
  worldDiagnosticBundleDifferences,
  worldDiagnosticArtifactFilename,
  worldDiagnosticBundleViewerUrl
} from "./worldDiagnosticBundle";

describe("맵 진단 번들", () => {
  it("현재 화면을 PNG 데이터로 캡처한다", async () => {
    const element = document.createElement("div");
    const renderer = vi.fn(async () => ({
      width: 780,
      height: 1688,
      toDataURL: () => "data:image/png;base64,diagnostic"
    } as HTMLCanvasElement));
    await expect(captureWorldDiagnosticScreenshot(element, renderer)).resolves.toEqual({
      mimeType: "image/png",
      dataUrl: "data:image/png;base64,diagnostic",
      width: 780,
      height: 1688
    });
    expect(renderer).toHaveBeenCalledWith(element, expect.objectContaining({ useCORS: true }));
  });

  it("캔버스가 지원하지 않는 계산 색상을 rgb 계열로 정규화한다", () => {
    expect(normalizeSrgbColorFunctions(
      "linear-gradient(color(srgb 0.5 0.25 1), color(srgb 1 0 0 / 0.66))"
    )).toBe("linear-gradient(rgb(128, 64, 255), rgba(255, 0, 0, 0.66))");
  });

  it("스크린샷·진단 상태·공유 URL을 한 JSON 파일로 저장하고 URL을 회수한다", async () => {
    const environment = {
      createObjectUrl: vi.fn((_blob: Blob) => "blob:diagnostic"),
      clickDownload: vi.fn((_url: string, _filename: string) => undefined),
      revokeObjectUrl: vi.fn((_url: string) => undefined)
    };
    const bundle = await createWorldDiagnosticBundle({
      generatedAt: "2026-08-04T00:00:00.000Z",
      zone: { id: "lobby", label: "예식장 로비" },
      diagnosticUrl: "https://example.test/?mapAudit=1&mapAuditZone=lobby",
      viewerUrl: "https://example.test/map-diagnostic-bundle-viewer.html",
      viewport: { width: 390, height: 844, devicePixelRatio: 2 },
      userAgent: "test",
      layers: { grid: true, collision: true, depth: true, heatmap: true, labels: true },
      heatmapMode: "pattern",
      sourceContract: {
        target: "client/src/game/worldForegroundPlacements.json",
        version: 1,
        checksum: "f9ad528aecb7b789ea4eb309b9d6c5bd8f78edce9a35ba0df7af8198b7793e25"
      },
      findings: [],
      policy: { status: "passed", blockingCount: 0, warningCount: 0, maxWarnings: 0, violations: [] },
      recommendationDecisions: { "lobby/lobby-desk": "accepted" },
      selectedPatch: {
        version: 1,
        target: "client/src/game/worldForegroundPlacements.json",
        sourceContractVersion: 1,
        sourceChecksum: "f9ad528aecb7b789ea4eb309b9d6c5bd8f78edce9a35ba0df7af8198b7793e25",
        generatedAt: "2026-08-04T00:00:00.000Z",
        acceptedPlacementKeys: ["lobby/lobby-desk"],
        operationCount: 1,
        operations: [{ op: "replace", path: "/zones/lobby/0/depthY", value: 475 }]
      },
      screenshot: { mimeType: "image/png", dataUrl: "data:image/png;base64,ok", width: 780, height: 1688 }
    });
    expect(bundle.integrity.checksum).toMatch(/^[a-f0-9]{64}$/);
    await expect(verifyWorldDiagnosticBundleIntegrity(bundle)).resolves.toBe(true);
    await expect(verifyWorldDiagnosticBundleIntegrity({
      ...bundle,
      zone: { ...bundle.zone, label: "변조됨" }
    })).resolves.toBe(false);
    downloadJsonArtifact(bundle, "diagnostic.json", environment);
    expect(environment.clickDownload).toHaveBeenCalledWith("blob:diagnostic", "diagnostic.json");
    expect(environment.revokeObjectUrl).toHaveBeenCalledWith("blob:diagnostic");
    const blob = environment.createObjectUrl.mock.calls[0]![0];
    const serialized = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result)));
      reader.addEventListener("error", reject);
      reader.readAsText(blob);
    });
    expect(serialized).toContain('"diagnosticUrl": "https://example.test/');
    expect(worldDiagnosticArtifactFilename("bundle", "lobby", new Date("2026-08-04T12:34:56.000Z")))
      .toBe("wedding-map-lobby-bundle-2026-08-04T12-34-56Z.json");
    expect(worldDiagnosticBundleViewerUrl("/invitation/", "https://example.test"))
      .toBe("https://example.test/invitation/map-diagnostic-bundle-viewer.html");
    expect(worldDiagnosticBundleViewerUrl(
      "./",
      "https://example.test/pixel-garden-invitation/?mapAudit=1"
    )).toBe("https://example.test/pixel-garden-invitation/map-diagnostic-bundle-viewer.html");
  });

  it("객체 키 순서와 무관한 정렬 JSON을 무결성 입력으로 사용한다", () => {
    expect(canonicalDiagnosticJson({ beta: [2, { z: true, a: null }], alpha: "x" }))
      .toBe('{"alpha":"x","beta":[2,{"a":null,"z":true}]}');
  });

  it("A/B 차이만 담고 스크린샷 원문은 제외한 경량 번들을 만든다", async () => {
    const base = await createWorldDiagnosticBundle({
      generatedAt: "2026-08-04T00:00:00.000Z",
      zone: { id: "lobby", label: "예식장 로비" },
      diagnosticUrl: "https://example.test/?mapAudit=1&mapAuditZone=lobby&mapAuditHeatmap=color",
      viewerUrl: "https://example.test/map-diagnostic-bundle-viewer.html",
      viewport: { width: 390, height: 844, devicePixelRatio: 2 },
      userAgent: "test",
      layers: { grid: true, collision: true, depth: true, heatmap: true, labels: true },
      heatmapMode: "color",
      sourceContract: { target: "client/src/game/worldForegroundPlacements.json", version: 1, checksum: "a".repeat(64) },
      findings: [],
      policy: { status: "passed", blockingCount: 0, warningCount: 0, maxWarnings: 0, violations: [] },
      recommendationDecisions: {},
      selectedPatch: { version: 1, target: "client/src/game/worldForegroundPlacements.json", sourceContractVersion: 1, sourceChecksum: "a".repeat(64), generatedAt: "2026-08-04T00:00:00.000Z", acceptedPlacementKeys: [], operationCount: 0, operations: [] },
      screenshot: { mimeType: "image/png", dataUrl: "data:image/png;base64,base", width: 780, height: 1688 }
    });
    const { version: _version, integrity: _integrity, ...baseInput } = base;
    const candidate = await createWorldDiagnosticBundle({
      ...baseInput,
      generatedAt: "2026-08-05T00:00:00.000Z",
      diagnosticUrl: "https://example.test/?mapAudit=1&mapAuditZone=lobby&mapAuditHeatmap=contrast",
      heatmapMode: "contrast",
      screenshot: { ...base.screenshot, dataUrl: "data:image/png;base64,candidate" }
    });
    const delta = await createWorldDiagnosticDeltaBundle(base, candidate, "2026-08-05T01:00:00.000Z");
    expect(worldDiagnosticBundleDifferences(base, candidate).map(({ field }) => field)).toEqual(["HEATMAP", "SCREENSHOT"]);
    expect(delta.reproductionUrl).toBe(candidate.diagnosticUrl);
    expect(delta.changes.map(({ field }) => field)).toEqual(["HEATMAP", "SCREENSHOT"]);
    expect(JSON.stringify(delta)).not.toContain("data:image/png;base64");
    expect(delta.screenshots.baseChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(isWorldDiagnosticDeltaBundle(delta)).toBe(true);
    await expect(verifyWorldDiagnosticDeltaBundleIntegrity(delta)).resolves.toBe(true);
    await expect(verifyWorldDiagnosticDeltaBundleIntegrity({
      ...delta,
      reproductionUrl: "https://example.test/tampered"
    })).resolves.toBe(false);
    expect(isWorldDiagnosticDeltaBundle({ ...delta, surprise: true })).toBe(false);
    expect(isWorldDiagnosticDeltaBundle({
      ...delta,
      screenshots: { ...delta.screenshots, changed: false }
    })).toBe(false);
    expect(worldDiagnosticArtifactFilename("delta", "lobby", new Date("2026-08-05T01:02:03.000Z")))
      .toBe("wedding-map-lobby-delta-2026-08-05T01-02-03Z.json");
  });
});
