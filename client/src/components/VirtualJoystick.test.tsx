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
  it("renders the wedding compass base and thumb using normalized movement variables", () => {
    const onVectorChange = vi.fn();
    render(<VirtualJoystick onVectorChange={onVectorChange} />);

    const control = screen.getByLabelText("가상 조이스틱");
    const base = control.querySelector(".virtual-joystick__base");
    const thumb = control.querySelector(".virtual-joystick__thumb");

    expect(base).toHaveAttribute("src", "/assets/ui/joystick-wedding-compass-base.png");
    expect(thumb).toHaveAttribute("src", "/assets/ui/joystick-wedding-compass-thumb.png");

    fireEvent.keyDown(control, { key: "ArrowRight" });
    expect(thumb).toHaveStyle({ "--joystick-x": "1", "--joystick-y": "0" });

    fireEvent.keyUp(control, { key: "ArrowRight" });
    expect(thumb).toHaveStyle({ "--joystick-x": "0", "--joystick-y": "0" });
  });

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

  it("snaps fractional pointer positions to a cardinal direction", () => {
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

    expect(onVectorChange).toHaveBeenCalledWith({ x: -1, y: 0 });
  });

  it("snaps pointer movement to a single cardinal direction", () => {
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
    fireEvent.pointerMove(control, { clientX: 116, clientY: 132, pointerId: 1 });

    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 0, y: 1 });
  });

  it("supports keyboard movement without trapping normal navigation", () => {
    const onVectorChange = vi.fn();
    render(<VirtualJoystick onVectorChange={onVectorChange} />);

    const control = screen.getByLabelText("가상 조이스틱");
    expect(control).toHaveAttribute("tabindex", "0");

    const tabEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "Tab"
    });
    control.dispatchEvent(tabEvent);

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(onVectorChange).not.toHaveBeenCalled();

    control.focus();
    expect(control).toHaveFocus();

    fireEvent.keyDown(control, { key: "ArrowRight" });
    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 1, y: 0 });

    fireEvent.keyUp(control, { key: "ArrowRight" });
    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });

  it("resets the thumb and suppresses pointer movement while disabled", () => {
    const onVectorChange = vi.fn();
    vi.stubGlobal("PointerEvent", MockPointerEvent);
    const { rerender } = render(<VirtualJoystick onVectorChange={onVectorChange} disabled={false} />);
    const control = screen.getByLabelText("가상 조이스틱");
    vi.spyOn(control, "getBoundingClientRect").mockReturnValue({
      left: 61,
      top: 61,
      right: 139,
      bottom: 139,
      width: 78,
      height: 78
    } as DOMRect);
    control.setPointerCapture = vi.fn();
    control.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(control, { clientX: 130, clientY: 100, pointerId: 1 });
    expect(control.querySelector(".virtual-joystick__thumb")).toHaveStyle({
      "--joystick-x": "1",
      "--joystick-y": "0"
    });

    rerender(<VirtualJoystick onVectorChange={onVectorChange} disabled />);
    expect(control).toHaveAttribute("aria-disabled", "true");
    expect(control.querySelector(".virtual-joystick__thumb")).toHaveStyle({
      "--joystick-x": "0",
      "--joystick-y": "0"
    });
    onVectorChange.mockClear();

    fireEvent.pointerMove(control, { clientX: 70, clientY: 100, pointerId: 1 });
    expect(onVectorChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(control, { pointerId: 1 });
    expect(onVectorChange).toHaveBeenCalledOnce();
    expect(onVectorChange).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it("ignores an unmatched directional keyup while disabled", () => {
    const onVectorChange = vi.fn();
    render(<VirtualJoystick onVectorChange={onVectorChange} disabled />);
    const control = screen.getByLabelText("가상 조이스틱");

    fireEvent.keyDown(control, { key: "ArrowRight" });
    expect(onVectorChange).not.toHaveBeenCalled();

    fireEvent.keyUp(control, { key: "ArrowRight" });
    expect(onVectorChange).not.toHaveBeenCalled();
  });

  it("reports release only for the directional key held before disabling", () => {
    const onVectorChange = vi.fn();
    const { rerender } = render(<VirtualJoystick onVectorChange={onVectorChange} />);
    const control = screen.getByLabelText("가상 조이스틱");

    fireEvent.keyDown(control, { key: "ArrowUp" });
    expect(onVectorChange).toHaveBeenLastCalledWith({ x: 0, y: -1 });

    rerender(<VirtualJoystick onVectorChange={onVectorChange} disabled />);
    onVectorChange.mockClear();

    fireEvent.keyDown(control, { key: "ArrowRight" });
    fireEvent.keyUp(control, { key: "ArrowRight" });
    expect(onVectorChange).not.toHaveBeenCalled();

    fireEvent.keyUp(control, { key: "ArrowUp" });
    expect(onVectorChange).toHaveBeenCalledOnce();
    expect(onVectorChange).toHaveBeenCalledWith({ x: 0, y: 0 });
  });

  it("reports a held directional key release after focus leaves the joystick", () => {
    const onVectorChange = vi.fn();
    const { rerender } = render(
      <>
        <VirtualJoystick onVectorChange={onVectorChange} />
        <button type="button">다른 컨트롤</button>
      </>
    );
    const control = screen.getByLabelText("가상 조이스틱");

    control.focus();
    fireEvent.keyDown(control, { key: "ArrowUp" });
    rerender(
      <>
        <VirtualJoystick onVectorChange={onVectorChange} disabled />
        <button type="button">다른 컨트롤</button>
      </>
    );
    screen.getByRole("button", { name: "다른 컨트롤" }).focus();
    onVectorChange.mockClear();

    fireEvent.keyUp(window, { key: "ArrowUp" });

    expect(onVectorChange).toHaveBeenCalledOnce();
    expect(onVectorChange).toHaveBeenCalledWith({ x: 0, y: 0 });
  });
});
