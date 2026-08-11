import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type TransitionEvent as ReactTransitionEvent
} from "react";
import "../game-ui-font-critical.css";
import { Accessibility, Archive, ArrowRight, CalendarDays, Camera, ChevronDown, CircleHelp, Flower2, Images, MapPinned, MessageCircle, RefreshCw, Share2, SlidersHorizontal, UsersRound, X } from "lucide-react";
import {
  companionRendezvousProposalLifetimeMs,
  guestPresetFrame,
  invitationContent,
  type ClientMessage,
  type CompanionPing,
  type Direction,
  type GuestReaction,
  type RoomGuest,
  type SpotId,
  type WorldZoneId
} from "@wedding-game/shared";
import { shouldReduceMotion } from "../accessibility/viewPreferences";
import { speakRouteVoiceMessage } from "../accessibility/routeVoiceGuidance";
import { useModalDialogFocus } from "../accessibility/useModalDialogFocus";
import { trackCameraCenterQuality } from "../analytics/invitationAnalytics";
import { resolveCharacterPortraitUrl } from "../character/assets";
import { resolveWorldCharacterAnchor, worldCharacterAnchorStyle } from "../character/worldAnchor";
import {
  fetchSyncedJourneyProgress,
  journeyProgressSyncScope,
  saveSyncedJourneyProgress
} from "../api/journeyProgressApi";
import {
  computeCameraTransform,
  screenToWorld,
  snapCameraViewport,
  type ViewportSize
} from "../game/camera";
import { resolveFootstepSurface, type FootstepSurface } from "../game/footstepSurface";
import { loadExtendedGameTypography, requiresExtendedGameTypography } from "../game/gameTypography";
import { placeRemoteGuestNameplates, type RemoteGuestNameplateObstacle } from "../game/remoteGuestNameplates";
import { computeNextGridPosition, directionFromVector, directionTowardPoint, snapToGrid } from "../game/movement";
import {
  findNearestInteractionRoute,
  findNearestPortalRouteAvoidingPoints,
  findTilePath,
  findTilePathAvoidingPoints,
  isTileOccupied
} from "../game/pathfinding";
import { portalAudioMixAt } from "../game/portalAudio";
import { shouldProcessGameFrame } from "../game/renderCadence";
import {
  advanceTileInput,
  createTileInputState,
  type TileInputState
} from "../game/tileInput";
import { advanceWalkPhase, neutralWalkFrame, walkFrameForPhase, walkLandingFootForFrame } from "../game/walkTiming";
import {
  completeJourneyCheckpoint,
  journeyCheckpointForInteraction,
  journeyCheckpointForZone,
  journeyCheckpoints,
  loadJourneyProgress,
  mergeJourneyProgress,
  nextJourneyCheckpoint,
  saveJourneyProgress,
  type JourneyCheckpoint,
  type JourneyCheckpointId
} from "../game/journeyProgress";
import {
  isJourneyStampRewardUnlocked,
  journeyStampRewards,
  loadJourneyStampReward,
  saveJourneyStampReward
} from "../game/journeyStampReward";
import {
  clearJourneySyncQueue,
  journeyProgressDiffers,
  loadJourneySyncQueue,
  markJourneySyncAttemptFailed,
  queueJourneyProgress
} from "../game/journeySyncQueue";
import { completeGameGuide, loadGameGuideState, shouldAutoOpenGameGuide } from "../game/gameGuide";
import { resolveGameHudDensity } from "../game/gameHudVisibility";
import {
  loadOptionalFeatureUsage,
  optionalFeatureSummary,
  recordOptionalFeatureUse,
  type OptionalFeatureId
} from "../game/optionalFeatureUsage";
import { placeWorldOverlayInsideViewport } from "../game/worldOverlayPlacement";
import { resolveWorldSpotProximity } from "../game/worldSpotProximity";
import { resolveWorldLabelVisibility } from "../game/worldLabelLayout";
import { resolveContextHudAction, type ContextHudAction } from "../game/contextHudAction";
import { resolveNpcDialoguePlacement } from "../game/gameOverlayPlacement";
import { journeyDirectionLabels, resolveJourneyGuidance } from "../game/journeyGuidance";
import { quickInvitationHashForCheckpoint } from "../game/journeyAccessibility";
import { summarizeRemainingJourney } from "../game/journeyRouteSummary";
import { journeyRouteTurns, segmentJourneyRouteBySurface } from "../game/journeyRouteVisual";
import { routeTurnCueOneTileAhead } from "../game/routeTurnCue";
import { routeArrivalCue } from "../game/routeArrivalGuidance";
import { smartJourneyRecommendation } from "../game/smartJourneyRecommendation";
import { weddingJourneyTiming } from "../game/weddingJourneyTiming";
import {
  resolveNpcDialogue,
  resolveNpcDialogueChoice,
  type NpcDialogue,
  type NpcDialogueChoice,
  type NpcId
} from "../game/npcDialogue";
import {
  loadNpcDialogueMemory,
  markNpcGroupCelebrationSeen,
  npcGroupCelebrationReady,
  npcConversationSnapshot,
  rememberNpcDialogueChoice
} from "../game/npcDialogueMemory";
import { buildNpcRelationshipStampBook } from "../game/npcRelationshipJournal";
import {
  advanceNpcMotionMap,
  createNpcMotionMap,
  npcMotionFor,
  type NpcMotionMap
} from "../game/npcMotion";
import { portalCongestion } from "../game/portalCongestion";
import { crowdDensityCells, portalWaitEstimate } from "../game/crowdDensity";
import {
  clearCompanionSession,
  appendCompanionTrailPoint,
  companionInviteLifetimeMs,
  companionArrivalEstimate,
  companionCandidates,
  companionFollowPath,
  companionRendezvousPoint,
  companionRendezvousReplanPoint,
  createCompanionInviteCode,
  createCompanionInviteUrl,
  inspectCompanionInviteUrl,
  loadCompanionSession,
  loadRealtimeIdentity,
  nearbyPhotoCompanions,
  saveCompanionSession
} from "../game/companionMode";
import {
  allCelebrationCollectibles,
  celebrationCollectiblesForZone,
  collectCelebrationItem,
  loadCelebrationCollection,
  visibleCelebrationCollectibles,
  type CelebrationCollectible
} from "../game/celebrationCollectibles";
import {
  celebrationKindRewardProgress,
  celebrationRewardProgress,
  celebrationSetRewardProgress,
  loadCelebrationCosmetic,
  loadCelebrationCosmeticTone,
  newlyUnlockedCelebrationMilestones,
  saveCelebrationCosmetic,
  saveCelebrationCosmeticTone,
  type CelebrationMilestone
} from "../game/celebrationReward";
import {
  collectionProximityBand,
  nearestUncollectedCelebrationItem,
  type CollectionProximityBand
} from "../game/celebrationCollectionGuide";
import {
  loadGameMemoryAlbum,
  recordGameMemory,
  type GameMemoryAlbum as GameMemoryAlbumData
} from "../game/gameMemoryAlbum";
import {
  registerCooperativeCelebration,
  type CooperativeCelebrationPulse,
  type CooperativeCelebrationTier
} from "../game/cooperativeCelebration";
import { triggerCollectionProximityHaptic } from "../feedback/gameAudio";
import { getWeddingDayPreviewNow, getWeddingDayStatus } from "../invitation/weddingDay";
import { copyText } from "../invitation/browserActions";
import {
  journeyArrivalAction,
  type JourneyArrivalAction
} from "../game/journeyArrivalAction";
import { destinationNavigationProgress } from "../game/navigationProgress";
import {
  estimateJourneyCheckpointRoute,
  firstJourneyWaypoint,
  estimateJourneyWaypointPlan,
  journeyWaypointZonePath,
  moveJourneyWaypoint,
  normalizeJourneyWaypointPlan,
  optimizeJourneyWaypointPlan,
  remainingJourneyWaypoints,
  toggleJourneyWaypoint
} from "../game/journeyWaypointPlan";
import { routeRecalculationResult, type RouteRecalculationResult } from "../game/routeDeviation";
import { useGameFeedback } from "../feedback/GameFeedbackContext";
import { useDevicePerformance } from "../performance/DevicePerformanceContext";
import { runtimeProtectionEventName } from "../performance/deviceRuntimeDiagnostics";
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
  nextWorldGeometryIssueZone,
  parseWorldGeometryAuditLayers,
  serializeWorldGeometryAuditLayers,
  type WorldGeometryAuditLayerKey
} from "../game/worldGeometryAuditLayers";
import {
  parseWorldGeometryAuditHeatmapMode,
  type WorldGeometryAuditHeatmapMode
} from "../game/worldGeometryAuditHeatmap";
import { auditWorldGeometry } from "../game/worldGeometryAudit";
import { evaluateWorldGeometryAuditPolicy } from "../game/worldGeometryAuditPolicy";
import {
  captureWorldDiagnosticScreenshot,
  createWorldDiagnosticBundle,
  downloadJsonArtifact,
  worldDiagnosticArtifactFilename,
  worldDiagnosticBundleViewerUrl
} from "../game/worldDiagnosticBundle";
import {
  buildWorldForegroundRecommendationPatch,
  foregroundRecommendationReviewsForZone,
  type ForegroundRecommendationDecision
} from "../game/worldForegroundRecommendations";
import {
  previewWorldForegroundRecommendationPatch,
  type WorldForegroundPatchPreview
} from "../game/worldForegroundPatchPreview";
import {
  loadWorldForegroundReviewDecisions,
  saveWorldForegroundReviewDecisions,
  writeWorldForegroundReviewDecisionsToUrl
} from "../game/worldForegroundReviewState";
import {
  nearestWorldLandmark,
  worldPortalAccessibilityLabel,
  type WorldAccessibilityLandmark
} from "../game/worldAccessibility";
import {
  loadWeddingPhotoAlbum,
  weddingPhotoAlbumProgress,
  type WeddingPhotoMemory
} from "../game/weddingPhoto";
import { recordJourneyVisit } from "../game/journeyVisitLog";
import { loadWorldSession, saveWorldSession } from "../game/worldSession";
import {
  isFirstWorldVisit,
  loadWorldTravelHistory,
  recentWorldTravelRecords,
  recordWorldTravel
} from "../game/worldTravelHistory";
import {
  worldPropInteractionFor,
  worldPropInteractionsForZone,
  totalWorldSecrets
} from "../game/worldPropInteractions";
import { discoverWorldSecret, equipWorldSecretReward, loadWorldSecretCollection } from "../game/worldSecretCollection";
import { resolveWorldSecretClue } from "../game/worldSecretClue";
import { weddingPhaseExperience } from "../game/weddingPhaseExperience";
import { journeyAssetPrediction, uniquePredictedAppearances } from "../game/journeyAssetPrediction";
import { loadInvitationViewSync, saveGameViewLocation } from "../game/invitationViewSync";
import { preloadImage } from "../performance/imagePreloader";
import { useNetworkMode } from "../performance/networkQuality";
import { connectRealtimeWithRetry, createMoveThrottle, getRoomUrl } from "../realtime/realtimeClient";
import type { EntryProfile } from "./EntryScreen";
import { CharacterSprite } from "./CharacterSprite";
import { AccessibleDestinationCue } from "./AccessibleDestinationCue";
import { CompanionDock } from "./CompanionDock";
import { CompanionInvitationPrompt } from "./CompanionInvitationPrompt";
import { CelebrationRewardNotice } from "./CelebrationRewardNotice";
import { CelebrationMilestoneNotice } from "./CelebrationMilestoneNotice";
import { DirectionsSheet } from "./DirectionsSheet";
import { FamilyContactSheet } from "./FamilyContactSheet";
import { GameFirstVisitGuide } from "./GameFirstVisitGuide";
import { GiftAccountSheet } from "./GiftAccountSheet";
import { GameFeedbackToggle } from "./GameFeedbackToggle";
import { GuestReactionBubble } from "./GuestReactions";
import { GameQuickDock } from "./GameQuickDock";
import { InvitationShareAccess } from "./InvitationShareAccess";
import { JourneyCompletion } from "./JourneyCompletion";
import { JourneyNextActionCard } from "./JourneyNextActionCard";
import type {
  JourneyRouteComparisonOption,
  JourneyRoutePreference
} from "./JourneyRouteSheet";
import { JourneyStampBook, JourneyStampNotice } from "./JourneyStampBook";
import { NpcDialogueBubble } from "./NpcDialogueBubble";
import { NpcGroupCelebrationNotice } from "./NpcGroupCelebrationNotice";
import { OneHandControlQuickToggle } from "./OneHandControlQuickToggle";
import { PortalDestinationPreview } from "./PortalDestinationPreview";
import { SpotModal } from "./SpotModal";
import { VirtualJoystick } from "./VirtualJoystick";
import { useViewPreferences } from "../accessibility/ViewPreferencesContext";
import { WeddingEventSummary } from "./WeddingEventSummary";
import { WeddingJourneyClock } from "./WeddingJourneyClock";
import { WeddingDayQuickAccess } from "./WeddingDayQuickAccess";
import { WeddingDayActionBar } from "./WeddingDayActionBar";
import { WeddingNpc } from "./WeddingNpc";
import { WorldMapArtwork } from "./WorldMapArtwork";
import { WorldGeometryAuditOverlay } from "./WorldGeometryAuditOverlay";
import { WorldGeometryAuditControls } from "./WorldGeometryAuditControls";
import { WorldDestinationBeacon } from "./WorldDestinationBeacon";
import { WorldCrowdHeatmap } from "./WorldCrowdHeatmap";
import { WorldCooperativeCelebration } from "./WorldCooperativeCelebration";
import { WorldContextAction } from "./WorldContextAction";
import {
  completeCurrentZoneMiniQuestStep,
  completedZoneMiniQuestStepCount,
  currentZoneMiniQuestStep,
  loadZoneMiniQuestProgress,
  saveZoneMiniQuestProgress,
  zoneMiniQuestFor,
  zoneMiniQuestStepDuplicatesCheckpoint,
  type ZoneMiniQuestAction,
  type ZoneMiniQuestStep
} from "../game/zoneMiniQuest";
import { resolveWorldRenderBudget } from "../game/worldRenderBudget";
import { createWorldMotionStore, type WorldMotionStore } from "../game/worldMotionStore";
import {
  CelebrationCollectionProgress,
  WorldCelebrationCollectibles
} from "./WorldCelebrationCollectibles";
import { WorldDecorationLayer, WorldPathLayer } from "./WorldStaticMapLayers";
import { WorldInteractiveProp, WorldPropMoment } from "./WorldInteractiveProp";
import { WorldMiniMap } from "./WorldMiniMap";
import { WorldLocalPlayer } from "./WorldLocalPlayer";
import { WorldSecretProgress } from "./WorldSecretProgress";
import { WorldSecretCollectionBook } from "./WorldSecretCollectionBook";
import { WorldTravelTimeline } from "./WorldTravelTimeline";
import { GamePerformanceStatus } from "./GamePerformanceStatus";
import { WeddingPhaseAnnouncement } from "./WeddingPhaseAnnouncement";
import "../journey.css";
import "../game-guide.css";
import "../npc-reactions.css";
import "../game-mobile-controls.css";
import "../wedding-photo-world.css";
import "../game-luxe-theme.css";
import "../game-navigation-enhancements.css";
import "../game-wedding-day-operations.css";
import "../game-experience-continuity.css";
import "../map-visual-enhancements.css";
import "../game-discovery-dashboard.css";
import "../game-hud-density.css";
import "../game-refined-theme.css";

const loadWeddingPhotoBoothComponent = () => import("./WeddingPhotoBooth");
const loadWeddingPhotoAlbumComponent = () => import("./WeddingPhotoAlbum");
const loadGameMemoryAlbumComponent = () => import("./GameMemoryAlbum");
const loadCelebrationCollectionGuideComponent = () => import("./CelebrationCollectionGuide");
const loadCompanionDestinationSheetComponent = () => import("./CompanionDestinationSheet");
const loadCompanionWaitingRoomComponent = () => import("./CompanionWaitingRoom");
const loadJourneyRouteSheetComponent = () => import("./JourneyRouteSheet");
const loadNpcRelationshipJournalComponent = () => import("./NpcRelationshipJournal");
const loadViewSettingsAccessComponent = () => import("./ViewSettingsAccess");
const loadGameSaveDataCenterComponent = () => import("./GameSaveDataCenter");
const loadGameDeviceReadinessCenterComponent = () => import("./GameDeviceReadinessCenter");
const loadWorldSecretMemorialComponent = () => import("./WorldSecretMemorial");
const loadJourneyMemoryCardAccessComponent = () => import("./JourneyMemoryCardAccess");

export async function preloadGameFeatureComponents() {
  await Promise.all([
    loadWeddingPhotoBoothComponent(),
    loadWeddingPhotoAlbumComponent(),
    loadGameMemoryAlbumComponent(),
    loadCelebrationCollectionGuideComponent(),
    loadCompanionDestinationSheetComponent(),
    loadCompanionWaitingRoomComponent(),
    loadJourneyRouteSheetComponent(),
    loadNpcRelationshipJournalComponent(),
    loadViewSettingsAccessComponent(),
    loadGameSaveDataCenterComponent(),
    loadGameDeviceReadinessCenterComponent(),
    loadWorldSecretMemorialComponent(),
    loadJourneyMemoryCardAccessComponent()
  ]);
}

const WeddingPhotoBooth = lazy(async () => {
  const module = await loadWeddingPhotoBoothComponent();
  return { default: module.WeddingPhotoBooth };
});
const WeddingPhotoAlbum = lazy(async () => {
  const module = await loadWeddingPhotoAlbumComponent();
  return { default: module.WeddingPhotoAlbum };
});
const GameMemoryAlbum = lazy(async () => {
  const module = await loadGameMemoryAlbumComponent();
  return { default: module.GameMemoryAlbum };
});
const CelebrationCollectionGuide = lazy(async () => {
  const module = await loadCelebrationCollectionGuideComponent();
  return { default: module.CelebrationCollectionGuide };
});
const CompanionDestinationSheet = lazy(async () => {
  const module = await loadCompanionDestinationSheetComponent();
  return { default: module.CompanionDestinationSheet };
});
const CompanionWaitingRoom = lazy(async () => {
  const module = await loadCompanionWaitingRoomComponent();
  return { default: module.CompanionWaitingRoom };
});
const JourneyRouteSheet = lazy(async () => {
  const module = await loadJourneyRouteSheetComponent();
  return { default: module.JourneyRouteSheet };
});
const NpcRelationshipJournal = lazy(async () => {
  const module = await loadNpcRelationshipJournalComponent();
  return { default: module.NpcRelationshipJournal };
});
const ViewSettingsAccess = lazy(async () => {
  const module = await loadViewSettingsAccessComponent();
  return { default: module.ViewSettingsAccess };
});
const GameSaveDataCenter = lazy(async () => {
  const module = await loadGameSaveDataCenterComponent();
  return { default: module.GameSaveDataCenter };
});
const GameDeviceReadinessCenter = lazy(async () => {
  const module = await loadGameDeviceReadinessCenterComponent();
  return { default: module.GameDeviceReadinessCenter };
});
const WorldSecretMemorial = lazy(async () => {
  const module = await loadWorldSecretMemorialComponent();
  return { default: module.WorldSecretMemorial };
});
const JourneyMemoryCardAccess = lazy(async () => {
  const module = await loadJourneyMemoryCardAccessComponent();
  return { default: module.JourneyMemoryCardAccess };
});

function GameFeatureLoading({ label }: { label: string }) {
  return (
    <div className="game-feature-loading" role="status" aria-live="polite">
      <RefreshCw aria-hidden="true" />
      <span>{label} 준비 중</span>
    </div>
  );
}

function GameInlineLoading({ label }: { label: string }) {
  return <p className="game-inline-loading" role="status">{label} 준비 중</p>;
}

type GameWorldProps = {
  profile: EntryProfile;
  weddingDayPreview?: boolean;
  onOpenQuickView?: () => void;
};
type RealtimeStatus = "offline" | "connecting" | "reconnecting" | "online" | "full";
type MoveMessage = Extract<ClientMessage, { type: "move" }>;
type RealtimeConnection = ReturnType<typeof connectRealtimeWithRetry>;
type CompanionRole = "leader" | "follower";
type IncomingCompanionInvite = { requesterGuestId: string; requesterNickname: string };
type ActiveCompanionPing = { ping: CompanionPing; nickname: string };
type CompanionRendezvousProposal = {
  proposalId: string;
  guestId: string;
  nickname: string;
  zoneId: WorldZoneId;
  point: Point;
  expiresAt: number;
};
type ActiveCompanionRendezvous = {
  proposalId: string;
  zoneId: WorldZoneId;
  point: Point;
  expiresAt: number;
};
type ActiveCooperativeCelebration = {
  token: number;
  participantNames: string[];
  participantIds: string[];
  tier: CooperativeCelebrationTier;
};
type SharedCompanionDestination = {
  token: number;
  portalId: string;
  destinationZoneId: WorldZoneId;
};
type SharedPortalWait = { portal: WorldPortal; approach: Point };
type PortalIntent = { portal: WorldPortal; path: Point[] };
type WorldInteractionIntent = {
  targetId: string;
  spotId?: SpotId;
  collectibleId?: string;
  decorationId?: string;
  label: string;
  path: Point[];
  target: Point;
  targetRect: Rect;
  actionRadius: number;
  photoSpotId?: WorldPhotoSpotId;
  npcId?: NpcId;
};
type NavigationResumeIntent =
  | { kind: "portal"; portal: WorldPortal; remainingTiles: number }
  | { kind: "interaction"; intent: WorldInteractionIntent; remainingTiles: number }
  | { kind: "map"; target: Point; remainingTiles: number };
type ActiveGuestReaction = {
  reaction: GuestReaction;
  token: number;
  zoneId: WorldZoneId;
};
type ActiveWorldPropMoment = {
  token: number;
  zoneId: WorldZoneId;
  decorationId: string;
  isNewSecret: boolean;
  achievementLabel?: string;
};
type PortalTransitionPhase = "arrival" | "fade-out" | "fade-in";
type PortalTransition = { portal: WorldPortal; phase: PortalTransitionPhase };
type RouteArrivalNotice = {
  title: string;
  detail: string;
  kind: "portal" | "destination";
};
type MoveToZoneOptions = {
  stampCheckpoint?: boolean;
  syncRealtime?: boolean;
  status?: string;
};

const joystickDeadZone = 0.05;
const joystickDirectionHandoffDelayMs = 96;
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
const svgRoutePoints = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(" ");
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
const celebrationCollectibles = allCelebrationCollectibles();
const totalCelebrationCollectibles = celebrationCollectibles.length;

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
  if (status === "online") return "같이 걷기 연결됨";
  if (status === "full") return "같이 걷기 만석 · 혼자 둘러보기";
  if (status === "reconnecting") return "같이 걷기 재연결 중 · 초대장 이용 가능";
  if (status === "connecting") return "같이 걷기 연결 중 · 초대장 이용 가능";
  return "같이 걷기 없이 둘러보기";
}

