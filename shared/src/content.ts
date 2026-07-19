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

export type WeddingEvent = {
  couple: {
    groom: string;
    bride: string;
  };
  title: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  venue: {
    name: string;
    hall: string;
    address: string;
  };
};

export const invitationContent = {
  event: {
    couple: { groom: "이승재", bride: "이건희" },
    title: "이승재 · 이건희 결혼식",
    startAt: "2027-05-01T17:10:00+09:00",
    endAt: "2027-05-01T18:40:00+09:00",
    timeZone: "Asia/Seoul",
    venue: {
      name: "MJ컨벤션",
      hall: "5층 파티오볼룸",
      address: "경기 부천시 소사구 경인로 386"
    }
  } satisfies WeddingEvent,
  spots: [
    {
      id: "wedding-info",
      title: "예식 안내",
      actionLabel: "예식 보기",
      body: "2027년 5월 1일 토요일 오후 5시 10분, MJ컨벤션 5층 파티오볼룸에서 예식이 진행됩니다."
    },
    {
      id: "directions",
      title: "오시는 길",
      actionLabel: "길 찾기",
      body: "MJ컨벤션은 경기 부천시 소사구 경인로 386에 있습니다."
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
