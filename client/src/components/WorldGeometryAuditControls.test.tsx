import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gardenWorld } from "../game/world";
import { defaultWorldGeometryAuditLayers } from "../game/worldGeometryAuditLayers";
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
        onCopyLink={vi.fn()}
        onEnabledChange={vi.fn()}
        onLayerChange={vi.fn()}
        onNextIssue={vi.fn()}
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
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="home"
        enabled
        issueCounts={{ home: 2, banquet: 1 }}
        layers={defaultWorldGeometryAuditLayers}
        copyStatus="idle"
        onCopyLink={onCopyLink}
        onEnabledChange={vi.fn()}
        onLayerChange={onLayerChange}
        onNextIssue={onNextIssue}
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
    expect(selector.querySelector('option[value="home"]')).toHaveTextContent("!2");

    fireEvent.click(screen.getByRole("button", { name: "다음 진단 오류 구역으로 이동, 총 3건" }));
    expect(onNextIssue).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "현재 진단 링크 복사" }));
    expect(onCopyLink).toHaveBeenCalledOnce();
  });
});
