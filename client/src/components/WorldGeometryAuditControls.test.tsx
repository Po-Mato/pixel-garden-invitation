import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gardenWorld } from "../game/world";
import { WorldGeometryAuditControls } from "./WorldGeometryAuditControls";

afterEach(cleanup);

describe("WorldGeometryAuditControls", () => {
  it("keeps the zone console folded while diagnostics are off", () => {
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="home"
        enabled={false}
        onEnabledChange={vi.fn()}
        onZoneChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "지도 진단 켜기" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("combobox", { name: "진단 구역 즉시 이동" })).not.toBeInTheDocument();
  });

  it("selects any of the ten journey zones from the diagnostic console", () => {
    const onZoneChange = vi.fn();
    render(
      <WorldGeometryAuditControls
        zones={gardenWorld.zones}
        activeZoneId="home"
        enabled
        onEnabledChange={vi.fn()}
        onZoneChange={onZoneChange}
      />
    );

    const selector = screen.getByRole("combobox", { name: "진단 구역 즉시 이동" });
    expect(selector.querySelectorAll("option")).toHaveLength(10);
    fireEvent.change(selector, { target: { value: "ceremony-hall" } });
    expect(onZoneChange).toHaveBeenCalledWith("ceremony-hall");
    expect(screen.getByText("10 MAPS")).toBeInTheDocument();
  });
});
