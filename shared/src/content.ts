import { weddingContent } from "./weddingContent";

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
  rsvp: {
    responseDeadline: string;
    deleteAt: string;
    consentVersion: string;
  };
  guestbook: {
    deleteAt: string;
  };
  giftAccounts: {
    notice: string;
    accounts: readonly WeddingGiftAccount[];
  };
  venue: {
    name: string;
    hall: string;
    address: string;
    directions: {
      mapSearchName: string;
      phone: string;
      transit: string;
      parking: string;
    };
  };
};

export type WeddingGiftAccount = {
  id:
    | "groom"
    | "groom-father"
    | "groom-mother"
    | "bride"
    | "bride-father"
    | "bride-mother";
  side: "groom" | "bride";
  relation: "신랑" | "신랑 아버지" | "신랑 어머니" | "신부" | "신부 아버지" | "신부 어머니";
  name: string;
  bank: string;
  accountNumber: string;
  holder: string;
  kakaoPayUrl: string;
  tossUrl: string;
};

export const invitationContent = {
  event: {
    couple: { groom: "이승재", bride: "이건희" },
    title: "이승재 · 이건희 결혼식",
    startAt: "2027-05-01T17:10:00+09:00",
    endAt: "2027-05-01T18:40:00+09:00",
    timeZone: "Asia/Seoul",
    rsvp: {
      responseDeadline: "2027-04-24T23:59:59+09:00",
      deleteAt: "2027-05-31T23:59:59+09:00",
      consentVersion: "2026-07-20"
    },
    guestbook: {
      deleteAt: "2027-05-31T23:59:59+09:00"
    },
    giftAccounts: {
      notice: "축하의 마음만으로도 충분히 감사드립니다.",
      accounts: [
        {
          id: "groom",
          side: "groom",
          relation: "신랑",
          name: "이승재",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        },
        {
          id: "groom-father",
          side: "groom",
          relation: "신랑 아버지",
          name: "",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        },
        {
          id: "groom-mother",
          side: "groom",
          relation: "신랑 어머니",
          name: "",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        },
        {
          id: "bride",
          side: "bride",
          relation: "신부",
          name: "이건희",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        },
        {
          id: "bride-father",
          side: "bride",
          relation: "신부 아버지",
          name: "",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        },
        {
          id: "bride-mother",
          side: "bride",
          relation: "신부 어머니",
          name: "",
          bank: "",
          accountNumber: "",
          holder: "",
          kakaoPayUrl: "",
          tossUrl: ""
        }
      ]
    },
    venue: {
      name: "MJ컨벤션",
      hall: "5층 파티오볼룸",
      address: "경기 부천시 소사구 경인로 386",
      directions: {
        mapSearchName: "MJ컨벤션",
        phone: "032-347-5500",
        transit: "1호선·서해선 소사역 1번 출구에서 도보 약 3분",
        parking: "주차 2시간 무료 · 약 500대 이상 주차 가능"
      }
    }
  } satisfies WeddingEvent,
  content: weddingContent,
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
