export type GameScreenState = 'TITLE' | 'PLAYING' | 'PAUSED' | 'BUSTED' | 'MISSION_COMPLETE';

export type CameraMode = 'CHASE' | 'HOOD' | 'TOP_DOWN';

export type WeatherMode = 'CLEAR' | 'SUNSET' | 'NIGHT';

export type VehicleType = 'SPORTS' | 'SEDAN' | 'SUV' | 'POLICE' | 'TAXI';

export type NPCRole = 'CIVILIAN' | 'JOGGER' | 'BUSINESS' | 'TOURIST' | 'OFFICER' | 'VENDOR' | 'MECHANIC';

export type NPCBehaviorState =
  | 'SCHEDULE_COMMUTE'
  | 'WAITING_SIGNAL'
  | 'AT_DESTINATION'
  | 'SOCIALIZING'
  | 'DODGING_CAR'
  | 'CONVERSING_PLAYER'
  | 'FLEEING'
  | 'COMBAT'
  | 'RAGDOLL';

export type SchedulePhase = 'MORNING_COMMUTE' | 'WORK_SHIFT' | 'EVENING_SOCIAL' | 'NIGHT_REST';

export interface NPCDailyAnchor {
  label: string;
  x: number;
  z: number;
}

export interface NPCRelationshipLink {
  targetNpcId: number;
  targetName: string;
  affinity: number;
  relationLabel: 'Best Friend' | 'Colleague' | 'Rival' | 'Neighbor';
}

export interface ActiveNPCDialogueOption {
  id: 'CHAT' | 'HELP_OBJECTIVE' | 'TRADE_DEAL' | 'PROVOKE' | 'LEAVE';
  label: string;
  subtitle: string;
}

export interface ActiveNPCInteraction {
  npcId: number;
  name: string;
  role: NPCRole;
  schedulePhase: SchedulePhase;
  currentActivity: string;
  personalObjective: string;
  objectiveCompleted: boolean;
  playerTrust: number;
  moodLabel: string;
  dialogueLine: string;
  relationships: NPCRelationshipLink[];
  options: ActiveNPCDialogueOption[];
}

export interface AmbientSpeechBubble {
  id: number;
  speakerName: string;
  text: string;
  screenX: number; // 0 to 100 percentage
  screenY: number; // 0 to 100 percentage
  mood: 'NEUTRAL' | 'FRIENDLY' | 'ALARMED';
}

export type SkillBranchId = 'DRIVING' | 'COMBAT' | 'SYNDICATE';

export interface SkillNodeDef {
  id: string;
  branch: SkillBranchId;
  tier: 1 | 2 | 3 | 4;
  name: string;
  type: 'PASSIVE' | 'ACTIVE';
  cost: number;
  description: string;
  effectSummary: string;
  prerequisiteId?: string;
}

export interface PlayerProgressionSnapshot {
  level: number;
  xp: number;
  nextLevelXp: number;
  skillPoints: number;
  unlockedSkillIds: string[];
  branchXp: Record<SkillBranchId, number>;
  scrapParts: number;
  craftedMedkits: number;
  craftedArmorPlates: number;
  activeCooldowns: {
    nitroReady: boolean;
    nitroCooldown: number;
    bribeReady: boolean;
    bribeCooldown: number;
    shockwaveReady: boolean;
    shockwaveCooldown: number;
  };
}

export type ProceduralPOIType =
  | 'STREET_MARKET'
  | 'SALVAGE_DROP'
  | 'TIME_TRIAL_RING'
  | 'SYNDICATE_STASH'
  | 'CITIZEN_DISPUTE';

export interface ProceduralPOIInfo {
  id: string;
  seed: number;
  type: ProceduralPOIType;
  title: string;
  subtitle: string;
  x: number;
  z: number;
  rewardCash: number;
  rewardXp: number;
  rewardScrap: number;
  discovered: boolean;
  completed: boolean;
  activeTimer?: number;
}

export interface MinimapBlip {
  x: number;
  z: number;
  type:
    | 'PLAYER'
    | 'VEHICLE'
    | 'POLICE'
    | 'OBJECTIVE'
    | 'NPC_HOSTILE'
    | 'NPC_FRIEND'
    | 'POI'
    | 'CUSTOMS';
  rotation?: number;
}

export interface MissionState {
  id: number;
  title: string;
  description: string;
  targetX: number;
  targetZ: number;
  reward: number;
  completedCount: number;
}

export interface HudSnapshot {
  screen: GameScreenState;
  health: number;
  maxHealth: number;
  armor: number;
  cash: number;
  wantedLevel: number;
  wantedCooldownProgress: number;
  speedKmh: number;
  inVehicle: boolean;
  vehicleName: string;
  vehicleHealth: number;
  districtName: string;
  timeOfDayHours: number;
  weather: WeatherMode;
  cameraMode: CameraMode;
  trafficDensity: number;
  activeNPCsCount: number;
  activeVehiclesCount: number;
  policeUnitsCount: number;
  nearInteractableVehicle: string | null;
  nearInteractableNPC: { id: number; name: string; role: NPCRole; trust: number } | null;
  nearInteractablePOI: ProceduralPOIInfo | null;
  activeNPCInteraction: ActiveNPCInteraction | null;
  ambientBarks: AmbientSpeechBubble[];
  progression: PlayerProgressionSnapshot;
  activePOIs: ProceduralPOIInfo[];
  worldSeed: number;
  mission: MissionState;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  isSprinting: boolean;
  radioStation: string;
  blips: MinimapBlip[];
  muted: boolean;
  notification: string | null;
}
