# 3번 네이비 정장 고정밀 컷아웃 파일럿 v2

이 디렉터리는 품질이 거절된 범용 벡터 v1을 대체하기 위한 3번 캐릭터 전용 파일럿 원본이다.
완성 보행 프레임이 아니라 방향별 원화 파츠를 원본으로 사용한다.

- `atlases/raw/`: 방향별 파츠 생성 원본
- `atlases/clean/`: 원본 보드의 외곽 배경만 제거한 중간 산출물
- `parts/<direction>/`: 얼굴·헤어·의상·관절별 편집 파츠
- `part-layout.json`: 192×288 공용 골격상의 파츠 배치
- `rig.json`: 공용 골격·방향·키프레임과 원본 정책
- `artwork.svg`: 그림자와 방향상 보이지 않는 빈 파츠

`scripts/prepare-guest03-hd-parts.mjs`가 원본 보드에서 파츠를 다시 추출한다.
결과가 잘못되면 원본 보드, 추출 좌표, `part-layout.json` 또는 키프레임을 수정하고 다시 렌더링한다.
`character-assets/generated`의 PNG는 직접 수정하지 않는다.
