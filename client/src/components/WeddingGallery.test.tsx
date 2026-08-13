import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { invitationContent } from "@wedding-game/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ViewPreferencesProvider } from "../accessibility/ViewPreferencesContext";
import { defaultViewPreferences } from "../accessibility/viewPreferences";
import { WeddingGallery } from "./WeddingGallery";

afterEach(cleanup);

describe("에디토리얼 웨딩 갤러리", () => {
  it("공유 메타데이터 순서대로 10장의 사진 버튼과 캡션을 렌더링한다", () => {
    render(<WeddingGallery />);

    const photos = invitationContent.content.gallery;
    expect(screen.getByText("10장의 소중한 순간")).toBeInTheDocument();
    expect(screen.getByText("사진을 누르면 전체 화면으로 감상할 수 있어요.")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /사진 \d+:/ });
    expect(buttons).toHaveLength(10);
    expect(screen.getAllByText("크게 보기")).toHaveLength(10);
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(
      photos.map((photo, index) => `사진 ${index + 1}: ${photo.alt}`)
    );
    const images = screen.getAllByRole("img");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[0]).toHaveAttribute("fetchpriority", "high");
    images.slice(1).forEach((image) => {
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("fetchpriority", "auto");
      expect(image).toHaveAttribute("decoding", "async");
    });

    photos.forEach((photo, index) => {
      const item = buttons[index].closest("figure");
      expect(item).toHaveClass("wedding-gallery__item", `wedding-gallery__item--${photo.layout}`);
      expect(item).toHaveAttribute("data-photo-id", photo.id);
      expect(item).toHaveAttribute("data-orientation", photo.orientation);
      expect(item?.querySelector(".wedding-gallery__caption-meta")).toHaveTextContent(
        `${photo.orientation === "portrait" ? "PORTRAIT" : "LANDSCAPE"} · ${String(index + 1).padStart(2, "0")}`
      );
      if (photo.caption) {
        expect(item).toHaveAttribute("data-has-caption", "true");
        expect(item).toHaveTextContent(photo.caption);
      } else {
        expect(item).not.toHaveAttribute("data-has-caption");
      }
    });
  });

  it("선택한 사진의 메타데이터 인덱스를 열기 콜백으로 전달한다", () => {
    const onPhotoOpen = vi.fn();
    render(<WeddingGallery onPhotoOpen={onPhotoOpen} />);

    fireEvent.click(screen.getAllByRole("button", { name: /사진 \d+:/ })[4]);

    expect(onPhotoOpen).toHaveBeenCalledWith(4);
    expect(screen.getByRole("dialog", { name: "웨딩 사진 전체 화면" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "웨딩 사진 바로 선택" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5번 사진 보기" })).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("button", { name: /사진 \d+:/ })[4]).toHaveAttribute("aria-current", "true");
  });

  it("전체 화면 번호 트랙으로 원하는 사진을 바로 선택한다", () => {
    render(<WeddingGallery />);
    fireEvent.click(screen.getAllByRole("button", { name: /사진 \d+:/ })[0]);

    fireEvent.click(screen.getByRole("button", { name: "8번 사진 보기" }));

    expect(screen.getByRole("button", { name: "8번 사진 보기" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("사진").parentElement).toHaveTextContent("8/ 10");
  });

  it("라이트박스를 닫으면 선택했던 사진 버튼으로 포커스를 복원한다", () => {
    render(<WeddingGallery />);
    const selectedPhoto = screen.getAllByRole("button", { name: /사진 \d+:/ })[4];

    fireEvent.click(selectedPhoto);
    fireEvent.click(screen.getByRole("button", { name: "전체 화면 닫기" }));

    expect(screen.queryByRole("dialog", { name: "웨딩 사진 전체 화면" })).not.toBeInTheDocument();
    expect(selectedPhoto).toHaveFocus();
    expect(selectedPhoto).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("05번 사진까지 감상했어요.")).toBeInTheDocument();
    expect(selectedPhoto).toHaveTextContent("다시 보기");
  });

  it("라이트박스에서 넘겨 본 현재 사진으로 선택 상태와 포커스를 옮긴다", () => {
    render(<WeddingGallery />);
    const photoButtons = screen.getAllByRole("button", { name: /사진 \d+:/ });

    fireEvent.click(photoButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "다음 사진" }));
    fireEvent.click(screen.getByRole("button", { name: "전체 화면 닫기" }));

    expect(photoButtons[2]).toHaveAttribute("aria-current", "true");
    expect(photoButtons[2]).toHaveFocus();
  });

  it("데이터 절약 중에는 4장만 먼저 표시하고 요청할 때 나머지를 불러온다", () => {
    render(
      <ViewPreferencesProvider initialPreferences={{ ...defaultViewPreferences, dataSaver: true }}>
        <WeddingGallery />
      </ViewPreferencesProvider>
    );

    expect(screen.getAllByRole("button", { name: /사진 \d+:/ })).toHaveLength(4);
    expect(screen.getByText("데이터 절약 중 · 사진 4/10장 표시")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "나머지 6장 불러오기" }));
    expect(screen.getAllByRole("button", { name: /사진 \d+:/ })).toHaveLength(10);
  });
});
