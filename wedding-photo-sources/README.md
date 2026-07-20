# 웨딩 갤러리 원본 사진

원본 사진은 `generated/` 디렉터리에 둡니다. 이 디렉터리는 Git에 포함하지 않습니다.

## 파일명

각 갤러리 ID마다 원본 파일은 정확히 하나여야 합니다.

```text
01-cover-source.png
02-dress-bouquet-source.jpg
```

허용 확장자는 `.png`, `.jpg`, `.jpeg`, `.webp`입니다. ID는 `shared/src/weddingGalleryAssets.json`의 값과 같아야 하며, 같은 ID에 두 개 이상의 원본을 두면 빌드가 실패합니다.

## 비율과 변환

가로 사진은 3:2, 세로 사진은 2:3 비율을 권장합니다. 원본 비율은 매니페스트의 선언 비율과 1% 이내여야 합니다.

```bash
pnpm gallery:build
pnpm gallery:audit
```

`gallery:build`는 각 원본을 폭 640px와 1024px WebP로 변환하여 `client/public/images/wedding-gallery/`에 배치합니다. `gallery:audit`는 20개 출력 파일, WebP 형식, 선언 폭 및 원본 비율을 확인합니다.

## 실제 사진 교체

1. `generated/`에서 해당 ID의 기존 원본을 삭제합니다.
2. 같은 ID와 허용 확장자로 새 원본을 하나만 둡니다.
3. `pnpm gallery:build`를 실행합니다.
4. `pnpm gallery:audit`로 결과를 확인합니다.
