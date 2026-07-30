import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameDeviceReadinessCenter } from "./GameDeviceReadinessCenter";

const analytics = vi.hoisted(() => ({ trackInvitationAnalytics: vi.fn(), flushInvitationAnalytics: vi.fn() }));
const detailApi = vi.hoisted(() => ({ postDeviceQaDetailReport: vi.fn() }));
vi.mock("../analytics/invitationAnalytics", () => analytics);
vi.mock("../api/deviceQaReportApi", () => detailApi);
afterEach(cleanup);

describe("GameDeviceReadinessCenter", () => {
  it("자동 점검과 실제 사용 체크 항목을 함께 제공한다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
    render(<GameDeviceReadinessCenter />);
    fireEvent.click(screen.getByText("내 휴대폰 최종 점검"));
    fireEvent.click(screen.getByRole("button", { name: "자동 점검 실행" }));
    expect(screen.getByRole("region", { name: "휴대폰 자동 점검 결과" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /조이스틱과 타일 이동/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이동 불편 선택" })).toBeInTheDocument();
  });

  it("선택한 불편 항목만 익명 집계 이벤트로 보낸다", async () => {
    analytics.flushInvitationAnalytics.mockResolvedValue(undefined);
    detailApi.postDeviceQaDetailReport.mockResolvedValue({ accepted: true });
    render(<GameDeviceReadinessCenter />);
    fireEvent.click(screen.getByText("내 휴대폰 최종 점검"));
    fireEvent.click(screen.getByRole("button", { name: "자동 점검 실행" }));
    fireEvent.click(screen.getByRole("button", { name: "이동 불편 선택" }));
    fireEvent.click(screen.getByRole("button", { name: "익명 점검 보내기" }));
    expect(await screen.findByRole("status")).toHaveTextContent("개인정보 없이");
    expect(analytics.trackInvitationAnalytics).toHaveBeenCalledWith("device_qa", expect.stringMatching(/:issue-movement$/));
  });
});
