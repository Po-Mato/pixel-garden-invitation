export type SpotId =
  | "wedding-info"
  | "directions"
  | "rsvp"
  | "guestbook"
  | "couple"
  | "gallery"
  | "story";

export type InvitationSpot = {
  id: SpotId;
  title: string;
  actionLabel: string;
  body: string;
};

export const invitationContent = {
  coupleNames: "이서준 & 김하린",
  weddingDate: "2027-05-15",
  weddingTime: "토요일 오후 1시",
  venueName: "라온가든 웨딩홀",
  venueAddress: "서울특별시 강남구 테헤란로 123",
  spots: [
    {
      id: "wedding-info",
      title: "예식 안내",
      actionLabel: "예식 보기",
      body: "2027년 5월 15일 토요일 오후 1시, 라온가든 웨딩홀에서 예식이 진행됩니다."
    },
    {
      id: "directions",
      title: "오시는 길",
      actionLabel: "길 찾기",
      body: "지하철 2호선 역삼역 3번 출구에서 도보 7분입니다. 주차는 웨딩홀 지하 주차장을 이용해 주세요."
    },
    {
      id: "rsvp",
      title: "참석 답변",
      actionLabel: "답변하기",
      body: "참석 여부와 동행 인원을 알려주세요."
    },
    {
      id: "guestbook",
      title: "방명록 우체통",
      actionLabel: "축하 쓰기",
      body: "두 사람에게 축하 메시지를 남겨주세요."
    },
    {
      id: "couple",
      title: "신랑신부 정원",
      actionLabel: "소개 보기",
      body: "서로의 계절을 함께 걷기로 한 두 사람을 소개합니다."
    },
    {
      id: "gallery",
      title: "사진 갤러리",
      actionLabel: "사진 보기",
      body: "두 사람이 함께한 순간들을 모았습니다."
    },
    {
      id: "story",
      title: "연애 스토리 꽃길",
      actionLabel: "스토리 보기",
      body: "첫 만남부터 결혼식까지 이어진 이야기를 따라 걸어보세요."
    }
  ] satisfies InvitationSpot[]
};
