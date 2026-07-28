export type CooperativeCelebrationPulse = {
  guestId: string;
  nickname: string;
  at: number;
};

export type CooperativeCelebrationResult = {
  pulses: CooperativeCelebrationPulse[];
  completed: boolean;
  participantNames: string[];
};

export function registerCooperativeCelebration(
  current: readonly CooperativeCelebrationPulse[],
  pulse: CooperativeCelebrationPulse,
  windowMs = 4_500,
  requiredGuests = 2
): CooperativeCelebrationResult {
  const recent = current.filter(({ at }) => pulse.at - at <= windowMs && pulse.at >= at);
  const byGuest = new Map(recent.map((entry) => [entry.guestId, entry]));
  byGuest.set(pulse.guestId, pulse);
  const pulses = [...byGuest.values()].sort((left, right) => left.at - right.at);
  return {
    pulses,
    completed: pulses.length >= requiredGuests,
    participantNames: pulses.map(({ nickname }) => nickname)
  };
}