export function GameWorld({ profile, weddingDayPreview = false, onOpenQuickView }: GameWorldProps) {
  const devicePerformance = useDevicePerformance();
  const { preferences: viewPreferences, setStepFreeRouteEnabled } = useViewPreferences();
  const networkMode = useNetworkMode(viewPreferences.dataSaver);
  const renderBudget = useMemo(() => resolveWorldRenderBudget(
    devicePerformance.mode,
    devicePerformance.effectsQuality
  ), [devicePerformance.effectsQuality, devicePerformance.mode]);
  const mapAuditMode = useMemo(() => {
    const parameters = new URLSearchParams(window.location.search);
    const parameter = parameters.get("mapAudit");
    const requestedZoneId = parameters.get("mapAuditZone");
    const initialZoneId = parameter === "1"
      && gardenWorld.zones.some((zone) => zone.id === requestedZoneId)
      ? requestedZoneId as WorldZoneId
      : null;
    return {
      available: parameter !== null,
      initiallyEnabled: parameter === "1",
      initialZoneId,
      initialLayers: parseWorldGeometryAuditLayers(parameters.get("mapAuditLayers")),
      initialHeatmapMode: parseWorldGeometryAuditHeatmapMode(parameters.get("mapAuditHeatmap")),
      initialRecommendationDecisions: loadWorldForegroundReviewDecisions(
        parameters.get("mapAuditReview"),
        window.localStorage
      )
    };
  }, []);
  const [geometryAuditEnabled, setGeometryAuditEnabled] = useState(mapAuditMode.initiallyEnabled);
  const [geometryAuditLayers, setGeometryAuditLayers] = useState(mapAuditMode.initialLayers);
  const [geometryAuditHeatmapMode, setGeometryAuditHeatmapMode] = useState(mapAuditMode.initialHeatmapMode);
  const [diagnosticCopyStatus, setDiagnosticCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [diagnosticPatchStatus, setDiagnosticPatchStatus] = useState<"idle" | "saved" | "error">("idle");
  const [diagnosticBundleStatus, setDiagnosticBundleStatus] = useState<"idle" | "capturing" | "saved" | "error">("idle");
  const [diagnosticPatchImportStatus, setDiagnosticPatchImportStatus] = useState<"idle" | "loaded" | "error">("idle");
  const [diagnosticPatchPreview, setDiagnosticPatchPreview] = useState<WorldForegroundPatchPreview | null>(null);
  const [foregroundRecommendationDecisions, setForegroundRecommendationDecisions] = useState<
    Partial<Record<string, ForegroundRecommendationDecision>>
  >(mapAuditMode.initialRecommendationDecisions);
  const movementStepIntervalMs = viewPreferences.gameMovementSpeed === "relaxed"
    ? 320
    : viewPreferences.gameMovementSpeed === "brisk" ? 190 : 240;
  const movementInitialDelayMs = viewPreferences.gameMovementSpeed === "relaxed"
    ? 380
    : viewPreferences.gameMovementSpeed === "brisk" ? 240 : 300;
  const {
    preferences: feedbackPreferences,
    playFeedback,
    playJourneyHaptic,
    playRouteTurnHaptic,
    setFeedbackZone,
    setPortalAudio
  } = useGameFeedback();
  const companionInviteInspection = useMemo(() => inspectCompanionInviteUrl(window.location.href), []);
  const companionInviteLink = companionInviteInspection.status === "valid"
    ? companionInviteInspection.invite
    : null;
  const diagnosticInitialZoneId = companionInviteLink ? null : mapAuditMode.initialZoneId;
  const realtimeIdentity = useMemo(() => loadRealtimeIdentity(), []);
  const restoredCompanionSession = useMemo(() => loadCompanionSession(), []);
  const restoredWorldSession = useMemo(() => loadWorldSession(), []);
  const restoredViewSync = useMemo(() => loadInvitationViewSync(), []);
  const initialZone = getWorldZone(
    gardenWorld,
    companionInviteLink?.zoneId
      ?? diagnosticInitialZoneId
      ?? restoredWorldSession?.zoneId
      ?? gardenWorld.defaultZoneId
  );
  const restoredGuideCandidate = restoredViewSync?.source === "quick" && restoredViewSync.checkpointId
    ? restoredViewSync.checkpointId
    : restoredWorldSession?.guideCheckpointId;
  const restoredGuideId = restoredGuideCandidate
    && journeyCheckpoints.some(({ id }) => id === restoredGuideCandidate)
    ? restoredGuideCandidate as JourneyCheckpointId
    : null;
  const initialGuideId = mapAuditMode.available ? null : restoredGuideId;
  const [activeZoneId, setActiveZoneId] = useState<WorldZoneId>(initialZone.id);
  const activeZone = getWorldZone(gardenWorld, activeZoneId);
  const geometryAuditsByZone = useMemo(() => (
    mapAuditMode.available
      ? Object.fromEntries(gardenWorld.zones.map((zone) => [zone.id, auditWorldGeometry(zone)]))
      : {}
  ) as Partial<Record<WorldZoneId, ReturnType<typeof auditWorldGeometry>>>, [mapAuditMode.available]);
  const geometryAuditIssueCounts = useMemo(() => Object.fromEntries(
    Object.entries(geometryAuditsByZone).map(([zoneId, audit]) => [zoneId, audit.severityCounts])
  ), [geometryAuditsByZone]);
  const activeForegroundRecommendations = useMemo(
    () => mapAuditMode.available ? foregroundRecommendationReviewsForZone(activeZoneId) : [],
    [activeZoneId, mapAuditMode.available]
  );
  const activePatchPreviewRecommendations = diagnosticPatchPreview?.reviewsByZone[activeZoneId] ?? null;
  const overlayRecommendationDecisions = diagnosticPatchPreview
    ? { ...foregroundRecommendationDecisions, ...diagnosticPatchPreview.decisions }
    : foregroundRecommendationDecisions;
  const [position, setPosition] = useState<Point>(
    companionInviteLink || diagnosticInitialZoneId
      ? initialZone.spawn
      : restoredWorldSession?.position ?? initialZone.spawn
  );
  const [target, setTargetState] = useState<Point | null>(null);
  const [mapPath, setMapPath] = useState<Point[]>([]);
  const [portalIntent, setPortalIntentState] = useState<PortalIntent | null>(null);
  const [previewPortalId, setPreviewPortalId] = useState<string | null>(null);
  const [interactionIntent, setInteractionIntentState] = useState<WorldInteractionIntent | null>(null);
  const [portalTransition, setPortalTransitionState] = useState<PortalTransition | null>(null);
  const [inputReleaseRequired, setInputReleaseRequiredState] = useState(false);
  const [joystickInputActive, setJoystickInputActive] = useState(false);
  const [direction, setDirection] = useState<Direction>(
    companionInviteLink || diagnosticInitialZoneId ? "down" : restoredWorldSession?.direction ?? "down"
  );
  const [moving, setMoving] = useState(false);
  const [stepFrame, setStepFrame] = useState(neutralWalkFrame);
  const motionStoreRef = useRef<WorldMotionStore | null>(null);
  if (!motionStoreRef.current) {
    motionStoreRef.current = createWorldMotionStore({ position, direction, moving, stepFrame });
  }
  const motionStore = motionStoreRef.current;
  const [activeSpotId, setActiveSpotId] = useState<SpotId | null>(null);
  const [activePhotoSpotId, setActivePhotoSpotId] = useState<WorldPhotoSpotId | null>(null);
  const [photoAlbum, setPhotoAlbum] = useState(loadWeddingPhotoAlbum);
  const [photoAlbumOpen, setPhotoAlbumOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hudToolsOpen, setHudToolsOpen] = useState(() => window.location.hash.startsWith("#game-transfer="));
  const [optionalFeatureUsage, setOptionalFeatureUsage] = useState(loadOptionalFeatureUsage);
  const [quickDockSettingsOpen, setQuickDockSettingsOpen] = useState(false);
  const [calendarSheetOpen, setCalendarSheetOpen] = useState(false);
  const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
  const [giftAccountSheetOpen, setGiftAccountSheetOpen] = useState(false);
  const [familyContactSheetOpen, setFamilyContactSheetOpen] = useState(false);
  const [weddingDaySheetOpen, setWeddingDaySheetOpen] = useState(false);
  const [guestInformationOpen, setGuestInformationOpen] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [travelStatus, setTravelStatus] = useState(companionInviteInspection.status === "expired"
    ? "동행 초대 링크가 만료됐어요 · 새 링크를 받아주세요"
    : diagnosticInitialZoneId
      ? `${initialZone.label} 진단 링크로 바로 이동했어요`
    : restoredWorldSession
      ? `${initialZone.label}의 이전 위치에서 이어서 시작해요`
      : "우리 집에서 여정을 시작해요");
  const [travelStatusVisible, setTravelStatusVisible] = useState(true);
  const [routeRecalculationId, setRouteRecalculationId] = useState(0);
  const [routeRecalculationNotice, setRouteRecalculationNotice] = useState<RouteRecalculationResult | null>(null);
  const [routeArrivalNotice, setRouteArrivalNotice] = useState<RouteArrivalNotice | null>(null);
  const [journeyProgress, setJourneyProgress] = useState(loadJourneyProgress);
  const journeyCompleted = journeyCheckpoints.every(({ id }) => journeyProgress.completedIds.includes(id));
  const [worldTravelHistory, setWorldTravelHistory] = useState(() => loadWorldTravelHistory(initialZone.id));
  const [worldSecretCollection, setWorldSecretCollection] = useState(loadWorldSecretCollection);
  const [zoneMiniQuestProgress, setZoneMiniQuestProgress] = useState(loadZoneMiniQuestProgress);
  const [journeySyncStatus, setJourneySyncStatus] = useState<
    "local" | "syncing" | "synced" | "queued" | "merged" | "error"
  >("local");
  const [plannedCheckpointIds, setPlannedCheckpointIds] = useState(() => (
    remainingJourneyWaypoints(loadJourneyProgress()).map(({ id }) => id)
  ));
  const [gameGuideOpen, setGameGuideOpen] = useState(() => (
    shouldAutoOpenGameGuide(loadGameGuideState(), journeyProgress)
  ));
  const [pendingJourneyGuideId, setPendingJourneyGuideId] = useState<JourneyCheckpointId | null>(initialGuideId);
  const [activeJourneyGuideId, setActiveJourneyGuideId] = useState<JourneyCheckpointId | null>(initialGuideId);
  const [stampedCheckpointId, setStampedCheckpointId] = useState<JourneyCheckpointId | null>(null);
  const [journeyCompletionPending, setJourneyCompletionPending] = useState(false);
  const [journeyCompletionOpen, setJourneyCompletionOpen] = useState(false);
  const [arrivalAction, setArrivalAction] = useState<JourneyArrivalAction | null>(null);
  const [journeyRouteOpen, setJourneyRouteOpen] = useState(false);
  const [journeyRoutePreference, setJourneyRoutePreference] = useState<JourneyRoutePreference>(
    viewPreferences.stepFreeRouteEnabled ? "step-free" : "recommended"
  );
  const [journeyClock, setJourneyClock] = useState(() => new Date());
  const [activeNpcDialogue, setActiveNpcDialogue] = useState<NpcDialogue | null>(null);
  const [npcDialogueMemory, setNpcDialogueMemory] = useState(loadNpcDialogueMemory);
  const [npcGroupCelebrationActive, setNpcGroupCelebrationActive] = useState(false);
  const [npcMotions, setNpcMotions] = useState<NpcMotionMap>(() => createNpcMotionMap(initialZone));
  const [localReaction, setLocalReaction] = useState<ActiveGuestReaction | null>(null);
  const [activePropMoment, setActivePropMoment] = useState<ActiveWorldPropMoment | null>(null);
  const [remoteReactions, setRemoteReactions] = useState<Record<string, ActiveGuestReaction>>({});
  const [viewport, setViewport] = useState<ViewportSize>(defaultViewport);
  const camera = useMemo(() => computeCameraTransform({
    player: position,
    viewport,
    bounds: activeZone.bounds,
    zoom: 1
  }), [activeZone.bounds.height, activeZone.bounds.width, position.x, position.y, viewport.height, viewport.width]);
  const [remoteGuests, setRemoteGuests] = useState<RoomGuest[]>([]);
  const [companionGuestId, setCompanionGuestId] = useState<string | null>(
    restoredCompanionSession?.companionGuestId ?? null
  );
  const [companionNickname, setCompanionNickname] = useState<string | null>(
    restoredCompanionSession?.companionNickname ?? null
  );
  const [companionRole, setCompanionRole] = useState<CompanionRole | null>(
    restoredCompanionSession?.role ?? null
  );
  const [pendingCompanionGuestId, setPendingCompanionGuestId] = useState<string | null>(null);
  const [incomingCompanionInvite, setIncomingCompanionInvite] = useState<IncomingCompanionInvite | null>(null);
  const [companionDestinationOpen, setCompanionDestinationOpen] = useState(false);
  const [sharedCompanionDestination, setSharedCompanionDestination] = useState<SharedCompanionDestination | null>(null);
  const [sharedPortalWait, setSharedPortalWait] = useState<SharedPortalWait | null>(null);
  const [recentCompanionPing, setRecentCompanionPing] = useState<ActiveCompanionPing | null>(null);
  const [companionDestinationRequested, setCompanionDestinationRequested] = useState(false);
  const [companionRejoinZoneId, setCompanionRejoinZoneId] = useState<WorldZoneId | null>(null);
  const [companionShareStatus, setCompanionShareStatus] = useState<string | null>(null);
  const [companionWaitingRoomOpen, setCompanionWaitingRoomOpen] = useState(false);
  const [companionTrailPoints, setCompanionTrailPoints] = useState<Point[]>([]);
  const [companionRendezvous, setCompanionRendezvous] = useState<ActiveCompanionRendezvous | null>(null);
  const [incomingRendezvousProposal, setIncomingRendezvousProposal] = useState<CompanionRendezvousProposal | null>(null);
  const [outgoingRendezvousProposal, setOutgoingRendezvousProposal] = useState<ActiveCompanionRendezvous | null>(null);
  const [companionInviteDraft, setCompanionInviteDraft] = useState<{
    url: string;
    expiresAt: number;
    zoneId: WorldZoneId;
    inviteCode: string;
    canceled: boolean;
    used: boolean;
  } | null>(null);
  const [collectedCelebrationIds, setCollectedCelebrationIds] = useState(loadCelebrationCollection);
  const [collectionGuideOpen, setCollectionGuideOpen] = useState(false);
  const [guidedCollectibleId, setGuidedCollectibleId] = useState<string | null>(null);
  const [celebrationRewardOpen, setCelebrationRewardOpen] = useState(false);
  const [celebrationMilestones, setCelebrationMilestones] = useState<CelebrationMilestone[]>([]);
  const [equippedCelebrationCosmetic, setEquippedCelebrationCosmetic] = useState(loadCelebrationCosmetic);
  const [equippedCelebrationTone, setEquippedCelebrationTone] = useState(loadCelebrationCosmeticTone);
  const [equippedJourneyStampReward, setEquippedJourneyStampReward] = useState(loadJourneyStampReward);
  const [gameMemoryAlbum, setGameMemoryAlbum] = useState<GameMemoryAlbumData>(loadGameMemoryAlbum);
  const [gameMemoryAlbumOpen, setGameMemoryAlbumOpen] = useState(false);
  const [cooperativeCelebration, setCooperativeCelebration] = useState<ActiveCooperativeCelebration | null>(null);
  const [cooperativePhotoGuestIds, setCooperativePhotoGuestIds] = useState<string[]>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("offline");
  const [loadedBackgroundZoneId, setLoadedBackgroundZoneId] = useState<WorldZoneId | null>(null);
  const handleBackgroundLoadStateChange = useCallback((loaded: boolean) => {
    setLoadedBackgroundZoneId((current) => (
      loaded ? activeZoneId : current === activeZoneId ? null : current
    ));
  }, [activeZoneId]);
  const nonGuideSheetOpen = calendarSheetOpen
    || directionsSheetOpen
    || giftAccountSheetOpen
    || familyContactSheetOpen
    || weddingDaySheetOpen
    || guestInformationOpen
    || shareSheetOpen
    || viewSettingsOpen
    || photoAlbumOpen
    || gameMemoryAlbumOpen
    || collectionGuideOpen
    || companionDestinationOpen
    || companionWaitingRoomOpen
    || journeyRouteOpen;

  const nonGuideOverlayOpen = menuOpen
    || nonGuideSheetOpen
    || quickDockSettingsOpen
    || activeSpotId !== null
    || activePhotoSpotId !== null
    || activeNpcDialogue !== null
    || journeyCompletionOpen
    || celebrationRewardOpen;

  const gameGuideVisible = gameGuideOpen && !nonGuideOverlayOpen;
  const nestedMenuSheetOpen = nonGuideSheetOpen || gameGuideVisible;

  const gameOverlayOpen = menuOpen
    || nestedMenuSheetOpen
    || quickDockSettingsOpen
    || activeSpotId !== null
    || activePhotoSpotId !== null
    || activeNpcDialogue !== null
    || journeyCompletionOpen
    || celebrationRewardOpen;

  useEffect(() => {
    if (isJourneyStampRewardUnlocked(equippedJourneyStampReward, journeyProgress)) return;
    saveJourneyStampReward("none");
    setEquippedJourneyStampReward("none");
  }, [equippedJourneyStampReward, journeyProgress]);

  const mapShellRef = useRef<HTMLDivElement | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapStageRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuDialogRef = useRef<HTMLElement | null>(null);
  const menuTitleRef = useRef<HTMLHeadingElement | null>(null);
  const menuCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreMenuButtonFocusRef = useRef(false);
  const activeZoneIdRef = useRef<WorldZoneId>(initialZone.id);
  const positionRef = useRef<Point>(restoredWorldSession?.position ?? initialZone.spawn);
  const directionRef = useRef<Direction>(restoredWorldSession?.direction ?? "down");
  const portalIntentRef = useRef<PortalIntent | null>(null);
  const interactionIntentRef = useRef<WorldInteractionIntent | null>(null);
  const navigationResumeRef = useRef<NavigationResumeIntent | null>(null);
  const portalTransitionRef = useRef<PortalTransition | null>(null);
  const targetStepAtRef = useRef<number | null>(null);
  const tileInputStateRef = useRef<TileInputState | null>(null);
  const joystickVectorRef = useRef<Point>({ x: 0, y: 0 });
  const joystickInputActiveRef = useRef(false);
  const joystickStopTimerRef = useRef<number | null>(null);
  const joystickWasMovingRef = useRef(false);
  const inputReleaseRequiredRef = useRef(false);
  const inputGenerationRef = useRef(0);
  const routeGuidanceSessionRef = useRef(0);
  const announcedRouteTurnRef = useRef("");
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const currentGuestIdRef = useRef<string | null>(null);
  const moveSeqRef = useRef(0);
  const lastSentMoveRef = useRef<MoveMessage | null>(null);
  const journeyProgressRef = useRef(journeyProgress);
  const plannedCheckpointIdsRef = useRef(plannedCheckpointIds);
  const journeyGuideLastZoneRef = useRef<WorldZoneId | null>(null);
  const pendingJourneyGuideIdRef = useRef<JourneyCheckpointId | null>(null);
  const journeySyncRequestRef = useRef(0);
  const moveThrottleRef = useRef<((message: MoveMessage, now: number) => void) | null>(null);
  const terminalStopConfirmTimerRef = useRef<number | null>(null);
  const localReactionTimerRef = useRef<number | null>(null);
  const worldPropMomentTimerRef = useRef<number | null>(null);
  const remoteReactionTimersRef = useRef(new Map<string, number>());
  const companionGuestIdRef = useRef<string | null>(null);
  const pendingCompanionGuestIdRef = useRef<string | null>(null);
  const sharedCompanionDestinationRef = useRef<SharedCompanionDestination | null>(null);
  const plannedSharedDestinationTokenRef = useRef<number | null>(null);
  const sharedPortalWaitRef = useRef<SharedPortalWait | null>(null);
  const remoteCompanionPortalReadyRef = useRef<{ portalId: string; destinationZoneId: WorldZoneId } | null>(null);
  const sharedPortalReadyTimerRef = useRef<number | null>(null);
  const companionPingTimerRef = useRef<number | null>(null);
  const companionZoneGraceUntilRef = useRef(0);
  const companionLinkInviteSentRef = useRef(false);
  const companionTrailKeyRef = useRef("");
  const outgoingRendezvousProposalRef = useRef<ActiveCompanionRendezvous | null>(null);
  const companionInviteDraftRef = useRef(companionInviteDraft);
  const collectionProximityBandRef = useRef<CollectionProximityBand | null>(null);
  const plannedGuidedCollectibleRef = useRef<string | null>(null);
  const cooperativeCelebrationPulsesRef = useRef<CooperativeCelebrationPulse[]>([]);
  const cooperativeCelebrationSessionRef = useRef<string | null>(null);
  const cooperativeCelebrationTimerRef = useRef<number | null>(null);
  const reactionTokenRef = useRef(0);
  const worldPropMomentTokenRef = useRef(0);
  const walkPhaseRef = useRef(0);
  const renderFrameAtRef = useRef<number | null>(null);
  const spokenTravelStatusRef = useRef("");
  const routeTurnSpokenAtRef = useRef(0);
  const routeArrivalNoticeTimerRef = useRef<number | null>(null);
  const dynamicAvoidanceRerouteAtRef = useRef(Number.NEGATIVE_INFINITY);
  const remoteGuestsRef = useRef<RoomGuest[]>([]);
  const npcMotionsRef = useRef(npcMotions);

  remoteGuestsRef.current = remoteGuests;
  npcMotionsRef.current = npcMotions;
  plannedCheckpointIdsRef.current = plannedCheckpointIds;
  companionGuestIdRef.current = companionGuestId;
  pendingCompanionGuestIdRef.current = pendingCompanionGuestId;
  sharedCompanionDestinationRef.current = sharedCompanionDestination;
  sharedPortalWaitRef.current = sharedPortalWait;
  companionInviteDraftRef.current = companionInviteDraft;
  outgoingRendezvousProposalRef.current = outgoingRendezvousProposal;

  useEffect(() => {
    const handleRuntimeProtection = () => {
      remoteReactionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      remoteReactionTimersRef.current.clear();
      if (worldPropMomentTimerRef.current !== null) window.clearTimeout(worldPropMomentTimerRef.current);
      if (cooperativeCelebrationTimerRef.current !== null) window.clearTimeout(cooperativeCelebrationTimerRef.current);
      worldPropMomentTimerRef.current = null;
      cooperativeCelebrationTimerRef.current = null;
      cooperativeCelebrationPulsesRef.current = [];
      cooperativeCelebrationSessionRef.current = null;
      setRemoteReactions({});
      setActivePropMoment(null);
      setCooperativeCelebration(null);
      setCompanionTrailPoints((points) => points.slice(-12));
      setTravelStatus("기기 안정화를 위해 지나간 장식 효과를 정리했어요");
    };
    window.addEventListener(runtimeProtectionEventName, handleRuntimeProtection);
    return () => window.removeEventListener(runtimeProtectionEventName, handleRuntimeProtection);
  }, []);

  useEffect(() => {
    if (loadedBackgroundZoneId !== activeZone.id || portalTransition) return;
    const timer = window.setTimeout(() => {
      const map = mapViewportRef.current;
      const stage = mapStageRef.current;
      const player = stage?.querySelector<HTMLElement>(".world-player:not(.player--remote)");
      const sprite = player?.querySelector<HTMLElement>(".character-sprite--world");
      if (!map || !stage || !player || !sprite || motionStore.getSnapshot().moving) return;
      const mapRect = map.getBoundingClientRect();
      const spriteRect = sprite.getBoundingClientRect();
      if (mapRect.width <= 0 || mapRect.height <= 0 || spriteRect.width <= 0 || spriteRect.height <= 0) return;

      const playerStyle = getComputedStyle(player);
      const centerOffsetX = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-offset-x")) || 0;
      const centerY = Number.parseFloat(playerStyle.getPropertyValue("--character-world-anchor-y")) || spriteRect.height / 2;
      const visualCenter = {
        x: spriteRect.x + spriteRect.width / 2 + centerOffsetX * camera.zoom,
        y: spriteRect.y + centerY * camera.zoom
      };
      const viewportCenter = { x: mapRect.x + mapRect.width / 2, y: mapRect.y + mapRect.height / 2 };
      const scaledWidth = activeZone.bounds.width * camera.zoom;
      const scaledHeight = activeZone.bounds.height * camera.zoom;
      const centerable = {
        x: scaledWidth > mapRect.width + 1
          && camera.x < -0.5
          && camera.x > mapRect.width - scaledWidth + 0.5,
        y: scaledHeight > mapRect.height + 1
          && camera.y < -0.5
          && camera.y > mapRect.height - scaledHeight + 0.5
      };
      const error = Math.hypot(
        centerable.x ? visualCenter.x - viewportCenter.x : 0,
        centerable.y ? visualCenter.y - viewportCenter.y : 0
      );
      trackCameraCenterQuality(error, centerable.x || centerable.y ? "interior" : "edge");
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeZone.id, loadedBackgroundZoneId, portalTransition, viewport.height, viewport.width]);

  useEffect(() => {
    pendingJourneyGuideIdRef.current = pendingJourneyGuideId;
  }, [pendingJourneyGuideId]);

  useEffect(() => {
    if (companionInviteInspection.status === "valid") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("together")) return;
    url.searchParams.delete("together");
    url.searchParams.delete("togetherZone");
    url.searchParams.delete("togetherExpires");
    url.searchParams.delete("togetherCode");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [companionInviteInspection.status]);

  useEffect(() => {
    if (!pendingCompanionGuestId) return;
    const timer = window.setTimeout(() => {
      if (pendingCompanionGuestIdRef.current !== pendingCompanionGuestId) return;
      connectionRef.current?.send({
        type: "companion_stop",
        targetGuestId: pendingCompanionGuestId
      });
      pendingCompanionGuestIdRef.current = null;
      setPendingCompanionGuestId(null);
      setTravelStatus("동행 초대 응답 시간이 지났어요");
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [pendingCompanionGuestId]);

  useEffect(() => {
    if (!incomingCompanionInvite) return;
    setCompanionWaitingRoomOpen(false);
    const timer = window.setTimeout(() => {
      connectionRef.current?.send({
        type: "companion_reply",
        requesterGuestId: incomingCompanionInvite.requesterGuestId,
        accepted: false
      });
      setIncomingCompanionInvite((current) => (
        current?.requesterGuestId === incomingCompanionInvite.requesterGuestId ? null : current
      ));
      setTravelStatus("동행 초대 응답 시간이 지났어요");
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [incomingCompanionInvite]);

  useEffect(() => {
    if (mapAuditMode.available) return;
    saveWorldSession({
      zoneId: activeZoneId,
      position,
      direction,
      guideCheckpointId: activeJourneyGuideId ?? pendingJourneyGuideId
    });
  }, [activeJourneyGuideId, activeZoneId, direction, mapAuditMode.available, pendingJourneyGuideId, position]);

  useEffect(() => {
    const timer = window.setInterval(() => setJourneyClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const initialMotions = createNpcMotionMap(activeZone);
    npcMotionsRef.current = initialMotions;
    setNpcMotions(initialMotions);
  }, [activeZone]);

  useEffect(() => {
    if (activeZone.npcs.length === 0 || portalTransition) return;
    const pausedNpcIds = [interactionIntent?.npcId, activeNpcDialogue?.npcId]
      .filter((id): id is NpcId => Boolean(id));
    const timer = window.setInterval(() => {
      setNpcMotions((current) => advanceNpcMotionMap(
        activeZone,
        current,
        positionRef.current,
        pausedNpcIds
      ));
    }, renderBudget.npcMotionIntervalMs);
    return () => window.clearInterval(timer);
  }, [activeNpcDialogue?.npcId, activeZone, interactionIntent?.npcId, portalTransition, renderBudget.npcMotionIntervalMs]);

  useEffect(() => {
    if (!arrivalAction || activeNpcDialogue) return;
    const timer = window.setTimeout(() => setArrivalAction(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [activeNpcDialogue, arrivalAction]);

  useEffect(() => {
    if (devicePerformance.mode === "lite" || viewPreferences.dataSaver) return;
    const timer = window.setTimeout(() => {
      for (const portal of activeZone.portals) {
        for (const entry of portal.entryTiles) findTilePath(activeZone, positionRef.current, entry);
      }
    }, 320);
    return () => window.clearTimeout(timer);
  }, [activeZone, devicePerformance.mode, viewPreferences.dataSaver]);

  const speakRouteMessage = useCallback((message: string): boolean => {
    if (!viewPreferences.routeVoiceGuidance) return false;
    return speakRouteVoiceMessage({
      message,
      rate: viewPreferences.routeVoiceRate,
      detail: viewPreferences.routeVoiceDetail,
      zoneLabel: activeZone.label,
      landmarkLabel: nearestWorldLandmark(activeZone, positionRef.current)?.label
    });
  }, [
    activeZone.label,
    viewPreferences.routeVoiceDetail,
    viewPreferences.routeVoiceGuidance,
    viewPreferences.routeVoiceRate
  ]);

  const announceUpcomingRouteTurn = useCallback((current: Point, path: Point[]) => {
    const cue = routeTurnCueOneTileAhead(current, path);
    if (!cue) return;
    const cueKey = [
      routeGuidanceSessionRef.current,
      activeZoneIdRef.current,
      cue.corner.x,
      cue.corner.y,
      cue.direction
    ].join(":");
    if (announcedRouteTurnRef.current === cueKey) return;
    announcedRouteTurnRef.current = cueKey;
    playRouteTurnHaptic(cue.direction);
    if (speakRouteMessage(cue.message)) routeTurnSpokenAtRef.current = Date.now();
  }, [playRouteTurnHaptic, speakRouteMessage]);

  useEffect(() => {
    if (!viewPreferences.routeVoiceGuidance || spokenTravelStatusRef.current === travelStatus) return;
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance !== "function") return;
    spokenTravelStatusRef.current = travelStatus;
    const timer = window.setTimeout(() => {
      if (Date.now() - routeTurnSpokenAtRef.current < 600) return;
      speakRouteMessage(travelStatus);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [speakRouteMessage, travelStatus, viewPreferences.routeVoiceGuidance]);

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

  const setJoystickVector = useCallback((vector: Point) => {
    if (joystickStopTimerRef.current !== null) {
      window.clearTimeout(joystickStopTimerRef.current);
      joystickStopTimerRef.current = null;
    }
    joystickVectorRef.current = vector;
    const active = hasJoystickMovement(vector);
    if (joystickInputActiveRef.current === active) return;
    joystickInputActiveRef.current = active;
    setJoystickInputActive(active);
  }, []);

  useEffect(() => () => {
    if (joystickStopTimerRef.current !== null) {
      window.clearTimeout(joystickStopTimerRef.current);
    }
  }, []);

  useEffect(() => {
    motionStore.update({ position });
  }, [motionStore, position]);

  useEffect(() => {
    motionStore.update({ direction });
  }, [direction, motionStore]);

  useEffect(() => {
    motionStore.update({ moving });
  }, [motionStore, moving]);

  useEffect(() => {
    motionStore.update({ stepFrame });
  }, [motionStore, stepFrame]);

  useEffect(() => {
    const updateCamera = () => {
      const stage = mapStageRef.current;
      if (!stage) return;
      const nextCamera = computeCameraTransform({
        player: motionStore.getSnapshot().position,
        viewport,
        bounds: activeZone.bounds,
        zoom: 1
      });
      stage.style.transform = `translate3d(${nextCamera.x}px, ${nextCamera.y}px, 0) scale(${nextCamera.zoom})`;
    };
    updateCamera();
    return motionStore.subscribe(updateCamera);
  }, [activeZone.bounds.height, activeZone.bounds.width, motionStore, viewport.height, viewport.width]);

  const resetWalkCycle = useCallback(() => {
    walkPhaseRef.current = 0;
    motionStore.update({ stepFrame: neutralWalkFrame });
    setStepFrame(neutralWalkFrame);
  }, [motionStore]);

  const advanceWalkCycle = useCallback((surface: FootstepSurface) => {
    const next = advanceWalkPhase(walkPhaseRef.current);
    walkPhaseRef.current = next.nextPhase;
    const foot = walkLandingFootForFrame(next.frame);
    if (foot) playFeedback("footstep", { surface, foot });
    return next.frame;
  }, [playFeedback]);

  const showRouteArrivalNotice = useCallback((notice: RouteArrivalNotice) => {
    if (routeArrivalNoticeTimerRef.current !== null) {
      window.clearTimeout(routeArrivalNoticeTimerRef.current);
    }
    setRouteArrivalNotice(notice);
    routeArrivalNoticeTimerRef.current = window.setTimeout(() => {
      routeArrivalNoticeTimerRef.current = null;
      setRouteArrivalNotice(null);
    }, 1800);
  }, []);

  useEffect(() => () => {
    if (routeArrivalNoticeTimerRef.current !== null) {
      window.clearTimeout(routeArrivalNoticeTimerRef.current);
    }
  }, []);

  const applyJourneyProgress = useCallback((remoteProgress: ReturnType<typeof loadJourneyProgress>) => {
    const merged = mergeJourneyProgress(journeyProgressRef.current, remoteProgress);
    journeyProgressRef.current = merged;
    saveJourneyProgress(merged);
    setJourneyProgress(merged);
    setPlannedCheckpointIds((current) => normalizeJourneyWaypointPlan(merged, current));
    return merged;
  }, []);

  const syncJourneyProgress = useCallback(async (
    progress: ReturnType<typeof loadJourneyProgress>,
    loadFirst = false
  ) => {
    const syncScope = journeyProgressSyncScope();
    if (!syncScope) {
      setJourneySyncStatus("local");
      return;
    }

    const queued = loadJourneySyncQueue(syncScope);
    const pending = queued ? mergeJourneyProgress(progress, queued.progress) : progress;
    const queueEntry = pending.completedIds.length > 0 || queued
      ? queueJourneyProgress(syncScope, pending)
      : null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setJourneySyncStatus(queueEntry ? "queued" : "error");
      return;
    }

    const requestId = ++journeySyncRequestRef.current;
    setJourneySyncStatus("syncing");
    try {
      const remote = loadFirst
        ? await fetchSyncedJourneyProgress()
        : await saveSyncedJourneyProgress(pending);
      if (requestId !== journeySyncRequestRef.current) return;
      if (!remote) {
        setJourneySyncStatus("local");
        return;
      }

      const shouldShowMerge = loadFirst
        && pending.completedIds.length > 0
        && journeyProgressDiffers(pending, remote);
      const merged = applyJourneyProgress(loadFirst ? mergeJourneyProgress(pending, remote) : remote);
      if (loadFirst && journeyProgressDiffers(merged, remote)) {
        const saved = await saveSyncedJourneyProgress(merged);
        if (saved && requestId === journeySyncRequestRef.current) applyJourneyProgress(saved);
      }
      if (requestId === journeySyncRequestRef.current) {
        if (queueEntry) clearJourneySyncQueue(syncScope, queueEntry.progress);
        setJourneySyncStatus(shouldShowMerge ? "merged" : "synced");
      }
    } catch {
      if (requestId === journeySyncRequestRef.current) {
        markJourneySyncAttemptFailed(syncScope);
        setJourneySyncStatus(queueEntry ? "queued" : "error");
      }
    }
  }, [applyJourneyProgress]);

  useEffect(() => {
    void syncJourneyProgress(journeyProgressRef.current, true);
    const retry = () => {
      const syncScope = journeyProgressSyncScope();
      const queued = syncScope ? loadJourneySyncQueue(syncScope) : null;
      void syncJourneyProgress(queued?.progress ?? journeyProgressRef.current);
    };
    const markOffline = () => {
      const syncScope = journeyProgressSyncScope();
      if (syncScope && loadJourneySyncQueue(syncScope)) setJourneySyncStatus("queued");
    };
    window.addEventListener("online", retry);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", markOffline);
    };
  }, [syncJourneyProgress]);

  const stampJourneyCheckpoint = useCallback((checkpointId: JourneyCheckpointId) => {
    const result = completeJourneyCheckpoint(journeyProgressRef.current, checkpointId);
    if (!result.changed) return;

    journeyProgressRef.current = result.progress;
    saveJourneyProgress(result.progress);
    setJourneyProgress(result.progress);
    recordJourneyVisit(checkpointId);
    void syncJourneyProgress(result.progress);
    setPlannedCheckpointIds((current) => normalizeJourneyWaypointPlan(
      result.progress,
      current.filter((id) => id !== checkpointId)
    ));
    setStampedCheckpointId(checkpointId);
    setArrivalAction(journeyArrivalAction(
      result.progress,
      checkpointId,
      plannedCheckpointIdsRef.current.filter((id) => id !== checkpointId)
    ));
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
    setTravelStatus(`${checkpoint?.label ?? "방문"} 스탬프를 찍었어요`);
    playFeedback("stamp");
    playJourneyHaptic(checkpointId, "arrived");
    if (result.journeyCompleted) setJourneyCompletionPending(true);
  }, [playFeedback, playJourneyHaptic, syncJourneyProgress]);

  const stampWorldInteraction = useCallback((spotId: SpotId) => {
    const checkpointId = journeyCheckpointForInteraction(activeZoneIdRef.current, spotId);
    if (checkpointId) stampJourneyCheckpoint(checkpointId);
  }, [stampJourneyCheckpoint]);

  const completeZoneMiniQuestAction = useCallback((action: ZoneMiniQuestAction) => {
    setZoneMiniQuestProgress((current) => {
      const result = completeCurrentZoneMiniQuestStep(current, activeZoneIdRef.current, action);
      if (!result.changed) return current;
      saveZoneMiniQuestProgress(result.progress);
      return result.progress;
    });
  }, []);

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

  const registerCelebrationReaction = useCallback((
    guestId: string,
    nickname: string,
    reaction: GuestReaction,
    zoneId: WorldZoneId
  ) => {
    if (reaction !== "celebrate" || zoneId !== "ceremony-hall") return;
    const now = Date.now();
    const result = registerCooperativeCelebration(
      cooperativeCelebrationPulsesRef.current,
      { guestId, nickname, at: now }
    );
    cooperativeCelebrationPulsesRef.current = result.pulses;
    if (!result.completed || !result.tier) return;

    const sessionId = `celebration:${result.pulses[0]!.at}`;
    const token = ++reactionTokenRef.current;
    cooperativeCelebrationSessionRef.current = sessionId;
    setCooperativeCelebration({
      token,
      participantNames: result.participantNames,
      participantIds: result.participantIds,
      tier: result.tier
    });
    setTravelStatus(`${result.participantNames.length}명의 하객이 함께 축하 꽃비를 만들었어요`);
    setGameMemoryAlbum(recordGameMemory({
      id: sessionId,
      kind: "celebration",
      title: "함께 만든 축하 꽃비",
      detail: `${result.participantNames.join(", ")}님과 예식홀을 축하했어요`,
      zoneId,
      createdAt: new Date(now).toISOString()
    }));
    playFeedback("reaction");
    if (cooperativeCelebrationTimerRef.current !== null) {
      window.clearTimeout(cooperativeCelebrationTimerRef.current);
    }
    cooperativeCelebrationTimerRef.current = window.setTimeout(() => {
      cooperativeCelebrationTimerRef.current = null;
      cooperativeCelebrationSessionRef.current = null;
      cooperativeCelebrationPulsesRef.current = [];
      setCooperativeCelebration((current) => current?.token === token ? null : current);
    }, 4_500);
  }, [playFeedback]);

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
    registerCelebrationReaction(
      currentGuestIdRef.current ?? "local-guest",
      profile.nickname,
      reaction,
      activeZoneIdRef.current
    );
    playFeedback("reaction");
  }, [playFeedback, profile.nickname, registerCelebrationReaction]);

  const activateWorldPropInteraction = useCallback((decorationId: string) => {
    const interaction = worldPropInteractionFor(activeZone, decorationId);
    if (!interaction) return;
    if (worldPropMomentTimerRef.current !== null) {
      window.clearTimeout(worldPropMomentTimerRef.current);
    }
    const discovery = discoverWorldSecret(worldSecretCollection, interaction.secretId);
    setWorldSecretCollection(discovery.collection);
    const token = ++worldPropMomentTokenRef.current;
    setActivePropMoment({
      token,
      zoneId: activeZone.id,
      decorationId,
      isNewSecret: discovery.isNew,
      achievementLabel: discovery.newAchievements.at(-1)?.label
    });
    setTravelStatus(interaction.resultMessage);
    handleGuestReaction(interaction.reaction);
    worldPropMomentTimerRef.current = window.setTimeout(() => {
      worldPropMomentTimerRef.current = null;
      setActivePropMoment((current) => current?.token === token ? null : current);
    }, 3_200);
  }, [activeZone, handleGuestReaction, worldSecretCollection]);

  const handleCollectCelebrationItem = useCallback((item: CelebrationCollectible) => {
    const next = collectCelebrationItem(collectedCelebrationIds, item.id);
    if (next.length === collectedCelebrationIds.length) return;
    setCollectedCelebrationIds(next);
    if (guidedCollectibleId === item.id) {
      setGuidedCollectibleId(null);
      collectionProximityBandRef.current = null;
    }
    setTravelStatus(`${item.label}을 모았어요 · ${next.length}/${totalCelebrationCollectibles}`);
    setGameMemoryAlbum(recordGameMemory({
      id: `collectible:${item.id}`,
      kind: "collectible",
      title: `${item.label} 수집`,
      detail: `${getWorldZone(gardenWorld, item.zoneId).label}에서 발견했어요`,
      zoneId: item.zoneId
    }));
    const milestones = newlyUnlockedCelebrationMilestones(
      collectedCelebrationIds,
      next,
      celebrationCollectibles,
      gardenWorld.zones
    );
    if (milestones.length > 0) {
      setCelebrationMilestones((current) => [...current, ...milestones]);
    }
    if (celebrationRewardProgress(next, totalCelebrationCollectibles).unlocked) {
      setCelebrationRewardOpen(true);
    }
    playFeedback("stamp");
  }, [collectedCelebrationIds, guidedCollectibleId, playFeedback]);

  const clearCompanionState = useCallback(() => {
    if (sharedPortalReadyTimerRef.current !== null) {
      window.clearTimeout(sharedPortalReadyTimerRef.current);
      sharedPortalReadyTimerRef.current = null;
    }
    if (companionPingTimerRef.current !== null) {
      window.clearTimeout(companionPingTimerRef.current);
      companionPingTimerRef.current = null;
    }
    companionGuestIdRef.current = null;
    pendingCompanionGuestIdRef.current = null;
    sharedCompanionDestinationRef.current = null;
    plannedSharedDestinationTokenRef.current = null;
    remoteCompanionPortalReadyRef.current = null;
    setCompanionGuestId(null);
    setCompanionNickname(null);
    setCompanionRole(null);
    setPendingCompanionGuestId(null);
    setIncomingCompanionInvite(null);
    setCompanionDestinationOpen(false);
    setSharedCompanionDestination(null);
    setSharedPortalWait(null);
    setRecentCompanionPing(null);
    setCompanionDestinationRequested(false);
    setCompanionRejoinZoneId(null);
    setCompanionTrailPoints([]);
    setCompanionRendezvous(null);
    setIncomingRendezvousProposal(null);
    setOutgoingRendezvousProposal(null);
    outgoingRendezvousProposalRef.current = null;
    companionTrailKeyRef.current = "";
    clearCompanionSession();
  }, []);

  const stopCompanion = useCallback((announce = true) => {
    const targetGuestId = companionGuestIdRef.current ?? pendingCompanionGuestIdRef.current;
    if (targetGuestId) connectionRef.current?.send({ type: "companion_stop", targetGuestId });
    clearCompanionState();
    if (announce) setTravelStatus("동행을 마쳤어요");
  }, [clearCompanionState]);

  const inviteCompanion = useCallback((guestId: string) => {
    const guest = remoteGuestsRef.current.find((candidate) => candidate.guestId === guestId);
    if (!guest || guest.zoneId !== activeZoneIdRef.current) return;
    connectionRef.current?.send({ type: "companion_invite", targetGuestId: guestId });
    pendingCompanionGuestIdRef.current = guestId;
    setPendingCompanionGuestId(guestId);
    setTravelStatus(`${guest.nickname}님에게 동행 초대를 보냈어요`);
  }, []);

  const replyToCompanionInvite = useCallback((accepted: boolean) => {
    const invite = incomingCompanionInvite;
    if (!invite) return;
    connectionRef.current?.send({
      type: "companion_reply",
      requesterGuestId: invite.requesterGuestId,
      accepted
    });
    setIncomingCompanionInvite(null);
    if (!accepted) {
      setTravelStatus(`${invite.requesterNickname}님의 동행 초대를 거절했어요`);
      return;
    }
    companionGuestIdRef.current = invite.requesterGuestId;
    setCompanionGuestId(invite.requesterGuestId);
    setCompanionNickname(invite.requesterNickname);
    setCompanionRole("leader");
    setCompanionInviteDraft((current) => current ? { ...current, used: true } : current);
    saveCompanionSession({
      companionGuestId: invite.requesterGuestId,
      companionNickname: invite.requesterNickname,
      role: "leader"
    });
    setTravelStatus(`${invite.requesterNickname}님과 동행을 시작해요`);
    setGameMemoryAlbum(recordGameMemory({
      kind: "companion",
      title: `${invite.requesterNickname}님과 동행`,
      detail: `${getWorldZone(gardenWorld, activeZoneIdRef.current).label}에서 함께 걷기 시작했어요`,
      zoneId: activeZoneIdRef.current
    }));
  }, [incomingCompanionInvite]);

  const copyCompanionInvite = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCompanionShareStatus("동행 초대 링크를 복사했어요");
      return true;
    } catch {
      setCompanionShareStatus("링크를 복사하지 못했어요");
      return false;
    }
  }, []);

  const shareCompanionInvite = useCallback(async (url: string) => {
    if (typeof navigator.share !== "function") return copyCompanionInvite(url);
    try {
      await navigator.share({
        title: `${profile.nickname}님과 웨딩 정원 같이 걷기`,
        text: "링크를 열고 같은 구역에서 함께 걸어보세요.",
        url
      });
      setCompanionShareStatus("동행 초대 링크를 공유했어요");
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return false;
      return copyCompanionInvite(url);
    }
  }, [copyCompanionInvite, profile.nickname]);

  const renewCompanionInvite = useCallback(() => {
    const expiresAt = Date.now() + companionInviteLifetimeMs;
    const zoneId = activeZoneIdRef.current;
    const inviteCode = createCompanionInviteCode();
    setCompanionInviteDraft({
      url: createCompanionInviteUrl(window.location.href, realtimeIdentity, zoneId, expiresAt, inviteCode),
      expiresAt,
      zoneId,
      inviteCode,
      canceled: false,
      used: false
    });
    setCompanionShareStatus(null);
  }, [realtimeIdentity]);

  const cancelCompanionInvite = useCallback(() => {
    if (pendingCompanionGuestIdRef.current) stopCompanion(false);
    setCompanionInviteDraft((current) => current ? { ...current, canceled: true } : current);
    setCompanionShareStatus("동행 초대를 취소했어요");
    setTravelStatus("동행 초대를 취소했어요");
  }, [stopCompanion]);

  const showCompanionPing = useCallback((ping: CompanionPing, nickname: string) => {
    if (companionPingTimerRef.current !== null) window.clearTimeout(companionPingTimerRef.current);
    setRecentCompanionPing({ ping, nickname });
    companionPingTimerRef.current = window.setTimeout(() => {
      companionPingTimerRef.current = null;
      setRecentCompanionPing(null);
    }, 3_200);
  }, []);

  const sendCompanionPing = useCallback((ping: CompanionPing) => {
    const targetGuestId = companionGuestIdRef.current;
    if (!targetGuestId) return;
    connectionRef.current?.send({ type: "companion_ping", targetGuestId, ping });
    showCompanionPing(ping, "나");
    setTravelStatus(ping === "wait"
      ? "동행 하객에게 잠시 기다려 달라고 알렸어요"
      : ping === "here"
        ? "동행 하객에게 현재 위치를 알렸어요"
        : "동행 하객에게 응원을 보냈어요");
  }, [showCompanionPing]);

  const requestCompanionDestination = useCallback(() => {
    const targetGuestId = companionGuestIdRef.current;
    if (!targetGuestId) return;
    connectionRef.current?.send({ type: "companion_destination_request", targetGuestId });
    setTravelStatus("동행 리더에게 목적지 변경을 요청했어요");
  }, []);

  const showNpcDialogue = useCallback((npcId: NpcId) => {
    const npc = activeZone.npcs.find((candidate) => candidate.id === npcId);
    if (!npc) return;
    const conversation = npcConversationSnapshot(npcDialogueMemory, npcId);
    const dialogue = resolveNpcDialogue({
      npcId,
      zoneId: activeZone.id,
      nickname: profile.nickname,
      completedCheckpointIds: journeyProgressRef.current.completedIds,
      weddingPhase: weddingJourneyTiming(
        invitationContent.event,
        new Date(),
        journeyProgressRef.current.completedIds.includes("ceremony")
      )?.phase,
      conversation
    });
    stampWorldInteraction("couple");
    completeZoneMiniQuestAction({ type: "npc", id: npcId });
    setActiveNpcDialogue({
      ...dialogue,
      affinityLevel: conversation.affinityLevel,
      specialRewardLabel: conversation.specialRewardLabel
    });
    setTravelStatus(`${npc.label}와 이야기를 나눴어요`);
    playFeedback("dialogue");
  }, [activeZone, completeZoneMiniQuestAction, npcDialogueMemory, playFeedback, profile.nickname, stampWorldInteraction]);

  const chooseNpcDialogue = useCallback((choice: NpcDialogueChoice) => {
    if (!activeNpcDialogue) return;
    const previousConversation = npcConversationSnapshot(npcDialogueMemory, activeNpcDialogue.npcId);
    const result = resolveNpcDialogueChoice(activeNpcDialogue, choice.id, profile.nickname, previousConversation);
    let nextMemory = rememberNpcDialogueChoice(npcDialogueMemory, activeNpcDialogue.npcId, choice.id, undefined, undefined, activeZone.id);
    const nextConversation = npcConversationSnapshot(nextMemory, activeNpcDialogue.npcId);
    const rewardUnlocked = previousConversation.specialRewardLabel === null && nextConversation.specialRewardLabel !== null;
    const groupEventUnlocked = npcGroupCelebrationReady(nextMemory) && !nextMemory.groupCelebrationSeen;
    if (groupEventUnlocked) nextMemory = markNpcGroupCelebrationSeen(nextMemory);
    setNpcDialogueMemory(nextMemory);
    handleGuestReaction(result.reaction);
    setActiveNpcDialogue({
      ...result.dialogue,
      relationshipLabel: nextConversation.relationshipLabel,
      affinityLevel: nextConversation.affinityLevel,
      specialRewardLabel: nextConversation.specialRewardLabel,
      rewardUnlocked,
      groupEventMessage: groupEventUnlocked ? "두 사람과 주변 하객이 함께 축하하는 인연 피날레가 열렸어요" : undefined
    });
    if (groupEventUnlocked) setNpcGroupCelebrationActive(true);
    setTravelStatus(groupEventUnlocked ? "인연 피날레 이벤트가 열렸어요" : rewardUnlocked ? `${nextConversation.specialRewardLabel}을 받았어요` : result.status);
  }, [activeNpcDialogue, activeZone.id, handleGuestReaction, npcDialogueMemory, profile.nickname]);

  useEffect(() => {
    if (!npcGroupCelebrationActive) return;
    const timer = window.setTimeout(() => setNpcGroupCelebrationActive(false), 5_200);
    return () => window.clearTimeout(timer);
  }, [npcGroupCelebrationActive]);

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

  useModalDialogFocus({
    open: menuOpen,
    dialogRef: menuDialogRef,
    initialFocusRef: menuTitleRef,
    returnFocusRef: menuButtonRef,
    onEscape: closeMenu,
    suspended: nestedMenuSheetOpen,
    isolateSiblings: true,
    lockBody: true
  });

  useLayoutEffect(() => {
    const dialog = menuDialogRef.current;
    if (!dialog) return;
    dialog.toggleAttribute("inert", nestedMenuSheetOpen);
  }, [menuOpen, nestedMenuSheetOpen]);

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
    setRouteRecalculationNotice(null);
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
    setRouteRecalculationNotice(null);
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

  const activateCompanionRendezvous = useCallback((
    rendezvous: ActiveCompanionRendezvous,
    nickname: string
  ) => {
    if (rendezvous.zoneId !== activeZoneIdRef.current) return false;
    const zone = getWorldZone(gardenWorld, rendezvous.zoneId);
    const point = snapToGrid(rendezvous.point, zone);
    const path = findTilePath(zone, positionRef.current, point);
    if (!path) {
      setTravelStatus("합류할 수 있는 중간 타일을 찾지 못했어요");
      return false;
    }
    pauseWorldInput();
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    setCompanionRendezvous({ ...rendezvous, point });
    if (path.length > 0) {
      setTarget(point);
      setMapPath(path);
      targetStepAtRef.current = null;
      setTravelStatus(`${nickname}님과 약속한 합류 타일로 이동 중`);
    } else {
      setTravelStatus(`합류 지점에서 ${nickname}님을 기다려요`);
    }
    return true;
  }, [pauseWorldInput]);

  const openCompanionWaitingRoom = useCallback(() => {
    void loadCompanionWaitingRoomComponent();
    pauseWorldInput();
    renewCompanionInvite();
    setCompanionWaitingRoomOpen(true);
  }, [pauseWorldInput, renewCompanionInvite]);

  const startPortalTransition = useCallback((
    portal: WorldPortal,
    approach: Point,
    preserveCompanion = false
  ) => {
    if (portalTransitionRef.current) return;

    completeZoneMiniQuestAction({ type: "portal", id: portal.id });

    if (preserveCompanion) {
      companionZoneGraceUntilRef.current = Date.now() + 6_000;
      sharedCompanionDestinationRef.current = null;
      remoteCompanionPortalReadyRef.current = null;
      sharedPortalWaitRef.current = null;
      setSharedCompanionDestination(null);
      setSharedPortalWait(null);
    } else {
      stopCompanion(false);
    }
    void preloadWorldZoneAssets(portal.to, "high");
    setRouteRecalculationNotice(null);
    clearTerminalStopConfirm();
    const transition: PortalTransition = { portal, phase: "arrival" };
    const destinationZone = getWorldZone(gardenWorld, portal.to);
    showRouteArrivalNotice({
      title: "포털 도착",
      detail: `${destinationZone.label} 맵으로 이동합니다`,
      kind: "portal"
    });
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
    const continuingCheckpointId = pendingJourneyGuideIdRef.current;
    const continuingCheckpoint = continuingCheckpointId
      ? journeyCheckpoints.find((checkpoint) => checkpoint.id === continuingCheckpointId)
      : null;
    setTravelStatus(continuingCheckpoint
      ? `${portal.label} 통과 중 · ${continuingCheckpoint.label} 연속 안내`
      : `${portal.label} 도착`);
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;
    setInputReleaseRequired(inputReleaseRequiredRef.current || joystickWasMoving);
    setPortalTransition(transition);
    sendRealtimeStop(approach, portal.facing, activeZoneIdRef.current);
    playFeedback("portal");
  }, [
    clearTerminalStopConfirm,
    completeZoneMiniQuestAction,
    playFeedback,
    resetWalkCycle,
    sendRealtimeStop,
    stopCompanion,
    setInputReleaseRequired,
    setInteractionIntent,
    setPortalIntent,
    setPortalTransition,
    showRouteArrivalNotice
  ]);

  const beginPortalTransition = useCallback((portal: WorldPortal, approach: Point, _now: number) => {
    const companionId = companionGuestIdRef.current;
    const sharedDestination = sharedCompanionDestinationRef.current;
    const sharedPortal = companionId
      && sharedDestination?.portalId === portal.id
      && sharedDestination.destinationZoneId === portal.to;
    if (!sharedPortal) {
      startPortalTransition(portal, approach);
      return;
    }

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
    sendRealtimeStop(approach, portal.facing, activeZoneIdRef.current);
    connectionRef.current?.send({
      type: "companion_portal_ready",
      targetGuestId: companionId,
      portalId: portal.id,
      destinationZoneId: portal.to
    });

    const remoteReady = remoteCompanionPortalReadyRef.current;
    if (remoteReady?.portalId === portal.id && remoteReady.destinationZoneId === portal.to) {
      startPortalTransition(portal, approach, true);
      return;
    }

    const waiting = { portal, approach };
    sharedPortalWaitRef.current = waiting;
    setSharedPortalWait(waiting);
    setTravelStatus("포털에 도착했어요 · 동행 하객을 기다리는 중");
    if (sharedPortalReadyTimerRef.current !== null) window.clearTimeout(sharedPortalReadyTimerRef.current);
    sharedPortalReadyTimerRef.current = window.setTimeout(() => {
      sharedPortalReadyTimerRef.current = null;
      const pending = sharedPortalWaitRef.current;
      if (!pending || pending.portal.id !== portal.id) return;
      sharedPortalWaitRef.current = null;
      setSharedPortalWait(null);
      setTravelStatus("동행 하객의 도착이 늦어 먼저 이동합니다");
      startPortalTransition(pending.portal, pending.approach);
    }, 6_000);
  }, [
    resetWalkCycle,
    sendRealtimeStop,
    setInteractionIntent,
    setPortalIntent,
    startPortalTransition,
    setTarget
  ]);

  const moveToZone = useCallback((zoneId: WorldZoneId, spawn?: Point, options: MoveToZoneOptions = {}) => {
    clearTerminalStopConfirm();
    setRouteRecalculationNotice(null);
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
    setActivePropMoment(null);
    if (localReactionTimerRef.current !== null) {
      window.clearTimeout(localReactionTimerRef.current);
      localReactionTimerRef.current = null;
    }
    if (worldPropMomentTimerRef.current !== null) {
      window.clearTimeout(worldPropMomentTimerRef.current);
      worldPropMomentTimerRef.current = null;
    }
    setTravelStatus(options.status ?? `${zone.label} 도착`);
    if (options.stampCheckpoint !== false) {
      const checkpointId = journeyCheckpointForZone(zone.id);
      if (checkpointId) stampJourneyCheckpoint(checkpointId);
    }
    targetStepAtRef.current = null;
    tileInputStateRef.current = null;
    joystickWasMovingRef.current = false;

    const connection = options.syncRealtime === false ? null : connectionRef.current;
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

  const handleDiagnosticZoneChange = useCallback((zoneId: WorldZoneId) => {
    if (!mapAuditMode.available || zoneId === activeZoneIdRef.current) return;
    const zone = getWorldZone(gardenWorld, zoneId);
    setPortalTransition(null);
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    journeyGuideLastZoneRef.current = null;
    setActiveSpotId(null);
    setInputReleaseRequired(false);
    void preloadWorldZoneAssets(zoneId, "high");
    moveToZone(zoneId, undefined, {
      stampCheckpoint: false,
      syncRealtime: false,
      status: `${zone.label} 진단 위치로 이동했어요`
    });
    const url = new URL(window.location.href);
    url.searchParams.set("mapAuditZone", zoneId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setDiagnosticCopyStatus("idle");
    setDiagnosticBundleStatus("idle");
  }, [mapAuditMode.available, moveToZone, setInputReleaseRequired, setPortalTransition]);

  const handleDiagnosticLayerChange = useCallback((layer: WorldGeometryAuditLayerKey, enabled: boolean) => {
    const nextLayers = { ...geometryAuditLayers, [layer]: enabled };
    setGeometryAuditLayers(nextLayers);
    const url = new URL(window.location.href);
    url.searchParams.set("mapAuditLayers", serializeWorldGeometryAuditLayers(nextLayers));
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setDiagnosticCopyStatus("idle");
    setDiagnosticBundleStatus("idle");
  }, [geometryAuditLayers]);

  const handleDiagnosticHeatmapModeChange = useCallback((mode: WorldGeometryAuditHeatmapMode) => {
    setGeometryAuditHeatmapMode(mode);
    const url = new URL(window.location.href);
    url.searchParams.set("mapAuditHeatmap", mode);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setDiagnosticCopyStatus("idle");
    setDiagnosticBundleStatus("idle");
  }, []);

  const handleImportDiagnosticPatch = useCallback(async (file: File) => {
    try {
      const preview = previewWorldForegroundRecommendationPatch(JSON.parse(await file.text()));
      setDiagnosticPatchPreview(preview);
      setDiagnosticPatchImportStatus("loaded");
      const firstZoneId = preview.zoneIds[0];
      if (firstZoneId && firstZoneId !== activeZoneIdRef.current) handleDiagnosticZoneChange(firstZoneId);
    } catch (error) {
      console.error("[map-diagnostics] Rejected imported foreground patch", error);
      setDiagnosticPatchPreview(null);
      setDiagnosticPatchImportStatus("error");
    }
    setDiagnosticBundleStatus("idle");
  }, [handleDiagnosticZoneChange]);

  const handleNextDiagnosticIssue = useCallback(() => {
    const zoneId = nextWorldGeometryIssueZone(
      gardenWorld.zones.map((zone) => zone.id),
      geometryAuditIssueCounts,
      activeZoneId
    );
    if (zoneId) handleDiagnosticZoneChange(zoneId);
  }, [activeZoneId, geometryAuditIssueCounts, handleDiagnosticZoneChange]);

  const handleCopyDiagnosticLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("mapAudit", "1");
    url.searchParams.set("mapAuditZone", activeZoneId);
    url.searchParams.set("mapAuditLayers", serializeWorldGeometryAuditLayers(geometryAuditLayers));
    url.searchParams.set("mapAuditHeatmap", geometryAuditHeatmapMode);
    writeWorldForegroundReviewDecisionsToUrl(url, foregroundRecommendationDecisions);
    try {
      await copyText(url.toString());
      setDiagnosticCopyStatus("copied");
    } catch {
      setDiagnosticCopyStatus("error");
    }
  }, [activeZoneId, foregroundRecommendationDecisions, geometryAuditHeatmapMode, geometryAuditLayers]);

  const handleForegroundRecommendationDecision = useCallback((
    key: string,
    decision: ForegroundRecommendationDecision
  ) => {
    setForegroundRecommendationDecisions((current) => {
      const next = { ...current };
      if (decision === "pending") delete next[key];
      else next[key] = decision;
      saveWorldForegroundReviewDecisions(next, window.localStorage);
      const url = writeWorldForegroundReviewDecisionsToUrl(new URL(window.location.href), next);
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
      return next;
    });
    setDiagnosticPatchStatus("idle");
    setDiagnosticBundleStatus("idle");
  }, []);

  const handleDownloadDiagnosticPatch = useCallback(() => {
    try {
      const generatedAt = new Date();
      const patch = buildWorldForegroundRecommendationPatch(
        foregroundRecommendationDecisions,
        generatedAt.toISOString()
      );
      downloadJsonArtifact(
        patch,
        worldDiagnosticArtifactFilename("patch", activeZoneId, generatedAt)
      );
      setDiagnosticPatchStatus("saved");
    } catch {
      setDiagnosticPatchStatus("error");
    }
  }, [activeZoneId, foregroundRecommendationDecisions]);

  const handleDownloadDiagnosticBundle = useCallback(async () => {
    const shell = mapShellRef.current;
    if (!shell || diagnosticBundleStatus === "capturing") return;
    setDiagnosticBundleStatus("capturing");
    try {
      const generatedAt = new Date();
      const audit = geometryAuditsByZone[activeZoneId] ?? auditWorldGeometry(activeZone);
      const screenshot = await captureWorldDiagnosticScreenshot(shell);
      const selectedPatch = diagnosticPatchPreview?.patch ?? buildWorldForegroundRecommendationPatch(
        foregroundRecommendationDecisions,
        generatedAt.toISOString()
      );
      const bundle = await createWorldDiagnosticBundle({
        generatedAt: generatedAt.toISOString(),
        zone: { id: activeZone.id, label: activeZone.label },
        diagnosticUrl: window.location.href,
        viewerUrl: worldDiagnosticBundleViewerUrl(),
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1
        },
        userAgent: navigator.userAgent,
        layers: geometryAuditLayers,
        heatmapMode: geometryAuditHeatmapMode,
        sourceContract: {
          target: selectedPatch.target,
          version: selectedPatch.sourceContractVersion,
          checksum: selectedPatch.sourceChecksum
        },
        findings: audit.findings,
        policy: evaluateWorldGeometryAuditPolicy(audit),
        recommendationDecisions: overlayRecommendationDecisions,
        selectedPatch,
        screenshot
      });
      downloadJsonArtifact(
        bundle,
        worldDiagnosticArtifactFilename("bundle", activeZoneId, generatedAt)
      );
      setDiagnosticBundleStatus("saved");
    } catch (error) {
      console.error("[map-diagnostics] Failed to build diagnostic bundle", error);
      setDiagnosticBundleStatus("error");
    }
  }, [
    activeZone,
    activeZoneId,
    diagnosticBundleStatus,
    diagnosticPatchPreview,
    foregroundRecommendationDecisions,
    geometryAuditHeatmapMode,
    geometryAuditLayers,
    geometryAuditsByZone,
    overlayRecommendationDecisions
  ]);

  useEffect(() => {
    if (!mapAuditMode.available || !geometryAuditEnabled) return;
    const handleDiagnosticShortcut = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement
        || target instanceof HTMLSelectElement
        || target instanceof HTMLTextAreaElement
        || (target instanceof HTMLElement && target.isContentEditable)
      ) return;

      let nextIndex: number | null = null;
      if (/^[1-9]$/.test(event.key)) nextIndex = Number(event.key) - 1;
      else if (event.key === "0") nextIndex = 9;
      else if (event.key === "[" || event.key === "]") {
        const activeIndex = gardenWorld.zones.findIndex((zone) => zone.id === activeZoneId);
        const offset = event.key === "[" ? -1 : 1;
        nextIndex = (activeIndex + offset + gardenWorld.zones.length) % gardenWorld.zones.length;
      }
      if (nextIndex === null || nextIndex >= gardenWorld.zones.length) return;
      event.preventDefault();
      handleDiagnosticZoneChange(gardenWorld.zones[nextIndex].id);
    };
    window.addEventListener("keydown", handleDiagnosticShortcut);
    return () => window.removeEventListener("keydown", handleDiagnosticShortcut);
  }, [activeZoneId, geometryAuditEnabled, handleDiagnosticZoneChange, mapAuditMode.available]);

  const handleJourneySelect = useCallback((zoneId: WorldZoneId) => {
    if (portalTransitionRef.current || zoneId === activeZoneIdRef.current) return;
    const fromZoneId = activeZoneIdRef.current;
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    journeyGuideLastZoneRef.current = null;
    playFeedback("portal");
    void preloadWorldZoneAssets(zoneId, "high");
    closeMenu();
    setActiveSpotId(null);
    setInputReleaseRequired(false);
    setWorldTravelHistory((current) => recordWorldTravel(current, {
      from: fromZoneId,
      to: zoneId,
      method: "journey"
    }));
    moveToZone(zoneId);
  }, [closeMenu, moveToZone, playFeedback, setInputReleaseRequired]);

  const completePortalFadeOut = useCallback(() => {
    const transition = portalTransitionRef.current;
    if (!transition || transition.phase !== "fade-out") return;

    const continuingCheckpointId = pendingJourneyGuideIdRef.current;
    const continuingCheckpoint = continuingCheckpointId
      ? journeyCheckpoints.find((checkpoint) => checkpoint.id === continuingCheckpointId)
      : null;
    const fromZoneId = activeZoneIdRef.current;
    setWorldTravelHistory((current) => recordWorldTravel(current, {
      from: fromZoneId,
      to: transition.portal.to,
      portalId: transition.portal.id,
      method: "portal"
    }));
    moveToZone(transition.portal.to, transition.portal.spawn);
    if (continuingCheckpoint) {
      const nextZone = getWorldZone(gardenWorld, transition.portal.to);
      setTravelStatus(`${nextZone.label}에서 ${continuingCheckpoint.label}(으)로 계속 안내할게요`);
    }
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
    completeZoneMiniQuestAction({ type: "spot", id: spotId });
    setActiveSpotId(spotId);
  }, [closeMenu, completeZoneMiniQuestAction, pauseWorldInput]);

  const openPhotoSpot = useCallback((photoSpotId: WorldPhotoSpotId) => {
    if (portalTransitionRef.current) return;
    void loadWeddingPhotoBoothComponent();
    pauseWorldInput();
    closeMenu();
    completeZoneMiniQuestAction({ type: "photo", id: photoSpotId });
    setActivePhotoSpotId(photoSpotId);
  }, [closeMenu, completeZoneMiniQuestAction, pauseWorldInput]);

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
    collectibleId?: string;
    decorationId?: string;
    label: string;
    target: Rect;
    actionRadius: number;
    photoSpotId?: WorldPhotoSpotId;
    npcId?: NpcId;
  }) => {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    setRouteRecalculationNotice(null);
    routeGuidanceSessionRef.current += 1;
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
      if (!input.decorationId) {
        showRouteArrivalNotice({
          title: `${input.label} 도착`,
          detail: "목적지 상호작용을 시작합니다",
          kind: "destination"
        });
      }
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
      if (input.collectibleId) {
        const collectible = celebrationCollectiblesForZone(activeZone)
          .find((item) => item.id === input.collectibleId);
        if (collectible) handleCollectCelebrationItem(collectible);
      }
      if (input.decorationId) activateWorldPropInteraction(input.decorationId);
      return;
    }

    setInteractionIntent({
      targetId: input.targetId,
      spotId: input.spotId,
      collectibleId: input.collectibleId,
      decorationId: input.decorationId,
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
    activateWorldPropInteraction,
    activeZone,
    clearTerminalStopConfirm,
    handleCollectCelebrationItem,
    openSpot,
    openPhotoSpot,
    resetWalkCycle,
    sendRealtimeTerminalStop,
    setInputReleaseRequired,
    setInteractionIntent,
    setPortalIntent,
    showRouteArrivalNotice,
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
      pendingJourneyGuideIdRef.current = checkpoint.id;
      setPendingJourneyGuideId(checkpoint.id);
      setTravelStatus(`${destinationZone.label}의 ${checkpoint.label}(으)로 안내할게요`);
      handlePortalClick(portal);
      return;
    }

    journeyGuideLastZoneRef.current = null;
    pendingJourneyGuideIdRef.current = null;
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
      const npcPoint = npcMotionFor(activeZone, npc, npcMotionsRef.current).point;
      beginWorldInteraction({
        targetId: `npc:${npc.id}`,
        npcId: npc.id,
        label: checkpoint.label,
        target: npcInteractionRect(npcPoint),
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
    startJourneyGuidance(checkpoint);
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
    if (open) {
      void loadWeddingPhotoAlbumComponent();
      pauseWorldInput();
    }
    setPhotoAlbumOpen(open);
  }, [pauseWorldInput]);

  const markOptionalFeatureUsed = useCallback((id: OptionalFeatureId) => {
    setOptionalFeatureUsage(recordOptionalFeatureUse(id));
  }, []);

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

    let resizeFrame: number | null = null;
    let settleTimer: number | null = null;

    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nextViewport = snapCameraViewport(rect);
        setViewport((current) => (
          current.width === nextViewport.width && current.height === nextViewport.height
            ? current
            : nextViewport
        ));
      }
    };
    const scheduleUpdate = () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = null;
        update();
      });
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(update, 320);
    };
    update();

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(scheduleUpdate);
    observer?.observe(element);
    window.addEventListener("resize", scheduleUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
    window.visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
    window.visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("orientationchange", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      if (settleTimer !== null) window.clearTimeout(settleTimer);
    };
  }, [activeZoneId]);

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
      if (worldPropMomentTimerRef.current !== null) window.clearTimeout(worldPropMomentTimerRef.current);
      remoteReactionTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      remoteReactionTimersRef.current.clear();
      if (cooperativeCelebrationTimerRef.current !== null) {
        window.clearTimeout(cooperativeCelebrationTimerRef.current);
      }
      if (sharedPortalReadyTimerRef.current !== null) {
        window.clearTimeout(sharedPortalReadyTimerRef.current);
      }
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
          zoneId: activeZoneIdRef.current,
          resumeId: realtimeIdentity
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
            if (companionGuestIdRef.current) setTravelStatus("동행 상태를 유지하며 다시 연결하고 있어요");
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
              const restoredCompanion = companionGuestIdRef.current
                ? message.guests.find(({ guestId }) => guestId === companionGuestIdRef.current)
                : null;
              if (restoredCompanion) {
                setCompanionNickname(restoredCompanion.nickname);
                setTravelStatus(`${restoredCompanion.nickname}님과 동행을 다시 연결했어요`);
              } else if (companionGuestIdRef.current) {
                setTravelStatus(`${companionNickname ?? "동행 하객"}님의 재접속을 기다리고 있어요`);
              }
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
              if (message.guest.guestId === companionGuestIdRef.current) {
                setCompanionNickname(message.guest.nickname);
                setTravelStatus(`${message.guest.nickname}님과 동행을 다시 연결했어요`);
              }
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
                const guest = remoteGuestsRef.current.find(({ guestId }) => guestId === message.guestId);
                registerCelebrationReaction(
                  message.guestId,
                  guest?.nickname ?? "하객",
                  message.reaction,
                  message.zoneId
                );
              }
              return;
            }
            if (message.type === "companion_invited") {
              const draft = companionInviteDraftRef.current;
              if (draft && (draft.canceled || draft.used || draft.expiresAt <= Date.now())) {
                connectionRef.current?.send({
                  type: "companion_reply",
                  requesterGuestId: message.requesterGuestId,
                  accepted: false
                });
                setTravelStatus("종료된 일회용 코드로 들어온 동행 요청을 막았어요");
                return;
              }
              if (
                message.zoneId === activeZoneIdRef.current
                && !companionGuestIdRef.current
                && !pendingCompanionGuestIdRef.current
              ) {
                setIncomingCompanionInvite({
                  requesterGuestId: message.requesterGuestId,
                  requesterNickname: message.requesterNickname
                });
                setTravelStatus(`${message.requesterNickname}님이 같이 걷기를 요청했어요`);
              }
              return;
            }
            if (message.type === "companion_replied") {
              if (pendingCompanionGuestIdRef.current !== message.guestId) return;
              pendingCompanionGuestIdRef.current = null;
              setPendingCompanionGuestId(null);
              if (!message.accepted || message.zoneId !== activeZoneIdRef.current) {
                setTravelStatus(`${message.guestNickname}님이 동행 초대를 거절했어요`);
                return;
              }
              companionGuestIdRef.current = message.guestId;
              setCompanionGuestId(message.guestId);
              setCompanionNickname(message.guestNickname);
              setCompanionRole("follower");
              saveCompanionSession({
                companionGuestId: message.guestId,
                companionNickname: message.guestNickname,
                role: "follower"
              });
              setTravelStatus(`${message.guestNickname}님과 동행을 시작해요`);
              setGameMemoryAlbum(recordGameMemory({
                kind: "companion",
                title: `${message.guestNickname}님과 동행`,
                detail: `${getWorldZone(gardenWorld, message.zoneId).label}에서 함께 걷기 시작했어요`,
                zoneId: message.zoneId
              }));
              return;
            }
            if (message.type === "companion_destination_set") {
              if (
                companionGuestIdRef.current !== message.guestId
                || message.zoneId !== activeZoneIdRef.current
              ) return;
              const zone = getWorldZone(gardenWorld, message.zoneId);
              const portal = zone.portals.find((candidate) => (
                candidate.id === message.portalId && candidate.to === message.destinationZoneId
              ));
              if (!portal) return;
              const destination = {
                token: Date.now(),
                portalId: message.portalId,
                destinationZoneId: message.destinationZoneId
              };
              sharedCompanionDestinationRef.current = destination;
              setSharedCompanionDestination(destination);
              setTravelStatus(`${message.guestNickname}님이 ${getWorldZone(gardenWorld, message.destinationZoneId).label}(으)로 함께 가자고 했어요`);
              return;
            }
            if (message.type === "companion_destination_requested") {
              if (
                companionGuestIdRef.current !== message.guestId
                || message.zoneId !== activeZoneIdRef.current
              ) return;
              setCompanionDestinationRequested(true);
              setTravelStatus(`${message.guestNickname}님이 공동 목적지 변경을 요청했어요`);
              return;
            }
            if (message.type === "companion_pinged") {
              if (
                companionGuestIdRef.current !== message.guestId
                || message.zoneId !== activeZoneIdRef.current
              ) return;
              showCompanionPing(message.ping, message.guestNickname);
              setTravelStatus(message.ping === "wait"
                ? `${message.guestNickname}님이 잠시 기다려 달라고 했어요`
                : message.ping === "here"
                  ? `${message.guestNickname}님이 현재 위치를 알렸어요`
                  : `${message.guestNickname}님이 응원을 보냈어요`);
              return;
            }
            if (message.type === "companion_rendezvous_proposed") {
              if (
                companionGuestIdRef.current !== message.guestId
                || message.zoneId !== activeZoneIdRef.current
              ) return;
              setIncomingRendezvousProposal({
                proposalId: message.proposalId,
                guestId: message.guestId,
                nickname: message.guestNickname,
                zoneId: message.zoneId,
                point: { x: message.x, y: message.y },
                expiresAt: message.expiresAt
              });
              setTravelStatus(`${message.guestNickname}님이 중간 합류 타일을 제안했어요`);
              return;
            }
            if (message.type === "companion_rendezvous_replied") {
              const proposal = outgoingRendezvousProposalRef.current;
              if (
                companionGuestIdRef.current !== message.guestId
                || !proposal
                || proposal.proposalId !== message.proposalId
              ) return;
              outgoingRendezvousProposalRef.current = null;
              setOutgoingRendezvousProposal(null);
              if (!message.accepted || message.zoneId !== proposal.zoneId) {
                setTravelStatus(`${message.guestNickname}님이 합류 제안을 거절했어요`);
                return;
              }
              activateCompanionRendezvous({ ...proposal, expiresAt: Date.now() + 2 * 60_000 }, message.guestNickname);
              return;
            }
            if (message.type === "companion_rendezvous_canceled") {
              if (companionGuestIdRef.current !== message.guestId) return;
              setIncomingRendezvousProposal((current) => (
                current?.proposalId === message.proposalId ? null : current
              ));
              setCompanionRendezvous((current) => (
                current?.proposalId === message.proposalId ? null : current
              ));
              setTravelStatus("상대 하객이 합류 예약을 취소했어요");
              return;
            }
            if (message.type === "companion_portal_ready") {
              if (companionGuestIdRef.current !== message.guestId) return;
              remoteCompanionPortalReadyRef.current = {
                portalId: message.portalId,
                destinationZoneId: message.destinationZoneId
              };
              const waiting = sharedPortalWaitRef.current;
              if (
                waiting?.portal.id === message.portalId
                && waiting.portal.to === message.destinationZoneId
              ) {
                if (sharedPortalReadyTimerRef.current !== null) {
                  window.clearTimeout(sharedPortalReadyTimerRef.current);
                  sharedPortalReadyTimerRef.current = null;
                }
                sharedPortalWaitRef.current = null;
                setSharedPortalWait(null);
                setTravelStatus("두 하객이 모두 도착해 함께 포털을 통과합니다");
                startPortalTransition(waiting.portal, waiting.approach, true);
              } else {
                setTravelStatus("동행 하객이 포털에 먼저 도착했어요");
              }
              return;
            }
            if (message.type === "companion_stopped") {
              if (companionGuestIdRef.current === message.guestId) {
                clearCompanionState();
                setTravelStatus("상대 하객이 동행을 마쳤어요");
              }
              setIncomingCompanionInvite((current) => (
                current?.requesterGuestId === message.guestId ? null : current
              ));
              return;
            }
            if (message.type === "guest_left") {
              setRemoteGuests((guests) => guests.filter((guest) => guest.guestId !== message.guestId));
              clearRemoteReaction(message.guestId);
              if (companionGuestIdRef.current === message.guestId) {
                setTravelStatus(`${companionNickname ?? "동행 하객"}님의 재접속을 기다리고 있어요`);
              } else if (pendingCompanionGuestIdRef.current === message.guestId) {
                clearCompanionState();
              }
              setIncomingCompanionInvite((current) => (
                current?.requesterGuestId === message.guestId ? null : current
              ));
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
    activateCompanionRendezvous,
    clearCompanionState,
    clearRemoteReaction,
    clearTerminalStopConfirm,
    profile.appearance,
    profile.nickname,
    realtimeIdentity,
    sendMoveImmediately,
    registerCelebrationReaction,
    startPortalTransition,
    showCompanionPing,
    showRemoteReaction
  ]);

  useEffect(() => {
    const inputGeneration = inputGenerationRef.current;
    if (portalTransitionRef.current) return;

    const hasJoystickInput = joystickInputActive;
    const movementTarget = interactionIntent?.path[0] ?? portalIntent?.path[0] ?? mapPath[0] ?? target;
    if (!movementTarget && !hasJoystickInput) {
      targetStepAtRef.current = null;
      tileInputStateRef.current = null;
      return;
    }

    let frame = 0;
    function tick(now: number) {
      if (inputGeneration !== inputGenerationRef.current || portalTransitionRef.current) return;
      devicePerformance.reportAnimationFrame(now);
      if (!shouldProcessGameFrame(renderBudget.targetFps, renderFrameAtRef.current, now)) {
        frame = requestAnimationFrame(tick);
        return;
      }
      renderFrameAtRef.current = now;

      const current = positionRef.current;
      const automaticPath = interactionIntent?.path ?? portalIntent?.path ?? mapPath;
      const movementVector = joystickVectorRef.current;
      const hasDirectionalInput = hasJoystickMovement(movementVector);
      const nextDirection = hasDirectionalInput
        ? directionFromVector(movementVector)
        : movementTarget
          ? directionTowardPoint(current, movementTarget)
          : null;

      if (!nextDirection) {
        if (joystickInputActive) {
          frame = requestAnimationFrame(tick);
          return;
        }
        setMoving(false);
        resetWalkCycle();
        setTarget(null);
        targetStepAtRef.current = null;
        tileInputStateRef.current = null;
        return;
      }

      if (hasDirectionalInput) {
        const input = tileInputStateRef.current ?? createTileInputState(nextDirection, now);
        const result = advanceTileInput(
          input,
          nextDirection,
          now,
          movementStepIntervalMs,
          movementInitialDelayMs
        );
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
        targetStepAtRef.current = now + movementStepIntervalMs;
        announceUpcomingRouteTurn(current, automaticPath);
      }

      const next = computeNextGridPosition({ current, direction: nextDirection, world: activeZone });
      const nearbyRemoteGuests = remoteGuestsRef.current
        .filter((guest) => guest.zoneId === activeZone.id)
        .sort((left, right) => (
          Math.hypot(left.x - current.x, left.y - current.y)
          - Math.hypot(right.x - current.x, right.y - current.y)
        ))
        .slice(0, renderBudget.remoteGuestLimit);
      const occupiedPoints = [
        ...activeZone.npcs.map((npc) => npcMotionFor(
          activeZone,
          npc,
          npcMotionsRef.current
        ).point),
        ...nearbyRemoteGuests.map((guest) => ({ x: guest.x, y: guest.y }))
      ];
      if (isTileOccupied(next, occupiedPoints)) {
        directionRef.current = nextDirection;
        if (hasDirectionalInput) {
          walkPhaseRef.current = 0;
          motionStore.update({ direction: nextDirection, moving: false, stepFrame: neutralWalkFrame });
        } else {
          setDirection(nextDirection);
          setMoving(false);
          resetWalkCycle();
        }
        sendRealtimeMove(current, false, nextDirection, activeZone.id, now);

        const rerouteInterval = renderBudget.targetFps === 24 ? 480 : 240;
        const routeGoal = automaticPath.at(-1);
        if (
          !hasDirectionalInput
          && routeGoal
          && now - dynamicAvoidanceRerouteAtRef.current >= rerouteInterval
        ) {
          dynamicAvoidanceRerouteAtRef.current = now;
          const portalReroute = portalIntent
            ? findNearestPortalRouteAvoidingPoints(activeZone, current, portalIntent.portal, occupiedPoints)
            : null;
          const reroutedPath = portalReroute?.path
            ?? findTilePathAvoidingPoints(activeZone, current, routeGoal, occupiedPoints);
          if (reroutedPath && reroutedPath.length > 0) {
            const notice = routeRecalculationResult(automaticPath.length, reroutedPath.length);
            if (interactionIntent) setInteractionIntent({ ...interactionIntent, path: reroutedPath });
            else if (portalIntent) setPortalIntent({ ...portalIntent, path: reroutedPath });
            else setMapPath(reroutedPath);
            setRouteRecalculationNotice(notice);
            setRouteRecalculationId((value) => value + 1);
            setTravelStatus("다른 하객을 피해 새 경로로 이동해요");
            targetStepAtRef.current = null;
            return;
          }
        }

        setTravelStatus(hasDirectionalInput
          ? "앞 타일에 다른 캐릭터가 있어 잠시 멈췄어요"
          : "다른 하객이 지나가길 기다리는 중이에요");
        targetStepAtRef.current = now + movementStepIntervalMs;
        frame = requestAnimationFrame(tick);
        return;
      }
      const didMove = !samePoint(current, next);
      const reachedTarget = movementTarget ? samePoint(next, movementTarget) : false;
      directionRef.current = nextDirection;
      if (!hasDirectionalInput) setDirection(nextDirection);

      if (!didMove) {
        setRouteRecalculationNotice(null);
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
        setRouteRecalculationNotice(null);
        if (!interactionIntent.decorationId) {
          showRouteArrivalNotice({
            title: `${interactionIntent.label} 도착`,
            detail: "목적지 상호작용을 시작합니다",
            kind: "destination"
          });
        }
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
        if (interactionIntent.collectibleId) {
          const collectible = celebrationCollectiblesForZone(activeZone)
            .find((item) => item.id === interactionIntent.collectibleId);
          if (collectible) handleCollectCelebrationItem(collectible);
        }
        if (interactionIntent.decorationId) {
          activateWorldPropInteraction(interactionIntent.decorationId);
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
      const nextStepFrame = advanceWalkCycle(resolveFootstepSurface(activeZone, next));
      motionStore.update({
        position: next,
        direction: nextDirection,
        moving: true,
        stepFrame: nextStepFrame
      });
      if (!hasDirectionalInput) {
        setPosition(next);
        setMoving(true);
        setStepFrame(nextStepFrame);
      }
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
          setRouteRecalculationNotice(null);
          showRouteArrivalNotice({
            title: "선택한 위치 도착",
            detail: "이동을 완료했어요",
            kind: "destination"
          });
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
    activateWorldPropInteraction,
    advanceWalkCycle,
    announceUpcomingRouteTurn,
    beginPortalTransition,
    devicePerformance.reportAnimationFrame,
    interactionIntent,
    handleCollectCelebrationItem,
    joystickInputActive,
    mapPath,
    motionStore,
    movementInitialDelayMs,
    movementStepIntervalMs,
    openSpot,
    openPhotoSpot,
    portalIntent,
    resetWalkCycle,
    renderBudget.remoteGuestLimit,
    renderBudget.targetFps,
    sendRealtimeMove,
    sendRealtimeStop,
    setInteractionIntent,
    setPortalIntent,
    showNpcDialogue,
    showRouteArrivalNotice,
    stampWorldInteraction,
    target
  ]);

  function handlePortalClick(portalItem: WorldPortal) {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    setPreviewPortalId(portalItem.id);
    setRouteRecalculationNotice(null);
    routeGuidanceSessionRef.current += 1;
    void preloadWorldZoneAssets(portalItem.to, "high");
    clearTerminalStopConfirm();
    setActiveNpcDialogue(null);
    cancelInteractionWalk();
    const occupiedPoints = [
      ...activeZone.npcs.map((npc) => npcMotionFor(
        activeZone,
        npc,
        npcMotionsRef.current
      ).point),
      ...remoteGuestsRef.current
        .filter((guest) => guest.zoneId === activeZone.id)
        .map((guest) => ({ x: guest.x, y: guest.y }))
    ];
    const congestion = portalCongestion(portalItem, occupiedPoints);
    const route = findNearestPortalRouteAvoidingPoints(
      activeZone,
      positionRef.current,
      portalItem,
      occupiedPoints
    );
    setTarget(null);
    setJoystickVector({ x: 0, y: 0 });
    targetStepAtRef.current = null;
    if (!route) {
      setPortalIntent(null);
      setTravelStatus(congestion.level === "full"
        ? "포털 진입 타일이 혼잡해 잠시 기다려 주세요"
        : "길을 찾을 수 없어요");
      return;
    }
    if (route.path.length === 0) {
      beginPortalTransition(portalItem, route.entry, performance.now());
      return;
    }
    setPortalIntent({ portal: portalItem, path: route.path });
    setTravelStatus(congestion.level === "busy"
      ? `${portalItem.label}의 빈 진입 타일로 우회 중`
      : `${portalItem.label}까지 이동 중`);
  }

  function chooseSharedCompanionDestination(portalItem: WorldPortal) {
    const companionId = companionGuestIdRef.current;
    if (!companionId || companionRole !== "leader") return;
    const destination = {
      token: Date.now(),
      portalId: portalItem.id,
      destinationZoneId: portalItem.to
    };
    sharedCompanionDestinationRef.current = destination;
    setSharedCompanionDestination(destination);
    setCompanionDestinationOpen(false);
    setCompanionDestinationRequested(false);
    connectionRef.current?.send({
      type: "companion_destination",
      targetGuestId: companionId,
      portalId: portalItem.id,
      destinationZoneId: portalItem.to
    });
    setTravelStatus(`${getWorldZone(gardenWorld, portalItem.to).label}(으)로 함께 이동합니다`);
  }

  function guideToCompanionZone() {
    if (!activeCompanion || activeCompanion.zoneId === activeZone.id) return;
    const nextZoneId = nextWorldZoneToward(activeZone.id, activeCompanion.zoneId);
    const portal = activeZone.portals.find(({ to }) => to === nextZoneId);
    if (!portal) {
      setTravelStatus(`${activeCompanion.nickname}님에게 가는 포털을 찾지 못했어요`);
      return;
    }
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    handlePortalClick(portal);
    setTravelStatus(`${activeCompanion.nickname}님과 재합류하기 위해 ${portal.label}(으)로 이동 중`);
  }

  function reserveCompanionRendezvous() {
    const companionId = companionGuestIdRef.current;
    if (!companionId || !activeCompanion || activeCompanion.zoneId !== activeZone.id) return;
    const midpoint = snapToGrid(companionRendezvousPoint(
      positionRef.current,
      { x: activeCompanion.x, y: activeCompanion.y }
    ), activeZone);
    const path = findTilePath(activeZone, positionRef.current, midpoint);
    if (!path) {
      setTravelStatus("합류할 수 있는 중간 타일을 찾지 못했어요");
      return;
    }
    const proposal = {
      proposalId: `meet-${Date.now().toString(36)}`,
      zoneId: activeZone.id,
      point: midpoint,
      expiresAt: Date.now() + companionRendezvousProposalLifetimeMs
    };
    outgoingRendezvousProposalRef.current = proposal;
    setOutgoingRendezvousProposal(proposal);
    connectionRef.current?.send({
      type: "companion_rendezvous_propose",
      targetGuestId: companionId,
      proposalId: proposal.proposalId,
      zoneId: proposal.zoneId,
      x: proposal.point.x,
      y: proposal.point.y
    });
    setTravelStatus(`${activeCompanion.nickname}님에게 중간 합류 타일을 제안했어요`);
  }

  function replyToRendezvousProposal(accepted: boolean) {
    const proposal = incomingRendezvousProposal;
    if (!proposal) return;
    connectionRef.current?.send({
      type: "companion_rendezvous_reply",
      requesterGuestId: proposal.guestId,
      proposalId: proposal.proposalId,
      accepted
    });
    setIncomingRendezvousProposal(null);
    if (!accepted) {
      setTravelStatus(`${proposal.nickname}님의 합류 제안을 거절했어요`);
      return;
    }
    activateCompanionRendezvous({
      proposalId: proposal.proposalId,
      zoneId: proposal.zoneId,
      point: proposal.point,
      expiresAt: Date.now() + 2 * 60_000
    }, proposal.nickname);
  }

  function cancelCompanionRendezvous() {
    const companionId = companionGuestIdRef.current;
    const proposal = companionRendezvous ?? outgoingRendezvousProposal;
    if (companionId && proposal) {
      connectionRef.current?.send({
        type: "companion_rendezvous_cancel",
        targetGuestId: companionId,
        proposalId: proposal.proposalId
      });
    }
    outgoingRendezvousProposalRef.current = null;
    setOutgoingRendezvousProposal(null);
    setCompanionRendezvous(null);
    setTravelStatus("합류 지점 예약을 취소했어요");
  }

  function navigateToAccessibilityLandmark(landmark: WorldAccessibilityLandmark) {
    pauseWorldInput();
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    if (landmark.kind === "portal") {
      const portal = activeZone.portals.find(({ id }) => id === landmark.id);
      if (portal) handlePortalClick(portal);
      return;
    }
    if (landmark.kind === "spot") {
      const spot = activeZone.spots.find(({ id }) => id === landmark.id);
      if (!spot) return;
      beginWorldInteraction({
        targetId: `spot:${spot.id}`,
        spotId: spot.id,
        label: spot.label,
        target: spot,
        actionRadius: spot.actionRadius
      });
      return;
    }
    if (landmark.kind === "photo") {
      const photoSpot = activeZone.photoSpots.find(({ id }) => id === landmark.id);
      if (!photoSpot) return;
      beginWorldInteraction({
        targetId: `photo:${photoSpot.id}`,
        photoSpotId: photoSpot.id,
        label: photoSpot.label,
        target: photoSpot,
        actionRadius: photoSpot.actionRadius
      });
      return;
    }
    const npc = activeZone.npcs.find(({ id }) => id === landmark.id);
    if (!npc) return;
    const point = npcMotionFor(activeZone, npc, npcMotionsRef.current).point;
    beginWorldInteraction({
      targetId: `npc:${npc.id}`,
      npcId: npc.id,
      label: npc.label,
      target: npcInteractionRect(point),
      actionRadius: npcInteractionRadius
    });
  }

  function navigateToRelationshipStamp(npcId: string, label: string) {
    const npc = activeZone.npcs.find(({ id }) => id === npcId);
    if (!npc) return;
    pauseWorldInput();
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    const point = npcMotionFor(activeZone, npc, npcMotionsRef.current).point;
    beginWorldInteraction({
      targetId: `npc:${npc.id}`,
      npcId: npc.id,
      spotId: "couple",
      label: npc.label,
      target: npcInteractionRect(point),
      actionRadius: npcInteractionRadius
    });
    setTravelStatus(`${label} 도장 주인공에게 자동 길찾기를 시작했어요`);
  }

  function guideToCelebrationItem(item: CelebrationCollectible) {
    if (collectedCelebrationIds.includes(item.id)) return;
    setCollectionGuideOpen(false);
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    setGuidedCollectibleId(item.id);
    plannedGuidedCollectibleRef.current = null;
    if (item.zoneId !== activeZone.id) {
      const nextZoneId = nextWorldZoneToward(activeZone.id, item.zoneId);
      const portal = activeZone.portals.find(({ to }) => to === nextZoneId);
      if (portal) {
        handlePortalClick(portal);
        setTravelStatus(`${getWorldZone(gardenWorld, item.zoneId).label}의 ${item.label}(으)로 안내합니다`);
      }
      return;
    }
    plannedGuidedCollectibleRef.current = item.id;
    beginWorldInteraction({
      targetId: `collectible:${item.id}`,
      collectibleId: item.id,
      label: item.label,
      target: { x: item.point.x - 10, y: item.point.y - 10, width: 20, height: 20 },
      actionRadius: 8
    });
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (portalTransitionRef.current) return;

    navigationResumeRef.current = null;
    setRouteRecalculationNotice(null);
    routeGuidanceSessionRef.current += 1;
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
        setRouteRecalculationNotice(routeRecalculationResult(
          resumeIntent.remainingTiles,
          portalIntentRef.current.path.length
        ));
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
        decorationId: intent.decorationId,
        label: intent.label,
        target: intent.targetRect,
        actionRadius: intent.actionRadius,
        photoSpotId: intent.photoSpotId,
        npcId: intent.npcId
      });
      if (interactionIntentRef.current) {
        setRouteRecalculationNotice(routeRecalculationResult(
          resumeIntent.remainingTiles,
          interactionIntentRef.current.path.length
        ));
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
    setRouteRecalculationNotice(routeRecalculationResult(resumeIntent.remainingTiles, path.length));
    setRouteRecalculationId((current) => current + 1);
    setTravelStatus("선택한 위치까지 경로를 다시 찾았어요");
  }

  function handleJoystickVectorChange(vector: Point) {
    const wasMoving = joystickWasMovingRef.current;
    const isMoving = hasJoystickMovement(vector);

    if (isMoving) {
      clearTerminalStopConfirm();
    }

    if (!isMoving) {
      setInputReleaseRequired(false);
      if (portalTransitionRef.current) {
        setJoystickVector(vector);
        joystickWasMovingRef.current = false;
        tileInputStateRef.current = null;
        return;
      }
      if (portalTransitionRef.current || inputReleaseRequiredRef.current) return;

      joystickVectorRef.current = vector;
      tileInputStateRef.current = null;
      if (!wasMoving) {
        setJoystickVector(vector);
        return;
      }
      if (joystickStopTimerRef.current !== null) {
        window.clearTimeout(joystickStopTimerRef.current);
      }
      joystickStopTimerRef.current = window.setTimeout(() => {
        setJoystickVector({ x: 0, y: 0 });
        joystickWasMovingRef.current = false;
        const settledMotion = motionStore.getSnapshot();
        motionStore.update({ moving: false, stepFrame: neutralWalkFrame });
        setPosition(settledMotion.position);
        setDirection(settledMotion.direction);
        setMoving(false);
        resetWalkCycle();
        sendRealtimeMove(
          settledMotion.position,
          false,
          settledMotion.direction,
          activeZone.id,
          performance.now()
        );
        resumeNavigationAfterManualMove();
      }, joystickDirectionHandoffDelayMs);
      return;
    }

    if (portalTransitionRef.current || inputReleaseRequiredRef.current) return;

    if (!wasMoving) {
      navigationResumeRef.current = portalIntentRef.current
        ? {
          kind: "portal",
          portal: portalIntentRef.current.portal,
          remainingTiles: portalIntentRef.current.path.length
        }
        : interactionIntentRef.current
          ? {
            kind: "interaction",
            intent: interactionIntentRef.current,
            remainingTiles: interactionIntentRef.current.path.length
          }
          : target
            ? { kind: "map", target, remainingTiles: mapPath.length }
            : null;
      if (!navigationResumeRef.current) {
        setPendingJourneyGuideId(null);
        setActiveJourneyGuideId(null);
        journeyGuideLastZoneRef.current = null;
      }
      setActiveNpcDialogue(null);
      setPortalIntent(null);
      setInteractionIntent(null);
      setTarget(null);
      targetStepAtRef.current = null;
      setMoving(true);
    }
    setJoystickVector(vector);
    joystickWasMovingRef.current = true;
    directionRef.current = directionFromVector(vector);
    motionStore.update({ direction: directionRef.current, moving: true });
  }

  const completedJourneyIds = new Set(journeyProgress.completedIds);
  const remainingWaypoints = remainingJourneyWaypoints(journeyProgress);
  const weddingTiming = useMemo(() => weddingJourneyTiming(
    invitationContent.event,
    journeyClock,
    completedJourneyIds.has("ceremony")
  ), [journeyClock, journeyProgress.completedIds]);
  const weddingDayFrameAvailable = Boolean(getWeddingDayStatus(
    invitationContent.event,
    weddingDayPreview ? getWeddingDayPreviewNow(invitationContent.event) : journeyClock
  ));
  const weddingExperience = useMemo(() => weddingPhaseExperience(weddingTiming), [weddingTiming]);
  const smartJourney = useMemo(() => smartJourneyRecommendation(
    journeyProgress,
    invitationContent.event,
    journeyClock
  ), [journeyClock, journeyProgress]);
  const smartJourneyCheckpoint = smartJourney
    ? journeyCheckpoints.find((checkpoint) => checkpoint.id === smartJourney.checkpointId) ?? null
    : null;
  const recommendedCheckpoint = smartJourneyCheckpoint
    ?? firstJourneyWaypoint(journeyProgress, plannedCheckpointIds)
    ?? nextJourneyCheckpoint(journeyProgress);
  const destinationCheckpoint = activeJourneyGuideId
    ? journeyCheckpoints.find((checkpoint) => checkpoint.id === activeJourneyGuideId) ?? recommendedCheckpoint
    : recommendedCheckpoint;
  const recommendedZone = destinationCheckpoint
    ? getWorldZone(gardenWorld, destinationCheckpoint.zoneId)
    : null;
  const journeyGuidance = destinationCheckpoint
    ? resolveJourneyGuidance(activeZone, position, destinationCheckpoint)
    : null;
  const journeyDistanceLabel = journeyGuidance?.available
    ? journeyGuidance.tileCount === 0
      ? "목적지 도착"
      : `${journeyGuidance.direction ? `${journeyDirectionLabels[journeyGuidance.direction]} · ` : ""}${journeyGuidance.tileCount}타일`
    : "경로 확인 필요";
  const journeyOverallSummary = summarizeRemainingJourney(journeyProgress, activeZone.id);
  const journeyPlanEstimate = useMemo(() => journeyRouteOpen
    ? estimateJourneyWaypointPlan(journeyProgress, plannedCheckpointIds, activeZone.id, position)
    : null, [activeZone.id, journeyProgress, journeyRouteOpen, plannedCheckpointIds, position]);
  const journeyRouteComparison = useMemo(() => {
    const fallback = {
      recommendedIds: [...plannedCheckpointIds],
      shortestIds: [...plannedCheckpointIds],
      options: [] as JourneyRouteComparisonOption[]
    };
    if (!journeyRouteOpen) return fallback;

    const selectedIds = new Set(normalizeJourneyWaypointPlan(journeyProgress, plannedCheckpointIds));
    const recommendedIds = remainingJourneyWaypoints(journeyProgress)
      .map(({ id }) => id)
      .filter((id) => selectedIds.has(id));
    const shortestIds = optimizeJourneyWaypointPlan(
      journeyProgress,
      recommendedIds,
      activeZone.id,
      position
    );
    const recommendedEstimate = estimateJourneyWaypointPlan(
      journeyProgress,
      recommendedIds,
      activeZone.id,
      position
    );
    const shortestEstimate = estimateJourneyWaypointPlan(
      journeyProgress,
      shortestIds,
      activeZone.id,
      position
    );

    return {
      recommendedIds,
      shortestIds,
      options: [{
        id: "recommended" as const,
        label: "추천 경로",
        detail: "예식 흐름에 맞춘 순서",
        tileCount: recommendedEstimate.tileSteps,
        portalCount: recommendedEstimate.zoneTransitions,
        estimatedLabel: recommendedEstimate.label
      }, {
        id: "shortest" as const,
        label: "최단 경로",
        detail: "총 이동을 가장 짧게",
        tileCount: shortestEstimate.tileSteps,
        portalCount: shortestEstimate.zoneTransitions,
        estimatedLabel: shortestEstimate.label
      }, {
        id: "step-free" as const,
        label: "계단 없는 길",
        detail: "엘리베이터·편의 안내 포함",
        tileCount: recommendedEstimate.tileSteps,
        portalCount: recommendedEstimate.zoneTransitions,
        estimatedLabel: recommendedEstimate.label
      }]
    };
  }, [activeZone.id, journeyProgress, journeyRouteOpen, plannedCheckpointIds, position]);
  const destinationRouteEstimate = useMemo(() => destinationCheckpoint
    ? estimateJourneyCheckpointRoute(
      { zoneId: activeZone.id, position },
      destinationCheckpoint
    )
    : null, [activeZone.id, destinationCheckpoint, position]);
  const destinationTravelProgress = destinationRouteEstimate?.available
    ? destinationNavigationProgress(
      destinationRouteEstimate.tileSteps,
      destinationRouteEstimate.portalTransitions
    )
    : null;
  const fullJourneyZonePath = useMemo(() => journeyWaypointZonePath(
    journeyProgress,
    plannedCheckpointIds,
    activeZone.id
  ), [activeZone.id, journeyProgress, plannedCheckpointIds]);
  const miniMapJourneyStops = fullJourneyZonePath.map((zoneId, index) => {
    const zone = getWorldZone(gardenWorld, zoneId);
    const nextZoneId = fullJourneyZonePath[index + 1];
    const portal = nextZoneId ? zone.portals.find((candidate) => candidate.to === nextZoneId) : null;
    return {
      id: `${zoneId}-${index}`,
      zoneLabel: zone.label,
      portalLabel: portal?.label ?? null,
      current: index === 0
    };
  });
  const miniMapJourneyDestinationLabels = normalizeJourneyWaypointPlan(
    journeyProgress,
    plannedCheckpointIds
  ).flatMap((checkpointId) => {
    const checkpoint = journeyCheckpoints.find((candidate) => candidate.id === checkpointId);
    return checkpoint ? [checkpoint.label] : [];
  });
  const journeyRoutePoints = activeJourneyGuideId && journeyGuidance?.available
    ? [position, ...journeyGuidance.path]
    : [];
  const selectedTravelPath = interactionIntent?.path
    ?? portalIntent?.path
    ?? mapPath;
  const selectedTravelRoutePoints = selectedTravelPath.length > 0
    ? [position, ...selectedTravelPath]
    : journeyRoutePoints;
  const journeyRouteSegments = segmentJourneyRouteBySurface(activeZone, selectedTravelRoutePoints);
  const compactRouteMarkers = viewport.width <= 420 || devicePerformance.mode === "lite";
  const journeyRouteTurnMarkers = journeyRouteTurns(activeZone, selectedTravelRoutePoints, {
    minimumTileGap: compactRouteMarkers ? 2 : 1,
    maxMarkers: compactRouteMarkers ? 5 : 8
  });
  const journeyRouteStart = selectedTravelRoutePoints[0];
  const journeyRouteDestination = selectedTravelRoutePoints.at(-1);
  const journeyRouteDestinationSurface = resolveFootstepSurface(
    activeZone,
    journeyRouteDestination ?? position
  );
  const journeyRouteMaskId = `journey-route-mask-${activeZone.id}-${routeRecalculationId}`;
  const journeyRouteFadeId = `journey-route-fade-${activeZone.id}-${routeRecalculationId}`;
  const directTravelActive = Boolean(interactionIntent || portalIntent || target);
  const directTravelProgress = directTravelActive
    ? destinationNavigationProgress(selectedTravelPath.length, portalIntent ? 1 : 0)
    : null;
  const visibleTravelProgress = activeJourneyGuideId
    ? destinationTravelProgress
    : directTravelProgress;
  const miniMapPreviewRoutePoints = journeyGuidance?.available && journeyGuidance.path.length > 0
    ? [position, ...journeyGuidance.path]
    : [];
  const miniMapRoutePoints = selectedTravelRoutePoints.length > 1
    ? selectedTravelRoutePoints
    : miniMapPreviewRoutePoints;
  const miniMapRouteActive = directTravelActive || Boolean(activeJourneyGuideId);
  const miniMapRouteKind = directTravelActive
    ? "selected" as const
    : activeJourneyGuideId
      ? "journey" as const
      : "preview" as const;
  const miniMapDestinationLabel = interactionIntent?.label
    ?? portalIntent?.portal.label
    ?? (target ? "선택한 위치" : destinationCheckpoint?.label ?? null);
  const accessibleDestinationPoint = journeyRouteDestination ?? journeyGuidance?.destinationPoint ?? null;
  const accessibleDestinationRemainingTiles = selectedTravelPath.length > 0
    ? selectedTravelPath.length
    : journeyGuidance?.tileCount ?? 0;
  const destinationUsesWorldSpotCard = Boolean(
    interactionIntent?.spotId
    || (
      !interactionIntent
      && !portalIntent
      && !target
      && destinationCheckpoint?.zoneId === activeZone.id
      && destinationCheckpoint.target.type === "spot"
    )
  );
  const activeRouteArrivalCue = directTravelActive && miniMapDestinationLabel
    ? routeArrivalCue(selectedTravelPath.length, miniMapDestinationLabel, Boolean(portalIntent))
    : null;
  const miniMapRouteProgressLabel = activeJourneyGuideId
    ? destinationTravelProgress?.label ?? null
    : directTravelProgress?.label ?? destinationTravelProgress?.label ?? null;
  const zoneRemoteGuests = useMemo(
    () => remoteGuests.filter((guest) => guest.zoneId === activeZone.id),
    [activeZone.id, remoteGuests]
  );
  const zoneGuestAppearanceKey = zoneRemoteGuests.map(({ appearance }) => JSON.stringify(appearance)).join("|");
  const predictedGuestAppearances = useMemo(
    () => uniquePredictedAppearances(zoneRemoteGuests.map(({ appearance }) => appearance)),
    [zoneGuestAppearanceKey]
  );
  const activeCompanion = companionGuestId
    ? remoteGuests.find((guest) => guest.guestId === companionGuestId) ?? null
    : null;
  const companionArrival = companionArrivalEstimate(
    position,
    activeZone.id,
    activeCompanion,
    activeCompanion ? getWorldZone(gardenWorld, activeCompanion.zoneId).label : ""
  );

  useEffect(() => {
    if (!activeCompanion || activeCompanion.zoneId !== activeZone.id) {
      companionTrailKeyRef.current = "";
      setCompanionTrailPoints([]);
      return;
    }
    const trailKey = `${activeCompanion.guestId}:${activeZone.id}`;
    if (companionTrailKeyRef.current !== trailKey) {
      companionTrailKeyRef.current = trailKey;
      setCompanionTrailPoints([{ x: activeCompanion.x, y: activeCompanion.y }]);
      return;
    }
    setCompanionTrailPoints((current) => appendCompanionTrailPoint(
      current,
      { x: activeCompanion.x, y: activeCompanion.y },
      18,
      14
    ));
  }, [activeCompanion?.guestId, activeCompanion?.x, activeCompanion?.y, activeCompanion?.zoneId, activeZone.id]);

  useEffect(() => {
    if (!companionRendezvous) return;
    if (!activeCompanion || companionRendezvous.zoneId !== activeZone.id || activeCompanion.zoneId !== activeZone.id) {
      setCompanionRendezvous(null);
      return;
    }
    if (Date.now() >= companionRendezvous.expiresAt) {
      setCompanionRendezvous(null);
      setTravelStatus("합류 예약 시간이 지나 취소됐어요");
      return;
    }
    const replannedPoint = companionRendezvousReplanPoint(
      companionRendezvous.point,
      position,
      { x: activeCompanion.x, y: activeCompanion.y }
    );
    if (replannedPoint) {
      const nextPoint = snapToGrid(replannedPoint, activeZone);
      if (activateCompanionRendezvous({ ...companionRendezvous, point: nextPoint }, activeCompanion.nickname)) {
        setTravelStatus(`${activeCompanion.nickname}님과의 거리 변화에 맞춰 합류 지점을 다시 잡았어요`);
      }
      return;
    }
    const playerArrived = Math.hypot(
      position.x - companionRendezvous.point.x,
      position.y - companionRendezvous.point.y
    ) <= 30;
    const companionArrived = Math.hypot(
      activeCompanion.x - companionRendezvous.point.x,
      activeCompanion.y - companionRendezvous.point.y
    ) <= 42;
    if (playerArrived && companionArrived) {
      setCompanionRendezvous(null);
      setTravelStatus(`${activeCompanion.nickname}님과 합류했어요`);
    } else if (playerArrived) {
      setTravelStatus(`합류 지점에서 ${activeCompanion.nickname}님을 기다려요`);
    }
  }, [activateCompanionRendezvous, activeCompanion, activeZone, companionRendezvous, position]);

  useEffect(() => {
    const proposal = outgoingRendezvousProposal;
    if (!proposal) return;
    const expire = () => {
      if (outgoingRendezvousProposalRef.current?.proposalId !== proposal.proposalId) return;
      const companionId = companionGuestIdRef.current;
      if (companionId) connectionRef.current?.send({
        type: "companion_rendezvous_cancel",
        targetGuestId: companionId,
        proposalId: proposal.proposalId
      });
      outgoingRendezvousProposalRef.current = null;
      setOutgoingRendezvousProposal(null);
      setTravelStatus("합류 제안 응답 시간이 지났어요");
    };
    const remaining = proposal.expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remaining);
    return () => window.clearTimeout(timer);
  }, [outgoingRendezvousProposal]);

  useEffect(() => {
    const proposal = incomingRendezvousProposal;
    if (!proposal) return;
    const expire = () => {
      setIncomingRendezvousProposal((current) => current?.proposalId === proposal.proposalId ? null : current);
      connectionRef.current?.send({
        type: "companion_rendezvous_reply",
        requesterGuestId: proposal.guestId,
        proposalId: proposal.proposalId,
        accepted: false
      });
      setTravelStatus("합류 제안이 만료됐어요");
    };
    const remaining = proposal.expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    const timer = window.setTimeout(expire, remaining);
    return () => window.clearTimeout(timer);
  }, [incomingRendezvousProposal]);
  const nearbyCompanionCandidates = companionCandidates(remoteGuests, activeZone.id, position);
  const sameZoneCompanionCandidates = activeCompanion
    && activeCompanion.zoneId === activeZone.id
    && !nearbyCompanionCandidates.some(({ guestId }) => guestId === activeCompanion.guestId)
    ? [activeCompanion, ...nearbyCompanionCandidates].slice(0, 3)
    : nearbyCompanionCandidates;
  const photoCompanions = nearbyPhotoCompanions(remoteGuests, activeZone.id, position);
  const cooperativePhotoCompanions = cooperativePhotoGuestIds.length > 0
    ? remoteGuests.filter((guest) => (
      guest.zoneId === activeZone.id && cooperativePhotoGuestIds.includes(guest.guestId)
    )).slice(0, 2)
    : [];
  const boothCompanions = activePhotoSpotId === "ceremony-aisle" && cooperativePhotoCompanions.length > 0
    ? cooperativePhotoCompanions
    : photoCompanions;
  const zoneCelebrationCollectibles = useMemo(
    () => celebrationCollectiblesForZone(activeZone),
    [activeZone]
  );
  const guidedCollectible = guidedCollectibleId
    ? zoneCelebrationCollectibles.find(({ id }) => id === guidedCollectibleId) ?? null
    : null;
  const nearestCelebrationItem = nearestUncollectedCelebrationItem(
    zoneCelebrationCollectibles,
    collectedCelebrationIds,
    activeZone.id,
    position
  );
  const nearbyCelebrationItems = visibleCelebrationCollectibles(
    zoneCelebrationCollectibles,
    collectedCelebrationIds,
    position,
    guidedCollectibleId
  );
  const nearbyCelebrationIds = new Set(nearbyCelebrationItems.map(({ id }) => id));
  const miniMapCollectibleMarkers = zoneCelebrationCollectibles
    .filter(({ id }) => (
      !collectedCelebrationIds.includes(id)
      && (collectionGuideOpen || id === guidedCollectibleId || nearbyCelebrationIds.has(id))
    ))
    .map((item) => ({
      id: item.id,
      point: item.point,
      kind: item.kind,
      highlighted: item.id === guidedCollectibleId
        || (collectionGuideOpen && item.id === nearestCelebrationItem?.item.id)
    }));
  const celebrationReward = celebrationRewardProgress(
    collectedCelebrationIds,
    totalCelebrationCollectibles
  );
  const unlockedCelebrationKinds = celebrationKindRewardProgress(
    collectedCelebrationIds,
    celebrationCollectibles
  ).filter(({ unlocked }) => unlocked).map(({ kind }) => kind);
  const activeNpcContexts = useMemo(() => activeZone.npcs.map((npc) => ({
    id: npc.id,
    label: npc.label,
    point: npcMotionFor(activeZone, npc, npcMotions).point
  })), [activeZone, npcMotions]);
  const relationshipStampBook = buildNpcRelationshipStampBook(npcDialogueMemory);
  const nextRelationshipStamp = relationshipStampBook.stamps.find(({ unlocked }) => !unlocked);
  const miniMapRelationshipStampMarkers = relationshipStampBook.stamps
    .filter(({ zoneId }) => zoneId === activeZone.id)
    .flatMap((stamp) => {
      const npc = activeNpcContexts.find(({ id }) => id === stamp.npcId);
      return npc ? [{
        id: stamp.id,
        npcId: stamp.npcId,
        label: stamp.label,
        point: npc.point,
        unlocked: stamp.unlocked,
        recommended: stamp.id === nextRelationshipStamp?.id
      }] : [];
    });
  const activeNpcPoints = useMemo(
    () => activeNpcContexts.map(({ point }) => point),
    [activeNpcContexts]
  );
  const activeZoneMiniQuest = zoneMiniQuestFor(activeZone.id);
  const activeZoneMiniQuestStep = currentZoneMiniQuestStep(activeZoneMiniQuest, zoneMiniQuestProgress);
  const activeZoneMiniQuestCompletedCount = completedZoneMiniQuestStepCount(
    activeZoneMiniQuest,
    zoneMiniQuestProgress
  );
  const nearbyContextHudAction = resolveContextHudAction({
    player: position,
    portals: activeZone.portals,
    photoSpots: activeZone.photoSpots,
    npcs: activeNpcContexts
  });
  const contextHudAction: ContextHudAction | null = nearbyContextHudAction ?? (activeZoneMiniQuestStep ? {
    kind: "quest",
    id: activeZoneMiniQuestStep.id,
    label: activeZoneMiniQuestStep.label,
    actionLabel: activeZoneMiniQuestStep.actionLabel,
    distance: Number.POSITIVE_INFINITY,
    progressLabel: `${activeZoneMiniQuest.title} · ${activeZoneMiniQuestCompletedCount + 1}/${activeZoneMiniQuest.steps.length}`
  } : null);
  const contextQuestDuplicatesDestination = Boolean(
    contextHudAction?.kind === "quest"
    && activeZoneMiniQuestStep
    && recommendedCheckpoint
    && zoneMiniQuestStepDuplicatesCheckpoint(activeZoneMiniQuestStep, recommendedCheckpoint)
  );
  const activeDialogueNpcPoint = activeNpcDialogue
    ? activeNpcContexts.find(({ id }) => id === activeNpcDialogue.npcId)?.point ?? null
    : null;
  const npcDialoguePlacement = activeDialogueNpcPoint
    ? resolveNpcDialoguePlacement({
        anchor: {
          x: camera.x + activeDialogueNpcPoint.x * camera.zoom,
          y: camera.y + activeDialogueNpcPoint.y * camera.zoom
        },
        viewport,
        destinationGuideVisible: Boolean(recommendedCheckpoint)
      })
    : "above";
  const contextActionVisible = Boolean(
    contextHudAction
    && !gameOverlayOpen
    && !hudToolsOpen
    && !moving
    && !directTravelActive
    && !portalTransition
    && !routeArrivalNotice
    && !activeRouteArrivalCue
    && !contextQuestDuplicatesDestination
    && !journeyCompleted
  );
  const hudDensity = resolveGameHudDensity({
    moving,
    routeActive: miniMapRouteActive,
    contextActive: contextActionVisible,
    toolsOpen: hudToolsOpen,
    overlayOpen: gameOverlayOpen,
    dialogueOpen: Boolean(activeNpcDialogue),
    journeyComplete: journeyCompleted
  });

  function guideToZoneMiniQuestStep(step: ZoneMiniQuestStep) {
    const target = step.target;
    if (target.type === "portal") {
      const portal = activeZone.portals.find(({ id }) => id === target.id);
      if (portal) handlePortalClick(portal);
      return;
    }
    if (target.type === "spot") {
      const spot = activeZone.spots.find(({ id }) => id === target.id);
      if (!spot) return;
      beginWorldInteraction({
        targetId: `spot:${spot.id}`,
        spotId: spot.id,
        label: spot.label,
        target: spot,
        actionRadius: spot.actionRadius
      });
      return;
    }
    if (target.type === "photo") {
      const photoSpot = activeZone.photoSpots.find(({ id }) => id === target.id);
      if (!photoSpot) return;
      beginWorldInteraction({
        targetId: `photo:${photoSpot.id}`,
        photoSpotId: photoSpot.id,
        label: photoSpot.label,
        target: photoSpot,
        actionRadius: photoSpot.actionRadius
      });
      return;
    }
    const npc = target.id === "either"
      ? activeZone.npcs
        .map((candidate) => ({
          candidate,
          point: npcMotionFor(activeZone, candidate, npcMotionsRef.current).point
        }))
        .sort((left, right) => (
          Math.hypot(left.point.x - position.x, left.point.y - position.y)
          - Math.hypot(right.point.x - position.x, right.point.y - position.y)
        ))[0]?.candidate
      : activeZone.npcs.find(({ id }) => id === target.id);
    if (!npc) return;
    const point = npcMotionFor(activeZone, npc, npcMotionsRef.current).point;
    beginWorldInteraction({
      targetId: `npc:${npc.id}`,
      spotId: "couple",
      label: npc.label,
      target: npcInteractionRect(point),
      actionRadius: npcInteractionRadius,
      npcId: npc.id
    });
  }

  function activateContextHudAction(action: ContextHudAction) {
    setActiveJourneyGuideId(null);
    setPendingJourneyGuideId(null);
    if (action.kind === "quest") {
      if (activeZoneMiniQuestStep?.id === action.id) guideToZoneMiniQuestStep(activeZoneMiniQuestStep);
      return;
    }
    if (action.kind === "portal") {
      const portal = activeZone.portals.find(({ id }) => id === action.id);
      if (!portal) return;
      setPreviewPortalId(portal.id);
      handlePortalClick(portal);
      return;
    }
    if (action.kind === "photo") {
      const photoSpot = activeZone.photoSpots.find(({ id }) => id === action.id);
      if (!photoSpot) return;
      beginWorldInteraction({
        targetId: `photo:${photoSpot.id}`,
        photoSpotId: photoSpot.id,
        label: photoSpot.label,
        target: photoSpot,
        actionRadius: photoSpot.actionRadius
      });
      return;
    }
    const npc = activeZone.npcs.find(({ id }) => id === action.id);
    if (!npc) return;
    const point = npcMotionFor(activeZone, npc, npcMotionsRef.current).point;
    beginWorldInteraction({
      targetId: `npc:${npc.id}`,
      spotId: "couple",
      label: npc.label,
      target: npcInteractionRect(point),
      actionRadius: npcInteractionRadius,
      npcId: npc.id
    });
  }
  const portalOccupiedPoints = useMemo(() => [
    ...activeNpcPoints,
    ...zoneRemoteGuests.map((guest) => ({ x: guest.x, y: guest.y }))
  ], [activeNpcPoints, zoneRemoteGuests]);
  const portalCongestionById = useMemo(() => new Map(activeZone.portals.map((portal) => [
    portal.id,
    portalCongestion(portal, portalOccupiedPoints)
  ])), [activeZone.portals, portalOccupiedPoints]);
  const crowdCells = useMemo(
    () => crowdDensityCells(zoneRemoteGuests.map((guest) => ({ x: guest.x, y: guest.y }))),
    [zoneRemoteGuests]
  );
  const portalWaitById = useMemo(() => new Map(activeZone.portals.map((portal) => [
    portal.id,
    portalWaitEstimate(
      portal,
      portalCongestionById.get(portal.id)!,
      zoneRemoteGuests.map((guest) => ({ x: guest.x, y: guest.y }))
    )
  ])), [activeZone.portals, portalCongestionById, zoneRemoteGuests]);
  const visibleRemoteGuests = useMemo(() => (
    zoneRemoteGuests.length > renderBudget.remoteGuestLimit
      ? [...zoneRemoteGuests]
        .sort((left, right) => (
          Math.hypot(left.x - position.x, left.y - position.y)
          - Math.hypot(right.x - position.x, right.y - position.y)
        ))
        .slice(0, renderBudget.remoteGuestLimit)
      : zoneRemoteGuests
  ), [position.x, position.y, renderBudget.remoteGuestLimit, zoneRemoteGuests]);
  const worldLabelCandidates = [
    ...activeZone.spots.map((worldSpot) => {
      const proximity = resolveWorldSpotProximity(position, worldSpot);
      const placedSpot = placeWorldOverlayInsideViewport({ rect: worldSpot, camera, viewport }).rect;
      const targeted = interactionIntent?.targetId === `spot:${worldSpot.id}`;
      const recommended = recommendedCheckpoint?.zoneId === activeZone.id
        && recommendedCheckpoint.target.type === "spot"
        && recommendedCheckpoint.target.spotId === worldSpot.id;
      return {
        id: `spot:${worldSpot.id}`,
        rect: {
          x: placedSpot.x + placedSpot.width / 2 - 48,
          y: placedSpot.y + placedSpot.height / 2 - 31,
          width: 96,
          height: 62
        },
        priority: targeted ? 120 : recommended ? 110 : proximity === "near" ? 90 : proximity === "mid" ? 60 : 30
      };
    }),
    ...activeZone.portals.map((portalItem) => {
      const entry = portalEntryRect(portalItem);
      const targeted = portalIntent?.portal.id === portalItem.id;
      const recommended = journeyGuidance?.portalId === portalItem.id;
      return {
        id: `portal:${portalItem.id}`,
        rect: {
          x: entry.x + entry.width / 2 - 60,
          y: entry.y - 18,
          width: 120,
          height: entry.height + 42
        },
        priority: targeted ? 116 : recommended ? 106 : 80
      };
    }),
    ...activeZone.npcs.map((npc) => {
      const motion = npcMotionFor(activeZone, npc, npcMotions);
      const targeted = interactionIntent?.targetId === `npc:${npc.id}` || (
        recommendedCheckpoint?.zoneId === activeZone.id
        && recommendedCheckpoint.target.type === "npc"
        && recommendedCheckpoint.target.npcId === npc.id
      );
      return {
        id: `npc:${npc.id}`,
        rect: { x: motion.point.x - 48, y: motion.point.y - 52, width: 96, height: 152 },
        priority: activeNpcDialogue?.npcId === npc.id ? 130 : targeted ? 112 : 70
      };
    })
  ];
  const worldLabelVisibility = resolveWorldLabelVisibility(worldLabelCandidates);
  const remoteGuestNameplateBounds = useMemo(() => ({
    left: Math.max(activeZone.bounds.x, -camera.x / camera.zoom) + 4,
    right: Math.min(
      activeZone.bounds.x + activeZone.bounds.width,
      (viewport.width - camera.x) / camera.zoom
    ) - 4,
    top: Math.max(activeZone.bounds.y, -camera.y / camera.zoom) + 4,
    bottom: Math.min(
      activeZone.bounds.y + activeZone.bounds.height,
      (viewport.height - camera.y) / camera.zoom
    ) - Math.min(104, viewport.height * 0.22) / camera.zoom
  }), [activeZone.bounds, camera.x, camera.y, camera.zoom, viewport.height, viewport.width]);
  const activeDialogueObstacle: RemoteGuestNameplateObstacle | null = activeDialogueNpcPoint
    ? (() => {
        const width = Math.min(248, viewport.width - 24) / camera.zoom;
        const height = Math.min(236, viewport.height * 0.5) / camera.zoom;
        const horizontalGap = 51 / camera.zoom;
        const verticalGap = 58 / camera.zoom;
        if (npcDialoguePlacement === "left") {
          return {
            id: "npc-dialogue",
            left: activeDialogueNpcPoint.x - horizontalGap - width,
            right: activeDialogueNpcPoint.x - horizontalGap,
            top: activeDialogueNpcPoint.y - 24 / camera.zoom,
            bottom: activeDialogueNpcPoint.y - 24 / camera.zoom + height
          };
        }
        if (npcDialoguePlacement === "right") {
          return {
            id: "npc-dialogue",
            left: activeDialogueNpcPoint.x + horizontalGap,
            right: activeDialogueNpcPoint.x + horizontalGap + width,
            top: activeDialogueNpcPoint.y - 24 / camera.zoom,
            bottom: activeDialogueNpcPoint.y - 24 / camera.zoom + height
          };
        }
        const top = npcDialoguePlacement === "below"
          ? activeDialogueNpcPoint.y + verticalGap
          : activeDialogueNpcPoint.y - verticalGap - height;
        return {
          id: "npc-dialogue",
          left: activeDialogueNpcPoint.x - width / 2,
          right: activeDialogueNpcPoint.x + width / 2,
          top,
          bottom: top + height
        };
      })()
    : null;
  const remoteGuestNameplateObstacles: RemoteGuestNameplateObstacle[] = [
    ...worldLabelCandidates
      .filter(({ id }) => id.startsWith("npc:") || worldLabelVisibility.get(id) !== "quiet")
      .map(({ id, rect }) => ({
        id,
        left: rect.x,
        right: rect.x + rect.width,
        top: rect.y,
        bottom: rect.y + rect.height
      })),
    ...visibleRemoteGuests.flatMap((guest) => remoteReactions[guest.guestId]?.zoneId === activeZone.id ? [{
      id: `reaction:${guest.guestId}`,
      left: guest.x - 22,
      right: guest.x + 22,
      top: guest.y - 96,
      bottom: guest.y - 48
    }] : []),
    ...(activeDialogueObstacle ? [activeDialogueObstacle] : [])
  ].filter((obstacle) => (
    obstacle.right >= remoteGuestNameplateBounds.left
    && obstacle.left <= remoteGuestNameplateBounds.right
    && obstacle.bottom >= remoteGuestNameplateBounds.top
    && obstacle.top <= remoteGuestNameplateBounds.bottom
  ));
  const remoteGuestNameplates = placeRemoteGuestNameplates(
    visibleRemoteGuests.filter((guest) => (
      guest.x >= remoteGuestNameplateBounds.left - 64
      && guest.x <= remoteGuestNameplateBounds.right + 64
      && guest.y >= remoteGuestNameplateBounds.top - 18
      && guest.y <= remoteGuestNameplateBounds.bottom
        + Math.min(104, viewport.height * 0.22) / camera.zoom
        + 18
    )).map((guest) => {
      const anchor = resolveWorldCharacterAnchor(guest.appearance, window.devicePixelRatio);
      return {
        ...guest,
        x: guest.x - anchor.centerOffsetX,
        y: guest.y + guestPresetFrame.display.world.height + 3 - anchor.centerY
      };
    }),
    remoteGuestNameplateBounds,
    remoteGuestNameplateObstacles
  );
  useEffect(() => {
    if (requiresExtendedGameTypography([
      profile.nickname,
      ...visibleRemoteGuests.map(({ nickname }) => nickname)
    ])) {
      void loadExtendedGameTypography();
    }
  }, [profile.nickname, visibleRemoteGuests]);
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
  const previewPortal = portalIntent?.portal
    ?? activeZone.portals.find((portal) => portal.id === previewPortalId)
    ?? null;
  const previewPortalDestination = previewPortal
    ? getWorldZone(gardenWorld, previewPortal.to)
    : null;
  const previewPortalCongestion = previewPortal
    ? portalCongestionById.get(previewPortal.id)
    : undefined;
  const previewPortalWait = previewPortal
    ? portalWaitById.get(previewPortal.id)
    : undefined;
  const previewPortalFirstVisit = previewPortal
    ? isFirstWorldVisit(worldTravelHistory, previewPortal.to)
    : false;
  const previewPortalVisitCount = previewPortal
    ? worldTravelHistory.records.filter(({ to }) => to === previewPortal.to).length
    : 0;
  const recentTravelRecords = recentWorldTravelRecords(worldTravelHistory, 2).reverse();
  const recentTravelZoneIds = recentTravelRecords.length > 0
    ? [recentTravelRecords[0].from, ...recentTravelRecords.map(({ to }) => to)]
    : [];
  const recentTravelDestinations = recentTravelZoneIds
    .filter((zoneId, index) => index === 0 || zoneId !== recentTravelZoneIds[index - 1])
    .map((zoneId) => getWorldZone(gardenWorld, zoneId).label);
  const activeWorldPropInteractions = worldPropInteractionsForZone(activeZone);
  const activeWorldPropMomentEntry = activePropMoment?.zoneId === activeZone.id
    ? activeWorldPropInteractions.find(({ decoration }) => decoration.id === activePropMoment.decorationId) ?? null
    : null;
  const activeWorldSecretTarget = activeWorldPropInteractions
    .find(({ interaction }) => !worldSecretCollection.discoveredIds.includes(interaction.secretId)) ?? null;
  const activeWorldSecretHint = activeWorldSecretTarget?.interaction ?? null;
  const activeWorldSecretClue = activeWorldSecretTarget
    ? resolveWorldSecretClue(activeWorldSecretTarget.interaction, activeWorldSecretTarget.decoration, position)
    : null;
  const predictedNextZoneId = portalIntent?.portal.to
    ?? (destinationCheckpoint
      ? nextWorldZoneToward(activeZone.id, destinationCheckpoint.zoneId)
      : activeZone.portals[0]?.to ?? null);
  const predictedAssetPlan = useMemo(() => journeyAssetPrediction({
    nextZoneId: predictedNextZoneId,
    networkMode,
    performanceMode: devicePerformance.mode
  }), [devicePerformance.mode, networkMode, predictedNextZoneId]);

  useEffect(() => {
    saveGameViewLocation(activeZone.id, activeJourneyGuideId);
  }, [activeJourneyGuideId, activeZone.id]);

  useEffect(() => {
    const touched = zoneCelebrationCollectibles.find((item) => (
      !collectedCelebrationIds.includes(item.id) && samePoint(item.point, position)
    ));
    if (touched) handleCollectCelebrationItem(touched);
  }, [collectedCelebrationIds, handleCollectCelebrationItem, position, zoneCelebrationCollectibles]);

  useEffect(() => {
    if (!guidedCollectible || !feedbackPreferences.hapticsEnabled) {
      collectionProximityBandRef.current = null;
      return;
    }
    const distance = Math.hypot(guidedCollectible.point.x - position.x, guidedCollectible.point.y - position.y);
    const band = collectionProximityBand(distance);
    if (!band || collectionProximityBandRef.current === band) return;
    collectionProximityBandRef.current = band;
    triggerCollectionProximityHaptic(band);
  }, [feedbackPreferences.hapticsEnabled, guidedCollectible, position]);

  useEffect(() => {
    if (
      !guidedCollectible
      || collectedCelebrationIds.includes(guidedCollectible.id)
      || plannedGuidedCollectibleRef.current === guidedCollectible.id
      || portalTransition
    ) return;
    plannedGuidedCollectibleRef.current = guidedCollectible.id;
    beginWorldInteraction({
      targetId: `collectible:${guidedCollectible.id}`,
      collectibleId: guidedCollectible.id,
      label: guidedCollectible.label,
      target: {
        x: guidedCollectible.point.x - 10,
        y: guidedCollectible.point.y - 10,
        width: 20,
        height: 20
      },
      actionRadius: 8
    });
  }, [activeZone.id, collectedCelebrationIds, guidedCollectible, portalTransition, beginWorldInteraction]);

  useEffect(() => {
    if (!sharedCompanionDestination || plannedSharedDestinationTokenRef.current === sharedCompanionDestination.token) return;
    const portal = activeZone.portals.find((candidate) => (
      candidate.id === sharedCompanionDestination.portalId
      && candidate.to === sharedCompanionDestination.destinationZoneId
    ));
    if (!portal || !companionGuestId) return;
    plannedSharedDestinationTokenRef.current = sharedCompanionDestination.token;
    handlePortalClick(portal);
  }, [activeZone, companionGuestId, sharedCompanionDestination]);

  useEffect(() => {
    if (!companionGuestId) return;
    if (!activeCompanion) {
      setCompanionRejoinZoneId(null);
      if (realtimeStatus === "online") {
        setTravelStatus(`${companionNickname ?? "동행 하객"}님의 재접속을 기다리고 있어요`);
      }
      return;
    }
    if (activeCompanion.zoneId !== activeZone.id) {
      setCompanionRejoinZoneId(activeCompanion.zoneId);
      setTravelStatus(Date.now() < companionZoneGraceUntilRef.current
        ? `${activeCompanion.nickname}님도 포털을 통과하는 중이에요`
        : `${activeCompanion.nickname}님이 ${getWorldZone(gardenWorld, activeCompanion.zoneId).label}에 있어요 · 재합류 안내를 사용할 수 있어요`);
      return;
    }
    companionZoneGraceUntilRef.current = 0;
    setCompanionRejoinZoneId(null);
    if (companionRole !== "follower" || companionRendezvous) return;
    if (portalTransition || interactionIntent || portalIntent || joystickInputActive) return;
    const companionPoint = snapToGrid({ x: activeCompanion.x, y: activeCompanion.y }, activeZone);
    const fullPath = findTilePath(activeZone, positionRef.current, companionPoint);
    if (!fullPath) {
      setTravelStatus(`${activeCompanion.nickname}님에게 가는 길을 잠시 찾지 못했어요`);
      return;
    }
    const followPath = companionFollowPath(fullPath);
    if (followPath.length === 0) {
      setTarget(null);
      setTravelStatus(`${activeCompanion.nickname}님과 나란히 걷고 있어요`);
      return;
    }
    const followTarget = followPath.at(-1)!;
    setPendingJourneyGuideId(null);
    setActiveJourneyGuideId(null);
    setTarget(followTarget);
    setMapPath(followPath);
    setTravelStatus(`${activeCompanion.nickname}님을 따라 이동 중`);
    targetStepAtRef.current = null;
  }, [
    companionGuestId,
    companionNickname,
    companionRole,
    activeCompanion?.guestId,
    activeCompanion?.nickname,
    activeCompanion?.x,
    activeCompanion?.y,
    activeCompanion?.zoneId,
    activeZone,
    interactionIntent,
    joystickInputActive,
    portalIntent,
    portalTransition,
    realtimeStatus,
    companionRendezvous,
    setTarget
  ]);

  useEffect(() => {
    if (
      !companionInviteLink
      || companionLinkInviteSentRef.current
      || companionGuestId
      || pendingCompanionGuestId
      || realtimeStatus !== "online"
    ) return;
    if (currentGuestIdRef.current === companionInviteLink.targetGuestId) {
      companionLinkInviteSentRef.current = true;
      setTravelStatus("내 동행 링크가 열려 있어요. 다른 하객에게 링크를 보내주세요");
      return;
    }
    const targetGuest = remoteGuests.find(({ guestId }) => guestId === companionInviteLink.targetGuestId);
    if (!targetGuest) {
      setTravelStatus("링크를 보낸 하객이 입장하기를 기다리고 있어요");
      return;
    }
    if (targetGuest.zoneId !== activeZone.id) {
      setTravelStatus(`${targetGuest.nickname}님이 있는 ${getWorldZone(gardenWorld, targetGuest.zoneId).label}로 이동해 주세요`);
      setCompanionRejoinZoneId(targetGuest.zoneId);
      return;
    }
    companionLinkInviteSentRef.current = true;
    inviteCompanion(targetGuest.guestId);
    const url = new URL(window.location.href);
    url.searchParams.delete("together");
    url.searchParams.delete("togetherZone");
    url.searchParams.delete("togetherExpires");
    url.searchParams.delete("togetherCode");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }, [
    activeZone.id,
    companionGuestId,
    companionInviteLink,
    inviteCompanion,
    pendingCompanionGuestId,
    realtimeStatus,
    remoteGuests
  ]);

  useEffect(() => {
    setTravelStatusVisible(true);
    const timer = window.setTimeout(() => setTravelStatusVisible(false), 2_800);
    return () => window.clearTimeout(timer);
  }, [travelStatus]);

  useEffect(() => {
    if (!companionInviteLink) return;
    const remaining = companionInviteLink.expiresAt - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => {
      if (companionGuestIdRef.current || pendingCompanionGuestIdRef.current) return;
      companionLinkInviteSentRef.current = true;
      setTravelStatus("동행 초대 링크가 만료됐어요 · 새 링크를 받아주세요");
      const url = new URL(window.location.href);
      url.searchParams.delete("together");
      url.searchParams.delete("togetherZone");
      url.searchParams.delete("togetherExpires");
      url.searchParams.delete("togetherCode");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }, remaining);
    return () => window.clearTimeout(timer);
  }, [companionInviteLink]);

  useEffect(() => {
    if (!companionShareStatus) return;
    const timer = window.setTimeout(() => setCompanionShareStatus(null), 3_000);
    return () => window.clearTimeout(timer);
  }, [companionShareStatus]);

  useEffect(() => {
    if (!predictedAssetPlan) return;
    const timer = window.setTimeout(() => {
      void preloadWorldZoneAssets(
        predictedAssetPlan.zoneId,
        predictedAssetPlan.priority,
        predictedAssetPlan.detail
      );
      if (predictedAssetPlan.preloadGuestPortraits) {
        predictedGuestAppearances.forEach((appearance) => {
          void preloadImage(resolveCharacterPortraitUrl(appearance), "low");
        });
      }
    }, 220);
    return () => window.clearTimeout(timer);
  }, [predictedAssetPlan, predictedGuestAppearances]);

  return (
    <section
      className="game-world"
      data-wedding-phase={weddingExperience?.phase}
      data-wedding-ambience={weddingExperience?.ambience}
      data-collection-rewards={unlockedCelebrationKinds.join(" ") || undefined}
      data-collection-cosmetic={equippedCelebrationCosmetic}
      data-collection-tone={equippedCelebrationTone}
      data-journey-stamp-reward={equippedJourneyStampReward}
      data-secret-reward={worldSecretCollection.equippedRewardId}
      data-group-celebration={npcGroupCelebrationActive || undefined}
      data-hud-tools-open={hudToolsOpen || undefined}
      aria-label="모바일 청첩장 월드"
      aria-busy={portalTransition ? "true" : undefined}
    >
      {npcGroupCelebrationActive ? <NpcGroupCelebrationNotice onClose={() => setNpcGroupCelebrationActive(false)} /> : null}
      <div
        className={`world-portal-transition world-portal-transition--${portalTransition?.phase ?? "idle"}`}
        data-testid="world-portal-transition"
        data-phase={portalTransition?.phase ?? "idle"}
        data-continuous-journey={Boolean(portalTransition && pendingJourneyGuideId) || undefined}
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
      <header
        className="world-hud"
        data-tools-open={hudToolsOpen || undefined}
        data-density={hudDensity}
        data-journey-complete={journeyCompleted || undefined}
        data-dialogue-open={Boolean(activeNpcDialogue) || undefined}
      >
        <div className="world-hud__status">
          <div className="world-zone-summary">
            <span>현재 구역 · {activeZone.journeyIndex + 1}/10</span>
            <strong>{activeZone.label}</strong>
            <small>{activeZone.subtitle}</small>
          </div>
          <button
            type="button"
            className="world-hud__tools-toggle"
            aria-expanded={hudToolsOpen}
            aria-label={hudToolsOpen ? "안내 도구 닫기" : "안내 도구 열기"}
            onClick={() => {
              pauseWorldInput();
              setHudToolsOpen((current) => !current);
            }}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span>{journeyCompleted ? "추억" : "안내"}</span>
            <i className={`realtime-pill realtime-pill--${realtimeStatus}`} aria-label={realtimeStatusText(realtimeStatus)} />
            <ChevronDown aria-hidden="true" />
          </button>
        </div>
        {journeyCompleted && !hudToolsOpen ? (
          <nav className="world-journey-complete-actions" aria-label="완주 후 초대장 바로가기">
            <button type="button" onClick={() => openSpot("wedding-info")}>
              <CalendarDays aria-hidden="true" />
              <span><strong>예식 정보</strong><small>날짜·장소 확인</small></span>
            </button>
            <button type="button" onClick={() => openSpot("guestbook")}>
              <MessageCircle aria-hidden="true" />
              <span><strong>방명록</strong><small>축하 인사 남기기</small></span>
            </button>
          </nav>
        ) : null}
        {recommendedCheckpoint && recommendedZone ? (
          <div
            className="world-destination-guide-row"
            data-active={activeJourneyGuideId === recommendedCheckpoint.id || undefined}
            data-smart-phase={smartJourney?.phase}
          >
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
                <small>{activeJourneyGuideId === recommendedCheckpoint.id ? "안내 중" : "다음"}</small>
                <strong>{recommendedCheckpoint.label}</strong>
                <em>{recommendedCheckpoint.zoneId === activeZone.id ? "현재 맵" : recommendedZone.label} · {journeyDistanceLabel}</em>
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
        ) : null}
        {hudToolsOpen ? <div className="world-hud__tools">
          <div className="world-hud__realtime-controls">
            <OneHandControlQuickToggle />
            <GameFeedbackToggle />
            <div className={`realtime-pill realtime-pill--${realtimeStatus}`}>{realtimeStatusText(realtimeStatus)}</div>
          </div>
        {weddingTiming ? (
          <WeddingJourneyClock
            timing={weddingTiming}
            disabled={Boolean(portalTransition)}
            onFastRoute={() => {
              const ceremony = journeyCheckpoints.find((checkpoint) => checkpoint.id === "ceremony");
              if (!ceremony) return;
              setArrivalAction(null);
              startJourneyGuidance(ceremony);
            }}
          />
        ) : null}
        {weddingExperience ? <WeddingPhaseAnnouncement experience={weddingExperience} /> : null}
        <JourneyStampBook
          progress={journeyProgress}
          syncStatus={journeySyncStatus}
          activeZoneId={activeZone.id}
          highlightedCheckpointId={stampedCheckpointId}
          disabled={Boolean(portalTransition)}
          appearance={profile.appearance}
          equippedReward={equippedJourneyStampReward}
          onOpenChange={(open) => { if (open) pauseWorldInput(); }}
          onEquipReward={(rewardId) => {
            if (!isJourneyStampRewardUnlocked(rewardId, journeyProgress)) return;
            saveJourneyStampReward(rewardId);
            setEquippedJourneyStampReward(rewardId);
            const reward = journeyStampRewards.find(({ id }) => id === rewardId);
            setTravelStatus(rewardId === "none" ? "방문 스탬프 장식을 해제했어요" : `${reward?.label ?? "스탬프 장식"}을 착용했어요`);
          }}
          onOpenCompletion={openJourneyCompletion}
          onSelectZone={handleJourneySelect}
        />
        {recommendedCheckpoint && recommendedZone ? (
          <button
            type="button"
            className="world-accessible-route"
            aria-label={`쉬운 길찾기 열기, 남은 추억 ${journeyOverallSummary.remainingCheckpoints}개, 실제 타일 경로 확인`}
            onClick={() => {
              void loadJourneyRouteSheetComponent();
              pauseWorldInput();
              setJourneyRoutePreference(viewPreferences.stepFreeRouteEnabled ? "step-free" : "recommended");
              setJourneyRouteOpen(true);
            }}
          >
            <Accessibility aria-hidden="true" />
            <strong>쉬운 길찾기</strong>
            <span>남은 {journeyOverallSummary.remainingCheckpoints}개 · 맵 이동 {journeyOverallSummary.zoneTransitions}회 · 실제 타일 경로 확인</span>
          </button>
        ) : null}
        <details className="world-game-vault" data-optional-features="true">
          <summary>
            <Archive aria-hidden="true" />
            <span>
              <strong>게임 기록·설정</strong>
              <small>{optionalFeatureUsage.recentId
                ? optionalFeatureSummary(optionalFeatureUsage)
                : "수집·같이 걷기·저장·기기 점검"}</small>
            </span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <div className="world-game-vault__body">
            <section className="world-game-vault__section" aria-label="함께하고 수집하기">
              <h3>함께하고 수집하기</h3>
              <div className="world-game-vault__shortcuts">
                <button
                  type="button"
                  data-optional-feature="collection"
                  data-recent={optionalFeatureUsage.recentId === "collection" || undefined}
                  onClick={() => {
                    markOptionalFeatureUsed("collection");
                    void loadCelebrationCollectionGuideComponent();
                    pauseWorldInput();
                    setCollectionGuideOpen(true);
                  }}
                >
                  <Flower2 aria-hidden="true" />
                  <span><strong>축하 아이템 지도</strong><small>{collectedCelebrationIds.length}/{totalCelebrationCollectibles} 수집</small></span>
                </button>
                <button
                  type="button"
                  data-optional-feature="companion"
                  data-recent={optionalFeatureUsage.recentId === "companion" || undefined}
                  onClick={() => {
                    markOptionalFeatureUsed("companion");
                    openCompanionWaitingRoom();
                  }}
                >
                  <UsersRound aria-hidden="true" />
                  <span><strong>같이 걷기</strong><small>QR·링크로 하객 초대</small></span>
                </button>
              </div>
            </section>
            <section className="world-game-vault__section" aria-label="추억과 기록">
              <h3>추억과 기록</h3>
              <div className="world-game-vault__shortcuts">
                <button
                  type="button"
                  data-optional-feature="photo-album"
                  data-recent={optionalFeatureUsage.recentId === "photo-album" || undefined}
                  onClick={() => {
                    markOptionalFeatureUsed("photo-album");
                    setHudToolsOpen(false);
                    handlePhotoAlbumOpenChange(true);
                  }}
                >
                  <Images aria-hidden="true" />
                  <span><strong>포토앨범</strong><small>{weddingPhotoAlbumProgress(photoAlbum)}/3개 사진</small></span>
                </button>
                <button
                  type="button"
                  data-optional-feature="game-memory"
                  data-recent={optionalFeatureUsage.recentId === "game-memory" || undefined}
                  onClick={() => {
                    markOptionalFeatureUsed("game-memory");
                    setHudToolsOpen(false);
                    pauseWorldInput();
                    setGameMemoryAlbum(loadGameMemoryAlbum());
                    setGameMemoryAlbumOpen(true);
                  }}
                >
                  <Images aria-hidden="true" />
                  <span><strong>게임 추억</strong><small>{gameMemoryAlbum.entries.length}개 기록</small></span>
                </button>
              </div>
              <WorldSecretProgress
                collection={worldSecretCollection}
                totalCount={totalWorldSecrets}
                currentHint={activeWorldSecretHint}
                currentClue={activeWorldSecretClue}
              />
              <WorldSecretCollectionBook
                collection={worldSecretCollection}
                activeZoneId={activeZone.id}
                disabled={Boolean(portalTransition)}
                onSelectZone={handleJourneySelect}
                onEquipReward={(rewardId) => {
                  const next = equipWorldSecretReward(worldSecretCollection, rewardId);
                  setWorldSecretCollection(next);
                  setTravelStatus(rewardId === "none" ? "숨은 추억 장식을 해제했어요" : "숨은 추억 장식을 착용했어요");
                }}
              />
              <WorldTravelTimeline
                zones={gardenWorld.zones}
                history={worldTravelHistory}
                activeZoneId={activeZone.id}
                disabled={Boolean(portalTransition)}
                onSelectZone={handleJourneySelect}
              />
              <Suspense fallback={<GameInlineLoading label="추억 카드" />}>
                <JourneyMemoryCardAccess nickname={profile.nickname} progress={journeyProgress} />
              </Suspense>
              <Suspense fallback={<GameInlineLoading label="인연 기록" />}>
                <NpcRelationshipJournal
                  memory={npcDialogueMemory}
                  names={{ bride: invitationContent.event.couple.bride, groom: invitationContent.event.couple.groom }}
                  onRewardInteraction={(npcId, rewardLabel) => {
                    handleGuestReaction(npcId === "bride" ? "heart" : "celebrate");
                    playFeedback("complete");
                    setTravelStatus(`${rewardLabel}을 다시 펼쳐봤어요`);
                  }}
                />
              </Suspense>
            </section>
            <section className="world-game-vault__section" aria-label="장소 바로가기">
              <h3>장소 바로가기</h3>
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
            </section>
            <section className="world-game-vault__section" aria-label="게임 이용 설정">
              <h3>게임 이용 설정</h3>
              <div className="world-game-vault__shortcuts">
                <button
                  type="button"
                  onClick={() => {
                    setHudToolsOpen(false);
                    setQuickDockSettingsOpen(true);
                    pauseWorldInput();
                  }}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span><strong>빠른 도구 편집</strong><small>반응·안내·소리 선택</small></span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHudToolsOpen(false);
                    openGameGuide();
                  }}
                >
                  <CircleHelp aria-hidden="true" />
                  <span><strong>게임 안내</strong><small>조작 방법 다시 보기</small></span>
                </button>
                <Suspense fallback={<GameInlineLoading label="화면 설정" />}>
                  <ViewSettingsAccess
                    variant="menu"
                    currentZoneId={activeZone.id}
                    onOpenChange={handleViewSettingsOpenChange}
                  />
                </Suspense>
              </div>
            </section>
            <section className="world-game-vault__section" aria-label="기기와 저장">
              <h3>기기와 저장</h3>
              <GamePerformanceStatus performance={devicePerformance} />
              <Suspense fallback={<GameInlineLoading label="저장·기기 점검" />}>
                <GameSaveDataCenter />
                <GameDeviceReadinessCenter />
              </Suspense>
            </section>
          </div>
        </details>
        </div> : null}
        <div className="world-travel-status-row" data-visible={travelStatusVisible || visibleTravelProgress || undefined}>
          <p className="world-travel-status" aria-live="polite">{travelStatus}</p>
          {visibleTravelProgress && !portalTransition ? (
            <span className="world-travel-progress" data-testid="world-travel-progress">
              <MapPinned aria-hidden="true" /> {visibleTravelProgress.label}
              {routeRecalculationNotice ? (
                <small
                  className="world-travel-progress__reroute"
                  data-kind={routeRecalculationNotice.kind}
                >
                  {routeRecalculationNotice.notice}
                </small>
              ) : null}
            </span>
          ) : null}
          {portalTransition && pendingJourneyGuideId ? (
            <span className="world-travel-progress world-travel-progress--continuing">
              <MapPinned aria-hidden="true" /> 목적지 연속 안내
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

      <div ref={mapShellRef} className="world-map-shell">
        {mapAuditMode.available ? (
          <WorldGeometryAuditControls
            zones={gardenWorld.zones}
            activeZoneId={activeZone.id}
            enabled={geometryAuditEnabled}
            issueCounts={geometryAuditIssueCounts}
            layers={geometryAuditLayers}
            copyStatus={diagnosticCopyStatus}
            patchStatus={diagnosticPatchStatus}
            bundleStatus={diagnosticBundleStatus}
            patchImportStatus={diagnosticPatchImportStatus}
            importedPatchOperationCount={diagnosticPatchPreview?.patch.operationCount ?? 0}
            heatmapMode={geometryAuditHeatmapMode}
            recommendations={activeForegroundRecommendations}
            recommendationDecisions={foregroundRecommendationDecisions}
            onDownloadBundle={() => { void handleDownloadDiagnosticBundle(); }}
            onDownloadPatch={handleDownloadDiagnosticPatch}
            onImportPatch={(file) => { void handleImportDiagnosticPatch(file); }}
            onClearImportedPatch={() => {
              setDiagnosticPatchPreview(null);
              setDiagnosticPatchImportStatus("idle");
              setDiagnosticBundleStatus("idle");
            }}
            onOpenBundleViewer={() => {
              window.open(worldDiagnosticBundleViewerUrl(), "_blank", "noopener,noreferrer");
            }}
            onCopyLink={() => { void handleCopyDiagnosticLink(); }}
            onEnabledChange={(nextEnabled) => {
              const url = new URL(window.location.href);
              url.searchParams.set("mapAudit", nextEnabled ? "1" : "0");
              if (nextEnabled) {
                url.searchParams.set("mapAuditLayers", serializeWorldGeometryAuditLayers(geometryAuditLayers));
                url.searchParams.set("mapAuditHeatmap", geometryAuditHeatmapMode);
                writeWorldForegroundReviewDecisionsToUrl(url, foregroundRecommendationDecisions);
              } else {
                url.searchParams.delete("mapAuditZone");
                url.searchParams.delete("mapAuditLayers");
                url.searchParams.delete("mapAuditHeatmap");
                url.searchParams.delete("mapAuditReview");
              }
              window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
              setGeometryAuditEnabled(nextEnabled);
            }}
            onLayerChange={handleDiagnosticLayerChange}
            onHeatmapModeChange={handleDiagnosticHeatmapModeChange}
            onNextIssue={handleNextDiagnosticIssue}
            onRecommendationDecision={handleForegroundRecommendationDecision}
            onZoneChange={handleDiagnosticZoneChange}
          />
        ) : null}
        <div
          ref={mapViewportRef}
          className={`world-map world-map--${activeZone.theme}`}
          data-testid="world-map-viewport"
          data-dialogue-open={Boolean(activeNpcDialogue) || undefined}
          data-dialogue-placement={activeNpcDialogue ? npcDialoguePlacement : undefined}
          onClick={handleMapClick}
        >
          <div
            ref={mapStageRef}
            className={`world-map__stage${loadedBackgroundZoneId === activeZone.id ? " world-map__stage--background-loaded" : ""}`}
            aria-label={`${activeZone.label} 지도`}
            data-zone={activeZone.id}
            data-render-quality={devicePerformance.mode}
            data-render-budget={renderBudget.ambientMotion}
            data-render-fps={renderBudget.targetFps}
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
              ambientMotion={renderBudget.ambientMotion}
              onLoadStateChange={handleBackgroundLoadStateChange}
            />
            <WorldCrowdHeatmap cells={crowdCells} />
            <WorldPathLayer paths={activeZone.paths} />
            <WorldGeometryAuditOverlay
              zone={activeZone}
              enabled={geometryAuditEnabled}
              layers={geometryAuditLayers}
              heatmapMode={geometryAuditHeatmapMode}
              previewRecommendations={activePatchPreviewRecommendations}
              recommendationDecisions={overlayRecommendationDecisions}
            />
            <WorldCelebrationCollectibles
              items={zoneCelebrationCollectibles}
              collectedIds={collectedCelebrationIds}
              player={position}
              guidedCollectibleId={guidedCollectibleId}
              onCollect={(item) => beginWorldInteraction({
                targetId: `collectible:${item.id}`,
                collectibleId: item.id,
                label: item.label,
                target: {
                  x: item.point.x - 10,
                  y: item.point.y - 10,
                  width: 20,
                  height: 20
                },
                actionRadius: 8
              })}
            />
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
                <defs>
                  <radialGradient id={journeyRouteFadeId}>
                    <stop offset="0%" stopColor="#000" />
                    <stop offset="32%" stopColor="#000" />
                    <stop offset="100%" stopColor="#fff" />
                  </radialGradient>
                  <mask
                    id={journeyRouteMaskId}
                    maskUnits="userSpaceOnUse"
                    x="0"
                    y="0"
                    width={activeZone.bounds.width}
                    height={activeZone.bounds.height}
                  >
                    <rect width={activeZone.bounds.width} height={activeZone.bounds.height} fill="#fff" />
                    <circle
                      className="world-journey-route__player-fade"
                      cx={journeyRouteStart?.x}
                      cy={journeyRouteStart?.y}
                      r="48"
                      fill={`url(#${journeyRouteFadeId})`}
                    />
                  </mask>
                </defs>
                <g className="world-journey-route__visuals" mask={`url(#${journeyRouteMaskId})`}>
                  {journeyRouteSegments.map((segment, index) => (
                    <g
                      key={`${segment.surface}-${index}`}
                      className="world-journey-route__segment"
                      data-surface={segment.surface}
                    >
                      <polyline
                        className="world-journey-route__outline"
                        points={svgRoutePoints(segment.points)}
                      />
                      <polyline
                        className="world-journey-route__path"
                        points={svgRoutePoints(segment.points)}
                      />
                    </g>
                  ))}
                  {journeyRouteTurnMarkers.map((turn, index) => (
                    <g
                      key={`${turn.point.x}-${turn.point.y}-${index}`}
                      className="world-journey-route__turn"
                      data-surface={turn.surface}
                      transform={`translate(${turn.point.x} ${turn.point.y}) rotate(${turn.rotation})`}
                    >
                      <circle r="8" />
                      <path d="M -4 0 H 3.5 M 0 -3.5 L 3.5 0 0 3.5" />
                    </g>
                  ))}
                  <circle
                    className="world-journey-route__destination"
                    data-surface={journeyRouteDestinationSurface}
                    cx={journeyRouteDestination?.x}
                    cy={journeyRouteDestination?.y}
                    r="9"
                  />
                </g>
              </svg>
            ) : null}
            {accessibleDestinationPoint && miniMapDestinationLabel && !destinationUsesWorldSpotCard ? (
              <WorldDestinationBeacon
                point={accessibleDestinationPoint}
                label={miniMapDestinationLabel}
                remainingTiles={accessibleDestinationRemainingTiles}
                kind={portalIntent ? "portal" : "destination"}
              />
            ) : null}
            {activeCompanion?.zoneId === activeZone.id ? (
              <svg
                className="world-companion-link"
                viewBox={`0 0 ${activeZone.bounds.width} ${activeZone.bounds.height}`}
                aria-hidden="true"
              >
                <line x1={position.x} y1={position.y} x2={activeCompanion.x} y2={activeCompanion.y} />
              </svg>
            ) : null}
            <WorldDecorationLayer zoneId={activeZone.id} decorations={activeZone.decorations} />
            {activeZone.id === "home" && worldSecretCollection.unlockedAchievementIds.includes("wedding-archivist") ? (
              <Suspense fallback={null}>
                <WorldSecretMemorial collection={worldSecretCollection} />
              </Suspense>
            ) : null}
            {activeWorldPropInteractions.map(({ decoration, interaction }) => (
              <WorldInteractiveProp
                key={`interaction:${decoration.id}`}
                decoration={decoration}
                interaction={interaction}
                active={interactionIntent?.decorationId === decoration.id}
                discovered={worldSecretCollection.discoveredIds.includes(interaction.secretId)}
                nearby={Math.hypot(
                  decoration.x + decoration.width / 2 - position.x,
                  decoration.y + decoration.height / 2 - position.y
                ) <= interaction.actionRadius + 90}
                clue={worldSecretCollection.discoveredIds.includes(interaction.secretId)
                  ? null
                  : resolveWorldSecretClue(interaction, decoration, position)}
                onSelect={() => {
                  setActiveJourneyGuideId(null);
                  setPendingJourneyGuideId(null);
                  beginWorldInteraction({
                    targetId: `decoration:${decoration.id}`,
                    decorationId: decoration.id,
                    label: decoration.label,
                    target: decoration,
                    actionRadius: interaction.actionRadius
                  });
                }}
              />
            ))}
            {activeZone.spots.map((worldSpot) => {
              const content = invitationContent.spots.find((candidate) => candidate.id === worldSpot.id);
              const proximity = resolveWorldSpotProximity(position, worldSpot);
              const overlayPlacement = placeWorldOverlayInsideViewport({
                rect: worldSpot,
                camera,
                viewport
              });
              return (
                <button
                  key={worldSpot.id}
                  type="button"
                  className={`world-spot world-spot--${worldSpot.id}${interactionIntent?.targetId === `spot:${worldSpot.id}` ? " world-spot--target" : ""}${recommendedCheckpoint?.zoneId === activeZone.id && recommendedCheckpoint.target.type === "spot" && recommendedCheckpoint.target.spotId === worldSpot.id ? " world-spot--recommended" : ""}`}
                  data-edge-shifted={overlayPlacement.shiftedEdges.join(" ") || undefined}
                  data-proximity={proximity}
                  data-label-visibility={worldLabelVisibility.get(`spot:${worldSpot.id}`)}
                  style={{ ...pixelRect(overlayPlacement.rect), zIndex: 9000 }}
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
                  <span className="world-spot__card">
                    <strong>{worldSpot.label}</strong>
                    <small>{content?.actionLabel ?? "보기"}</small>
                  </span>
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
              const congestion = portalCongestionById.get(portalItem.id)!;
              const waitEstimate = portalWaitById.get(portalItem.id)!;
              const targetEntry = portalIntent?.portal.id === portalItem.id
                ? portalIntent.path.at(-1)
                : null;
              const destinationZone = getWorldZone(gardenWorld, portalItem.to);

              return (
                <button
                  key={portalItem.id}
                  type="button"
                  className={`world-portal world-portal--${horizontal ? "horizontal" : "vertical"}${portalIntent?.portal.id === portalItem.id ? " world-portal--target" : ""}${journeyGuidance?.portalId === portalItem.id ? " world-portal--recommended" : ""}`}
                  aria-label={portalItem.label}
                  aria-describedby={`portal-accessibility-${portalItem.id}`}
                  data-congestion={congestion.level}
                  data-label-visibility={worldLabelVisibility.get(`portal:${portalItem.id}`)}
                  style={{
                    ...pixelRect(portalEntryRect(portalItem)),
                    zIndex: worldDepth(portalItem.approach.y) - 100
                  }}
                  onPointerEnter={() => setPreviewPortalId(portalItem.id)}
                  onPointerLeave={() => setPreviewPortalId((current) => current === portalItem.id ? null : current)}
                  onFocus={() => setPreviewPortalId(portalItem.id)}
                  onBlur={() => setPreviewPortalId((current) => current === portalItem.id ? null : current)}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewPortalId(portalItem.id);
                    setActiveJourneyGuideId(null);
                    setPendingJourneyGuideId(null);
                    handlePortalClick(portalItem);
                  }}
                >
                  <span id={`portal-accessibility-${portalItem.id}`} className="sr-only">
                    {worldPortalAccessibilityLabel(
                      portalItem,
                      destinationZone,
                      position,
                      `${congestion.label}, ${waitEstimate.label}`
                    )}
                  </span>
                  <span className="world-portal__effect" aria-hidden="true">
                    <span className="world-portal__tiles">
                      {congestion.entries.map((entry) => (
                        <span
                          key={`${entry.point.x}-${entry.point.y}`}
                          className="world-portal__tile"
                          data-occupied={entry.occupied || undefined}
                          data-recommended={Boolean(targetEntry && samePoint(targetEntry, entry.point)) || undefined}
                        />
                      ))}
                    </span>
                  </span>
                  <span className="world-portal__congestion" aria-hidden="true">
                    {congestion.label} {congestion.openCount}/{congestion.totalCount}
                  </span>
                  <span className="world-portal__wait">{waitEstimate.label}</span>
                  <span className="world-portal__label">{portalItem.label}</span>
                </button>
              );
            })}
            {visibleRemoteGuests.map((guest) => {
              const nameplate = remoteGuestNameplates.get(guest.guestId) ?? { x: 0, y: 0, crowded: false };
              return (
                <div
                  key={guest.guestId}
                  className="world-player player player--remote"
                  aria-label={guest.nickname}
                  data-nameplate-crowded={nameplate.crowded || undefined}
                  data-remote-motion="pixel-step-3"
                  style={{
                    left: guest.x,
                    top: guest.y,
                    zIndex: worldDepth(guest.y),
                    "--remote-name-offset-x": `${nameplate.x}px`,
                    "--remote-name-offset-y": `${nameplate.y}px`,
                    ...worldCharacterAnchorStyle(guest.appearance, window.devicePixelRatio)
                  } as CSSProperties}
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
                  <span className="world-player__name" title={guest.nickname}>{guest.nickname}</span>
                </div>
              );
            })}
            {activeZone.npcs.map((npc) => {
              const motion = npcMotionFor(activeZone, npc, npcMotions);
              return (
                <div
                  key={npc.id}
                  className="world-npc"
                  data-motion={motion.moving ? "walking" : motion.reaction}
                  data-label-visibility={worldLabelVisibility.get(`npc:${npc.id}`)}
                  data-label-guided={activeNpcDialogue?.npcId === npc.id || interactionIntent?.targetId === `npc:${npc.id}` || (
                    recommendedCheckpoint?.zoneId === activeZone.id
                    && recommendedCheckpoint.target.type === "npc"
                    && recommendedCheckpoint.target.npcId === npc.id
                  ) || undefined}
                  style={{
                    left: motion.point.x,
                    top: motion.point.y,
                    zIndex: activeNpcDialogue?.npcId === npc.id ? 9100 : worldDepth(motion.point.y)
                  }}
                >
                  {activeNpcDialogue?.npcId === npc.id ? (
                    <NpcDialogueBubble
                      dialogue={activeNpcDialogue}
                      speaker={npc.label}
                      onClose={closeNpcDialogue}
                      onOpenProfile={openNpcProfile}
                      onChoose={chooseNpcDialogue}
                      placement={npcDialoguePlacement}
                    />
                  ) : null}
                  <WeddingNpc
                    id={npc.id}
                    label={npc.label}
                    direction={motion.direction}
                    moving={motion.moving}
                    stepFrame={motion.stepFrame}
                    reaction={motion.reaction}
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
                        target: npcInteractionRect(motion.point),
                        actionRadius: npcInteractionRadius,
                        npcId: npc.id
                      });
                    }}
                  />
                </div>
              );
            })}
            <WorldLocalPlayer
              appearance={profile.appearance}
              nickname={profile.nickname}
              motionStore={motionStore}
              activeZoneId={activeZone.id}
              reaction={localReaction}
            />
          </div>

          {activeWorldPropMomentEntry ? (
            <WorldPropMoment
              decoration={activeWorldPropMomentEntry.decoration}
              interaction={activeWorldPropMomentEntry.interaction}
              isNewSecret={activePropMoment?.isNewSecret}
              achievementLabel={activePropMoment?.achievementLabel}
            />
          ) : null}

          <CelebrationCollectionProgress
            collectedCount={collectedCelebrationIds.length}
            totalCount={totalCelebrationCollectibles}
            onOpenGuide={() => {
              void loadCelebrationCollectionGuideComponent();
              pauseWorldInput();
              setCollectionGuideOpen(true);
            }}
          />

          {cooperativeCelebration ? (
            <WorldCooperativeCelebration
              participantNames={cooperativeCelebration.participantNames}
              tier={cooperativeCelebration.tier}
              onOpenGroupPhoto={() => {
                setCooperativePhotoGuestIds(cooperativeCelebration.participantIds);
                openPhotoSpot("ceremony-aisle");
              }}
            />
          ) : null}

          <WorldMiniMap
            zone={activeZone}
            player={position}
            direction={direction}
            camera={camera}
            viewport={viewport}
            targetPortalId={portalIntent?.portal.id ?? journeyGuidance?.portalId ?? null}
            journeyMarkers={activeJourneyMarkers}
            destinationLabel={miniMapDestinationLabel}
            destinationPoint={journeyGuidance?.destinationPoint ?? null}
            routeActive={miniMapRouteActive}
            routeContinuing={Boolean(pendingJourneyGuideId)}
            routeKind={miniMapRouteKind}
            routePoints={miniMapRoutePoints}
            routeProgressLabel={miniMapRouteProgressLabel}
            routeNotice={routeRecalculationNotice}
            journeyStops={miniMapJourneyStops}
            journeyDestinationLabels={miniMapJourneyDestinationLabels}
            collectibleMarkers={miniMapCollectibleMarkers}
            relationshipStampMarkers={miniMapRelationshipStampMarkers}
            companionTrailPoints={activeCompanion?.zoneId === activeZone.id ? companionTrailPoints : []}
            rendezvousPoint={companionRendezvous?.zoneId === activeZone.id ? companionRendezvous.point : null}
            onNavigateAccessibilityLandmark={navigateToAccessibilityLandmark}
            onNavigateRelationshipStamp={(marker) => navigateToRelationshipStamp(marker.npcId, marker.label)}
          />

          {contextActionVisible && contextHudAction ? (
            <WorldContextAction action={contextHudAction} onActivate={activateContextHudAction} />
          ) : null}

          <CompanionDock
            candidates={sameZoneCompanionCandidates}
            activeGuestId={companionGuestId}
            activeNickname={activeCompanion?.nickname ?? companionNickname}
            pendingGuestId={pendingCompanionGuestId}
            role={companionRole}
            sharedDestinationLabel={sharedCompanionDestination
              ? getWorldZone(gardenWorld, sharedCompanionDestination.destinationZoneId).label
              : null}
            waitingAtPortal={Boolean(sharedPortalWait)}
            recentPing={recentCompanionPing}
            destinationRequested={companionDestinationRequested}
            rejoinZoneId={companionRejoinZoneId}
            rejoinZoneLabel={companionRejoinZoneId
              ? getWorldZone(gardenWorld, companionRejoinZoneId).label
              : null}
            onPing={sendCompanionPing}
            onRequestDestination={companionRole === "follower"
              ? requestCompanionDestination
              : undefined}
            onAcceptDestinationRequest={companionRole === "leader" ? () => {
              void loadCompanionDestinationSheetComponent();
              pauseWorldInput();
              setCompanionDestinationRequested(false);
              setCompanionDestinationOpen(true);
            } : undefined}
            onRejoin={companionRejoinZoneId ? guideToCompanionZone : undefined}
            onOpenDestination={companionRole === "leader" ? () => {
              void loadCompanionDestinationSheetComponent();
              pauseWorldInput();
              setCompanionDestinationOpen(true);
            } : undefined}
            onInvite={(guestId) => {
              pauseWorldInput();
              setPendingJourneyGuideId(null);
              setActiveJourneyGuideId(null);
              inviteCompanion(guestId);
            }}
            onStop={() => {
              pauseWorldInput();
              stopCompanion();
            }}
            onOpenWaitingRoom={openCompanionWaitingRoom}
            shareStatus={companionShareStatus}
            rendezvousLabel={companionRendezvous?.zoneId === activeZone.id
              ? `${activeZone.label} · 함께 이동할 합류 타일`
              : null}
            rendezvousPending={Boolean(outgoingRendezvousProposal)}
            rendezvousProposalNickname={incomingRendezvousProposal?.nickname ?? null}
            onReserveRendezvous={activeCompanion?.zoneId === activeZone.id
              ? reserveCompanionRendezvous
              : undefined}
            onCancelRendezvous={cancelCompanionRendezvous}
            onAcceptRendezvous={incomingRendezvousProposal
              ? () => replyToRendezvousProposal(true)
              : undefined}
            onDeclineRendezvous={incomingRendezvousProposal
              ? () => replyToRendezvousProposal(false)
              : undefined}
          />

          {incomingCompanionInvite ? (
            <CompanionInvitationPrompt
              nickname={incomingCompanionInvite.requesterNickname}
              onAccept={() => replyToCompanionInvite(true)}
              onDecline={() => replyToCompanionInvite(false)}
            />
          ) : null}

          {viewPreferences.stepFreeRouteEnabled && destinationCheckpoint ? (
            <AccessibleDestinationCue
              checkpoint={destinationCheckpoint}
              onOpen={() => {
                void loadJourneyRouteSheetComponent();
                pauseWorldInput();
                setJourneyRoutePreference("step-free");
                setJourneyRouteOpen(true);
              }}
            />
          ) : null}

          {previewPortal && previewPortalDestination ? (
            <PortalDestinationPreview
              portal={previewPortal}
              destinationZone={previewPortalDestination}
              congestion={previewPortalCongestion}
              waitEstimate={previewPortalWait}
              firstVisit={previewPortalFirstVisit}
              visitCount={previewPortalVisitCount}
              recentDestinations={recentTravelDestinations}
            />
          ) : null}

          {activeRouteArrivalCue ? (
            <div
              className="world-route-arrival-cue"
              data-remaining={activeRouteArrivalCue.remainingTiles}
              role="status"
              aria-live="polite"
            >
              <span>{activeRouteArrivalCue.eyebrow}</span>
              <strong>{activeRouteArrivalCue.message}</strong>
            </div>
          ) : null}

          {routeArrivalNotice ? (
            <div className="world-route-arrival-card" data-kind={routeArrivalNotice.kind} role="status">
              <MapPinned aria-hidden="true" />
              <span><strong>{routeArrivalNotice.title}</strong><small>{routeArrivalNotice.detail}</small></span>
              <ArrowRight aria-hidden="true" />
            </div>
          ) : null}

          {arrivalAction && !activeNpcDialogue ? (
            <JourneyNextActionCard
              action={arrivalAction}
              disabled={Boolean(portalTransition)}
              onDismiss={() => setArrivalAction(null)}
              onContinue={() => {
                const checkpoint = journeyCheckpoints.find(({ id }) => id === arrivalAction.nextCheckpointId);
                if (!checkpoint) return;
                setArrivalAction(null);
                startJourneyGuidance(checkpoint);
              }}
            />
          ) : null}

          <div className="world-control-dock" onClick={(event) => event.stopPropagation()}>
            <VirtualJoystick
              disabled={Boolean(portalTransition) || inputReleaseRequired}
              side={viewPreferences.joystickSide}
              onVectorChange={handleJoystickVectorChange}
            />
            <WeddingDayQuickAccess
              variant="world"
              preview={weddingDayPreview}
              open={weddingDaySheetOpen}
              showTrigger={false}
              onOpenChange={handleWeddingDaySheetOpenChange}
              onFamilyContactOpen={openFamilyContacts}
            />
            <GameQuickDock
              disabled={Boolean(portalTransition)}
              menuOpen={menuOpen}
              menuButtonRef={menuButtonRef}
              onPause={pauseWorldInput}
              onReact={handleGuestReaction}
              onGuestInformationOpenChange={handleGuestInformationOpenChange}
              onOpenJourney={() => setHudToolsOpen(true)}
              onOpenMenu={openMenu}
              onSettingsOpenChange={setQuickDockSettingsOpen}
              settingsOpen={quickDockSettingsOpen}
              showSettingsTrigger={false}
              contextActive={contextActionVisible && contextHudAction?.kind !== "quest"}
              moving={moving || directTravelActive}
              routeActive={Boolean(activeJourneyGuideId || pendingJourneyGuideId)}
            />
          </div>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="world-menu-backdrop"
            aria-hidden="true"
            tabIndex={-1}
            style={{ zIndex: nestedMenuSheetOpen ? 8 : undefined }}
            onClick={closeMenu}
          />
          <section
            ref={menuDialogRef}
            className="world-menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="world-menu-title"
            aria-describedby="world-menu-description"
            aria-hidden={nestedMenuSheetOpen || undefined}
            tabIndex={-1}
            style={{ zIndex: nestedMenuSheetOpen ? 9 : undefined }}
            onClickCapture={(event) => {
              if (event.target instanceof Element) {
                event.target.closest<HTMLButtonElement>("button")?.focus();
              }
            }}
          >
            <header className="world-menu-sheet__header">
              <div><span>WEDDING MENU</span><h2 ref={menuTitleRef} id="world-menu-title" tabIndex={-1}>초대장 바로가기</h2></div>
              <button ref={menuCloseButtonRef} type="button" aria-label="초대장 메뉴 닫기" onClick={closeMenu}>×</button>
            </header>
            <p id="world-menu-description" className="sr-only">예식 정보와 자주 찾는 초대장 항목을 순서대로 확인할 수 있습니다.</p>
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
                    const sync = saveGameViewLocation(activeZone.id, activeJourneyGuideId);
                    window.location.hash = sync.sectionId;
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
        <Suspense fallback={<GameFeatureLoading label="기념 촬영" />}>
          <WeddingPhotoBooth
            spot={gardenWorld.zones.flatMap((zone) => zone.photoSpots).find((photoSpot) => photoSpot.id === activePhotoSpotId)!}
            nickname={profile.nickname}
            appearance={profile.appearance}
            companions={boothCompanions}
            celebrationFrameUnlocked={celebrationReward.unlocked}
            weddingDayFrameAvailable={weddingDayFrameAvailable}
            celebrationCosmetic={equippedCelebrationCosmetic}
            celebrationTone={equippedCelebrationTone}
            onClose={() => {
              setActivePhotoSpotId(null);
              setCooperativePhotoGuestIds([]);
            }}
            onCaptured={(memory: WeddingPhotoMemory) => {
              setPhotoAlbum(loadWeddingPhotoAlbum());
              setTravelStatus(`${memory.spotLabel} 기념 촬영 완료`);
            }}
          />
        </Suspense>
      ) : null}
      {photoAlbumOpen ? (
        <Suspense fallback={<GameFeatureLoading label="포토앨범" />}>
          <WeddingPhotoAlbum
            album={photoAlbum}
            nickname={profile.nickname}
            onClose={() => setPhotoAlbumOpen(false)}
            onRetake={(photoSpotId) => {
              void loadWeddingPhotoBoothComponent();
              setPhotoAlbumOpen(false);
              setMenuOpen(false);
              setActivePhotoSpotId(photoSpotId);
            }}
          />
        </Suspense>
      ) : null}
      {gameMemoryAlbumOpen ? (
        <Suspense fallback={<GameFeatureLoading label="게임 추억" />}>
          <GameMemoryAlbum
            album={gameMemoryAlbum}
            photoAlbum={photoAlbum}
            collectedCount={celebrationReward.collectedCount}
            totalCollectibles={celebrationReward.totalCount}
            rewardUnlocked={celebrationReward.unlocked}
            nickname={profile.nickname}
            onClose={() => setGameMemoryAlbumOpen(false)}
            onOpenPhotoAlbum={() => {
              void loadWeddingPhotoAlbumComponent();
              setGameMemoryAlbumOpen(false);
              setPhotoAlbumOpen(true);
            }}
          />
        </Suspense>
      ) : null}
      {collectionGuideOpen ? (
        <Suspense fallback={<GameFeatureLoading label="수집 지도" />}>
          <CelebrationCollectionGuide
            items={celebrationCollectibles}
            collectedIds={collectedCelebrationIds}
            currentZoneId={activeZone.id}
            guidedItemId={guidedCollectibleId}
            equippedCosmetic={equippedCelebrationCosmetic}
            equippedTone={equippedCelebrationTone}
            appearance={profile.appearance}
            onChangeTone={(tone) => {
              saveCelebrationCosmeticTone(tone);
              setEquippedCelebrationTone(tone);
              setTravelStatus("캐릭터 장식 색상을 바꿨어요");
            }}
            onEquipCosmetic={(cosmeticId) => {
              const reward = celebrationKindRewardProgress(collectedCelebrationIds, celebrationCollectibles)
                .find((candidate) => candidate.cosmeticId === cosmeticId);
              const setReward = celebrationSetRewardProgress(collectedCelebrationIds, celebrationCollectibles);
              if (
                cosmeticId !== "none"
                && !reward?.unlocked
                && !(cosmeticId === setReward.cosmeticId && setReward.unlocked)
              ) return;
              saveCelebrationCosmetic(cosmeticId);
              setEquippedCelebrationCosmetic(cosmeticId);
              setTravelStatus(cosmeticId === "none"
                ? "캐릭터 장식을 해제했어요"
                : `${reward?.label ?? setReward.label}을 착용했어요`);
            }}
            onGuide={guideToCelebrationItem}
            onClose={() => setCollectionGuideOpen(false)}
          />
        </Suspense>
      ) : null}
      {companionDestinationOpen && activeCompanion ? (
        <Suspense fallback={<GameFeatureLoading label="동행 목적지" />}>
          <CompanionDestinationSheet
            companionName={activeCompanion.nickname}
            portals={activeZone.portals}
            onSelect={chooseSharedCompanionDestination}
            onClose={() => setCompanionDestinationOpen(false)}
          />
        </Suspense>
      ) : null}
      {companionWaitingRoomOpen && companionInviteDraft ? (
        <Suspense fallback={<GameFeatureLoading label="동행 초대" />}>
          <CompanionWaitingRoom
            inviteUrl={companionInviteDraft.url}
            expiresAt={companionInviteDraft.expiresAt}
            zoneLabel={getWorldZone(gardenWorld, companionInviteDraft.zoneId).label}
            nickname={profile.nickname}
            status={companionGuestId ? "connected" : pendingCompanionGuestId ? "requested" : "waiting"}
            companionNickname={activeCompanion?.nickname ?? companionNickname}
            inviteCode={companionInviteDraft.inviteCode}
            connectedCount={1 + remoteGuests.filter(({ zoneId }) => zoneId === activeZone.id).length}
            canceled={companionInviteDraft.canceled}
            used={companionInviteDraft.used}
            connectionState={companionGuestId ? activeCompanion ? "connected" : "reconnecting" : "waiting"}
            companionLocationLabel={companionArrival.locationLabel}
            companionArrivalLabel={companionArrival.etaLabel}
            onCopy={copyCompanionInvite}
            onShare={shareCompanionInvite}
            onRenew={renewCompanionInvite}
            onCancel={cancelCompanionInvite}
            onClose={() => setCompanionWaitingRoomOpen(false)}
          />
        </Suspense>
      ) : null}
      {celebrationMilestones[0] && !celebrationRewardOpen ? (
        <CelebrationMilestoneNotice
          milestone={celebrationMilestones[0]}
          onClose={() => setCelebrationMilestones((current) => current.slice(1))}
        />
      ) : null}
      {celebrationRewardOpen ? (
        <CelebrationRewardNotice onClose={() => setCelebrationRewardOpen(false)} />
      ) : null}
      {gameGuideVisible ? <GameFirstVisitGuide onDismiss={dismissGameGuide} /> : null}
      {journeyRouteOpen && recommendedCheckpoint ? (
        <Suspense fallback={<GameFeatureLoading label="여정 경로" />}>
          <JourneyRouteSheet
          activeZone={activeZone}
          checkpoint={recommendedCheckpoint}
          progress={journeyProgress}
          guidance={journeyGuidance}
          waypoints={remainingWaypoints}
          selectedWaypointIds={plannedCheckpointIds}
          onToggleWaypoint={(checkpointId) => {
            setJourneyRoutePreference("custom");
            setPlannedCheckpointIds((current) => (
              toggleJourneyWaypoint(journeyProgress, current, checkpointId)
            ));
          }}
          onMoveWaypoint={(checkpointId, moveDirection) => {
            setJourneyRoutePreference("custom");
            setPlannedCheckpointIds((current) => (
              moveJourneyWaypoint(journeyProgress, current, checkpointId, moveDirection)
            ));
          }}
          onOptimizeWaypoints={() => {
            setJourneyRoutePreference("shortest");
            setStepFreeRouteEnabled(false);
            setPlannedCheckpointIds(journeyRouteComparison.shortestIds);
          }}
          estimatedTotalLabel={journeyPlanEstimate?.label}
          estimatedTileCount={journeyPlanEstimate?.tileSteps}
          estimatedPortalCount={journeyPlanEstimate?.zoneTransitions}
          stepFreeRouteEnabled={viewPreferences.stepFreeRouteEnabled}
          onStepFreeRouteChange={(enabled) => {
            setStepFreeRouteEnabled(enabled);
            setJourneyRoutePreference(enabled ? "step-free" : "custom");
          }}
          routePreference={journeyRoutePreference}
          routeComparisonOptions={journeyRouteComparison.options}
          onRoutePreferenceChange={(preference) => {
            setJourneyRoutePreference(preference);
            setStepFreeRouteEnabled(preference === "step-free");
            setPlannedCheckpointIds(preference === "shortest"
              ? journeyRouteComparison.shortestIds
              : journeyRouteComparison.recommendedIds);
          }}
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
        </Suspense>
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
          onClose={() => {
            setJourneyCompletionOpen(false);
            setHudToolsOpen(false);
          }}
          onOpenRsvp={() => {
            setJourneyCompletionOpen(false);
            setHudToolsOpen(false);
            openSpot("rsvp");
          }}
          onOpenShare={() => {
            setJourneyCompletionOpen(false);
            setHudToolsOpen(false);
            pauseWorldInput();
            setShareSheetOpen(true);
          }}
          onOpenPhotoAlbum={() => {
            setJourneyCompletionOpen(false);
            setHudToolsOpen(false);
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
