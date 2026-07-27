import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TransitionEvent as ReactTransitionEvent
} from "react";
import { Accessibility, ArrowRight, Camera, CircleHelp, Images, MapPinned, RefreshCw, Share2, X } from "lucide-react";
import {
  invitationContent,
  type ClientMessage,
  type Direction,
  type GuestReaction,
  type RoomGuest,
  type SpotId,
  type WorldZoneId
} from "@wedding-game/shared";
import { shouldReduceMotion } from "../accessibility/viewPreferences";
import { computeCameraTransform, screenToWorld, type ViewportSize } from "../game/camera";
import { resolveFootstepSurface, type FootstepSurface } from "../game/footstepSurface";
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import { findNearestInteractionRoute, findNearestPortalRoute, findTilePath } from "../game/pathfinding";
import { portalAudioMixAt } from "../game/portalAudio";
import { shouldProcessGameFrame } from "../game/renderCadence";
import {
  advanceTileInput,
  createTileInputState,
  tileInputRepeatIntervalMs,
  type TileInputState
} from "../game/tileInput";
import { advanceWalkPhase, neutralWalkFrame, walkFrameForPhase, walkLandingFootForFrame } from "../game/walkTiming";
import {
  completeJourneyCheckpoint,
  journeyCheckpointForInteraction,
  journeyCheckpointForZone,
  journeyCheckpoints,
  loadJourneyProgress,
  nextJourneyCheckpoint,
  saveJourneyProgress,
  type JourneyCheckpoint,
  type JourneyCheckpointId
} from "../game/journeyProgress";
import { completeGameGuide, loadGameGuideState, shouldAutoOpenGameGuide } from "../game/gameGuide";
import { journeyDirectionLabels, resolveJourneyGuidance } from "../game/journeyGuidance";
import { quickInvitationHashForCheckpoint } from "../game/journeyAccessibility";
import { summarizeRemainingJourney } from "../game/journeyRouteSummary";
import { resolveNpcDialogue, type NpcDialogue, type NpcId } from "../game/npcDialogue";
import { navigationProgress } from "../game/navigationProgress";
import {
  firstJourneyWaypoint,
  estimateJourneyWaypointPlan,
  moveJourneyWaypoint,
  normalizeJourneyWaypointPlan,
  remainingJourneyWaypoints,
  toggleJourneyWaypoint
} from "../game/journeyWaypointPlan";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
import { useDevicePerformance } from "../performance/DevicePerformanceContext";
import {
  gardenWorld,
  getWorldZone,
  pointInPortalEntry,
  portalEntryRect,
  type Point,
  type Rect,
  type WorldPhotoSpotId,
  type WorldPortal,
  type WorldZone
} from "../game/world";
import {
  nextWorldZoneToward,
  preloadAdjacentWorldZoneAssets,
  preloadWorldZoneAssets
} from "../game/worldAssetPreloader";
import { worldDepth } from "../game/worldVisuals";
import {
  loadWeddingPhotoAlbum,
  weddingPhotoAlbumProgress,
  type WeddingPhotoMemory
} from "../game/weddingPhoto";
import { connectRealtimeWithRetry, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { CharacterSprite } from "./CharacterSprite";
import { DirectionsSheet } from "./DirectionsSheet";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { GameFirstVisitGuide } from "./GameFirstVisitGuide";
import { GiftAccountSheet } from "./GiftAccountSheet";
import { GameFeedbackToggle } from "./GameFeedbackToggle";
import { GuestReactionBubble, GuestReactionDock } from "./GuestReactions";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { InvitationShareAccess } from "./InvitationShareAccess";
import { JourneyCompletion } from "./JourneyCompletion";
import { JourneyRouteSheet } from "./JourneyRouteSheet";
import { JourneyStampBook, JourneyStampNotice } from "./JourneyStampBook";
import { NpcDialogueBubble } from "./NpcDialogueBubble";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";
import { WeddingDayQuickAccess } from "./WeddingDayQuickAccess";
import { WeddingDayActionBar } from "./WeddingDayActionBar";
import { WeddingNpc } from "./WeddingNpc";
import { WeddingPhotoBooth } from "./WeddingPhotoBooth";
import { WeddingPhotoAlbum } from "./WeddingPhotoAlbum";
import { WorldMapArtwork } from "./WorldMapArtwork";
import { WorldDecoration } from "./WorldDecoration";
import { WorldMiniMap } from "./WorldMiniMap";
import "../journey.css";
import "../game-guide.css";
import "../npc-reactions.css";
import "../game-mobile-controls.css";
import "../wedding-photo.css";
import "../game-luxe-theme.css";
import "../game-navigation-enhancements.css";

type GameWorldProps = {
  profile: EntryProfile;
  weddingDayPreview?: boolean;
  onOpenQuickView?: () => void;
};
type RealtimeStatus = "offline" | "connecting" | "reconnecting" | "online" | "full";
type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type RealtimeConnection = ReturnType<typeof connectRealtimeWithRetry>;
type PortalIntent = { portal: WorldPortal; path: Point[] };
type WorldInteractionIntent = {
  targetId: string;
  spotId?: SpotId;
  label: string;
  path: Point[];
  target: Point;
  targetRect: Rect;
  actionRadius: number;
  photoSpotId?: WorldPhotoSpotId;
  npcId?: NpcId;
};
type NavigationResumeIntent =
  | { kind: "portal"; portal: WorldPortal }
  | { kind: "interaction"; intent: WorldInteractionIntent }
  | { kind: "map"; target: Point };
type ActiveGuestReaction = {
  reaction: GuestReaction;
  token: number;
  zoneId: WorldZoneId;
};
type PortalTransitionPhase = "arrival" | "fade-out" | "fade-in";
type PortalTransition = { portal: WorldPortal; phase: PortalTransitionPhase };

const joystickDeadZone = 0.05;
const realtimeMoveIntervalMs = 100;
const realtimeTerminalStopConfirmDelayMs = realtimeMoveIntervalMs + 25;
const portalArrivalDelayMs = 150;
const portalFadeOutMs = 250;
const portalFadeOutFallbackMs = 1000;
const portalFadeInMs = 300;
const npcInteractionRadius = 30;
const reactionVisibleMs = 2200;
const defaultViewport: ViewportSize = { width: 390, height: 520 };
const samePoint = (first: Point, second: Point) => first.x === second.x && first.y === second.y;
const hasJoystickMovement = (vector: Point) => Math.hypot(vector.x, vector.y) > joystickDeadZone;
const pixelRect = (rect: { x: number; y: number; width: number; height: number }) => ({
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height
});
const rectCenter = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
const npcInteractionRect = (npc: { x: number; y: number }): Rect => ({
  x: npc.x - 30,
  y: npc.y - 45,
  width: 60,
  height: 75
});

function journeyMarkerPoint(zone: WorldZone, checkpoint: JourneyCheckpoint): Point | null {
  const checkpointTarget = checkpoint.target;
  if (checkpointTarget.type === "spot") {
    const target = zone.spots.find((spot) => spot.id === checkpointTarget.spotId);
    return target ? rectCenter(target) : null;
  }
  if (checkpointTarget.type === "npc") {
    const target = zone.npcs.find((npc) => npc.id === checkpointTarget.npcId);
    return target ? { x: target.x, y: target.y } : null;
  }
  if (zone.npcs.length > 0) {
    return {
      x: zone.npcs.reduce((sum, npc) => sum + npc.x, 0) / zone.npcs.length,
      y: zone.npcs.reduce((sum, npc) => sum + npc.y, 0) / zone.npcs.length
    };
  }
  return zone.spawn;
}

function withoutCurrentGuest(guests: RoomGuest[], currentGuestId: string | null): RoomGuest[] {
  return currentGuestId ? guests.filter((guest) => guest.guestId !== currentGuestId) : guests;
}

function upsertGuest(guests: RoomGuest[], guest: RoomGuest, currentGuestId: string | null): RoomGuest[] {
  if (guest.guestId === currentGuestId) return guests;
  const found = guests.some((candidate) => candidate.guestId === guest.guestId);
  return found
    ? guests.map((candidate) => (candidate.guestId === guest.guestId ? guest : candidate))
    : [...guests, guest];
}

function moveGuest(guests: RoomGuest[], guestId: string, position: MoveMessage): RoomGuest[] {
  return guests.map((guest) => guest.guestId === guestId ? {
    ...guest,
    x: position.x,
    y: position.y,
    direction: position.direction,
    moving: position.moving,
    seq: position.seq,
    zoneId: position.zoneId
  } : guest);
}

function realtimeStatusText(status: RealtimeStatus) {
  if (status === "online") return "실시간 정원";
  if (status === "full") return "실시간 만석 · 솔로 모드";
  if (status === "reconnecting") return "실시간 재연결 중";
  if (status === "connecting") return "실시간 연결 중";
  return "오프라인 정원";
}

export function GameWorld({ profile, weddingDayPreview = false, onOpenQuickView }: GameWorldProps) {
  const devicePerformance = useDevicePerformance();
  const { preferences: viewPreferences } = useViewPreferences();
  const { playFeedback, playJourneyHaptic, setFeedbackZone, setPortalAudio } = useGameFeedback();
  const initialZone = getWorldZone(gardenWorld, gardenWorld.defaultZoneId);
  const [activeZoneId, setActiveZoneId] = useState<WorldZoneId>(initialZone.id);
  const activeZone = getWorldZone(gardenWorld, activeZoneId);
  const [position, setPosition] = useState<Point>(initialZone.spawn);
  const [target, setTargetState] = useState<Point | null>(null);
  const [mapPath, setMapPath] = useState<Point[]>([]);
  const [portalIntent, setPortalIntentState] = useState<PortalIntent | null>(null);
  const [interactionIntent, setInteractionIntentState] = useState<WorldInteractionIntent | null>(null);
  const [portalTransition, setPortalTransitionState] = useState<PortalTransition | null>(null);
  const [inputReleaseRequired, setInputReleaseRequiredState] = useState(false);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(neutralWalkFrame);
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [activePhotoSpotId, setActivePhotoSpotId] = useState<WorldPhotoSpotId | null>(null);
  const [photoAlbum, setPhotoAlbum] = useState(loadWeddingPhotoAlbum);
  const [photoAlbumOpen, setPhotoAlbumOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
  const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
  const [giftAccountSheetOpen, setGiftAccountSheetOpen] = useState(false);
  const [familyContactSheetOpen, setFamilyContactSheetOpen] = useState(false);
  const [weddingDaySheetOpen, setWeddingDaySheetOpen] = useState(false);
  const [guestInformationOpen, setGuestInformationOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [travelStatus, setTravelStatus] = useState("우리 집에서 여정을 시작해요");
  const [routeRecalculationId, setRouteRecalculationId] = useState(0);
  const [journeyProgress, setJourneyProgress] = useState(loadJourneyProgress);
  const [plannedCheckpointIds, setPlannedCheckpointIds] = useState(() => (
    remainingJourneyWaypoints(loadJourneyProgress()).map(({ id }) => id)
  ));
  const [gameGuideOpen, setGameGuideOpen] = useState(() => (
    shouldAutoOpenGameGuide(loadGameGuideState(), journeyProgress)
  ));
  const [pendingJourneyGuideId, setPendingJourneyGuideId] = useState<JourneyCheckpointId | null>(null);
  const [activeJourneyGuideId, setActiveJourneyGuideId] = useState<JourneyCheckpointId | null>(null);
  const [stampedCheckpointId, setStampedCheckpointId] = useState<JourneyCheckpointId | null>(null);
  const [journeyCompletionPending, setJourneyCompletionPending] = useState(false);
  const [journeyCompletionOpen, setJourneyCompletionOpen] = useState(false);
  const [journeyRouteOpen, setJourneyRouteOpen] = useState(false);
  const [activeNpcDialogue, setActiveNpcDialogue] = useState<NpcDialogue | null>(null);
  const [localReaction, setLocalReaction] = useState<ActiveGuestReaction | null>(null);
  const [remoteReactions, setRemoteReactions] = useState<Record<string, ActiveGuestReaction>>({});
  const [viewport, setViewport] = useState<ViewportSize>(defaultViewport);
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [loadedBackgroundZoneId, setLoadedBackgroundZoneId] = useState<WorldZoneId | null>(null);
  const nestedMenuSheetOpen = calendarSheetOpen
    || directionsSheetOpen
    || giftAccountSheetOpen
    || familyContactSheetOpen
    || weddingDaySheetOpen
    || guestInformationOpen
    || shareSheetOpen
    || viewSettingsOpen
    || photoAlbumOpen
    || gameGuideOpen
    || journeyRouteOpen;

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreMenuButtonFocusRef = useRef(false);
  const activeZoneIdRef = useRef<WorldZoneId>(initialZone.id);
  const positionRef = useRef<Point>(initialZone.spawn);
  const directionRef = useRef<Direction>("down");
  const portalIntentRef = useRef<PortalIntent | null>(null);
  const interactionIntentRef = useRef<WorldInteractionIntent | null>(null);
  const navigationResumeRef = useRef<NavigationResumeIntent | null>(null);
  const portalTransitionRef = useRef<PortalTransition | null>(null);
  const targetStepAtRef = useRef<number | null>(null);
  const tileInputStateRef = useRef<TileInputState | null>(null);
  const joystickWasMovingRef = useRef(false);
  const inputReleaseRequiredRef = useRef(false);
  const inputGenerationRef = useRef(0);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const currentGuestIdRef = useRef<string | null>(null);
  const moveSeqRef = useRef(0);
  const lastSentMoveRef = useRef<MoveMessage | null>(null);
  const journeyProgressRef = useRef(journeyProgress);
  const journeyGuideLastZoneRef = useRef<WorldZoneId | null>(null);
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);
  const terminalStopConfirmTimerRef = useRef<number | null>(null);
  const localReactionTimerRef = useRef<number | null>(null);
  const remoteReactionTimersRef = useRef(new Map<string, number>());
  const reactionTokenRef = useRef(0);
  const walkPhaseRef = useRef(0);
  const renderFrameAtRef = useRef<number | null>(null);
  const spokenTravelStatusRef = useRef("");

  useEffect(() => {
    if (!viewPreferences.routeVoiceGuidance || spokenTravelStatusRef.current === travelStatus) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
    spokenTravelStatusRef.current = travelStatus;
    const timer = window.setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(travelStatus);
      utterance.lang = "ko-KR";
      utterance.rate = viewPreferences.routeVoiceRate === "slow"
        ? 0.88
        : viewPreferences.routeVoiceRate === "fast" ? 1.2 : 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [travelStatus, viewPreferences.routeVoiceGuidance, viewPreferences.routeVoiceRate]);

  const setTarget = useCallback((nextTarget: Point | null) => {
    setTargetState(nextTarget);
    if (!nextTarget) setMapPath([]);
  }, []);

  const setPortalIntent = useCallback((intent: PortalIntent | null) => {
    portalIntentRef.current = intent;
    setPortalIntentState(intent);
  }, []);

  const setInteractionIntent = useCallback((intent: WorldInteractionIntent | null) => {
    interactionIntentRef.current = intent;
    setInteractionIntentState(intent);
  }, []);

  const setPortalTransition = useCallback((transition: PortalTransition | null) => {
    portalTransitionRef.current = transition;
    setPortalTransitionState(transition);
  }, []);

  const setInputReleaseRequired = useCallback((required: boolean) => {
    inputReleaseRequiredRef.current = required;
    setInputReleaseRequiredState(required);
  }, []);

  const resetWalkCycle = useCallback(() => {
    walkPhaseRef.current = 0;
    setStepFrame(neutralWalkFrame);
  }, []);

  const advanceWalkCycle = useCallback((surface: FootstepSurface) => {
    const next = advanceWalkPhase(walkPhaseRef.current);
    walkPhaseRef.current = next.nextPhase;
    setStepFrame(next.frame);
    const foot = walkLandingFootForFrame(next.frame);
    if (foot) playFeedback("footstep", { surface, foot });
  }, [playFeedback]);

  const stampJourneyCheckpoint = useCallback((checkpointId: JourneyCheckpointId) => {
    const result = completeJourneyCheckpoint(journeyProgressRef.current, checkpointId);
    if (!result.changed) return;

    journeyProgressRef.current = result.progress;
    saveJourneyProgress(result.progress);
    setJourneyProgress(result.progress);
    setPlannedCheckpointIds((current) => normalizeJourneyWaypointPlan(
      result.progress,
      current.filter((id) => id !== checkpointId)
    ));
    setStampedCheckpointId(checkpointId);
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
    setTravelStatus(`${checkpoint?.label ?? "방문"} 스탬프를 찍었어요`);
    playFeedback("stamp");
    playJourneyHaptic(checkpointId, "arrived");
    if (result.journeyCompleted) setJourneyCompletionPending(true);
  }, [playFeedback, playJourneyHaptic]);

  const stampWorldInteraction = useCallback((spotId: SpotId) => {
    const checkpointId = journeyCheckpointForInteraction(activeZoneIdRef.current, spotId);
    if (checkpointId) stampJourneyCheckpoint(checkpointId);
  }, [stampJourneyCheckpoint]);

  const clearRemoteReaction = useCallback((guestId: string) => {
    const timer = remoteReactionTimersRef.current.get(guestId);
    if (timer !== undefined) window.clearTimeout(timer);
    remoteReactionTimersRef.current.delete(guestId);
    setRemoteReactions((current) => {
      if (!(guestId in current)) return current;
      const remaining = { ...current };
      delete remaining[guestId];
      return remaining;
    });
  }, []);

  const clearAllRemoteReactions = useCallback(() => {
    remoteReactionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    remoteReactionTimersRef.current.clear();
    setRemoteReactions({});
  }, []);

  const showRemoteReaction = useCallback((guestId: string, reaction: GuestReaction, zoneId: WorldZoneId) => {
    const previousTimer = remoteReactionTimersRef.current.get(guestId);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const token = ++reactionTokenRef.current;
    setRemoteReactions((current) => ({ ...current, [guestId]: { reaction, token, zoneId } }));
    const timer = window.setTimeout(() => {
      remoteReactionTimersRef.current.delete(guestId);
      setRemoteReactions((current) => {
        if (current[guestId]?.token !== token) return current;
        const remaining = { ...current };
        delete remaining[guestId];
        return remaining;
      });
    }, reactionVisibleMs);
    remoteReactionTimersRef.current.set(guestId, timer);
  }, []);

  const handleGuestReaction = useCallback((reaction: GuestReaction) => {
    if (localReactionTimerRef.current !== null) window.clearTimeout(localReactionTimerRef.current);
    const token = ++reactionTokenRef.current;
    setLocalReaction({ reaction, token, zoneId: activeZoneIdRef.current });
    localReactionTimerRef.current = window.setTimeout(() => {
      localReactionTimerRef.current = null;
      setLocalReaction((current) => current?.token === token ? null : current);
    }, reactionVisibleMs);

    if (currentGuestIdRef.current) {
      connectionRef.current?.send({ type: "react", reaction });
    }
    playFeedback("reaction");
  }, [playFeedback]);

  const showNpcDialogue = useCallback((npcId: NpcId) => {
    const npc = activeZone.npcs.find((candidate) => candidate.id === npcId);
    if (!npc) return;
    const dialogue = resolveNpcDialogue({
      npcId,
      zoneId: activeZone.id,
      nickname: profile.nickname,
      completedCheckpointIds: journeyProgressRef.current.completedIds
    });
    stampWorldInteraction("couple");
    setActiveNpcDialogue(dialogue);
    setTravelStatus(`${npc.label}와 이야기를 나눴어요`);
    playFeedback("dialogue");
  }, [activeZone, playFeedback, profile.nickname, stampWorldInteraction]);

  const cancelPortalWalk = useCallback(() => {
    if (!portalIntentRef.current) return;
    setPortalIntent(null);
    setTravelStatus("포털 이동을 취소했어요");
    targetStepAtRef.current = null;
  }, [setPortalIntent]);

  const cancelInteractionWalk = useCallback(() => {
    if (!interactionIntentRef.current) return;
    setInteractionIntent(null);
    setTravelStatus("상호작용 이동을 취소했어요");
    targetStepAtRef.current = null;
  }, [setInteractionIntent]);

  const closeMenu = useCallback(() => {
    setCalendarSheetOpen(false);
    setDirectionsSheetOpen(false);
    setGiftAccountSheetOpen(false);
    setFamilyContactSheetOpen(false);
    setWeddingDaySheetOpen(false);
    setShareSheetOpen(false);
    setViewSettingsOpen(false);
    setPhotoAlbumOpen(false);
    setMenuOpen(false);
  }, []);

  const sendMoveImmediately = useCallback((connection: RealtimeConnection, message: MoveMessage) => {
    if (!currentGuestIdRef.current) return;

    connection.send(message);
    moveSeqRef.current = message.seq;
    lastSentMoveRef.current = message;
  }, []);

  const clearTerminalStopConfirm = useCallback(() => {
    if (terminalStopConfirmTimerRef.current === null) return;
    window.clearTimeout(terminalStopConfirmTimerRef.current);
    terminalStopConfirmTimerRef.current = null;
  }, []);

  const sendRealtimeMove = useCallback((nextPosition: Point, isMoving: boolean, nextDirection: Direction, zoneId: WorldZoneId, now: number) => {
    if (isMoving) clearTerminalStopConfirm();
    moveThrottleRef.current?.({
      type: "move",
      x: nextPosition.x,
      y: nextPosition.y,
      direction: nextDirection,
      moving: isMoving,
      seq: moveSeqRef.current + 1,
      zoneId
    }, now);
  }, [clearTerminalStopConfirm]);

  const sendRealtimeStop = useCallback((nextPosition: Point, nextDirection: Direction, zoneId: WorldZoneId) => {
    const connection = connectionRef.current;
    if (!connection) return;

    const message: MoveMessage = {
      type: "move",
      x: nextPosition.x,
      y: nextPosition.y,
      direction: nextDirection,
      moving: false,
      seq: moveSeqRef.current + 1,
      zoneId
    };
    sendMoveImmediately(connection, message);
  }, [sendMoveImmediately]);

  const sendRealtimeTerminalStop = useCallback((nextDirection: Direction) => {
    const connection = connectionRef.current;
    const lastSentMove = lastSentMoveRef.current;
    if (!connection || !lastSentMove) return;

    clearTerminalStopConfirm();
    const terminalStop: MoveMessage = {
      ...lastSentMove,
      direction: nextDirection,
      moving: false,
      seq: moveSeqRef.current + 1
    };
    sendMoveImmediately(connection, terminalStop);
    terminalStopConfirmTimerRef.current = window.setTimeout(() => {
      terminalStopConfirmTimerRef.current = null;
      if (connectionRef.current !== connection || !currentGuestIdRef.current) return;

      sendMoveImmediately(connection, {
        type: "move",
        x: positionRef.current.x,
        y: positionRef.current.y,
        direction: directionRef.current,
        moving: false,
        seq: moveSeqRef.current + 1,
        zoneId: activeZoneIdRef.current
      });
    }, realtimeTerminalStopConfirmDelayMs);
  }, [clearTerminalStopConfirm, sendMoveImmediately]);

  const stopJourneyGuidance = useCallback((announce = true) => {
    navigationResumeRef.current = null;
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    journeyGuideLastZoneRef.current = null;
    inputGenerationRef.current += 1;
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    setPortalIntent(null);
    setInteractionIntent(null);
    setTarget(null);
    setMoving(false);
    resetWalkCycle();
    sendRealtimeTerminalStop(directionRef.current);
    if (announce) setTravelStatus("길 안내를 중단했어요");
  }, [resetWalkCycle, sendRealtimeTerminalStop, setInteractionIntent, setPortalIntent]);

  const pauseWorldInput = useCallback(() => {
    navigationResumeRef.current = null;
    const joystickWasMoving = joystickWasMovingRef.current;
    inputGenerationRef.current += 1;

    setTarget(null);
    setPortalIntent(null);
    setInteractionIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setMoving(false);
    resetWalkCycle();
    setActiveNpcDialogue(null);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    setInputReleaseRequired(inputReleaseRequiredRef.current || joystickWasMoving);

    sendRealtimeTerminalStop(directionRef.current);
  }, [resetWalkCycle, sendRealtimeTerminalStop, setInputReleaseRequired, setInteractionIntent, setPortalIntent]);

  const beginPortalTransition = useCallback((portal: WorldPortal, approach: Point, _now: number) => {
    if (portalTransitionRef.current) return;

    void preloadWorldZoneAssets(portal.to, "high");
    clearTerminalStopConfirm();
    const transition: PortalTransition = { portal, phase: "arrival" };
    const joystickWasMoving = joystickWasMovingRef.current;
    positionRef.current = approach;
    directionRef.current = portal.facing;
    setPosition(approach);
    setDirection(portal.facing);
    setMoving(false);
    resetWalkCycle();
    setTarget(null);
    setPortalIntent(null);
    setInteractionIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setCalendarSheetOpen(false);
    setDirectionsSheetOpen(false);
    setGiftAccountSheetOpen(false);
    setFamilyContactSheetOpen(false);
    setWeddingDaySheetOpen(false);
    setShareSheetOpen(false);
    setMenuOpen(false);
    setActiveSpotId(null);
    setActivePhotoSpotId(null);
    setActiveNpcDialogue(null);
    setTravelStatus(`${portal.label} 도착`);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    setInputReleaseRequired(inputReleaseRequiredRef.current || joystickWasMoving);
    setPortalTransition(transition);
    sendRealtimeStop(approach, portal.facing, activeZoneIdRef.current);
    playFeedback("portal");
  }, [
    clearTerminalStopConfirm,
    playFeedback,
    resetWalkCycle,
    sendRealtimeStop,
    setInputReleaseRequired,
    setInteractionIntent,
    setPortalIntent,
    setPortalTransition
  ]);

  const moveToZone = useCallback((zoneId: WorldZoneId, spawn?: Point) => {
    clearTerminalStopConfirm();
    const zone = getWorldZone(gardenWorld, zoneId);
    const nextPosition = snapToGrid(spawn ?? zone.spawn, zone);
    activeZoneIdRef.current = zone.id;
    positionRef.current = nextPosition;
    directionRef.current = "down";
    setLoadedBackgroundZoneId(null);
    setActiveZoneId(zone.id);
    setPosition(nextPosition);
    setTarget(null);
    setPortalIntent(null);
    setInteractionIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setDirection("down");
    setMoving(false);
    resetWalkCycle();
    setActiveNpcDialogue(null);
    setActivePhotoSpotId(null);
    setLocalReaction(null);
    if (localReactionTimerRef.current !== null) {
      window.clearTimeout(localReactionTimerRef.current);
      localReactionTimerRef.current = null;
    }
    setTravelStatus(`${zone.label} 도착`);
    const checkpointId = journeyCheckpointForZone(zone.id);
    if (checkpointId) stampJourneyCheckpoint(checkpointId);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;

    const connection = connectionRef.current;
    if (connection) {
      const message: MoveMessage = {
        type: "move",
        x: nextPosition.x,
        y: nextPosition.y,
        direction: "down",
        moving: false,
        seq: moveSeqRef.current + 1,
        zoneId: zone.id
      };
      sendMoveImmediately(connection, message);
    }
  }, [clearTerminalStopConfirm, resetWalkCycle, sendMoveImmediately, setInteractionIntent, setPortalIntent, stampJourneyCheckpoint]);

  const handleJourneySelect = useCallback((zoneId: WorldZoneId) => {
    if (portalTransitionRef.current || zoneId === activeZoneIdRef.current) return;
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    journeyGuideLastZoneRef.current = null;
    playFeedback("portal");
    void preloadWorldZoneAssets(zoneId, "high");
    closeMenu();
    setActiveSpotId(null);
    setInputReleaseRequired(false);
    moveToZone(zoneId);
  }, [closeMenu, moveToZone, playFeedback, setInputReleaseRequired]);

  const completePortalFadeOut = useCallback(() => {
    const transition = portalTransitionRef.current;
    if (!transition || transition.phase !== "fade-out") return;

    moveToZone(transition.portal.to, transition.portal.spawn);
    setPortalTransition({ ...transition, phase: "fade-in" });
  }, [moveToZone, setPortalTransition]);

  useEffect(() => {
    if (!portalTransition) return;

    const timer = window.setTimeout(() => {
      if (portalTransition.phase === "arrival") {
        setPortalTransition({ ...portalTransition, phase: "fade-out" });
        return;
      }
      if (portalTransition.phase === "fade-out") {
        completePortalFadeOut();
        return;
      }
      setPortalTransition(null);
    }, portalTransition.phase === "arrival"
      ? portalArrivalDelayMs
      : portalTransition.phase === "fade-out"
        ? shouldReduceMotion() ? portalFadeOutMs : portalFadeOutFallbackMs
        : portalFadeInMs);

    return () => window.clearTimeout(timer);
  }, [completePortalFadeOut, portalTransition, setPortalTransition]);

  const openSpot = useCallback((spotId: SpotId, restoreMenuButtonFocus = false) => {
    if (portalTransitionRef.current) return;
    restoreMenuButtonFocusRef.current = restoreMenuButtonFocus;
    pauseWorldInput();
    closeMenu();
    setActiveSpotId(spotId);
  }, [closeMenu, pauseWorldInput]);

  const openPhotoSpot = useCallback((photoSpotId: WorldPhotoSpotId) => {
    if (portalTransitionRef.current) return;
    pauseWorldInput();
    closeMenu();
    setActivePhotoSpotId(photoSpotId);
  }, [closeMenu, pauseWorldInput]);

  const closeNpcDialogue = useCallback(() => {
    setActiveNpcDialogue(null);
  }, []);

  const openNpcProfile = useCallback(() => {
    setActiveNpcDialogue(null);
    openSpot("couple");
  }, [openSpot]);

  const beginWorldInteraction = useCallback((input: {
    targetId: string;
    spotId?: SpotId;
    label: string;
    target: Rect;
    actionRadius: number;
    photoSpotId?: WorldPhotoSpotId;
    npcId?: NpcId;
  }) => {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    clearTerminalStopConfirm();
    const route = findNearestInteractionRoute(
      activeZone,
      positionRef.current,
      input.target,
      input.actionRadius
    );
    const joystickWasMoving = joystickWasMovingRef.current;
    inputGenerationRef.current += 1;
    setTarget(null);
    setPortalIntent(null);
    setInteractionIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setMoving(false);
    resetWalkCycle();
    setActiveNpcDialogue(null);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    setInputReleaseRequired(inputReleaseRequiredRef.current || joystickWasMoving);
    if (joystickWasMoving) sendRealtimeTerminalStop(directionRef.current);

    if (!route) {
      setTravelStatus(`${input.label} 근처로 갈 수 없어요`);
      return;
    }

    const targetPoint = rectCenter(input.target);
    const nextDirection = directionTowardPoint(route.entry, targetPoint) ?? directionRef.current;
    if (route.path.length === 0) {
      directionRef.current = nextDirection;
      setDirection(nextDirection);
      setTravelStatus(`${input.label}에 도착했어요`);
      if (input.photoSpotId) {
        openPhotoSpot(input.photoSpotId);
        return;
      }
      if (input.npcId) {
        showNpcDialogue(input.npcId);
        return;
      }
      if (input.spotId) {
        stampWorldInteraction(input.spotId);
        openSpot(input.spotId);
      }
      return;
    }

    setInteractionIntent({
      targetId: input.targetId,
      spotId: input.spotId,
      label: input.label,
      path: route.path,
      target: targetPoint,
      targetRect: input.target,
      actionRadius: input.actionRadius,
      npcId: input.npcId,
      photoSpotId: input.photoSpotId
    });
    setTravelStatus(`${input.label} 가까이 이동 중`);
  }, [
    activeZone,
    clearTerminalStopConfirm,
    openSpot,
    openPhotoSpot,
    resetWalkCycle,
    sendRealtimeTerminalStop,
    setInputReleaseRequired,
    setInteractionIntent,
    setPortalIntent,
    showNpcDialogue,
    stampWorldInteraction
  ]);

  const startJourneyGuidance = useCallback((checkpoint: JourneyCheckpoint) => {
    if (portalTransitionRef.current) return;
    if (activeJourneyGuideId !== checkpoint.id) playJourneyHaptic(checkpoint.id, "start");
    setActiveJourneyGuideId(checkpoint.id);
    if (checkpoint.zoneId !== activeZone.id) {
      const destinationZone = getWorldZone(gardenWorld, checkpoint.zoneId);
      const nextZoneId = nextWorldZoneToward(activeZone.id, checkpoint.zoneId);
      const portal = nextZoneId
        ? activeZone.portals.find((candidate) => candidate.to === nextZoneId)
        : null;
      if (!portal) {
        setPendingJourneyGuideId(null);
        setActiveJourneyGuideId(null);
        journeyGuideLastZoneRef.current = null;
        setTravelStatus(`${destinationZone.label} 방향을 찾을 수 없어요`);
        return;
      }
      journeyGuideLastZoneRef.current = activeZone.id;
      setPendingJourneyGuideId(checkpoint.id);
      setTravelStatus(`${destinationZone.label}의 ${checkpoint.label}(으)로 안내할게요`);
      handlePortalClick(portal);
      return;
    }

    journeyGuideLastZoneRef.current = null;
    setPendingJourneyGuideId(null);
    const target = checkpoint.target;
    if (target.type === "spot") {
      const worldSpot = activeZone.spots.find((spot) => spot.id === target.spotId);
      if (!worldSpot) return;
      beginWorldInteraction({
        targetId: `spot:${worldSpot.id}`,
        spotId: worldSpot.id,
        label: checkpoint.label,
        target: worldSpot,
        actionRadius: worldSpot.actionRadius
      });
      return;
    }
    if (target.type === "npc") {
      const npc = activeZone.npcs.find((candidate) => candidate.id === target.npcId);
      if (!npc) return;
      beginWorldInteraction({
        targetId: `npc:${npc.id}`,
        npcId: npc.id,
        label: checkpoint.label,
        target: npcInteractionRect(npc),
        actionRadius: npcInteractionRadius
      });
      return;
    }

    stampJourneyCheckpoint(checkpoint.id);
    setActiveJourneyGuideId(null);
    setTravelStatus(`${checkpoint.label}에 도착했어요`);
  }, [activeJourneyGuideId, activeZone, beginWorldInteraction, playJourneyHaptic, stampJourneyCheckpoint]);

  const restartJourneyGuidance = useCallback((checkpoint: JourneyCheckpoint) => {
    stopJourneyGuidance(false);
    window.setTimeout(() => startJourneyGuidance(checkpoint), 0);
  }, [startJourneyGuidance, stopJourneyGuidance]);

  useEffect(() => {
    if (!pendingJourneyGuideId || portalTransition) return;
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === pendingJourneyGuideId);
    if (!checkpoint || journeyGuideLastZoneRef.current === activeZone.id) return;
    journeyGuideLastZoneRef.current = activeZone.id;
    const timer = window.setTimeout(() => startJourneyGuidance(checkpoint), 0);
    return () => window.clearTimeout(timer);
  }, [activeZone.id, pendingJourneyGuideId, portalTransition, startJourneyGuidance]);

  const closeActiveSpot = useCallback(() => {
    const restoreMenuButtonFocus = restoreMenuButtonFocusRef.current;
    restoreMenuButtonFocusRef.current = false;
    setActiveSpotId(null);
    if (restoreMenuButtonFocus) {
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }
  }, []);

  const handleDirectionsSheetOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setDirectionsSheetOpen(open);
  }, [pauseWorldInput]);

  const handleWeddingDaySheetOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setWeddingDaySheetOpen(open);
  }, [pauseWorldInput]);

  const handleGuestInformationOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setGuestInformationOpen(open);
  }, [pauseWorldInput]);

  const handleShareSheetOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setShareSheetOpen(open);
  }, [pauseWorldInput]);

  const handleViewSettingsOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setViewSettingsOpen(open);
  }, [pauseWorldInput]);

  const handlePhotoAlbumOpenChange = useCallback((open: boolean) => {
    if (open) pauseWorldInput();
    setPhotoAlbumOpen(open);
  }, [pauseWorldInput]);

  const openGameGuide = useCallback(() => {
    pauseWorldInput();
    setGameGuideOpen(true);
  }, [pauseWorldInput]);

  const dismissGameGuide = useCallback(() => {
    completeGameGuide();
    setGameGuideOpen(false);
  }, []);

  const openFamilyContacts = useCallback(() => {
    pauseWorldInput();
    setFamilyContactSheetOpen(true);
  }, [pauseWorldInput]);

  const openMenu = useCallback(() => {
    if (portalTransitionRef.current) return;
    setMenuOpen(true);
  }, []);

  const openJourneyCompletion = useCallback(() => {
    pauseWorldInput();
    setJourneyCompletionPending(false);
    setJourneyCompletionOpen(true);
    playFeedback("complete");
  }, [pauseWorldInput, playFeedback]);

  useEffect(() => {
    setFeedbackZone(activeZone.id);
  }, [activeZone.id, setFeedbackZone]);

  useEffect(() => {
    setPortalAudio(portalTransition ? null : portalAudioMixAt(position, activeZone.portals));
  }, [activeZone.portals, portalTransition, position, setPortalAudio]);

  useEffect(() => () => setPortalAudio(null), [setPortalAudio]);

  useEffect(() => {
    const element = mapViewportRef.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({ width: rect.width, height: rect.height });
      }
    };
    update();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeZoneId]);

  useEffect(() => {
    if (!menuOpen) return;
    menuCloseButtonRef.current?.focus();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !nestedMenuSheetOpen) closeMenu();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeMenu, menuOpen, nestedMenuSheetOpen]);

  useEffect(() => {
    if (!stampedCheckpointId) return;
    const timer = window.setTimeout(() => setStampedCheckpointId(null), 1900);
    return () => window.clearTimeout(timer);
  }, [stampedCheckpointId]);

  useEffect(() => {
    if (
      !journeyCompletionPending ||
      activeSpotId ||
      activePhotoSpotId ||
      menuOpen ||
      nestedMenuSheetOpen
    ) return;

    openJourneyCompletion();
  }, [activePhotoSpotId, activeSpotId, journeyCompletionPending, menuOpen, nestedMenuSheetOpen, openJourneyCompletion]);

  useEffect(() => {
    if (loadedBackgroundZoneId !== activeZone.id) return;

    const timer = window.setTimeout(() => {
      void preloadAdjacentWorldZoneAssets(activeZone.id, devicePerformance.mode);
    }, 200);

    return () => window.clearTimeout(timer);
  }, [activeZone, devicePerformance.mode, loadedBackgroundZoneId]);

  useEffect(() => {
    return clearTerminalStopConfirm;
  }, [clearTerminalStopConfirm]);

  useEffect(() => {
    return () => {
      if (localReactionTimerRef.current !== null) window.clearTimeout(localReactionTimerRef.current);
      remoteReactionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      remoteReactionTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const workerUrl = import.meta.env.VITE_WORKER_URL;
    if (!workerUrl) {
      clearTerminalStopConfirm();
      setRealtimeStatus("offline");
      setRemoteGuests([]);
      clearAllRemoteReactions();
      return;
    }

    let active = true;
    let connection: RealtimeConnection;
    currentGuestIdRef.current = null;
    moveSeqRef.current = 0;
    lastSentMoveRef.current = null;
    setRemoteGuests([]);
    clearAllRemoteReactions();
    setRealtimeStatus("connecting");

    try {
      connection = connectRealtimeWithRetry(
        getRoomUrl(workerUrl, import.meta.env.VITE_INVITATION_ID ?? "sample-garden"),
        () => ({
          type: "join",
          nickname: profile.nickname,
          appearance: profile.appearance,
          zoneId: activeZoneIdRef.current
        }),
        {
          onOpen: () => {
            clearTerminalStopConfirm();
            if (active) setRealtimeStatus("online");
          },
          onClose: () => {
            if (!active) return;
            clearTerminalStopConfirm();
            currentGuestIdRef.current = null;
            lastSentMoveRef.current = null;
            setRemoteGuests([]);
            clearAllRemoteReactions();
            setRealtimeStatus("reconnecting");
          },
          onMessage: (message) => {
            if (!active) return;
            if (message.type === "error" && message.code === "room_full") {
              currentGuestIdRef.current = null;
              setRemoteGuests([]);
              clearAllRemoteReactions();
              setRealtimeStatus("full");
              return;
            }
            if (message.type === "welcome") {
              clearTerminalStopConfirm();
              currentGuestIdRef.current = message.guestId;
              setRemoteGuests(withoutCurrentGuest(message.guests, message.guestId));
              const presence: MoveMessage = {
                type: "move",
                x: positionRef.current.x,
                y: positionRef.current.y,
                direction: directionRef.current,
                moving: false,
                seq: moveSeqRef.current + 1,
                zoneId: activeZoneIdRef.current
              };
              sendMoveImmediately(connection, presence);
              return;
            }
            if (message.type === "guest_joined") {
              setRemoteGuests((guests) => upsertGuest(guests, message.guest, currentGuestIdRef.current));
              return;
            }
            if (message.type === "guest_moved") {
              if (message.guestId !== currentGuestIdRef.current) {
                setRemoteGuests((guests) => moveGuest(guests, message.guestId, { type: "move", ...message.position }));
              }
              return;
            }
            if (message.type === "guest_reacted") {
              if (message.guestId !== currentGuestIdRef.current) {
                showRemoteReaction(message.guestId, message.reaction, message.zoneId);
              }
              return;
            }
            if (message.type === "guest_left") {
              setRemoteGuests((guests) => guests.filter((guest) => guest.guestId !== message.guestId));
              clearRemoteReaction(message.guestId);
              return;
            }
            if (message.type === "room_state") {
              setRemoteGuests(withoutCurrentGuest(message.guests, currentGuestIdRef.current));
            }
          }
        }
      );
    } catch {
      clearTerminalStopConfirm();
      setRealtimeStatus("offline");
      return;
    }

    connectionRef.current = connection;
    moveThrottleRef.current = createMoveThrottle((message) => {
      sendMoveImmediately(connection, message);
    }, realtimeMoveIntervalMs);

    return () => {
      active = false;
      clearTerminalStopConfirm();
      if (connectionRef.current === connection) connectionRef.current = null;
      moveThrottleRef.current = null;
      currentGuestIdRef.current = null;
      lastSentMoveRef.current = null;
      connection.close();
    };
  }, [
    clearAllRemoteReactions,
    clearRemoteReaction,
    clearTerminalStopConfirm,
    profile.appearance,
    profile.nickname,
    sendMoveImmediately,
    showRemoteReaction
  ]);

  useEffect(() => {
    const inputGeneration = inputGenerationRef.current;
    if (portalTransitionRef.current) return;

    const hasJoystickInput = hasJoystickMovement(joystickVector);
    const movementTarget = interactionIntent?.path[0] ?? portalIntent?.path[0] ?? mapPath[0] ?? target;
    if (!movementTarget && !hasJoystickInput) {
      targetStepAtRef.current = null;
      tileInputStateRef.current = null;
      return;
    }

    const movementVector = joystickVector;
    let frame = 0;
    function tick(now: number) {
      if (inputGeneration !== inputGenerationRef.current || portalTransitionRef.current) return;
      devicePerformance.reportAnimationFrame(now);
      if (!shouldProcessGameFrame(devicePerformance.mode, renderFrameAtRef.current, now)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      renderFrameAtRef.current = now;

      const current = positionRef.current;
      const hasDirectionalInput = hasJoystickMovement(movementVector);
      const nextDirection = hasDirectionalInput
        ? directionFromVector(movementVector)
        : movementTarget
          ? directionTowardPoint(current, movementTarget)
          : null;

      if (!nextDirection) {
        setMoving(false);
        resetWalkCycle();
        setTarget(null);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        return;
      }

      if (hasDirectionalInput) {
        const input = tileInputStateRef.current ?? createTileInputState(nextDirection, now);
        const result = advanceTileInput(input, nextDirection, now);
        tileInputStateRef.current = result.state;
        if (!result.shouldStep) {
          frame = requestAnimationFrame(tick);
          return;
        }
      } else {
        tileInputStateRef.current = null;
        const nextStepAt = targetStepAtRef.current ?? now;
        if (now < nextStepAt) {
          frame = requestAnimationFrame(tick);
          return;
        }
        targetStepAtRef.current = now + tileInputRepeatIntervalMs;
      }

      const next = computeNextGridPosition({ current, direction: nextDirection, world: activeZone });
      const didMove = !samePoint(current, next);
      const reachedTarget = movementTarget ? samePoint(next, movementTarget) : false;
      directionRef.current = nextDirection;
      setDirection(nextDirection);

      if (!didMove) {
        setMoving(false);
        resetWalkCycle();
        setTarget(null);
        setPortalIntent(null);
        setInteractionIntent(null);
        setActiveJourneyGuideId(null);
        setTravelStatus("길을 찾을 수 없어요");
        sendRealtimeMove(current, false, nextDirection, activeZone.id, now);
        targetStepAtRef.current = null;
        return;
      }

      if (portalIntent && portalIntent.path.length === 1 && reachedTarget) {
        if (inputGeneration !== inputGenerationRef.current) return;
        beginPortalTransition(portalIntent.portal, next, now);
        return;
      }

      if (interactionIntent && interactionIntent.path.length === 1 && reachedTarget) {
        if (inputGeneration !== inputGenerationRef.current) return;
        const facing = directionTowardPoint(next, interactionIntent.target) ?? nextDirection;
        positionRef.current = next;
        directionRef.current = facing;
        setPosition(next);
        setDirection(facing);
        setMoving(false);
        resetWalkCycle();
        setTarget(null);
        setInteractionIntent(null);
        setActiveJourneyGuideId(null);
        setTravelStatus(`${interactionIntent.label}에 도착했어요`);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        sendRealtimeStop(next, facing, activeZone.id);
        if (interactionIntent.photoSpotId) {
          openPhotoSpot(interactionIntent.photoSpotId);
          return;
        }
        if (interactionIntent.npcId) {
          showNpcDialogue(interactionIntent.npcId);
          return;
        }
        if (interactionIntent.spotId) {
          stampWorldInteraction(interactionIntent.spotId);
          openSpot(interactionIntent.spotId);
        }
        return;
      }

      const joystickPortal = hasDirectionalInput
        ? activeZone.portals.find((portal) => pointInPortalEntry(portal, next))
        : undefined;
      if (joystickPortal) {
        if (inputGeneration !== inputGenerationRef.current) return;
        beginPortalTransition(joystickPortal, next, now);
        return;
      }

      positionRef.current = next;
      setPosition(next);
      setMoving(true);
      advanceWalkCycle(resolveFootstepSurface(activeZone, next));
      sendRealtimeMove(next, hasDirectionalInput || !reachedTarget, nextDirection, activeZone.id, now);

      if (reachedTarget) {
        if (portalIntent) {
          setPortalIntent({ ...portalIntent, path: portalIntent.path.slice(1) });
        } else if (interactionIntent) {
          setInteractionIntent({ ...interactionIntent, path: interactionIntent.path.slice(1) });
        } else if (mapPath.length > 1) {
          setMapPath(mapPath.slice(1));
        } else {
          setMoving(false);
          resetWalkCycle();
          setTarget(null);
          setTravelStatus("선택한 위치에 도착했어요");
          targetStepAtRef.current = null;
        }
        return;
      }

      frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    activeZone,
    advanceWalkCycle,
    beginPortalTransition,
    devicePerformance.mode,
    devicePerformance.reportAnimationFrame,
    interactionIntent,
    joystickVector,
    mapPath,
    openSpot,
    openPhotoSpot,
    portalIntent,
    resetWalkCycle,
    sendRealtimeMove,
    sendRealtimeStop,
    setInteractionIntent,
    setPortalIntent,
    showNpcDialogue,
    stampWorldInteraction,
    target
  ]);

  function handlePortalClick(portalItem: WorldPortal) {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    void preloadWorldZoneAssets(portalItem.to, "high");
    clearTerminalStopConfirm();
    setActiveNpcDialogue(null);
    cancelInteractionWalk();
    const route = findNearestPortalRoute(activeZone, positionRef.current, portalItem);
    setTarget(null);
    setJoystickVector({ x: 0, y: 0 });
    targetStepAtRef.current = null;
    if (!route) {
      setPortalIntent(null);
      setTravelStatus("길을 찾을 수 없어요");
      return;
    }
    if (route.path.length === 0) {
      beginPortalTransition(portalItem, route.entry, performance.now());
      return;
    }
    setPortalIntent({ portal: portalItem, path: route.path });
    setTravelStatus(`${portalItem.label}까지 이동 중`);
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    clearTerminalStopConfirm();
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    journeyGuideLastZoneRef.current = null;
    setActiveNpcDialogue(null);
    cancelPortalWalk();
    cancelInteractionWalk();
    const rect = event.currentTarget.getBoundingClientRect();
    const worldPoint = screenToWorld({
      client: { x: event.clientX, y: event.clientY },
      viewportRect: rect,
      camera
    });
    const nextTarget = snapToGrid(worldPoint, activeZone);
    const path = findTilePath(activeZone, positionRef.current, nextTarget);
    if (!path || path.length === 0) {
      setTarget(null);
      setTravelStatus(path ? "현재 위치예요" : "길을 찾을 수 없어요");
      return;
    }
    const nextDirection = directionTowardPoint(positionRef.current, nextTarget);
    if (nextDirection) directionRef.current = nextDirection;
    setTarget(nextTarget);
    setMapPath(path);
    setTravelStatus("선택한 위치로 이동 중");
    targetStepAtRef.current = null;
  }

  function resumeNavigationAfterManualMove() {
    const resumeIntent = navigationResumeRef.current;
    navigationResumeRef.current = null;
    if (!resumeIntent || portalTransitionRef.current) return;

    if (resumeIntent.kind === "portal") {
      handlePortalClick(resumeIntent.portal);
      if (portalIntentRef.current) {
        setRouteRecalculationId((current) => current + 1);
        setTravelStatus(`${resumeIntent.portal.label}까지 경로를 다시 찾았어요`);
      }
      return;
    }

    if (resumeIntent.kind === "interaction") {
      const { intent } = resumeIntent;
      beginWorldInteraction({
        targetId: intent.targetId,
        spotId: intent.spotId,
        label: intent.label,
        target: intent.targetRect,
        actionRadius: intent.actionRadius,
        photoSpotId: intent.photoSpotId,
        npcId: intent.npcId
      });
      if (interactionIntentRef.current) {
        setRouteRecalculationId((current) => current + 1);
        setTravelStatus(`${intent.label}까지 경로를 다시 찾았어요`);
      }
      return;
    }

    const path = findTilePath(activeZone, positionRef.current, resumeIntent.target);
    if (!path || path.length === 0) {
      setTravelStatus(path ? "현재 위치예요" : "목적지까지 새 경로를 찾지 못했어요");
      return;
    }
    setTarget(resumeIntent.target);
    setMapPath(path);
    setRouteRecalculationId((current) => current + 1);
    setTravelStatus("선택한 위치까지 경로를 다시 찾았어요");
  }

  function handleJoystickVectorChange(vector: Point) {
    const wasMoving = joystickWasMovingRef.current;
    const isMoving = hasJoystickMovement(vector);

    if (isMoving) clearTerminalStopConfirm();

    if (!isMoving) {
      setInputReleaseRequired(false);
      if (portalTransitionRef.current) {
        setJoystickVector(vector);
        joystickWasMovingRef.current = false;
        tileInputStateRef.current = null;
        return;
      }
    }

    if (portalTransitionRef.current || inputReleaseRequiredRef.current) return;

    if (isMoving) {
      if (!wasMoving) {
        navigationResumeRef.current = portalIntentRef.current
          ? { kind: "portal", portal: portalIntentRef.current.portal }
          : interactionIntentRef.current
            ? { kind: "interaction", intent: interactionIntentRef.current }
            : target
              ? { kind: "map", target }
              : null;
      }
      if (!navigationResumeRef.current) {
        setPendingJourneyGuideId(null);
        setActiveJourneyGuideId(null);
        journeyGuideLastZoneRef.current = null;
      }
      setActiveNpcDialogue(null);
      setPortalIntent(null);
      setInteractionIntent(null);
    }
    setJoystickVector(vector);

    if (isMoving) {
      joystickWasMovingRef.current = true;
      setTarget(null);
      targetStepAtRef.current = null;
      directionRef.current = directionFromVector(vector);
      return;
    }

    joystickWasMovingRef.current = false;
    tileInputStateRef.current = null;
    if (wasMoving) {
      setMoving(false);
      resetWalkCycle();
      sendRealtimeMove(positionRef.current, false, directionRef.current, activeZone.id, performance.now());
      resumeNavigationAfterManualMove();
    }
  }

  const camera = computeCameraTransform({ player: position, viewport, bounds: activeZone.bounds, zoom: 1 });
  const completedJourneyIds = new Set(journeyProgress.completedIds);
  const remainingWaypoints = remainingJourneyWaypoints(journeyProgress);
  const recommendedCheckpoint = firstJourneyWaypoint(journeyProgress, plannedCheckpointIds)
    ?? nextJourneyCheckpoint(journeyProgress);
  const recommendedZone = recommendedCheckpoint
    ? getWorldZone(gardenWorld, recommendedCheckpoint.zoneId)
    : null;
  const journeyGuidance = recommendedCheckpoint
    ? resolveJourneyGuidance(activeZone, position, recommendedCheckpoint)
    : null;
  const journeyDistanceLabel = journeyGuidance?.available
    ? journeyGuidance.tileCount === 0
      ? "목적지 도착"
      : `${journeyGuidance.direction ? `${journeyDirectionLabels[journeyGuidance.direction]} · ` : ""}${journeyGuidance.tileCount}타일`
    : "경로 확인 필요";
  const journeyOverallSummary = summarizeRemainingJourney(journeyProgress, activeZone.id);
  const journeyPlanEstimate = estimateJourneyWaypointPlan(
    journeyProgress,
    plannedCheckpointIds,
    activeZone.id,
    journeyGuidance?.available ? journeyGuidance.tileCount : 0
  );
  const journeyRoutePoints = activeJourneyGuideId && journeyGuidance?.available
    ? [position, ...journeyGuidance.path]
    : [];
  const selectedTravelPath = interactionIntent?.path
    ?? portalIntent?.path
    ?? mapPath;
  const selectedTravelRoutePoints = selectedTravelPath.length > 0
    ? [position, ...selectedTravelPath]
    : journeyRoutePoints;
  const directTravelActive = Boolean(interactionIntent || portalIntent || target);
  const directTravelProgress = directTravelActive
    ? navigationProgress(selectedTravelPath.length)
    : null;
  const zoneRemoteGuests = remoteGuests.filter((guest) => guest.zoneId === activeZone.id);
  const visibleRemoteGuests = devicePerformance.mode === "lite"
    ? [...zoneRemoteGuests]
      .sort((left, right) => (
        Math.hypot(left.x - position.x, left.y - position.y)
        - Math.hypot(right.x - position.x, right.y - position.y)
      ))
      .slice(0, 8)
    : zoneRemoteGuests;
  const activeJourneyMarkers = journeyCheckpoints
    .filter((checkpoint) => checkpoint.zoneId === activeZone.id)
    .flatMap((checkpoint) => {
      const point = journeyMarkerPoint(activeZone, checkpoint);
      return point ? [{
        id: checkpoint.id,
        point,
        completed: completedJourneyIds.has(checkpoint.id),
        recommended: checkpoint.id === recommendedCheckpoint?.id
      }] : [];
    });

  return (
    <section className="game-world" aria-label="모바일 청첩장 월드" aria-busy={portalTransition ? "true" : undefined}>
      <div
        className={`world-portal-transition world-portal-transition--${portalTransition?.phase ?? "idle"}`}
        data-testid="world-portal-transition"
        data-phase={portalTransition?.phase ?? "idle"}
        aria-hidden="true"
        onTransitionEnd={(event: ReactTransitionEvent<HTMLDivElement>) => {
          if (
            event.target !== event.currentTarget ||
            event.propertyName !== "opacity" ||
            portalTransitionRef.current?.phase !== "fade-out"
          ) {
            return;
          }
          completePortalFadeOut();
        }}
      />
      <header className="world-hud">
        <div className="world-hud__status">
          <div className="world-zone-summary">
            <span>현재 구역 · {activeZone.journeyIndex + 1}/10</span>
            <strong>{activeZone.label}</strong>
            <small>{activeZone.subtitle}</small>
          </div>
          <div className="world-hud__realtime-controls">
            <GameFeedbackToggle />
            <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>{realtimeStatusText(realtimeStatus)}</div>
          </div>
        </div>
        <JourneyStampBook
          progress={journeyProgress}
          activeZoneId={activeZone.id}
          highlightedCheckpointId={stampedCheckpointId}
          disabled={Boolean(portalTransition)}
          onOpenChange={(open) => { if (open) pauseWorldInput(); }}
          onOpenCompletion={openJourneyCompletion}
          onSelectZone={handleJourneySelect}
        />
        {recommendedCheckpoint && recommendedZone ? (
          <>
            <div className="world-destination-guide-row" data-active={activeJourneyGuideId === recommendedCheckpoint.id || undefined}>
              <button
                type="button"
                className="world-destination-guide"
                aria-label={activeJourneyGuideId === recommendedCheckpoint.id
                  ? `다음 목적지 ${recommendedCheckpoint.label}, 현재 위치에서 경로 다시 찾기`
                  : `다음 목적지 ${recommendedCheckpoint.label}, ${recommendedCheckpoint.zoneId === activeZone.id ? "길 안내 시작" : `${recommendedZone.label}로 이동`}`}
                disabled={Boolean(portalTransition)}
                onClick={() => activeJourneyGuideId === recommendedCheckpoint.id
                  ? restartJourneyGuidance(recommendedCheckpoint)
                  : startJourneyGuidance(recommendedCheckpoint)}
              >
                <MapPinned aria-hidden="true" />
                <span>
                  <small>{activeJourneyGuideId === recommendedCheckpoint.id ? "GUIDING NOW" : "NEXT DESTINATION"}</small>
                  <strong>{recommendedCheckpoint.label}</strong>
                  <em>{recommendedCheckpoint.zoneId === activeZone.id ? "현재 맵" : recommendedZone.label} · {journeyDistanceLabel} · {activeJourneyGuideId === recommendedCheckpoint.id ? "재탐색 가능" : "자동 이동"}</em>
                </span>
                {activeJourneyGuideId === recommendedCheckpoint.id ? <RefreshCw aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}
              </button>
              {activeJourneyGuideId === recommendedCheckpoint.id ? (
                <button
                  type="button"
                  className="world-destination-guide__cancel"
                  aria-label="길 안내 중단"
                  title="길 안내 중단"
                  disabled={Boolean(portalTransition)}
                  onClick={() => stopJourneyGuidance()}
                >
                  <X aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="world-accessible-route"
              aria-label={`쉬운 길찾기 열기, 남은 추억 ${journeyOverallSummary.remainingCheckpoints}개, 예상 ${journeyOverallSummary.estimatedStages}단계`}
              onClick={() => {
                pauseWorldInput();
                setJourneyRouteOpen(true);
              }}
            >
              <Accessibility aria-hidden="true" />
              <strong>쉬운 길찾기</strong>
              <span>남은 {journeyOverallSummary.remainingCheckpoints}개 · 맵 이동 {journeyOverallSummary.zoneTransitions}회 · 예상 {journeyOverallSummary.estimatedStages}단계</span>
            </button>
          </>
        ) : null}
        <ol className="world-journey" aria-label="하객 여정">
          {gardenWorld.zones.map((zone) => {
            const checkpoints = journeyCheckpoints.filter((checkpoint) => checkpoint.zoneId === zone.id);
            const stamped = checkpoints.length > 0 && checkpoints.every((checkpoint) => completedJourneyIds.has(checkpoint.id));
            return (
            <li
              key={zone.id}
              aria-current={zone.id === activeZone.id ? "location" : undefined}
              data-stamped={stamped || undefined}
            >
              <button
                type="button"
                className="world-journey__button"
                aria-label={`${zone.label} 바로 이동`}
                disabled={Boolean(portalTransition)}
                onClick={() => { handleJourneySelect(zone.id); }}
              >
                {zone.label}
                {stamped ? <span className="world-journey__stamp" aria-label="방문 완료">✓</span> : null}
              </button>
            </li>
            );
          })}
        </ol>
        <div className="world-travel-status-row">
          <p className="world-travel-status" aria-live="polite">{travelStatus}</p>
          {directTravelProgress && !portalTransition ? (
            <span className="world-travel-progress" data-testid="world-travel-progress">
              <MapPinned aria-hidden="true" /> {directTravelProgress.label}
            </span>
          ) : null}
          {directTravelActive && !portalTransition ? (
            <button
              type="button"
              className="world-destination-guide__cancel world-travel-cancel"
              aria-label="이동 취소"
              title="이동 취소"
              onClick={() => stopJourneyGuidance()}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="world-map-shell">
        <div
          ref={mapViewportRef}
          className={`world-map world-map--${activeZone.theme}`}
          data-testid="world-map-viewport"
          onClick={handleMapClick}
        >
          <div
            className={`world-map__stage${loadedBackgroundZoneId === activeZone.id ? " world-map__stage--background-loaded" : ""}`}
            aria-label={`${activeZone.label} 지도`}
            data-zone={activeZone.id}
            data-render-quality={devicePerformance.mode}
            data-logical-width={activeZone.bounds.width}
            data-logical-height={activeZone.bounds.height}
            style={{
              width: activeZone.bounds.width,
              height: activeZone.bounds.height,
              transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})`
            }}
          >
            <WorldMapArtwork
              zoneId={activeZone.id}
              onLoadStateChange={(loaded) => {
                setLoadedBackgroundZoneId((current) => (
                  loaded ? activeZone.id : current === activeZone.id ? null : current
                ));
              }}
            />
            {activeZone.paths.map((worldPath) => (
              <div
                key={worldPath.id}
                className={`world-path world-path--${worldPath.kind}`}
                style={pixelRect(worldPath)}
              />
            ))}
            {selectedTravelRoutePoints.length > 1 ? (
              <svg
                key={`route-${routeRecalculationId}`}
                className="world-journey-route"
                data-testid="world-journey-route"
                data-route-kind={directTravelActive ? "selected" : "journey"}
                data-route-recalculation={routeRecalculationId}
                viewBox={`0 0 ${activeZone.bounds.width} ${activeZone.bounds.height}`}
                aria-hidden="true"
              >
                <polyline points={selectedTravelRoutePoints.map((point) => `${point.x},${point.y}`).join(" ")} />
                <circle cx={selectedTravelRoutePoints.at(-1)?.x} cy={selectedTravelRoutePoints.at(-1)?.y} r="9" />
              </svg>
            ) : null}
            {activeZone.decorations.map((item) => (
              <WorldDecoration key={item.id} zoneId={activeZone.id} decoration={item} />
            ))}
            {activeZone.spots.map((worldSpot) => {
              const content = invitationContent.spots.find((candidate) => candidate.id === worldSpot.id);
              return (
                <button
                  key={worldSpot.id}
                  type="button"
                  className={`world-spot world-spot--${worldSpot.id}${interactionIntent?.targetId === `spot:${worldSpot.id}` ? " world-spot--target" : ""}${recommendedCheckpoint?.zoneId === activeZone.id && recommendedCheckpoint.target.type === "spot" && recommendedCheckpoint.target.spotId === worldSpot.id ? " world-spot--recommended" : ""}`}
                  style={{ ...pixelRect(worldSpot), zIndex: 9000 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveJourneyGuideId(null);
                    setPendingJourneyGuideId(null);
                    beginWorldInteraction({
                      targetId: `spot:${worldSpot.id}`,
                      spotId: worldSpot.id,
                      label: worldSpot.label,
                      target: worldSpot,
                      actionRadius: worldSpot.actionRadius
                    });
                  }}
                >
                  <span>{worldSpot.label}</span>
                  <small>{content?.actionLabel ?? "보기"}</small>
                </button>
              );
            })}
            {activeZone.photoSpots.map((photoSpot) => {
              const captured = photoAlbum.photos.some((photo) => photo.photoSpotId === photoSpot.id);
              return (
                <button
                  key={photoSpot.id}
                  type="button"
                  className={`world-photo-spot${interactionIntent?.targetId === `photo:${photoSpot.id}` ? " world-photo-spot--target" : ""}${captured ? " world-photo-spot--captured" : ""}`}
                  style={{ ...pixelRect(photoSpot), zIndex: worldDepth(photoSpot.y) - 200 }}
                  aria-label={`${photoSpot.label} ${captured ? "다시 촬영" : "기념 촬영"}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveJourneyGuideId(null);
                    setPendingJourneyGuideId(null);
                    beginWorldInteraction({
                      targetId: `photo:${photoSpot.id}`,
                      photoSpotId: photoSpot.id,
                      label: photoSpot.label,
                      target: photoSpot,
                      actionRadius: photoSpot.actionRadius
                    });
                  }}
                >
                  <Camera aria-hidden="true" />
                  <span>{captured ? "촬영 완료" : "PHOTO"}</span>
                </button>
              );
            })}
            {activeZone.portals.map((portalItem) => {
              const horizontal = portalItem.facing === "up" || portalItem.facing === "down";

              return (
                <button
                  key={portalItem.id}
                  type="button"
                  className={`world-portal world-portal--${horizontal ? "horizontal" : "vertical"}${portalIntent?.portal.id === portalItem.id ? " world-portal--target" : ""}${journeyGuidance?.portalId === portalItem.id ? " world-portal--recommended" : ""}`}
                  style={{
                    ...pixelRect(portalEntryRect(portalItem)),
                    zIndex: worldDepth(portalItem.approach.y) - 100
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveJourneyGuideId(null);
                    setPendingJourneyGuideId(null);
                    handlePortalClick(portalItem);
                  }}
                >
                  <span className="world-portal__effect" aria-hidden="true">
                    <span className="world-portal__tiles">
                      {portalItem.entryTiles.map((tile) => (
                        <span key={`${tile.x}-${tile.y}`} className="world-portal__tile" />
                      ))}
                    </span>
                  </span>
                  <span className="world-portal__label">{portalItem.label}</span>
                </button>
              );
            })}
            {visibleRemoteGuests.map((guest) => (
              <div
                key={guest.guestId}
                className="world-player player player--remote"
                aria-label={guest.nickname}
                data-remote-motion="pixel-step-3"
                style={{ left: guest.x, top: guest.y, zIndex: worldDepth(guest.y) }}
              >
                {remoteReactions[guest.guestId]?.zoneId === activeZone.id ? (
                  <GuestReactionBubble
                    reaction={remoteReactions[guest.guestId].reaction}
                    guestName={guest.nickname}
                  />
                ) : null}
                <CharacterSprite
                  appearance={guest.appearance}
                  direction={guest.direction}
                  moving={guest.moving}
                  stepFrame={walkFrameForPhase(Math.max(0, guest.seq - 1))}
                  label={`${guest.nickname} 캐릭터`}
                />
                <span>{guest.nickname}</span>
              </div>
            ))}
            {activeZone.npcs.map((npc) => (
              <div
                key={npc.id}
                className="world-npc"
                style={{
                  left: npc.x,
                  top: npc.y,
                  zIndex: activeNpcDialogue?.npcId === npc.id ? 9100 : worldDepth(npc.y)
                }}
              >
                {activeNpcDialogue?.npcId === npc.id ? (
                  <NpcDialogueBubble
                    dialogue={activeNpcDialogue}
                    speaker={npc.label}
                    onClose={closeNpcDialogue}
                    onOpenProfile={openNpcProfile}
                  />
                ) : null}
                <WeddingNpc
                  id={npc.id}
                  label={npc.label}
                  approaching={interactionIntent?.targetId === `npc:${npc.id}` || (
                    recommendedCheckpoint?.zoneId === activeZone.id
                    && recommendedCheckpoint.target.type === "npc"
                    && recommendedCheckpoint.target.npcId === npc.id
                  )}
                  onSelect={() => {
                    setActiveJourneyGuideId(null);
                    setPendingJourneyGuideId(null);
                    beginWorldInteraction({
                      targetId: `npc:${npc.id}`,
                      spotId: "couple",
                      label: npc.label,
                      target: npcInteractionRect(npc),
                      actionRadius: npcInteractionRadius,
                      npcId: npc.id
                    });
                  }}
                />
              </div>
            ))}
            <div
              className="world-player player"
              aria-label={profile.nickname}
              style={{ left: position.x, top: position.y, zIndex: worldDepth(position.y) }}
            >
              {localReaction?.zoneId === activeZone.id ? (
                <GuestReactionBubble reaction={localReaction.reaction} guestName={profile.nickname} />
              ) : null}
              <CharacterSprite
                appearance={profile.appearance}
                direction={direction}
                moving={moving}
                stepFrame={stepFrame}
                label={`${profile.nickname} 캐릭터`}
              />
              <span>{profile.nickname}</span>
            </div>
          </div>

          <WorldMiniMap
            zone={activeZone}
            player={position}
            direction={direction}
            camera={camera}
            viewport={viewport}
            targetPortalId={portalIntent?.portal.id ?? journeyGuidance?.portalId ?? null}
            journeyMarkers={activeJourneyMarkers}
            destinationLabel={recommendedCheckpoint ? `${recommendedCheckpoint.label} · ${journeyDistanceLabel}` : null}
            destinationPoint={journeyGuidance?.destinationPoint ?? null}
          />

          <div className="world-control-dock" onClick={(event) => event.stopPropagation()}>
            <VirtualJoystick
              disabled={Boolean(portalTransition) || inputReleaseRequired}
              onVectorChange={handleJoystickVectorChange}
            />
            <div className="world-control-actions">
              <GuestReactionDock
                disabled={Boolean(portalTransition)}
                onReact={handleGuestReaction}
              />
              <GuestInformationAccess
                variant="world"
                onOpenChange={handleGuestInformationOpenChange}
              />
              <WeddingDayQuickAccess
                variant="world"
                preview={weddingDayPreview}
                open={weddingDaySheetOpen}
                showTrigger={false}
                onOpenChange={handleWeddingDaySheetOpenChange}
                onFamilyContactOpen={openFamilyContacts}
              />
              <button ref={menuButtonRef} type="button" className="world-menu-button" aria-expanded={menuOpen} onClick={openMenu}>
                <span aria-hidden="true">+</span>
                초대장 메뉴
              </button>
            </div>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="world-menu-backdrop"
            aria-label="초대장 메뉴 닫기"
            style={{ zIndex: nestedMenuSheetOpen ? 8 : undefined }}
            onClick={closeMenu}
          />
          <section
            className="world-menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="초대장 바로가기"
            aria-hidden={nestedMenuSheetOpen || undefined}
            style={{ zIndex: nestedMenuSheetOpen ? 9 : undefined }}
            onClickCapture={(event) => {
              if (event.target instanceof Element) {
                event.target.closest<HTMLButtonElement>("button")?.focus();
              }
            }}
          >
            <header className="world-menu-sheet__header">
              <div><span>WEDDING MENU</span><h2>초대장 바로가기</h2></div>
              <button ref={menuCloseButtonRef} type="button" aria-label="초대장 메뉴 닫기" onClick={closeMenu}>×</button>
            </header>
            <WeddingEventSummary
              variant="detail"
              weddingDayPreview={weddingDayPreview}
              onCalendarSheetOpenChange={setCalendarSheetOpen}
              onDirectionsSheetOpenChange={handleDirectionsSheetOpenChange}
              onWeddingDaySheetOpenChange={handleWeddingDaySheetOpenChange}
              onFamilyContactOpen={openFamilyContacts}
            />
            <div className="world-menu-grid">
              {onOpenQuickView ? (
                <button
                  type="button"
                  onClick={() => {
                    closeMenu();
                    onOpenQuickView();
                  }}
                >
                  간편 초대장
                </button>
              ) : null}
              {invitationContent.spots.map((item) => (
                <button key={item.id} type="button" onClick={() => openSpot(item.id, true)}>{item.actionLabel}</button>
              ))}
              <button
                type="button"
                onClick={() => {
                  pauseWorldInput();
                  setGiftAccountSheetOpen(true);
                }}
              >
                마음 전하실 곳
              </button>
              <button
                type="button"
                onClick={() => {
                  openFamilyContacts();
                }}
              >
                혼주 연락처
              </button>
              <button type="button" onClick={() => handleShareSheetOpenChange(true)}>
                <Share2 aria-hidden="true" />
                초대장 공유
              </button>
              <button type="button" onClick={() => handlePhotoAlbumOpenChange(true)}>
                <Images aria-hidden="true" />
                포토앨범 {weddingPhotoAlbumProgress(photoAlbum)}/3
              </button>
              <button type="button" onClick={openGameGuide}>
                <CircleHelp aria-hidden="true" />
                게임 안내 다시 보기
              </button>
              <ViewSettingsAccess
                variant="menu"
                onOpenChange={handleViewSettingsOpenChange}
              />
            </div>
          </section>
        </>
      ) : null}
      {giftAccountSheetOpen ? (
        <GiftAccountSheet onClose={() => setGiftAccountSheetOpen(false)} />
      ) : null}
      {familyContactSheetOpen ? (
        <FamilyContactSheet onClose={() => setFamilyContactSheetOpen(false)} />
      ) : null}
      {activeSpotId === "directions" ? (
        <DirectionsSheet onClose={closeActiveSpot} />
      ) : activeSpotId ? (
        <SpotModal spotId={activeSpotId} nickname={profile.nickname} onClose={closeActiveSpot} />
      ) : null}
      {activePhotoSpotId ? (
        <WeddingPhotoBooth
          spot={gardenWorld.zones.flatMap((zone) => zone.photoSpots).find((photoSpot) => photoSpot.id === activePhotoSpotId)!}
          nickname={profile.nickname}
          appearance={profile.appearance}
          onClose={() => setActivePhotoSpotId(null)}
          onCaptured={(memory: WeddingPhotoMemory) => {
            setPhotoAlbum(loadWeddingPhotoAlbum());
            setTravelStatus(`${memory.spotLabel} 기념 촬영 완료`);
          }}
        />
      ) : null}
      {photoAlbumOpen ? (
        <WeddingPhotoAlbum
          album={photoAlbum}
          nickname={profile.nickname}
          onClose={() => setPhotoAlbumOpen(false)}
          onRetake={(photoSpotId) => {
            setPhotoAlbumOpen(false);
            setMenuOpen(false);
            setActivePhotoSpotId(photoSpotId);
          }}
        />
      ) : null}
      {gameGuideOpen ? <GameFirstVisitGuide onDismiss={dismissGameGuide} /> : null}
      {journeyRouteOpen && recommendedCheckpoint ? (
        <JourneyRouteSheet
          activeZone={activeZone}
          checkpoint={recommendedCheckpoint}
          progress={journeyProgress}
          guidance={journeyGuidance}
          waypoints={remainingWaypoints}
          selectedWaypointIds={plannedCheckpointIds}
          onToggleWaypoint={(checkpointId) => setPlannedCheckpointIds((current) => (
            toggleJourneyWaypoint(journeyProgress, current, checkpointId)
          ))}
          onMoveWaypoint={(checkpointId, moveDirection) => setPlannedCheckpointIds((current) => (
            moveJourneyWaypoint(journeyProgress, current, checkpointId, moveDirection)
          ))}
          estimatedTotalLabel={journeyPlanEstimate.label}
          onClose={() => setJourneyRouteOpen(false)}
          onStart={() => {
            setJourneyRouteOpen(false);
            if (activeJourneyGuideId === recommendedCheckpoint.id) restartJourneyGuidance(recommendedCheckpoint);
            else startJourneyGuidance(recommendedCheckpoint);
          }}
          onOpenSimpleDestination={(checkpoint) => {
            window.location.hash = quickInvitationHashForCheckpoint(checkpoint);
            setJourneyRouteOpen(false);
            onOpenQuickView?.();
          }}
        />
      ) : null}
      <InvitationShareAccess
        variant="menu"
        open={shareSheetOpen}
        showTrigger={false}
        onOpenChange={handleShareSheetOpenChange}
      />
      {stampedCheckpointId ? <JourneyStampNotice checkpointId={stampedCheckpointId} /> : null}
      {journeyCompletionOpen ? (
        <JourneyCompletion
          nickname={profile.nickname}
          appearance={profile.appearance}
          onClose={() => setJourneyCompletionOpen(false)}
          onOpenRsvp={() => {
            setJourneyCompletionOpen(false);
            openSpot("rsvp");
          }}
          onOpenShare={() => {
            setJourneyCompletionOpen(false);
            pauseWorldInput();
            setShareSheetOpen(true);
          }}
          onOpenPhotoAlbum={() => {
            setJourneyCompletionOpen(false);
            pauseWorldInput();
            setPhotoAlbumOpen(true);
          }}
        />
      ) : null}
      <WeddingDayActionBar
        variant="world"
        preview={weddingDayPreview}
        onOpenChange={(open) => { if (open) pauseWorldInput(); }}
        onSchedule={() => {
          pauseWorldInput();
          setWeddingDaySheetOpen(true);
        }}
        onRsvp={() => openSpot("rsvp")}
      />
    </section>
  );
}
