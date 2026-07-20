# 웨딩 콘텐츠 Task 2 보고서

## 구현 내용

- `scripts/lib/weddingGalleryAssets.mjs`에 매니페스트 로드·검증, 원본 탐색, Sharp WebP 변환, 감사 API를 구현했습니다.
- 원본 파일은 `${id}-source.png|jpg|jpeg|webp` 중 정확히 하나만 허용합니다.
- EXIF 회전 뒤 원본·선언 비율과 출력·원본 비율을 각각 1% 이내로 검사합니다.
- 폭 640px와 1024px WebP를 임시 디렉터리에 모두 만든 뒤 감사를 통과한 경우에만 기존 출력 디렉터리와 교체합니다.
- 감사는 매니페스트 10장, 출력 항목 20개, 파일명, WebP 형식, 폭, 비율, 원본 존재 여부를 차단합니다.
- CLI와 루트 `gallery:*`, `test`, `build` 스크립트, 원본 안내 README 및 ignore 규칙을 추가했습니다.

## TDD

1. `scripts/weddingGalleryAssets.test.mjs`를 먼저 작성했습니다.
2. `node --test scripts/weddingGalleryAssets.test.mjs`는 파이프라인 모듈 부재로 `ERR_MODULE_NOT_FOUND`가 발생해 RED를 확인했습니다.
3. 구현 후 출력 상위 디렉터리 부재 실패와 출력 하위 디렉터리 허용 실패를 각각 재현하고 수정했습니다.

## 검증

- `pnpm gallery:test`: 5개 통과
- `pnpm --filter @wedding-game/shared test`: 7개 파일, 50개 테스트 통과
- `git diff --check`: 통과

## 현재 제약

Task 3이 아직 실제 원본과 배포용 WebP 20개를 만들지 않았습니다. 따라서 `pnpm gallery:audit`는 `wedding-photo-sources/generated/`와 `client/public/images/wedding-gallery/` 누락으로 의도적으로 실패합니다. 루트 `pnpm test`와 `pnpm build`도 시작 단계의 `gallery:audit`에서 같은 이유로 실패합니다.
