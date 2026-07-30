import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorldSecretMemorial } from "./WorldSecretMemorial";

describe("WorldSecretMemorial", () => {
  it("숨은 추억 완주 기념물을 월드 오브젝트로 표시한다", () => {
    render(<WorldSecretMemorial />);
    expect(screen.getByLabelText("숨은 추억을 모두 모아 완성한 기억의 등불")).toHaveTextContent("기억의 등불");
  });
});
