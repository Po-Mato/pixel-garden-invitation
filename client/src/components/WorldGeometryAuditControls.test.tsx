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
        recommendations={[]}
        recommendationDecisions={{}}
        onDownloadBundle={vi.fn()}
        onDownloadPatch={vi.fn()}
        onCopyLink={vi.fn()}
        onEnabledChange={vi.fn()}
        onLayerChange={vi.fn()}
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
    const onRecommendationDecision = vi.fn();
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="home"
        enabled
        issueCounts={{
          home: { blocking: 2, warning: 0 },
          banquet: { blocking: 0, warning: 1 }
        }}
        layers={defaultWorldGeometryAuditLayers}
        copyStatus="idle"
        patchStatus="idle"
        bundleStatus="idle"
        recommendations={foregroundRecommendationReviewsForZone("home")}
        recommendationDecisions={{ "home/home-plant": "accepted" }}
        onDownloadBundle={onDownloadBundle}
        onDownloadPatch={onDownloadPatch}
        onCopyLink={onCopyLink}
        onEnabledChange={vi.fn()}
        onLayerChange={onLayerChange}
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
    expect(screen.getByRole("button", { name: "home-plant 추천 승인" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "home-plant 추천 거절" }));
    expect(onRecommendationDecision).toHaveBeenCalledWith("home/home-plant", "rejected");
    fireEvent.click(screen.getByRole("button", { name: "승인 추천 JSON patch 저장, 1개 선택" }));
    expect(onDownloadPatch).toHaveBeenCalledOnce();
  });
});
