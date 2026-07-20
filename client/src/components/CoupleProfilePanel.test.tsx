import { cleanup, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it } from "vitest";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";
import { CoupleProfilePanel } from "./CoupleProfilePanel";

afterEach(cleanup);

describe("신랑신부 소개 패널", () => {
  it("공통 콘텐츠의 두 사람 소개와 대표 사진을 세로로 표시한다", () => {
    render(<CoupleProfilePanel />);

    expect(screen.getByRole("heading", { name: "신랑 이승재" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "신부 이건희" })).toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /신랑 이승재|신부 이건희/ })).toHaveLength(2);
    expect(screen.getByRole("img", { name: invitationContent.content.gallery[0].alt })).toHaveAttribute(
      "src",
      resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp")
    );
    expect(screen.getByText("저희 두 사람의 새로운 시작에 함께해 주시면 더없는 기쁨이겠습니다.")).toBeInTheDocument();
  });
});
