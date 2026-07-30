import type { GameTransferState } from "../api/gameTransferApi";

export type GameTransferLiveRole = "sender" | "receiver";

export type GameTransferLiveStep = {
  id: "ready" | "connected" | "preview" | "restored";
  label: string;
  complete: boolean;
  current: boolean;
};

const senderLabels = ["QR 준비", "받는 기기 연결", "복원 내용 확인", "이전 완료"] as const;
const receiverLabels = ["QR 읽음", "보내는 기기 연결", "복원 내용 확인", "진행 적용"] as const;

function completedStepCount(state: Pick<GameTransferState, "status" | "receiverPhase" | "receiverSeenAt">): number {
  if (state.status === "claimed") return 4;
  if (state.status !== "active") return 0;
  if (state.receiverPhase === "restoring") return 3;
  if (state.receiverPhase === "previewing") return 3;
  if (state.receiverPhase === "opened" || state.receiverSeenAt) return 2;
  return 1;
}

export function gameTransferLiveSteps(
  role: GameTransferLiveRole,
  state: Pick<GameTransferState, "status" | "receiverPhase" | "receiverSeenAt">
): GameTransferLiveStep[] {
  const count = completedStepCount(state);
  const labels = role === "sender" ? senderLabels : receiverLabels;
  const ids = ["ready", "connected", "preview", "restored"] as const;
  return ids.map((id, index) => ({
    id,
    label: labels[index],
    complete: index < count,
    current: state.status === "active" && index === Math.min(3, count)
  }));
}

export function gameTransferLiveStatusLabel(
  role: GameTransferLiveRole,
  state: Pick<GameTransferState, "status" | "receiverPhase" | "receiverSeenAt">
): string {
  if (state.status === "claimed") return role === "sender" ? "받는 기기에서 복원을 마쳤어요" : "이 기기에 진행을 적용했어요";
  if (state.status === "revoked") return "보내는 기기에서 이전을 취소했어요";
  if (state.status === "expired") return "기기 이전 사용 시간이 지났어요";
  if (state.receiverPhase === "restoring") return "받는 기기에서 진행을 적용하고 있어요";
  if (state.receiverPhase === "previewing") return "받는 기기에서 복원 내용을 확인하고 있어요";
  if (state.receiverPhase === "opened" || state.receiverSeenAt) return "두 기기가 연결됐어요";
  return role === "sender" ? "받는 기기에서 QR을 읽기를 기다려요" : "보내는 기기와 연결하고 있어요";
}
