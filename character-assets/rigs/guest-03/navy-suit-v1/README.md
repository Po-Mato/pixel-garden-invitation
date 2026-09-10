# 3번 네이비 정장 컷아웃 파일럿

이 디렉터리가 3번 하객의 편집 가능한 원본이다. `artwork.svg`의 방향별 파츠와
`rig.json`의 관절·키프레임만 수정한다. 생성 PNG를 직접 수정하지 않는다.

## 원본과 출력 경계

- 공용 골격: `../../common-three-head-v1/skeleton.json`
- 캐릭터 파츠: `artwork.svg`
- 부모 관절·방향·키프레임: `rig.json`
- 자동 생성물: `character-assets/generated/cutout-pilot-v1/guest-03/`
- 검수 자료: `.superpowers/character-review/guest-03-cutout-pilot-v1/`

## 규칙

- 방향별 파츠 ID는 `down-*`, `left-*`, `right-*`, `up-*`로 각각 존재한다.
- 오른쪽 파츠를 왼쪽 파츠의 좌우 반전으로 만들지 않는다.
- 애니메이션은 회전과 이동만 허용하며 파츠 확대·축소는 허용하지 않는다.
- 2번과 4번은 동일한 중립 키프레임이다.
- 결과가 잘못되면 이 디렉터리의 SVG 파츠 또는 JSON 키프레임을 고친 뒤 다시 렌더링한다.

```sh
pnpm characters:build-cutout-pilot
pnpm characters:audit-cutout-pilot
```
