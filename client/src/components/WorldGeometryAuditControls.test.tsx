import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gardenWorld } from "../game/world";
import { defaultWorldGeometryAuditLayers } from "../game/worldGeometryAuditLayers";
import { foregroundRecommendationReviewsForZone } from "../game/worldForegroundRecommendations";
import { WorldGeometryAuditControls } from "./WorldGeometryAuditControls";

afterEach(cleanup);

describe("WorldGeometryAuditControls", () => {
  it("keeps the zone console folded while diagnostics are off", () => {
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="home"
        enabled={false}
        issueCounts={{}}
        layers={defaultWorldGeometryAuditLayers}
        copyStatus="idle"
        patchStatus="idle"
        bundleStatus="idle"
        patchImportStatus="idle"
        importedPatchOperationCount={0}
        heatmapMode="color"
        recommendations={[]}
        recommendationDecisions={{}}
        onDownloadBundle={vi.fn()}
        onDownloadPatch={vi.fn()}
        onImportPatch={vi.fn()}
        onClearImportedPatch={vi.fn()}
        onOpenBundleViewer={vi.fn()}
        onCopyLink={vi.fn()}
        onEnabledChange={vi.fn()}
        onLayerChange={vi.fn()}
        onHeatmapModeChange={vi.fn()}
        onNextIssue={vi.fn()}
        onRecommendationDecision={vi.fn()}
        onZoneChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "지도 진단 켜기" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox", { name: "진단 구역 즉시 이동" })).not.toBeInTheDocument();
  });

  it("selects any of the ten journey zones from the diagnostic console", () => {
    const onZoneChange = vi.fn();
    const onLayerChange = vi.fn();
    const onCopyLink = vi.fn();
    const onNextIssue = vi.fn();
    const onDownloadBundle = vi.fn();
    const onDownloadPatch = vi.fn();
    const onOpenBundleViewer = vi.fn();
    const onImportPatch = vi.fn();
    const onClearImportedPatch = vi.fn();
    const onHeatmapModeChange = vi.fn();
    const onRecommendationDecision = vi.fn();
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="neighborhood"
        enabled
        issueCounts={{
          home: { blocking: 2, warning: 0 },
          banquet: { blocking: 0, warning: 1 }
        }}
        layers={defaultWorldGeometryAuditLayers}
        copyStatus="idle"
        patchStatus="idle"
        bundleStatus="idle"
        patchImportStatus="loaded"
        importedPatchOperationCount={2}
        heatmapMode="pattern"
        recommendations={foregroundRecommendationReviewsForZone("neighborhood")}
        recommendationDecisions={{ "neighborhood/street-tree-1": "accepted" }}
        onDownloadBundle={onDownloadBundle}
        onDownloadPatch={onDownloadPatch}
        onImportPatch={onImportPatch}
        onClearImportedPatch={onClearImportedPatch}
        onOpenBundleViewer={onOpenBundleViewer}
        onCopyLink={onCopyLink}
        onEnabledChange={vi.fn()}
        onLayerChange={onLayerChange}
        onHeatmapModeChange={onHeatmapModeChange}
        onNextIssue={onNextIssue}
        onRecommendationDecision={onRecommendationDecision}
        onZoneChange={onZoneChange}
      />
    );

    const selector = screen.getByRole("combobox", { name: "진단 구역 즉시 이동" });
    expect(selector.querySelectorAll("option")).toHaveLength(10);
    fireEvent.change(selector, { target: { value: "ceremony-hall" } });
    expect(onZoneChange).toHaveBeenCalledWith("ceremony-hall");
    expect(screen.getByText("10 MAPS")).toBeInTheDocument();
    expect(screen.getByLabelText("구역 단축키")).toHaveTextContent("KEY 1–0 · [ ]");

    const gridFilter = screen.getByRole("button", { name: "이동 격자 숨기기" });
    expect(gridFilter).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(gridFilter);
    expect(onLayerChange).toHaveBeenCalledWith("grid", false);
    expect(screen.getByRole("button", { name: "추천 차이 히트맵 숨기기" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("combobox", { name: "히트맵 표시 방식" }), { target: { value: "contrast" } });
    expect(onHeatmapModeChange).toHaveBeenCalledWith("contrast");
    expect(selector.querySelector('option[value="home"]')).toHaveTextContent("B2");
    expect(selector.querySelector('option[value="banquet"]')).toHaveTextContent("W1");

    fireEvent.click(screen.getByRole("button", { name: "다음 진단 오류 구역으로 이동, 차단 2건 경고 1건" }));
    expect(onNextIssue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "현재 진단 링크 복사" }));
    expect(onCopyLink).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "현재 화면 진단 번들 저장" }));
    expect(onDownloadBundle).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "전경 추천 검토 열기" }));
    expect(screen.getByRole("region", { name: "현재 구역 전경 추천 검토" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "street-tree-1 추천 승인" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "street-tree-1 추천 거절" }));
    expect(onRecommendationDecision).toHaveBeenCalledWith("neighborhood/street-tree-1", "rejected");
    fireEvent.click(screen.getByRole("button", { name: "승인 추천 JSON patch 저장, 1개 선택" }));
    expect(onDownloadPatch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "진단 번들 뷰어 열기" }));
    expect(onOpenBundleViewer).toHaveBeenCalledOnce();
    const patchFile = new File(["{}"], "review.patch.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("검토 JSON patch 불러오기"), { target: { files: [patchFile] } });
    expect(onImportPatch).toHaveBeenCalledWith(patchFile);
    expect(screen.getByText("PATCH PREVIEW")).toBeInTheDocument();
    expect(screen.getByText("2 OPS")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "불러온 Patch 미리보기 지우기" }));
    expect(onClearImportedPatch).toHaveBeenCalledOnce();
  });
});
