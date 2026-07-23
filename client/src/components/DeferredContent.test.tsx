import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DeferredContent } from "./DeferredContent";

afterEach(cleanup);

it("테스트와 미지원 브라우저에서는 콘텐츠를 즉시 제공한다", () => {
  render(<DeferredContent label="사진"><p>실제 콘텐츠</p></DeferredContent>);
  expect(screen.getByText("실제 콘텐츠")).toBeInTheDocument();
});
