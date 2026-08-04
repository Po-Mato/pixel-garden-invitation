import { describe, expect, it, vi } from "vitest";
import {
  captureWorldDiagnosticScreenshot,
  createWorldDiagnosticBundle,
  downloadJsonArtifact,
  normalizeSrgbColorFunctions,
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
    const bundle = createWorldDiagnosticBundle({
      generatedAt: "2026-08-04T00:00:00.000Z",
      zone: { id: "lobby", label: "예식장 로비" },
      diagnosticUrl: "https://example.test/?mapAudit=1&mapAuditZone=lobby",
      viewerUrl: "https://example.test/map-diagnostic-bundle-viewer.html",
      viewport: { width: 390, height: 844, devicePixelRatio: 2 },
      userAgent: "test",
      layers: { grid: true, collision: true, depth: true, heatmap: true, labels: true },
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
  });
});
