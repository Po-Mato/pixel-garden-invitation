import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VirtualJoystick } from "./VirtualJoystick";

class MockPointerEvent extends MouseEvent {
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    Object.defineProperty(this, "pointerId", { value: init.pointerId ?? 0 });
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("VirtualJoystick", () => {
  it("reports a normalized movement vector while dragging", () => {
    const onVectorChange = vi.fn();
    vi.stubGlobal("PointerEvent", MockPointerEvent);
    render(<VirtualJoystick onVectorChange={onVectorChange} />);

    const control = screen.getByLabelText("가상 조이스틱");
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue({
      x: 61,
      y: 61,
      left: 61,
      top: 61,
      right: 139,
      bottom: 139,
      width: 78,
      height: 78,
      toJSON: () => ({})
    } as DOMRect);
    control.setPointerCapture = vi.fn();
    control.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(control, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 130, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(control, { pointerId: 1 });

    expect(onVectorChange).toHaveBeenCalledWith({ x: 1, y: 0 });
    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });

  it("rounds normalized movement with toFixed semantics", () => {
    const onVectorChange = vi.fn();
    vi.stubGlobal("PointerEvent", MockPointerEvent);
    render(<VirtualJoystick onVectorChange={onVectorChange} />);

    const control = screen.getByLabelText("가상 조이스틱");
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue({
      x: 11.75,
      y: 61,
      left: 11.75,
      top: 61,
      right: 89.75,
      bottom: 139,
      width: 78,
      height: 78,
      toJSON: () => ({})
    } as DOMRect);
    control.setPointerCapture = vi.fn();
    control.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(control, { clientX: 51, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(control, { clientX: 23, clientY: 100, pointerId: 1 });

    expect(onVectorChange).toHaveBeenCalledWith({ x: -0.93, y: 0 });
  });
});
