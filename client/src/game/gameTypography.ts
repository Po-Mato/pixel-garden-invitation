const criticalKoreanGlyphs = "ㄷㅅㅇㅋㅎㅜㅠㆍ中文日本美語가각간갈감갑값갓갔강갖같개객갤거걱건걸검겁것게겐겠겨격겪견결겸겼경계고곡곤곧골곳공과관광괜괴교구국군굴굿궁권귀규균그극근글금급기긴길김깊까깐깔깜깨꺼께껴꼬꼭꼴꽃꾸꾼꿀꿈끄끈끌끔끝끼낌나낙낚난날남납났낭낮내낸낼냈냉냐냥너널넓넘넣네넥넷녀녁년념녕노녹논놀농높놓누눈눌뉴느는늘능늦니닉닌닐님닙닝다닥단닫달닭담답닷당대댓더덕던덜덤덧덩데덴델도독돈돋돌동돼됐되된될됨됩두둔둘둥뒤뒷듀드득든듣들듬듯등디딜딩따딱딸땅때땐떠떡떤떨떻또똑뛰뜨뜻띠라락란랄람랍랐랑래랙랜램랩랫랭략량러럭런럴럼럽렇레렉렌렛려력련렬렴렵렸령례로록론롤롭롯롱뢰료룡루룩룸룹류률르른를름릉리릭린릴림립릿링마막만많말맑맘맛망맞맡매맥맨맵맹맺머먹먼멀멋멍메멘멜멤며면멸명몇모목몬몰몸못몽묘무묵문묻물뭐뭔뮤므미믹민믿밀밍및밑바박밖반받발밝밤밥방배백밴뱅버번벌범법벗베벤벨벳벼벽변별병보복본볼봄봅봇봉봐봤부북분불붕붙뷔뷰브븐블비빅빈빌빙빛빠빨빵빼뻐뽑뿌뿐쁘쁜사삭산살삶삼상새색샘생샤샵샷서석선설섬섭성세섹센셀셋셔션셜셨소속손솔송쇄쇼수숙순술숨숲쉬쉽슈스슨슬슴습슷승시식신실싫심십싱싶싸쌍써썸쓰쓴쓸씀씨씩씬아악안앉않알암압았앙앞애액앤앨앱야약양얘어억언얻얼엄업없엇었엉에엑엔엘엠여역엮연열염엽였영옆예옛오옥온올옵옷옹와완왔왕왜외왼요욕용우욱운울움웃웅워원월웠웨웹위윈윗유육윤율융으은을음응의이익인일읽임입잇있잉잊자작잔잘잠잡장재쟁저적전절젊점접정제젝젠젤져졌조족존졸좀종좋좌죄죠주죽준줄줌줍중줘쥐쥬즈즉즌즐즘증지직진질짐집짓징짜짝짤짧짱째쪽쯤찌찍차착찬찮찰참창찾채책처척천철첨첩첫청체쳐쳤초촉촌총촬최추축춘출춤충춰취츠측층치칙친칠침칭카칸칼캐캔캘캠캡커컨컬컴컵컷케켓켜코콘콜콤콩쾌쿠쿨퀘퀴퀵큐크큰클큼키킨킬킹타탁탄탈탐탑탕태택탱터턴털테텍텐텔템토톡톤톱통퇴투툰툴튀튜트특튼틀티틱틴틸팀팁팅파판팔팝패팩팬팸퍼펀페펜펴편펼평폐포폭폰폴폼표푸풀품풍퓨프픈플피픽핀필핑하학한할함합핫항해핵핸했행향허헌험헤헬혀혁현혈혐협혔형혜호혹혼홀홈홍화확환활황회획횟효후훈훼휘휴흐흑흔흘흡흥희히힌힐힘";

function isKoreanTypographyCodePoint(codePoint: number) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x11ff)
    || (codePoint >= 0x3130 && codePoint <= 0x318f)
    || (codePoint >= 0x3400 && codePoint <= 0x9fff)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
  );
}

export function requiresExtendedGameTypography(values: readonly string[]) {
  for (const value of values) {
    for (const glyph of value.normalize("NFC")) {
      const codePoint = glyph.codePointAt(0);
      if (codePoint !== undefined && isKoreanTypographyCodePoint(codePoint) && !criticalKoreanGlyphs.includes(glyph)) {
        return true;
      }
    }
  }
  return false;
}

let extendedGameTypography: Promise<unknown> | null = null;

export function loadExtendedGameTypography() {
  extendedGameTypography ??= import("@fontsource-variable/noto-sans-kr/wght.css");
  return extendedGameTypography;
}
