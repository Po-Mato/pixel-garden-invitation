import { cleanup, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it } from "vitest";
import { resolveGalleryAssetPath } from "../invitation/galleryAssets";
import { CoupleProfilePanel } from "./CoupleProfilePanel";

afterEach(cleanup);

describe("신랑신부 소개 패널", () => {
  it("공통 콘텐츠의 두 사람 소개와 대표 사진을 세로로 표시한다", () => {
    render(<CoupleProfilePanel />);

    expect(screen.getByRole("heading", { name: "이승재" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이건희" })).toBeInTheDocument();
    expect(screen.getAllByRole("region", { name: /신랑 이승재|신부 이건희/ })).toHaveLength(2);
    expect(screen.getByRole("img", { name: invitationContent.content.gallery[0].alt })).toHaveAttribute(
      "src",
      resolveGalleryAssetPath("images/wedding-gallery/01-cover-1024.webp")
    );
    expect(screen.getByText("저희 두 사람의 새로운 시작에 함께해 주시면 더없는 기쁨이겠습니다.")).toBeInTheDocument();
  });

  it("각 소개를 역할, 이름, 사진, 소개 순서로 한 번씩 읽는다", () => {
    render(<CoupleProfilePanel />);

    const sections = screen.getAllByRole("region", { name: /신랑 이승재|신부 이건희/ });

    invitationContent.content.coupleProfiles.forEach((profile, index) => {
      const [roleLabel, name, image, message] = Array.from(sections[index].children);

      expect(Array.from(sections[index].children).map((element) => element.tagName)).toEqual(["P", "H3", "IMG", "P"]);
      expect(roleLabel).toHaveTextContent(profile.roleLabel);
      expect(name).toHaveTextContent(profile.name);
      expect(image).toHaveAttribute("alt", invitationContent.content.gallery.find((photo) => photo.id === profile.photoId)?.alt);
      expect(message).toHaveTextContent(profile.message);
      expect(Array.from(sections[index].querySelectorAll("p")).filter((element) => element.textContent === profile.roleLabel))
        .toHaveLength(1);
    });
  });
});
