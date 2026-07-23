import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TransitionEvent as ReactTransitionEvent
} from "react";
import { Camera, Images, Share2 } from "lucide-react";
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
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import { findNearestInteractionRoute, findNearestPortalRoute, findTilePath } from "../game/pathfinding";
import {
  advanceTileInput,
  createTileInputState,
  tileInputRepeatIntervalMs,
  type TileInputState
} from "../game/tileInput";
import {
  completeJourneyCheckpoint,
  journeyCheckpointForInteraction,
  journeyCheckpointForZone,
  journeyCheckpoints,
  loadJourneyProgress,
  saveJourneyProgress,
  type JourneyCheckpoint,
  type JourneyCheckpointId
} from "../game/journeyProgress";
import { resolveNpcDialogue, type NpcDialogue, type NpcId } from "../game/npcDialogue";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
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
import { preloadWorldZoneAssets } from "../game/worldAssetPreloader";
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
import { GiftAccountSheet } from "./GiftAccountSheet";
import { GameFeedbackToggle } from "./GameFeedbackToggle";
import { GuestReactionBubble, GuestReactionDock } from "./GuestReactions";
import { GuestInformationAccess } from "./GuestInformationAccess";
import { InvitationShareAccess } from "./InvitationShareAccess";
import { JourneyCompletion } from "./JourneyCompletion";
import { JourneyStampBook, JourneyStampNotice } from "./JourneyStampBook";
import { NpcDialogueBubble } from "./NpcDialogueBubble";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";
import { ViewSettingsAccess } from "./ViewSettingsAccess";
import { WeddingEventSummary } from "./WeddingEventSummary";
import { WeddingDayQuickAccess } from "./WeddingDayQuickAccess";
import { WeddingNpc } from "./WeddingNpc";
import { WeddingPhotoBooth } from "./WeddingPhotoBooth";
import { WeddingPhotoAlbum } from "./WeddingPhotoAlbum";
import { WorldMapArtwork } from "./WorldMapArtwork";
import { WorldDecoration } from "./WorldDecoration";
import { WorldMiniMap } from "./WorldMiniMap";
import "../journey.css";
import "../npc-reactions.css";
import "../wedding-photo.css";

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
  photoSpotId?: WorldPhotoSpotId;
  npcId?: NpcId;
};
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
  const { playFeedback, setFeedbackZone } = useGameFeedback();
  const initialZone = getWorldZone(gardenWorld, gardenWorld.defaultZoneId);
  const [activeZoneId, setActiveZoneId] = useState<WorldZoneId>(initialZone.id);
  const activeZone = getWorldZone(gardenWorld, activeZoneId);
  const [position, setPosition] = useState<Point>(initialZone.spawn);
  const [target, setTarget] = useState<Point | null>(null);
  const [portalIntent, setPortalIntentState] = useState<PortalIntent | null>(null);
  const [interactionIntent, setInteractionIntentState] = useState<WorldInteractionIntent | null>(null);
  const [portalTransition, setPortalTransitionState] = useState<PortalTransition | null>(null);
  const [inputReleaseRequired, setInputReleaseRequiredState] = useState(false);
  const [joystickVector, setJoystickVector] = useState<Point>({ x: 0, y: 0 });
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(1);
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
  const [journeyProgress, setJourneyProgress] = useState(loadJourneyProgress);
  const [stampedCheckpointId, setStampedCheckpointId] = useState<JourneyCheckpointId | null>(null);
  const [journeyCompletionPending, setJourneyCompletionPending] = useState(false);
  const [journeyCompletionOpen, setJourneyCompletionOpen] = useState(false);
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
    || photoAlbumOpen;

  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreMenuButtonFocusRef = useRef(false);
  const activeZoneIdRef = useRef<WorldZoneId>(initialZone.id);
  const positionRef = useRef<Point>(initialZone.spawn);
  const directionRef = useRef<Direction>("down");
  const portalIntentRef = useRef<PortalIntent | null>(null);
  const interactionIntentRef = useRef<WorldInteractionIntent | null>(null);
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
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);
  const terminalStopConfirmTimerRef = useRef<number | null>(null);
  const localReactionTimerRef = useRef<number | null>(null);
  const remoteReactionTimersRef = useRef(new Map<string, number>());
  const reactionTokenRef = useRef(0);

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

  const stampJourneyCheckpoint = useCallback((checkpointId: JourneyCheckpointId) => {
    const result = completeJourneyCheckpoint(journeyProgressRef.current, checkpointId);
    if (!result.changed) return;

    journeyProgressRef.current = result.progress;
    saveJourneyProgress(result.progress);
    setJourneyProgress(result.progress);
    setStampedCheckpointId(checkpointId);
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
    setTravelStatus(`${checkpoint?.label ?? "방문"} 스탬프를 찍었어요`);
    playFeedback("stamp");
    if (result.journeyCompleted) setJourneyCompletionPending(true);
  }, [playFeedback]);

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

  const pauseWorldInput = useCallback(() => {
    const joystickWasMoving = joystickWasMovingRef.current;
    inputGenerationRef.current += 1;

    setTarget(null);
    setPortalIntent(null);
    setInteractionIntent(null);
    setJoystickVector({ x: 0, y: 0 });
    setMoving(false);
    setStepFrame(1);
    setActiveNpcDialogue(null);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    setInputReleaseRequired(inputReleaseRequiredRef.current || joystickWasMoving);

    sendRealtimeTerminalStop(directionRef.current);
  }, [sendRealtimeTerminalStop, setInputReleaseRequired, setInteractionIntent, setPortalIntent]);

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
    setStepFrame(1);
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
    setStepFrame(1);
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
  }, [clearTerminalStopConfirm, sendMoveImmediately, setInteractionIntent, setPortalIntent, stampJourneyCheckpoint]);

  const handleJourneySelect = useCallback((zoneId: WorldZoneId) => {
    if (portalTransitionRef.current || zoneId === activeZoneIdRef.current) return;
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
    setStepFrame(1);
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
      npcId: input.npcId,
      photoSpotId: input.photoSpotId
    });
    setTravelStatus(`${input.label} 가까이 이동 중`);
  }, [
    activeZone,
    clearTerminalStopConfirm,
    openSpot,
    openPhotoSpot,
    sendRealtimeTerminalStop,
    setInputReleaseRequired,
    setInteractionIntent,
    setPortalIntent,
    showNpcDialogue,
    stampWorldInteraction
  ]);

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
      const connectedZoneIds = new Set(activeZone.portals.map((portal) => portal.to));
      connectedZoneIds.forEach((zoneId) => { void preloadWorldZoneAssets(zoneId); });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [activeZone, loadedBackgroundZoneId]);

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
    const movementTarget = interactionIntent?.path[0] ?? portalIntent?.path[0] ?? target;
    if (!movementTarget && !hasJoystickInput) {
      targetStepAtRef.current = null;
      tileInputStateRef.current = null;
      return;
    }

    const movementVector = joystickVector;
    let frame = 0;
    function tick(now: number) {
      if (inputGeneration !== inputGenerationRef.current || portalTransitionRef.current) return;

      const current = positionRef.current;
      const hasDirectionalInput = hasJoystickMovement(movementVector);
      const nextDirection = hasDirectionalInput
        ? directionFromVector(movementVector)
        : movementTarget
          ? directionTowardPoint(current, movementTarget)
          : null;

      if (!nextDirection) {
        setMoving(false);
        setStepFrame(1);
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
        setStepFrame(1);
        setTarget(null);
        setPortalIntent(null);
        setInteractionIntent(null);
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
        setStepFrame(1);
        setTarget(null);
        setInteractionIntent(null);
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
      setStepFrame((currentFrame) => (currentFrame + 1) % 3);
      sendRealtimeMove(next, hasDirectionalInput || !reachedTarget, nextDirection, activeZone.id, now);

      if (reachedTarget) {
        if (portalIntent) {
          setPortalIntent({ ...portalIntent, path: portalIntent.path.slice(1) });
        } else if (interactionIntent) {
          setInteractionIntent({ ...interactionIntent, path: interactionIntent.path.slice(1) });
        } else {
          setMoving(false);
          setStepFrame(1);
          setTarget(null);
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
    beginPortalTransition,
    interactionIntent,
    joystickVector,
    openSpot,
    openPhotoSpot,
    portalIntent,
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

    clearTerminalStopConfirm();
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
    const nextDirection = directionTowardPoint(positionRef.current, nextTarget);
    if (nextDirection) directionRef.current = nextDirection;
    setTarget(nextTarget);
    targetStepAtRef.current = null;
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
      if (!wasMoving) playFeedback("tap");
      setActiveNpcDialogue(null);
      cancelPortalWalk();
      cancelInteractionWalk();
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
      setStepFrame(1);
      sendRealtimeMove(positionRef.current, false, directionRef.current, activeZone.id, performance.now());
    }
  }

  const camera = computeCameraTransform({ player: position, viewport, bounds: activeZone.bounds, zoom: 1 });
  const completedJourneyIds = new Set(journeyProgress.completedIds);
  const activeJourneyMarkers = journeyCheckpoints
    .filter((checkpoint) => checkpoint.zoneId === activeZone.id)
    .flatMap((checkpoint) => {
      const point = journeyMarkerPoint(activeZone, checkpoint);
      return point ? [{ id: checkpoint.id, point, completed: completedJourneyIds.has(checkpoint.id) }] : [];
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
        <p className="world-travel-status" aria-live="polite">{travelStatus}</p>
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
            {activeZone.decorations.map((item) => (
              <WorldDecoration key={item.id} zoneId={activeZone.id} decoration={item} />
            ))}
            {activeZone.spots.map((worldSpot) => {
              const content = invitationContent.spots.find((candidate) => candidate.id === worldSpot.id);
              return (
                <button
                  key={worldSpot.id}
                  type="button"
                  className={`world-spot world-spot--${worldSpot.id}${interactionIntent?.targetId === `spot:${worldSpot.id}` ? " world-spot--target" : ""}`}
                  style={{ ...pixelRect(worldSpot), zIndex: 9000 }}
                  onClick={(event) => {
                    event.stopPropagation();
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
                  className={`world-portal world-portal--${horizontal ? "horizontal" : "vertical"}${portalIntent?.portal.id === portalItem.id ? " world-portal--target" : ""}`}
                  style={{
                    ...pixelRect(portalEntryRect(portalItem)),
                    zIndex: worldDepth(portalItem.approach.y) - 100
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
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
            {remoteGuests.filter((guest) => guest.zoneId === activeZone.id).map((guest) => (
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
                  stepFrame={guest.seq % 3}
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
                  approaching={interactionIntent?.targetId === `npc:${npc.id}`}
                  onSelect={() => beginWorldInteraction({
                    targetId: `npc:${npc.id}`,
                    spotId: "couple",
                    label: npc.label,
                    target: npcInteractionRect(npc),
                    actionRadius: npcInteractionRadius,
                    npcId: npc.id
                  })}
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
            targetPortalId={portalIntent?.portal.id ?? null}
            journeyMarkers={activeJourneyMarkers}
          />

          <GuestReactionDock
            disabled={Boolean(portalTransition)}
            onReact={handleGuestReaction}
          />

          <div className="world-control-dock" onClick={(event) => event.stopPropagation()}>
            <VirtualJoystick
              disabled={Boolean(portalTransition) || inputReleaseRequired}
              onVectorChange={handleJoystickVectorChange}
            />
            <div className="world-control-actions">
              <GuestInformationAccess
                variant="world"
                onOpenChange={handleGuestInformationOpenChange}
              />
              <WeddingDayQuickAccess
                variant="world"
                preview={weddingDayPreview}
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
    </section>
  );
}
