import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  ActiveNPCDialogueOption,
  ActiveNPCInteraction,
  AmbientSpeechBubble,
  CameraMode,
  GameScreenState,
  HudSnapshot,
  MinimapBlip,
  MissionState,
  NPCBehaviorState,
  NPCRole,
  SkillBranchId,
  VehicleType,
  WeatherMode,
} from './types';
import {
  createAsphaltNormalTexture,
  createBuildingFacadeMaps,
  createRadialShadowTexture,
  createRoadIntersectionTexture,
  createSidewalkTexture,
  createSkyGradientTexture,
  createStraightRoadTexture,
  createWaterNormalTexture,
  detectSoftwareWebGL,
} from './materials';
import {
  buildCharacterModel,
  buildPalmTreeModel,
  buildStreetLampAssembly,
  buildTrafficLightAssembly,
  buildVehicleModel,
  CharacterRig,
  poseCharacterRig,
  VehicleRig,
} from './models';
import { soundEngine } from './audio';
import { SKILL_TREE_CATALOG, xpForLevel } from './progression';
import {
  buildContextualDialogue,
  buildNaturalChatReply,
  generateNPCProfiles,
  getMoodLabel,
  getSchedulePhaseForHour,
  RichNPCProfile,
} from './npcSystem';
import { generateProceduralPOIs, LivePOIEntity } from './proceduralWorld';

const GRID_INDICES = [-2, -1, 0, 1, 2];
const BLOCK_PITCH = 56;
const ROAD_WIDTH = 14;
const DRIVABLE_HALF_WIDTH = 5.72; // Strict asphalt lane boundary (keeps 100% of tires off 7.0m curbs!)
const MAX_ROAD_EXTENT = 2 * BLOCK_PITCH + DRIVABLE_HALF_WIDTH; // 117.72m outer highway guardrail
const SIDEWALK_OFFSET = 8.8;
const WORLD_LIMIT = 152;

type CardinalDir = 'N' | 'S' | 'E' | 'W';
type DriverArchetype = 'COMMUTER' | 'FREEROAM_RACER' | 'CAUTIOUS' | 'POLICE';

const DIR_HEADING: Record<CardinalDir, number> = {
  S: 0, // +Z
  E: Math.PI / 2, // +X
  N: Math.PI, // -Z
  W: -Math.PI / 2, // -X
};

const DIR_DELTA: Record<CardinalDir, { dix: number; diz: number; fx: number; fz: number }> = {
  S: { dix: 0, diz: 1, fx: 0, fz: 1 },
  N: { dix: 0, diz: -1, fx: 0, fz: -1 },
  E: { dix: 1, diz: 0, fx: 1, fz: 0 },
  W: { dix: -1, diz: 0, fx: -1, fz: 0 },
};

const TURN_LEFT_MAP: Record<CardinalDir, CardinalDir> = {
  N: 'W',
  W: 'S',
  S: 'E',
  E: 'N',
};

const TURN_RIGHT_MAP: Record<CardinalDir, CardinalDir> = {
  N: 'E',
  E: 'S',
  S: 'W',
  W: 'N',
};

const TURN_UTURN_MAP: Record<CardinalDir, CardinalDir> = {
  N: 'S',
  S: 'N',
  E: 'W',
  W: 'E',
};

interface AABBCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface SimVehicle {
  id: number;
  type: VehicleType;
  name: string;
  driverStyle: DriverArchetype;
  hasDriver: boolean;
  rig: VehicleRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  health: number;
  isPlayerDriven: boolean;
  // Road-Network Graph Navigation & Autonomous Turning State
  travelDir: CardinalDir;
  roadLineIndex: number; // Grid index (-2..2) of the road centerline currently followed
  nextInterIx: number;
  nextInterIz: number;
  laneOffset: number; // +3.2 = standard right-hand lane; shifts dynamically to pass/evade
  targetLaneOffset: number;
  plannedOutDir: CardinalDir | null;
  blinkerSide: -1 | 0 | 1; // -1 = left turn blinker, +1 = right turn blinker
  inTurnArc: boolean;
  turnProgress: number;
  turnLength: number;
  turnStartX: number;
  turnStartZ: number;
  turnCtrlX: number;
  turnCtrlZ: number;
  turnEndX: number;
  turnEndZ: number;
  steerAngle: number;
  evadeTimer: number;
  honkCooldown: number;
  sirenTimer: number;
}

interface SimNPC {
  id: number;
  role: NPCRole;
  profile: RichNPCProfile;
  state: NPCBehaviorState;
  rig: CharacterRig;
  x: number;
  z: number;
  heading: number;
  walkCycle: number;
  idleSeed: number;
  health: number;
  cashCarry: number;
  stateTimer: number;
  attackCooldown: number;
  usesPhoneHabit: boolean;
  barkText: string | null;
  barkTimer: number;
  barkMood: 'NEUTRAL' | 'FRIENDLY' | 'ALARMED';
  barkCooldown: number;
}

interface CashPickup {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  amount: number;
  age: number;
}

interface ParticleBurst {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ShotTracer {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

const RADIO_STATIONS = [
  'Radio Off',
  'West Coast Synth FM',
  'Vinewood Bassline',
  'Solis Chill FM',
] as const;

const CUSTOMS_ROAD_X = 56;
const CUSTOMS_ROAD_Z = -26;
const CUSTOMS_RESPRAY_COLORS = [
  0xef4444, 0x06b6d4, 0xf59e0b, 0xa855f7, 0x10b981, 0xec4899, 0x3b82f6, 0xf8fafc,
];

const MISSIONS: Omit<MissionState, 'completedCount'>[] = [
  {
    id: 1,
    title: 'Sunset Pier Drop-Off',
    description: 'Drive along the road to the Vespucci Coastal Intersection Beacon.',
    targetX: -112,
    targetZ: 56,
    reward: 1500,
  },
  {
    id: 2,
    title: 'Downtown Financial Courier',
    description: 'Cruise down the Midtown avenue to the Solis Tower road checkpoint.',
    targetX: 0,
    targetZ: -56,
    reward: 2200,
  },
  {
    id: 3,
    title: 'Vinewood Boulevard Rendezvous',
    description: 'Deliver the package at the northern Vinewood Blvd intersection.',
    targetX: 56,
    targetZ: -112,
    reward: 2800,
  },
  {
    id: 4,
    title: 'Harbor Highway Run',
    description: 'Make the drop at Southport Corner while shaking LSPD cruisers.',
    targetX: 112,
    targetZ: 112,
    reward: 3500,
  },
];

const AMBIENT_CHATTER_BY_ROLE: Record<NPCRole, string[]> = {
  BUSINESS: [
    'Man, Midtown traffic is wild today—everybody’s in a rush.',
    'Tell the client I’m five minutes away, just crossing the avenue now.',
    'Definitely grabbing an iced espresso on Vinewood after this meeting.',
    'Did you hear that twin-turbo coupe rip down the block just now?',
  ],
  VENDOR: [
    'Yo, fresh Marina stock right here—best prices in San Solis!',
    'Come check it out before sunset, everything’s moving fast today!',
    'Gotta love this weather—whole neighborhood’s out on the street.',
  ],
  MECHANIC: [
    'Hear the exhaust note on that sports car? Pure twin-scroll perfection.',
    'Still hunting two clean salvage parts to finish this build.',
    'Drivers out here take corners like they’re qualifying for a race!',
  ],
  JOGGER: [
    'Five kilometers down, ocean breeze off Vespucci feels amazing!',
    'Gotta watch the crosswalks—these street racers barely lift off the gas.',
    'Best cardio route on the whole coast right here!',
  ],
  TOURIST: [
    'Whoa, look at the palm trees and Downtown towers from here!',
    'Hold up, let me snap a picture of that custom ride cruising past!',
    'San Solis is ten times livelier than the videos online!',
  ],
  CIVILIAN: [
    'Honestly, nothing beats an afternoon walk around Central Plaza.',
    'Texting Elena right now—we’re meeting up by the boardwalk later.',
    'Did you see how fast that coupe drifted around the corner?!',
    'Hey, watch your step at the curb when the light turns green.',
  ],
  OFFICER: [
    'Dispatch, Unit 14 on foot beat—traffic’s flowing steady on the avenues.',
    'Keep those wheels on the asphalt, folks—let’s keep the crosswalks safe.',
    'Eyes open for high-speed street racers cutting lanes near Midtown.',
  ],
};

const DODGE_BARKS = [
  'Whoa!! Watch where you’re steering, maniac!',
  'Hey! Keep your eyes on the road, pal!',
  'Are you out of your mind?! You nearly clipped me!',
  'Jesus! Learn how to drive before you hurt somebody!',
];

const CARJACK_BARKS = [
  'Hey!! What are you doing?! That’s my car!!',
  'Whoa, chill chill! Take the keys, don’t hurt me!',
  'Somebody call the cops! They just jacked my ride right on the street!',
  'Oh hell no—nobody steals my whip and gets away with it!',
];

const SOCIAL_PAIR_REPLIES = [
  'For real! Let’s grab food by Vespucci later tonight.',
  'Haha no way, you’re kidding me! Tell me the rest on the walk.',
  'Totally agree—catch up with you after this shift!',
];

const ALLY_GREETINGS = [
  'Yo, good seeing you out here! Respect!',
  'What’s good, partner! Whole block’s got love for you.',
  'Holler anytime you need a hand on this street!',
];

const _camTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();

function snapCoordToSidewalk(val: number): number {
  let nearestRoad = 0;
  let minD = Infinity;
  for (const idx of GRID_INDICES) {
    const r = idx * BLOCK_PITCH;
    const d = Math.abs(val - r);
    if (d < minD) {
      minD = d;
      nearestRoad = r;
    }
  }
  return val >= nearestRoad ? nearestRoad + SIDEWALK_OFFSET : nearestRoad - SIDEWALK_OFFSET;
}

function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

export class CitySimulationEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean = false;
  private disposed: boolean = false;
  private frameId: number = 0;
  private lastTime: number = 0;
  private elapsedSeconds: number = 0;

  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private fog!: THREE.FogExp2;
  private skyDomeMat!: THREE.MeshBasicMaterial;
  private sunOrbMesh!: THREE.Mesh;
  private sunOrbMat!: THREE.MeshBasicMaterial;
  private waterNormalTex: THREE.CanvasTexture | null = null;
  private surfFoamMesh: THREE.Mesh | null = null;
  private buildingMaterials: THREE.MeshStandardMaterial[] = [];
  private customsRingMesh: THREE.Mesh | null = null;
  private streetLampBulbMat!: THREE.MeshBasicMaterial;
  private timeOfDay: number = 15.5;
  private weather: WeatherMode = 'CLEAR';

  private trafficPhaseTimer: number = 0;
  private nsGreen: boolean = true;
  private trafficBulbs: { nsBulb: THREE.MeshBasicMaterial; ewBulb: THREE.MeshBasicMaterial }[] = [];

  private buildingColliders: AABBCollider[] = [];
  private vehicles: SimVehicle[] = [];
  private npcs: SimNPC[] = [];
  private cashPickups: CashPickup[] = [];
  private particles: ParticleBurst[] = [];
  private shotTracers: ShotTracer[] = [];
  private shadowTex!: THREE.CanvasTexture;
  private worldSeed: number = 40921;
  private poiEntities: LivePOIEntity[] = [];

  private conversingNpcId: number | null = null;
  private chatTurnCounter: number = 0;
  private targetHighlightRing!: THREE.Mesh;

  private missionBeaconGroup!: THREE.Group;
  private missionRingMesh!: THREE.Mesh;
  private missionIndex: number = 0;
  private completedMissions: number = 0;

  private playerRig!: CharacterRig;
  private playerX: number = 9.2;
  private playerZ: number = 12;
  private playerHeading: number = 0;
  private playerWalkCycle: number = 0;
  private playerSpeed: number = 0;
  private playerHealth: number = 100;
  private playerMaxHealth: number = 100;
  private playerArmor: number = 50;
  private playerCash: number = 950;
  private currentVehicle: SimVehicle | null = null;
  private lastPlayerVehicleName: string | null = null;
  private attackSwingTimer: number = 0;
  private shotCooldownTimer: number = 0;
  private smokeEmitTimer: number = 0;
  private customsCooldown: number = 0;
  private nearMissCooldown: number = 0;
  private resprayColorIndex: number = 0;
  private radioStationIndex: number = 1;
  private isCurrentlySprinting: boolean = false;

  // Decoupled Touchscreen & PC Mouse Camera Look ("The Arrow")
  private cameraYaw: number = 0;
  private cameraPitch: number = 0.08;
  private timeSinceLastLookInput: number = 10;
  private resizeObserver: ResizeObserver | null = null;

  private playerLevel: number = 1;
  private playerXp: number = 0;
  private skillPoints: number = 1;
  private unlockedSkills = new Set<string>();
  private branchXp: Record<SkillBranchId, number> = {
    DRIVING: 0,
    COMBAT: 0,
    SYNDICATE: 0,
  };
  private scrapParts: number = 2;
  private craftedMedkits: number = 1;
  private craftedArmorPlates: number = 0;
  private drivingXpAccumulator: number = 0;
  private kingpinDividendTimer: number = 0;

  private nitroCooldown: number = 0;
  private nitroActiveTimer: number = 0;
  private shockwaveCooldown: number = 0;
  private bribeCooldown: number = 0;

  private wantedLevel: number = 0;
  private timeSinceLastCrime: number = 0;

  private screenState: GameScreenState = 'TITLE';
  private cameraMode: CameraMode = 'CHASE';
  private titleOrbitAngle: number = 0.4;
  private cameraShake: number = 0;
  private hitstopTimer: number = 0;
  private hudEmitTimer: number = 0;
  private notificationText: string | null = null;
  private notificationTimer: number = 0;
  private trafficDensityMultiplier: number = 1.0;

  private heldKeys = new Set<string>();
  private justPressedKeys = new Set<string>();

  // Native Mobile Touch Controls State
  private touchMoveX: number = 0;
  private touchMoveY: number = 0;
  private touchThrottle: number = 0;
  private touchSprintHeld: boolean = false;
  private touchHandbrakeHeld: boolean = false;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    this.initRendererAndScene();
    this.buildUrbanWorld();
    this.spawnInitialPopulation();
    this.regenerateProceduralPOIs(this.worldSeed, false);
    this.bindEvents();

    this.lastTime = performance.now();
    this.emitHud();
    this.scheduleNextFrame();
  }

  private getViewportSize(): { w: number; h: number } {
    // offsetWidth/offsetHeight preserve un-transformed CSS widescreen dimensions even under rotate-90!
    const w = this.container.offsetWidth || this.container.clientWidth || window.innerWidth;
    const h = this.container.offsetHeight || this.container.clientHeight || window.innerHeight;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  private initRendererAndScene() {
    this.isSoftwareGl = detectSoftwareWebGL();
    const { w, h } = this.getViewportSize();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x38bdf8);
    this.fog = new THREE.FogExp2(0x93c5fd, 0.0029);
    this.scene.fog = this.fog;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(58, w / h, 0.25, 620);

    // 3D Atmospheric Sky Dome + Glowing California Sun Orb
    const skyTex = createSkyGradientTexture();
    this.skyDomeMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(520, 28, 18), this.skyDomeMat);
    skyDome.renderOrder = -2;
    this.scene.add(skyDome);

    this.sunOrbMat = new THREE.MeshBasicMaterial({
      color: 0xfffbeb,
      fog: false,
    });
    this.sunOrbMesh = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 16), this.sunOrbMat);
    this.scene.add(this.sunOrbMesh);

    this.hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x334155, 0.92);
    this.hemiLight.position.set(0, 90, 0);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    this.sunLight.position.set(75, 110, 65);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    const d = 115;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 280;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.shadowTex = createRadialShadowTexture();
    this.streetLampBulbMat = new THREE.MeshBasicMaterial({ color: 0x64748b });

    this.targetHighlightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.62, 24),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    this.targetHighlightRing.rotation.x = -Math.PI / 2;
    this.targetHighlightRing.position.y = 0.04;
    this.targetHighlightRing.visible = false;
    this.scene.add(this.targetHighlightRing);
  }

  private buildUrbanWorld() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const asphaltNormalTex = createAsphaltNormalTexture(maxAniso);
    this.waterNormalTex = createWaterNormalTexture(maxAniso);
    const intersectionTex = createRoadIntersectionTexture(maxAniso);
    const roadTex = createStraightRoadTexture(maxAniso);
    const sidewalkTex = createSidewalkTexture(maxAniso);

    const terrain = new THREE.Mesh(
      new THREE.PlaneGeometry(880, 880),
      new THREE.MeshStandardMaterial({ color: 0x3f6244, roughness: 0.92, metalness: 0.02 })
    );
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.08;
    terrain.receiveShadow = !this.isSoftwareGl;
    this.scene.add(terrain);

    // Shimmering Normal-Mapped Pacific Ocean + Surf Foam + Vespucci Sunset Pier
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0369a1,
      normalMap: this.waterNormalTex,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughness: 0.12,
      metalness: 0.28,
      clearcoat: this.isSoftwareGl ? 0 : 0.9,
      clearcoatRoughness: 0.08,
    });
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(420, 880), oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-350, -0.02, 0);
    this.scene.add(ocean);

    this.surfFoamMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 480),
      new THREE.MeshBasicMaterial({
        color: 0xf0f9ff,
        transparent: true,
        opacity: 0.55,
      })
    );
    this.surfFoamMesh.rotation.x = -Math.PI / 2;
    this.surfFoamMesh.position.set(-148, -0.01, 0);
    this.scene.add(this.surfFoamMesh);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 520),
      new THREE.MeshStandardMaterial({ color: 0xebd3b7, roughness: 0.88 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(-138, -0.03, 0);
    sand.receiveShadow = !this.isSoftwareGl;
    this.scene.add(sand);

    // Vespucci Wooden Pier extending out over the Pacific Ocean
    const pierWoodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.82 });
    const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(58, 0.5, 11), pierWoodMat);
    pierDeck.position.set(-154, 1.35, 56);
    pierDeck.castShadow = !this.isSoftwareGl;
    this.scene.add(pierDeck);
    for (let px = -130; px >= -180; px -= 10) {
      for (const pz of [51.5, 60.5]) {
        const piling = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 2.8, 8), pierWoodMat);
        piling.position.set(px, 0.2, pz);
        this.scene.add(piling);
      }
    }

    // Sculpted Vinewood Mountain Range Backdrop
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x36533c,
      roughness: 0.92,
      flatShading: true,
    });
    const hillConfigs = [
      [-135, 0, -255, 105, 58],
      [-25, 0, -268, 128, 76],
      [98, 0, -258, 115, 64],
      [248, 0, -95, 105, 52],
      [255, 0, 75, 120, 56],
    ];
    for (const [hx, hy, hz, r, h] of hillConfigs) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), hillMat);
      hill.position.set(hx, hy + h * 0.45, hz);
      this.scene.add(hill);
    }

    const interGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_WIDTH);
    const interMat = new THREE.MeshStandardMaterial({
      map: intersectionTex,
      normalMap: asphaltNormalTex,
      normalScale: new THREE.Vector2(0.42, 0.42),
      roughness: 0.68,
      metalness: 0.08,
    });
    const segLen = BLOCK_PITCH - ROAD_WIDTH;
    const roadNSGeo = new THREE.PlaneGeometry(ROAD_WIDTH, segLen);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      normalMap: asphaltNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.66,
      metalness: 0.08,
    });

    for (const ix of GRID_INDICES) {
      for (const iz of GRID_INDICES) {
        const cx = ix * BLOCK_PITCH;
        const cz = iz * BLOCK_PITCH;

        const inter = new THREE.Mesh(interGeo, interMat);
        inter.rotation.x = -Math.PI / 2;
        inter.position.set(cx, 0.01, cz);
        inter.receiveShadow = !this.isSoftwareGl;
        this.scene.add(inter);

        if (Math.abs(ix) <= 1 && Math.abs(iz) <= 1) {
          const tl = buildTrafficLightAssembly();
          tl.group.position.set(cx - ROAD_WIDTH * 0.56, 0, cz - ROAD_WIDTH * 0.56);
          this.scene.add(tl.group);
          this.trafficBulbs.push({ nsBulb: tl.nsBulb, ewBulb: tl.ewBulb });
        }

        if (iz < 2) {
          const nsRoad = new THREE.Mesh(roadNSGeo, roadMat);
          nsRoad.rotation.x = -Math.PI / 2;
          nsRoad.position.set(cx, 0.01, cz + BLOCK_PITCH * 0.5);
          nsRoad.receiveShadow = !this.isSoftwareGl;
          this.scene.add(nsRoad);
        }

        if (ix < 2) {
          const ewRoad = new THREE.Mesh(roadNSGeo, roadMat);
          ewRoad.rotation.x = -Math.PI / 2;
          ewRoad.rotation.z = Math.PI / 2;
          ewRoad.position.set(cx + BLOCK_PITCH * 0.5, 0.01, cz);
          ewRoad.receiveShadow = !this.isSoftwareGl;
          this.scene.add(ewRoad);
        }
      }
    }

    // Highway Perimeter Guardrails & Raised Outer Curbs
    const guardrailMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      metalness: 0.76,
      roughness: 0.28,
    });
    const outerEdge = 2 * BLOCK_PITCH + ROAD_WIDTH * 0.5 + 0.35;
    const railSpan = outerEdge * 2;

    const northRail = new THREE.Mesh(new THREE.BoxGeometry(railSpan, 0.62, 0.42), guardrailMat);
    northRail.position.set(0, 0.31, -outerEdge);
    const southRail = northRail.clone();
    southRail.position.set(0, 0.31, outerEdge);

    const westRail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, railSpan), guardrailMat);
    westRail.position.set(-outerEdge, 0.31, 0);
    const eastRail = westRail.clone();
    eastRail.position.set(outerEdge, 0.31, 0);

    this.scene.add(northRail, southRail, westRail, eastRail);

    // =========================================================================
    // SOLIS CUSTOMS DRIVE-THRU ROAD GANTRY (x = 56, z = -26 — 100% ON THE ROAD!)
    // Drive any vehicle through to repair 100% health, respray metallic paint & drop heat!
    // =========================================================================
    const customsGroup = new THREE.Group();
    customsGroup.position.set(CUSTOMS_ROAD_X, 0, CUSTOMS_ROAD_Z);

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.72,
      roughness: 0.25,
    });
    const neonMagentaMat = new THREE.MeshBasicMaterial({ color: 0xe879f9 });
    const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.85, 6.2, 1.4), pillarMat);
    leftPillar.position.set(-7.35, 3.1, 0);
    const rightPillar = leftPillar.clone();
    rightPillar.position.set(7.35, 3.1, 0);

    const topBeam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 1.15, 1.8), pillarMat);
    topBeam.position.set(0, 6.35, 0);

    const neonTrimTop = new THREE.Mesh(new THREE.BoxGeometry(15.7, 0.18, 1.92), neonMagentaMat);
    neonTrimTop.position.set(0, 6.95, 0);
    const neonTrimBot = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.16, 1.88), neonCyanMat);
    neonTrimBot.position.set(0, 5.75, 0);

    this.customsRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 4.1, 28),
      new THREE.MeshBasicMaterial({
        color: 0xe879f9,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    this.customsRingMesh.rotation.x = -Math.PI / 2;
    this.customsRingMesh.position.y = 0.05;

    customsGroup.add(
      leftPillar,
      rightPillar,
      topBeam,
      neonTrimTop,
      neonTrimBot,
      this.customsRingMesh
    );
    this.scene.add(customsGroup);

    // Next-Gen Glass Curtain-Wall & Sunlit Limestone Skyscraper Facade Materials
    const facadeSpecs = [
      createBuildingFacadeMaps('#1e293b', '#38bdf8', '#fef08a', maxAniso, 1),
      createBuildingFacadeMaps('#334155', '#7dd3fc', '#fde68a', maxAniso, 2),
      createBuildingFacadeMaps('#78716c', '#bae6fd', '#fef3c7', maxAniso, 3),
      createBuildingFacadeMaps('#0f172a', '#0284c7', '#fde047', maxAniso, 4),
      createBuildingFacadeMaps('#475569', '#60a5fa', '#ffedd5', maxAniso, 5),
    ];
    this.buildingMaterials = facadeSpecs.map(
      (f) =>
        new THREE.MeshStandardMaterial({
          map: f.map,
          emissive: 0xffffff,
          emissiveMap: f.emissiveMap,
          emissiveIntensity: 0.22,
          roughness: 0.26,
          metalness: 0.52,
        })
    );

    const sidewalkMat = new THREE.MeshStandardMaterial({
      map: sidewalkTex,
      normalMap: asphaltNormalTex,
      normalScale: new THREE.Vector2(0.18, 0.18),
      roughness: 0.84,
    });
    const curbTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.72 });
    const roofBeaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const blockSpan = BLOCK_PITCH - ROAD_WIDTH;
    for (let bx = -2; bx < 2; bx++) {
      for (let bz = -2; bz < 2; bz++) {
        const centerX = (bx + 0.5) * BLOCK_PITCH;
        const centerZ = (bz + 0.5) * BLOCK_PITCH;

        const curbBase = new THREE.Mesh(
          new THREE.BoxGeometry(blockSpan + 0.36, 0.24, blockSpan + 0.36),
          curbTrimMat
        );
        curbBase.position.set(centerX, 0.12, centerZ);
        this.scene.add(curbBase);

        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(blockSpan - 0.12, 0.25, blockSpan - 0.12),
          sidewalkMat
        );
        slab.position.set(centerX, 0.125, centerZ);
        slab.receiveShadow = !this.isSoftwareGl;
        this.scene.add(slab);

        const lampSE = buildStreetLampAssembly(this.streetLampBulbMat);
        lampSE.position.set(centerX + blockSpan * 0.5 - 0.8, 0.22, centerZ);
        this.scene.add(lampSE);

        const lampNW = buildStreetLampAssembly(this.streetLampBulbMat);
        lampNW.position.set(centerX - blockSpan * 0.5 + 0.8, 0.22, centerZ);
        lampNW.rotation.y = Math.PI;
        this.scene.add(lampNW);

        if (bx === 0 && bz === 0) {
          const lawn = new THREE.Mesh(
            new THREE.BoxGeometry(blockSpan - 6, 0.12, blockSpan - 6),
            new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.88 })
          );
          lawn.position.set(centerX, 0.28, centerZ);
          this.scene.add(lawn);

          const basin = new THREE.Mesh(
            new THREE.CylinderGeometry(4.8, 5.2, 0.75, 24),
            new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.42 })
          );
          basin.position.set(centerX, 0.58, centerZ);
          const waterPool = new THREE.Mesh(
            new THREE.CylinderGeometry(4.3, 4.3, 0.58, 24),
            oceanMat
          );
          waterPool.position.set(centerX, 0.72, centerZ);
          const spire = new THREE.Mesh(
            new THREE.OctahedronGeometry(1.85, 0),
            new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.88, roughness: 0.14 })
          );
          spire.position.set(centerX, 3.1, centerZ);
          spire.scale.set(0.85, 1.9, 0.85);
          this.scene.add(basin, waterPool, spire);
          this.buildingColliders.push({
            minX: centerX - 5.1,
            maxX: centerX + 5.1,
            minZ: centerZ - 5.1,
            maxZ: centerZ + 5.1,
          });

          for (const [ox, oz] of [
            [-12.5, -12.5],
            [12.5, -12.5],
            [-12.5, 12.5],
            [12.5, 12.5],
          ]) {
            const palm = buildPalmTreeModel(this.isSoftwareGl);
            palm.position.set(centerX + ox, 0.24, centerZ + oz);
            this.scene.add(palm);
          }
          continue;
        }

        const quadrants = [
          [-9.5, -9.5],
          [9.5, -9.5],
          [-9.5, 9.5],
          [9.5, 9.5],
        ];

        for (let q = 0; q < quadrants.length; q++) {
          const [qx, qz] = quadrants[q];
          const bldX = centerX + qx;
          const bldZ = centerZ + qz;
          const distFromCore = Math.hypot(bx + 0.5, bz + 0.5);
          const baseHeight =
            distFromCore < 1.2
              ? 26 + ((q * 9 + Math.abs(bx) * 5) % 24)
              : 11 + ((q * 6 + Math.abs(bz) * 5) % 15);
          const w = 13.6;
          const d = 13.6;

          const bldMat =
            this.buildingMaterials[Math.abs(bx * 3 + bz * 5 + q) % this.buildingMaterials.length];
          const bldGroup = new THREE.Group();
          bldGroup.position.set(bldX, 0.24, bldZ);

          const mainTower = new THREE.Mesh(new THREE.BoxGeometry(w, baseHeight, d), bldMat);
          mainTower.position.y = baseHeight * 0.5;
          mainTower.castShadow = !this.isSoftwareGl;
          mainTower.receiveShadow = !this.isSoftwareGl;
          bldGroup.add(mainTower);

          // Stepped Architectural Setback Penthouse Tier on Taller Skyscrapers
          if (baseHeight > 24) {
            const tierH = 5.5;
            const upperTier = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.72, tierH, d * 0.72),
              bldMat
            );
            upperTier.position.y = baseHeight + tierH * 0.5;
            bldGroup.add(upperTier);

            const spireMast = new THREE.Mesh(
              new THREE.CylinderGeometry(0.08, 0.18, 5.2, 8),
              guardrailMat
            );
            spireMast.position.y = baseHeight + tierH + 2.6;
            const beaconDot = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), roofBeaconMat);
            beaconDot.position.y = baseHeight + tierH + 5.3;
            bldGroup.add(spireMast, beaconDot);
          } else {
            const crown = new THREE.Mesh(
              new THREE.BoxGeometry(w * 0.86, 1.2, d * 0.86),
              new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.45, roughness: 0.4 })
            );
            crown.position.y = baseHeight + 0.6;
            const hvac = new THREE.Mesh(
              new THREE.BoxGeometry(3.0, 1.4, 2.2),
              new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.55, roughness: 0.4 })
            );
            hvac.position.set(1.8, baseHeight + 1.8, -1.5);
            bldGroup.add(crown, hvac);
          }

          this.scene.add(bldGroup);
          this.buildingColliders.push({
            minX: bldX - w * 0.5,
            maxX: bldX + w * 0.5,
            minZ: bldZ - d * 0.5,
            maxZ: bldZ + d * 0.5,
          });
        }
      }
    }

    // Lush Vespucci Beach & Vinewood Boulevard California Fan Palms
    for (let z = -112; z <= 112; z += 18) {
      const palm = buildPalmTreeModel(this.isSoftwareGl);
      palm.position.set(-124, 0, z);
      palm.rotation.y = z * 0.17;
      const sc = 0.92 + ((Math.abs(z) % 5) * 0.05);
      palm.scale.setScalar(sc);
      this.scene.add(palm);
    }

    this.missionBeaconGroup = new THREE.Group();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 28, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.26,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 14;

    this.missionRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(2.3, 3.1, 28),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    this.missionRingMesh.rotation.x = -Math.PI / 2;
    this.missionRingMesh.position.y = 0.06;

    this.missionBeaconGroup.add(beam, this.missionRingMesh);
    this.scene.add(this.missionBeaconGroup);
    this.syncMissionBeacon();
  }

  // ==========================================================================
  // STRICT ASPHALT ROAD NETWORK CONTAINMENT & LANE HELPERS
  // Guarantees ZERO cars ever drive on sidewalks, grass, parks, or beaches!
  // ==========================================================================

  private nearestGridRoadIndex(coord: number): number {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (const idx of GRID_INDICES) {
      const d = Math.abs(coord - idx * BLOCK_PITCH);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    }
    return bestIdx;
  }

  /**
   * Projects any candidate vehicle position strictly inside the paved asphalt road grid.
   * Allows smooth driving, lane changes, and 90° turns inside intersections while blocking
   * any movement onto sidewalks, parks, plazas, or beaches.
   */
  private constrainVehicleToRoad(
    x: number,
    z: number,
    heading: number
  ): { x: number; z: number; heading: number; hitCurb: boolean } {
    let rx = x;
    let rz = z;
    let rHeading = heading;
    let hitCurb = false;

    if (rx > MAX_ROAD_EXTENT) {
      rx = MAX_ROAD_EXTENT;
      hitCurb = true;
    } else if (rx < -MAX_ROAD_EXTENT) {
      rx = -MAX_ROAD_EXTENT;
      hitCurb = true;
    }

    if (rz > MAX_ROAD_EXTENT) {
      rz = MAX_ROAD_EXTENT;
      hitCurb = true;
    } else if (rz < -MAX_ROAD_EXTENT) {
      rz = -MAX_ROAD_EXTENT;
      hitCurb = true;
    }

    const nearIx = this.nearestGridRoadIndex(rx);
    const nearIz = this.nearestGridRoadIndex(rz);
    const roadX = nearIx * BLOCK_PITCH;
    const roadZ = nearIz * BLOCK_PITCH;

    const dx = rx - roadX;
    const dz = rz - roadZ;
    const absDx = Math.abs(dx);
    const absDz = Math.abs(dz);

    // A car is on asphalt if it is within DRIVABLE_HALF_WIDTH of EITHER an NS avenue OR an EW boulevard
    if (absDx > DRIVABLE_HALF_WIDTH && absDz > DRIVABLE_HALF_WIDTH) {
      hitCurb = true;
      const penX = absDx - DRIVABLE_HALF_WIDTH;
      const penZ = absDz - DRIVABLE_HALF_WIDTH;

      if (penX <= penZ) {
        // Clamp back onto the North-South avenue curb
        rx = roadX + Math.sign(dx) * DRIVABLE_HALF_WIDTH;
        const targetNSHeading = Math.cos(rHeading) >= 0 ? 0 : Math.PI;
        rHeading += normalizeAngle(targetNSHeading - rHeading) * 0.22;
      } else {
        // Clamp back onto the East-West boulevard curb
        rz = roadZ + Math.sign(dz) * DRIVABLE_HALF_WIDTH;
        const targetEWHeading = Math.sin(rHeading) >= 0 ? Math.PI / 2 : -Math.PI / 2;
        rHeading += normalizeAngle(targetEWHeading - rHeading) * 0.22;
      }
    }

    return { x: rx, z: rz, heading: rHeading, hitCurb };
  }

  /**
   * Snaps any arbitrary world point onto a clean right-hand lane on the nearest asphalt road.
   */
  private snapToNearestRoadLane(
    rawX: number,
    rawZ: number,
    preferredDir?: CardinalDir
  ): {
    x: number;
    z: number;
    heading: number;
    travelDir: CardinalDir;
    roadLineIndex: number;
    nextInterIx: number;
    nextInterIz: number;
  } {
    const cx = THREE.MathUtils.clamp(rawX, -108, 108);
    const cz = THREE.MathUtils.clamp(rawZ, -108, 108);
    const ix = this.nearestGridRoadIndex(cx);
    const iz = this.nearestGridRoadIndex(cz);
    const distNS = Math.abs(cx - ix * BLOCK_PITCH);
    const distEW = Math.abs(cz - iz * BLOCK_PITCH);

    let dir: CardinalDir = preferredDir ?? (distNS <= distEW ? 'S' : 'E');
    if (!preferredDir) {
      if (distNS <= distEW) {
        dir = iz >= 2 ? 'N' : iz <= -2 ? 'S' : cx >= ix * BLOCK_PITCH ? 'N' : 'S';
      } else {
        dir = ix >= 2 ? 'W' : ix <= -2 ? 'E' : cz >= iz * BLOCK_PITCH ? 'E' : 'W';
      }
    }

    const heading = DIR_HEADING[dir];
    const laneOffset = 3.2;

    if (dir === 'N' || dir === 'S') {
      const roadX = ix * BLOCK_PITCH;
      const rightX = dir === 'N' ? 1 : -1;
      const x = roadX + rightX * laneOffset;
      // Place cleanly on a segment between two intersections
      let baseIz = Math.floor(cz / BLOCK_PITCH);
      baseIz = THREE.MathUtils.clamp(baseIz, -2, 1);
      const segZ = (baseIz + 0.5) * BLOCK_PITCH;
      const nextInterIz = dir === 'S' ? baseIz + 1 : baseIz;
      return {
        x,
        z: segZ,
        heading,
        travelDir: dir,
        roadLineIndex: ix,
        nextInterIx: ix,
        nextInterIz,
      };
    } else {
      const roadZ = iz * BLOCK_PITCH;
      const rightZ = dir === 'E' ? 1 : -1;
      const z = roadZ + rightZ * laneOffset;
      let baseIx = Math.floor(cx / BLOCK_PITCH);
      baseIx = THREE.MathUtils.clamp(baseIx, -2, 1);
      const segX = (baseIx + 0.5) * BLOCK_PITCH;
      const nextInterIx = dir === 'E' ? baseIx + 1 : baseIx;
      return {
        x: segX,
        z,
        heading,
        travelDir: dir,
        roadLineIndex: iz,
        nextInterIx,
        nextInterIz: iz,
      };
    }
  }

  private spawnInitialPopulation() {
    this.playerRig = buildCharacterModel(
      'PLAYER',
      0x0284c7,
      0x1e293b,
      0xe0ac69,
      this.shadowTex,
      this.isSoftwareGl,
      0
    );
    this.playerX = 9.2;
    this.playerZ = 14;
    this.playerRig.group.position.set(this.playerX, 0.25, this.playerZ);
    this.scene.add(this.playerRig.group);

    // Player's starter parked sports coupe waiting curbside ON THE ASPHALT ROAD (driverless until entered!)
    this.spawnRoadVehicle(
      'SPORTS',
      'Comet GT Turbo',
      0xef4444,
      'FREEROAM_RACER',
      false,
      4.4,
      16,
      Math.PI,
      'N',
      0,
      0,
      0
    );

    const vehicleCatalog: {
      type: VehicleType;
      name: string;
      color: number;
      style: DriverArchetype;
    }[] = [
      { type: 'SPORTS', name: 'Infernus RS', color: 0xf59e0b, style: 'FREEROAM_RACER' },
      { type: 'SEDAN', name: 'Premier Sedan', color: 0x3b82f6, style: 'COMMUTER' },
      { type: 'SUV', name: 'Baller V8 SUV', color: 0x10b981, style: 'COMMUTER' },
      { type: 'TAXI', name: 'Downtown Cab', color: 0xeab308, style: 'COMMUTER' },
      { type: 'SPORTS', name: 'Banshee GTS', color: 0x06b6d4, style: 'FREEROAM_RACER' },
      { type: 'SEDAN', name: 'Asterope Executive', color: 0x94a3b8, style: 'CAUTIOUS' },
      { type: 'SUV', name: 'Cavalcade XL', color: 0x475569, style: 'COMMUTER' },
      { type: 'SPORTS', name: 'Cheetah Custom', color: 0xa855f7, style: 'FREEROAM_RACER' },
      { type: 'TAXI', name: 'Metro Taxi', color: 0xeab308, style: 'COMMUTER' },
    ];

    let vIdx = 0;
    for (const roadIndex of GRID_INDICES) {
      // Spawn Northbound & Southbound road vehicles on valid segments
      for (const dir of ['S', 'N'] as const) {
        const spec = vehicleCatalog[vIdx % vehicleCatalog.length];
        const segBlock = ((vIdx * 2) % 4) - 2; // -2, -1, 0, 1
        const startZ = (segBlock + 0.5) * BLOCK_PITCH;
        const rightSign = dir === 'N' ? 1 : -1;
        const laneX = roadIndex * BLOCK_PITCH + rightSign * 3.2;
        const nextIz = dir === 'S' ? segBlock + 1 : segBlock;

        this.spawnRoadVehicle(
          spec.type,
          spec.name,
          spec.color,
          spec.style,
          true,
          laneX,
          startZ,
          DIR_HEADING[dir],
          dir,
          roadIndex,
          roadIndex,
          nextIz
        );
        vIdx++;
      }

      // Spawn Eastbound / Westbound road vehicles on valid segments
      const specEW = vehicleCatalog[vIdx % vehicleCatalog.length];
      const dirEW: CardinalDir = roadIndex % 2 === 0 ? 'E' : 'W';
      const segBlockX = ((vIdx * 3) % 4) - 2;
      const startX = (segBlockX + 0.5) * BLOCK_PITCH;
      const rightSignZ = dirEW === 'E' ? 1 : -1;
      const laneZ = roadIndex * BLOCK_PITCH + rightSignZ * 3.2;
      const nextIx = dirEW === 'E' ? segBlockX + 1 : segBlockX;

      this.spawnRoadVehicle(
        specEW.type,
        specEW.name,
        specEW.color,
        specEW.style,
        true,
        startX,
        laneZ,
        DIR_HEADING[dirEW],
        dirEW,
        roadIndex,
        nextIx,
        roadIndex
      );
      vIdx++;
    }

    // Spawn 46 Realistic Human Citizens on sidewalks
    const npcCount = 46;
    const { profiles, roles } = generateNPCProfiles(npcCount);

    const casualTops = [
      0xf8fafc, 0x2563eb, 0xdc2626, 0x059669, 0x7c3aed, 0xdb2777, 0xeab308, 0x0f766e,
    ];
    const suitTops = [0x1e293b, 0x334155, 0x27272a, 0x1e3a8a];
    const pantsPalette = [0x1e293b, 0x334155, 0x44403c, 0x172554, 0x57534e];
    const skinPalette = [0xffdfc4, 0xf0c8a0, 0xddb080, 0xc68642, 0x8d5524, 0x5c3824];

    for (let i = 0; i < npcCount; i++) {
      const role = roles[i];
      const profile = profiles[i];

      profile.homeAnchor.x = snapCoordToSidewalk(profile.homeAnchor.x);
      profile.workAnchor.x = snapCoordToSidewalk(profile.workAnchor.x);

      let shirtColor = casualTops[i % casualTops.length];
      if (role === 'OFFICER') shirtColor = 0x172554;
      else if (role === 'BUSINESS') shirtColor = suitTops[i % suitTops.length];
      else if (role === 'MECHANIC') shirtColor = 0xb45309;
      else if (role === 'VENDOR') shirtColor = 0x047857;

      const rig = buildCharacterModel(
        role,
        shirtColor,
        pantsPalette[i % pantsPalette.length],
        skinPalette[i % skinPalette.length],
        this.shadowTex,
        this.isSoftwareGl,
        i + 1
      );

      let startX = snapCoordToSidewalk(profile.workAnchor.x);
      let startZ = profile.workAnchor.z;
      if (i < 6) {
        startX = i % 2 === 0 ? 8.9 : 14 + i * 2.2;
        startZ = 10 + i * 3.6;
      }
      const safe = this.resolveBuildingCollision(startX, startZ, 0.5);

      rig.group.position.set(safe.x, 0.25, safe.z);
      this.scene.add(rig.group);

      this.npcs.push({
        id: i + 1,
        role,
        profile,
        state: 'SCHEDULE_COMMUTE',
        rig,
        x: safe.x,
        z: safe.z,
        heading: (i * 1.3) % (Math.PI * 2),
        walkCycle: Math.random() * 10,
        idleSeed: Math.random() * 20,
        health: 100,
        cashCarry: 55 + (i % 6) * 25,
        stateTimer: 0,
        attackCooldown: 0,
        usesPhoneHabit: i % 3 === 0,
        barkText: null,
        barkTimer: 0,
        barkMood: 'NEUTRAL',
        barkCooldown: 2.5 + (i % 8) * 1.9,
      });
    }
  }

  private triggerNPCBark(
    npc: SimNPC,
    text: string,
    mood: 'NEUTRAL' | 'FRIENDLY' | 'ALARMED' = 'NEUTRAL',
    duration: number = 4.0,
    speakAloud: boolean = false,
    priorityVoice: boolean = false
  ) {
    npc.barkText = text;
    npc.barkMood = mood;
    npc.barkTimer = duration;
    npc.barkCooldown = 10 + Math.random() * 9;

    if (speakAloud && this.screenState === 'PLAYING') {
      const dist = Math.hypot(npc.x - this.playerX, npc.z - this.playerZ);
      if (dist < 24 || priorityVoice) {
        soundEngine.speakVoice(text, npc.profile.voiceSeed, mood, priorityVoice);
      }
    }
  }

  public regenerateProceduralPOIs(newSeed?: number, notify: boolean = true) {
    for (const old of this.poiEntities) {
      this.scene.remove(old.group);
    }
    this.worldSeed = newSeed ?? Math.floor(10000 + Math.random() * 89999);
    this.poiEntities = generateProceduralPOIs(this.worldSeed, this.scene, 7);
    if (notify) {
      soundEngine.playMissionComplete();
      this.showNotification(`Generated 7 Dynamic POIs (World Seed #${this.worldSeed})`, 3.0);
      this.emitHud();
    }
  }

  private grantSkillXp(branch: SkillBranchId, amount: number, reason?: string) {
    this.branchXp[branch] += amount;
    this.playerXp += amount;
    let leveledUp = false;

    while (this.playerXp >= xpForLevel(this.playerLevel)) {
      this.playerXp -= xpForLevel(this.playerLevel);
      this.playerLevel += 1;
      this.skillPoints += 1;
      leveledUp = true;
    }

    if (leveledUp) {
      soundEngine.playMissionComplete();
      this.showNotification(`Level ${this.playerLevel} Reached! +1 Skill Point Unlocked`, 3.5);
    } else if (reason) {
      this.showNotification(`${reason} (+${amount} ${branch} XP)`, 2.2);
    }
  }

  public unlockSkillNode(skillId: string) {
    const def = SKILL_TREE_CATALOG.find((s) => s.id === skillId);
    if (!def || this.unlockedSkills.has(skillId)) return;
    if (def.prerequisiteId && !this.unlockedSkills.has(def.prerequisiteId)) return;
    if (this.skillPoints < def.cost) return;

    this.skillPoints -= def.cost;
    this.unlockedSkills.add(skillId);

    if (skillId === 'cmb_1_conditioning') {
      this.playerMaxHealth = 135;
      this.playerHealth = Math.min(135, this.playerHealth + 35);
    }

    soundEngine.playMissionComplete();
    this.showNotification(`Unlocked Skill: ${def.name}`, 2.6);
    this.emitHud();
  }

  public craftFieldItem(item: 'MEDKIT' | 'ARMOR') {
    const scrapCost = this.unlockedSkills.has('syn_2_salvage') ? 1 : 2;
    if (this.scrapParts < scrapCost) {
      this.showNotification(`Need ${scrapCost} Salvage Parts to craft!`, 2.0);
      return;
    }
    this.scrapParts -= scrapCost;
    if (item === 'MEDKIT') {
      this.craftedMedkits += 1;
    } else {
      this.craftedArmorPlates += 1;
    }
    soundEngine.playDoorChime();
    this.grantSkillXp(
      'SYNDICATE',
      45,
      `Crafted ${item === 'MEDKIT' ? 'Street Medkit' : 'Armor Plate'}`
    );
    this.emitHud();
  }

  public useCraftedItem(item: 'MEDKIT' | 'ARMOR') {
    if (item === 'MEDKIT' && this.craftedMedkits > 0 && this.playerHealth < this.playerMaxHealth) {
      this.craftedMedkits -= 1;
      this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 55);
      soundEngine.playDoorChime();
      this.showNotification('Used Street Medkit (+55 HP)', 1.8);
      this.emitHud();
    } else if (item === 'ARMOR' && this.craftedArmorPlates > 0 && this.playerArmor < 100) {
      this.craftedArmorPlates -= 1;
      this.playerArmor = Math.min(100, this.playerArmor + 60);
      soundEngine.playDoorChime();
      this.showNotification('Equipped Tactical Plate (+60 Armor)', 1.8);
      this.emitHud();
    }
  }

  private findNearbyNPC(maxDist: number = 4.2): SimNPC | null {
    if (this.currentVehicle) return null;
    let best: SimNPC | null = null;
    let bestD = maxDist;
    for (const npc of this.npcs) {
      if (npc.state === 'RAGDOLL' || npc.state === 'COMBAT') continue;
      const d = Math.hypot(npc.x - this.playerX, npc.z - this.playerZ);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  public openNearbyNPCConversation() {
    const npc = this.findNearbyNPC(4.5);
    if (!npc) return;
    this.conversingNpcId = npc.id;
    npc.profile.lastCustomReply = null;
    npc.state = 'CONVERSING_PLAYER';
    npc.heading = Math.atan2(this.playerX - npc.x, this.playerZ - npc.z);
    npc.rig.group.rotation.y = npc.heading;
    soundEngine.playDoorChime();

    // Speak the NPC's natural greeting out loud like a real person!
    const phase = getSchedulePhaseForHour(this.timeOfDay);
    const ctx = buildContextualDialogue(
      npc.profile,
      npc.role,
      phase,
      this.wantedLevel,
      this.scrapParts,
      this.playerCash,
      this.lastPlayerVehicleName
    );
    soundEngine.speakVoice(
      ctx.line,
      npc.profile.voiceSeed,
      npc.profile.playerTrust >= 30 ? 'FRIENDLY' : 'NEUTRAL',
      true
    );

    this.emitHud();
  }

  public selectNPCDialogueOption(optionId: ActiveNPCDialogueOption['id']) {
    const npc = this.npcs.find((n) => n.id === this.conversingNpcId);
    if (!npc) {
      this.conversingNpcId = null;
      this.emitHud();
      return;
    }

    const charismaMult = this.unlockedSkills.has('syn_1_silver_tongue') ? 1.6 : 1.0;
    const payoutMult = this.unlockedSkills.has('syn_1_silver_tongue') ? 1.25 : 1.0;

    if (optionId === 'LEAVE') {
      npc.profile.lastCustomReply = null;
      npc.state = 'SCHEDULE_COMMUTE';
      this.conversingNpcId = null;
      this.triggerNPCBark(npc, 'Catch you around the block, stay safe!', 'FRIENDLY', 2.8, true, true);
      this.emitHud();
      return;
    }

    if (optionId === 'CHAT') {
      this.chatTurnCounter += 1;
      const trustDelta = Math.round(12 * charismaMult);
      npc.profile.playerTrust = Math.min(100, npc.profile.playerTrust + trustDelta);
      const friendRel = npc.profile.relationships[0];
      if (friendRel && friendRel.affinity > 0) {
        const friendNpc = this.npcs.find((n) => n.id === friendRel.targetNpcId);
        if (friendNpc) {
          friendNpc.profile.playerTrust = Math.min(100, friendNpc.profile.playerTrust + 6);
        }
      }
      const reply = buildNaturalChatReply(npc.profile, npc.role, npc.id + this.chatTurnCounter);
      npc.profile.lastCustomReply = reply;
      soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
      soundEngine.playDoorChime();
      this.grantSkillXp('SYNDICATE', 35, `Caught up with ${npc.profile.name}`);
    } else if (optionId === 'HELP_OBJECTIVE' && !npc.profile.objectiveCompleted) {
      if (npc.profile.objectiveType === 'SCRAP_DELIVERY') {
        if (this.scrapParts < npc.profile.objectiveScrapNeeded) {
          const msg = `Ah man, looks like you’re still short on Salvage Parts—check those cyan crates along the curb!`;
          npc.profile.lastCustomReply = msg;
          soundEngine.speakVoice(msg, npc.profile.voiceSeed, 'NEUTRAL', true);
          this.showNotification('Grab Salvage Parts from cyan curbside POIs!', 2.4);
          this.emitHud();
          return;
        }
        this.scrapParts -= npc.profile.objectiveScrapNeeded;
        const cashEarned = Math.round(320 * payoutMult);
        this.playerCash += cashEarned;
        npc.profile.objectiveCompleted = true;
        npc.profile.playerTrust = Math.min(
          100,
          npc.profile.playerTrust + Math.round(35 * charismaMult)
        );
        const reply = `No way—you actually came through with the parts! Here, take $${cashEarned}, you’re family on this block now!`;
        npc.profile.lastCustomReply = reply;
        soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
        this.grantSkillXp(
          'SYNDICATE',
          90,
          `Helped ${npc.profile.name} (+$${cashEarned})`
        );
      } else if (npc.profile.objectiveType === 'CASH_INVEST') {
        if (this.playerCash < 120) {
          const msg = `You need $120 cash to go half on this crate—come back whenever you’re stacked!`;
          npc.profile.lastCustomReply = msg;
          soundEngine.speakVoice(msg, npc.profile.voiceSeed, 'NEUTRAL', true);
          this.showNotification('Need $120 cash to pitch in.', 2.2);
          this.emitHud();
          return;
        }
        const net = Math.round(280 * payoutMult);
        this.playerCash += net - 120;
        this.scrapParts += 2;
        npc.profile.objectiveCompleted = true;
        npc.profile.playerTrust = Math.min(
          100,
          npc.profile.playerTrust + Math.round(35 * charismaMult)
        );
        const reply = `Boom, sold out already! Here’s your $${net} cut plus two spare turbo parts—pleasure doing business!`;
        npc.profile.lastCustomReply = reply;
        soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
        this.grantSkillXp('SYNDICATE', 95, `Backed ${npc.profile.name}'s Hustle (+2 Salvage)`);
      } else {
        const cashEarned = Math.round(180 * payoutMult);
        this.playerCash += cashEarned;
        npc.profile.objectiveCompleted = true;
        npc.profile.playerTrust = Math.min(
          100,
          npc.profile.playerTrust + Math.round(30 * charismaMult)
        );
        const reply = `You’re a lifesaver for that tip! Seriously, take $${cashEarned} for looking out!`;
        npc.profile.lastCustomReply = reply;
        soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
        this.grantSkillXp('SYNDICATE', 75, `Helped ${npc.profile.name} (+$${cashEarned})`);
      }
      soundEngine.playMissionComplete();
    } else if (optionId === 'TRADE_DEAL') {
      if (npc.role === 'MECHANIC') {
        if (this.playerCash < 90) {
          this.showNotification('Need $90 cash for salvage bundle.', 2.0);
        } else {
          this.playerCash -= 90;
          this.scrapParts += 2;
          const reply = `Fresh off the workbench—two clean salvage parts, all yours!`;
          npc.profile.lastCustomReply = reply;
          soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
          soundEngine.playDoorChime();
          this.grantSkillXp('SYNDICATE', 40, 'Bought 2 Salvage Parts');
        }
      } else {
        if (this.playerCash < 85) {
          this.showNotification('Need $85 cash for supplies.', 2.0);
        } else {
          this.playerCash -= 85;
          this.playerHealth = Math.min(this.playerMaxHealth, this.playerHealth + 40);
          this.playerArmor = Math.min(100, this.playerArmor + 40);
          const reply = `Got you covered—fresh energy & vest liner right under the counter!`;
          npc.profile.lastCustomReply = reply;
          soundEngine.speakVoice(reply, npc.profile.voiceSeed, 'FRIENDLY', true);
          soundEngine.playDoorChime();
          this.grantSkillXp('SYNDICATE', 40, 'Bought Street Gear');
        }
      }
    } else if (optionId === 'PROVOKE') {
      npc.profile.playerTrust = Math.max(-100, npc.profile.playerTrust - 45);
      npc.profile.lastCustomReply = null;
      this.playerCash += 65;
      this.conversingNpcId = null;
      this.triggerNPCBark(
        npc,
        'Are you crazy?! Somebody call LSPD right now—you’re gonna regret that!',
        'ALARMED',
        4.2,
        true,
        true
      );
      this.addCrimeHeat(1, `Shook down ${npc.profile.name}`);

      npc.state = npc.role === 'OFFICER' || npc.role === 'MECHANIC' ? 'COMBAT' : 'FLEEING';
      npc.stateTimer = 8.0;

      for (const rel of npc.profile.relationships) {
        if (rel.affinity > 30) {
          const ally = this.npcs.find((n) => n.id === rel.targetNpcId);
          if (ally) {
            ally.profile.playerTrust = Math.max(-100, ally.profile.playerTrust - 25);
            if (Math.hypot(ally.x - this.playerX, ally.z - this.playerZ) < 28) {
              ally.state = 'COMBAT';
              ally.stateTimer = 8.0;
              this.triggerNPCBark(
                ally,
                `Hey! Get your hands off ${npc.profile.name.split(' ')[0]}!`,
                'ALARMED',
                3.6
              );
            }
          }
        }
      }
    }

    this.emitHud();
  }

  private findNearbyPOI(maxDist: number = 6.8): LivePOIEntity | null {
    let best: LivePOIEntity | null = null;
    let bestD = maxDist;
    for (const p of this.poiEntities) {
      if (p.info.completed) continue;
      const d = Math.hypot(p.info.x - this.playerX, p.info.z - this.playerZ);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  private interactWithNearbyPOI() {
    const poi = this.findNearbyPOI(7.2);
    if (!poi) return;

    poi.info.completed = true;
    poi.group.visible = false;

    const payoutMult = this.unlockedSkills.has('syn_1_silver_tongue') ? 1.25 : 1.0;
    const scrapBonus = this.unlockedSkills.has('syn_2_salvage') ? 1 : 0;

    const cashWon = Math.round(poi.info.rewardCash * payoutMult);
    const scrapWon = poi.info.rewardScrap + scrapBonus;

    this.playerCash += cashWon;
    this.scrapParts += scrapWon;

    if (poi.info.type === 'SYNDICATE_STASH') {
      this.addCrimeHeat(1, 'Cracked Syndicate Lockbox');
    } else if (poi.info.type === 'CITIZEN_DISPUTE') {
      for (const npc of this.npcs) {
        if (Math.hypot(npc.x - poi.info.x, npc.z - poi.info.z) < 35) {
          npc.profile.playerTrust = Math.min(100, npc.profile.playerTrust + 15);
        }
      }
    }

    const branch: SkillBranchId =
      poi.info.type === 'TIME_TRIAL_RING' ? 'DRIVING' : 'SYNDICATE';
    this.grantSkillXp(
      branch,
      poi.info.rewardXp,
      `${poi.info.title}: +$${cashWon} & +${scrapWon} Salvage`
    );
    soundEngine.playMissionComplete();
    this.spawnParticles(poi.info.x, 1.4, poi.info.z, 0x38bdf8, 16);

    if (this.poiEntities.every((e) => e.info.completed)) {
      this.regenerateProceduralPOIs(undefined, true);
    } else {
      this.emitHud();
    }
  }

  private spawnRoadVehicle(
    type: VehicleType,
    name: string,
    colorHex: number,
    driverStyle: DriverArchetype,
    hasDriver: boolean,
    rawX: number,
    rawZ: number,
    heading: number,
    travelDir: CardinalDir,
    roadLineIndex: number,
    nextInterIx: number,
    nextInterIz: number
  ): SimVehicle {
    const safeRoad = this.constrainVehicleToRoad(rawX, rawZ, heading);
    const rig = buildVehicleModel(type, colorHex, this.shadowTex, this.isSoftwareGl);
    rig.driverGroup.visible = hasDriver;
    rig.group.position.set(safeRoad.x, 0, safeRoad.z);
    rig.group.rotation.y = safeRoad.heading;
    this.scene.add(rig.group);

    const maxSpeed =
      type === 'SPORTS' ? 36 : type === 'POLICE' ? 33 : type === 'SUV' ? 25 : 27;
    const accel = type === 'SPORTS' ? 24 : type === 'POLICE' ? 22 : 17;

    const vehicle: SimVehicle = {
      id: Math.random(),
      type,
      name,
      driverStyle,
      hasDriver,
      rig,
      x: safeRoad.x,
      z: safeRoad.z,
      heading: safeRoad.heading,
      speed: 0,
      maxSpeed,
      accel,
      health: 100,
      isPlayerDriven: false,
      travelDir,
      roadLineIndex,
      nextInterIx,
      nextInterIz,
      laneOffset: 3.2,
      targetLaneOffset: 3.2,
      plannedOutDir: null,
      blinkerSide: 0,
      inTurnArc: false,
      turnProgress: 0,
      turnLength: 10,
      turnStartX: safeRoad.x,
      turnStartZ: safeRoad.z,
      turnCtrlX: safeRoad.x,
      turnCtrlZ: safeRoad.z,
      turnEndX: safeRoad.x,
      turnEndZ: safeRoad.z,
      steerAngle: 0,
      evadeTimer: 0,
      honkCooldown: 0,
      sirenTimer: Math.random() * 5,
    };

    this.vehicles.push(vehicle);
    return vehicle;
  }

  /**
   * GTA-5 Authentic Carjacking: Pulling a driver out of an occupied car spawns a real human
   * driver right outside the door who shouts in a real voice and runs or fights back!
   */
  private ejectCarjackedDriver(v: SimVehicle) {
    const doorLeftX = v.x + Math.cos(v.heading) * 1.85;
    const doorLeftZ = v.z - Math.sin(v.heading) * 1.85;
    const safePos = this.resolveBuildingCollision(doorLeftX, doorLeftZ, 0.45);

    // Repurpose the furthest off-screen ambient civilian so total draw calls remain constant & fast!
    let ejectedNpc: SimNPC | null = null;
    let maxDist = -1;
    for (const cand of this.npcs) {
      if (cand.role === 'OFFICER' || cand.id === this.conversingNpcId) continue;
      const d = Math.hypot(cand.x - this.playerX, cand.z - this.playerZ);
      if (d > maxDist) {
        maxDist = d;
        ejectedNpc = cand;
      }
    }

    if (!ejectedNpc) return;

    ejectedNpc.x = safePos.x;
    ejectedNpc.z = safePos.z;
    ejectedNpc.health = 100;
    ejectedNpc.heading = Math.atan2(v.x - safePos.x, v.z - safePos.z);
    ejectedNpc.rig.group.rotation.x = 0;
    ejectedNpc.rig.group.position.set(
      ejectedNpc.x,
      this.isOnSidewalk(ejectedNpc.x, ejectedNpc.z) ? 0.25 : 0,
      ejectedNpc.z
    );

    const fightsBack = v.driverStyle === 'FREEROAM_RACER';
    ejectedNpc.state = fightsBack ? 'COMBAT' : 'FLEEING';
    ejectedNpc.stateTimer = 7.5;
    if (!fightsBack) {
      ejectedNpc.heading = Math.atan2(safePos.x - v.x, safePos.z - v.z);
    }

    const line = fightsBack
      ? CARJACK_BARKS[3]
      : CARJACK_BARKS[Math.floor(Math.random() * 3)];
    this.triggerNPCBark(ejectedNpc, line, 'ALARMED', 4.2, true, true);
  }

  private syncMissionBeacon() {
    const m = MISSIONS[this.missionIndex % MISSIONS.length];
    this.missionBeaconGroup.position.set(m.targetX, 0, m.targetZ);
  }

  private showNotification(msg: string, duration: number = 3.2) {
    this.notificationText = msg;
    this.notificationTimer = duration;
  }

  public startGame() {
    if (this.screenState === 'BUSTED') {
      this.respawnPlayer();
    }
    this.screenState = 'PLAYING';
    this.emitHud();
  }

  public togglePause() {
    if (this.screenState === 'PLAYING') {
      this.screenState = 'PAUSED';
      soundEngine.stopContinuousSounds();
      soundEngine.stopVoice();
    } else if (this.screenState === 'PAUSED') {
      this.screenState = 'PLAYING';
    }
    this.emitHud();
  }

  public cycleCameraMode() {
    const order: CameraMode[] = ['CHASE', 'HOOD', 'TOP_DOWN'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    this.showNotification(`Camera: ${next.replace('_', ' ')}`, 1.8);
    this.emitHud();
  }

  public setWeatherMode(mode: WeatherMode) {
    this.weather = mode;
    if (mode === 'CLEAR') this.timeOfDay = 10.5;
    if (mode === 'SUNSET') this.timeOfDay = 18.5;
    if (mode === 'NIGHT') this.timeOfDay = 23.0;
    this.emitHud();
  }

  public clearWantedLevel() {
    this.wantedLevel = 0;
    this.timeSinceLastCrime = 0;
    this.showNotification('Police Dispatch Cleared', 2.0);
    this.emitHud();
  }

  public spawnDropSportsCar() {
    const px = this.currentVehicle ? this.currentVehicle.x : this.playerX;
    const pz = this.currentVehicle ? this.currentVehicle.z : this.playerZ;
    // Always deliver custom GT car cleanly onto the nearest asphalt road lane!
    const snap = this.snapToNearestRoadLane(px, pz);
    this.spawnRoadVehicle(
      'SPORTS',
      'Valkyrie GT Custom',
      0xec4899,
      'FREEROAM_RACER',
      false,
      snap.x,
      snap.z,
      snap.heading,
      snap.travelDir,
      snap.roadLineIndex,
      snap.nextInterIx,
      snap.nextInterIz
    );
    this.spawnParticles(snap.x, 1.0, snap.z, 0xfbbf24, 12);
    soundEngine.playDoorChime();
    this.showNotification('Delivered Valkyrie GT Custom on nearest road!', 2.6);
    this.emitHud();
  }

  public toggleMute() {
    const next = !soundEngine.isMuted();
    soundEngine.setMuted(next);
    this.emitHud();
  }

  private respawnPlayer() {
    if (this.currentVehicle) {
      this.currentVehicle.isPlayerDriven = false;
      this.currentVehicle.hasDriver = false;
      this.currentVehicle.rig.driverGroup.visible = false;
      this.currentVehicle = null;
    }
    this.conversingNpcId = null;
    this.playerX = 9.2;
    this.playerZ = 14;
    this.playerHealth = this.playerMaxHealth;
    this.playerArmor = 50;
    this.wantedLevel = 0;
    this.playerCash = Math.max(0, this.playerCash - 150);
    this.playerRig.group.visible = true;
    this.playerRig.group.position.set(this.playerX, 0.25, this.playerZ);

    this.vehicles = this.vehicles.filter((v) => {
      if (v.type === 'POLICE') {
        this.scene.remove(v.rig.group);
        return false;
      }
      return true;
    });
  }

  private addCrimeHeat(amount: number, reason: string) {
    this.timeSinceLastCrime = 0;
    const prev = this.wantedLevel;
    this.wantedLevel = Math.min(5, Math.max(this.wantedLevel, Math.ceil(this.wantedLevel + amount)));
    if (this.wantedLevel > prev) {
      this.showNotification(`Wanted Level ★${this.wantedLevel}: ${reason}`, 2.6);
      this.ensurePoliceUnits();
    }
  }

  private ensurePoliceUnits() {
    const currentPolice = this.vehicles.filter((v) => v.type === 'POLICE').length;
    const desired = Math.min(4, this.wantedLevel);
    const px = this.currentVehicle ? this.currentVehicle.x : this.playerX;
    const pz = this.currentVehicle ? this.currentVehicle.z : this.playerZ;

    for (let i = currentPolice; i < desired; i++) {
      const angle = (i * Math.PI * 0.5) + Math.random() * 0.8;
      const candX = THREE.MathUtils.clamp(px + Math.cos(angle) * 64, -108, 108);
      const candZ = THREE.MathUtils.clamp(pz + Math.sin(angle) * 64, -108, 108);
      const snap = this.snapToNearestRoadLane(candX, candZ);
      this.spawnRoadVehicle(
        'POLICE',
        'LSPD Interceptor',
        0x111827,
        'POLICE',
        true,
        snap.x,
        snap.z,
        snap.heading,
        snap.travelDir,
        snap.roadLineIndex,
        snap.nextInterIx,
        snap.nextInterIz
      );
    }
  }

  private spawnParticles(x: number, y: number, z: number, hexColor: number, count: number) {
    const mat = new THREE.MeshBasicMaterial({ color: hexColor });
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * 8,
        vy: 2.0 + Math.random() * 5.0,
        vz: (Math.random() - 0.5) * 8,
        life: 0,
        maxLife: 0.42 + Math.random() * 0.32,
      });
    }
  }

  private spawnCashDrop(x: number, z: number, amount: number) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.32),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x15803d,
        emissiveIntensity: 0.5,
        roughness: 0.4,
      })
    );
    mesh.position.set(x, 0.28, z);
    this.scene.add(mesh);
    this.cashPickups.push({ mesh, x, z, amount, age: 0 });
  }

  private isOnSidewalk(x: number, z: number): boolean {
    let nearRoad = false;
    for (const idx of GRID_INDICES) {
      const rc = idx * BLOCK_PITCH;
      if (Math.abs(x - rc) < ROAD_WIDTH * 0.5 || Math.abs(z - rc) < ROAD_WIDTH * 0.5) {
        nearRoad = true;
        break;
      }
    }
    return !nearRoad && x > -118 && x < 118 && z > -118 && z < 118;
  }

  private resolveBuildingCollision(
    x: number,
    z: number,
    radius: number
  ): { x: number; z: number; hit: boolean } {
    let rx = THREE.MathUtils.clamp(x, -WORLD_LIMIT, WORLD_LIMIT);
    let rz = THREE.MathUtils.clamp(z, -WORLD_LIMIT, WORLD_LIMIT);
    let hit = false;

    if (rx < -132) {
      rx = -132;
      hit = true;
    }

    for (const b of this.buildingColliders) {
      const closestX = THREE.MathUtils.clamp(rx, b.minX, b.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, b.minZ, b.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        hit = true;
        const dist = Math.sqrt(distSq) || 0.001;
        if (dist > 0.002) {
          rx = closestX + (dx / dist) * radius;
          rz = closestZ + (dz / dist) * radius;
        } else {
          rx = b.maxX + radius;
        }
      }
    }

    return { x: rx, z: rz, hit };
  }

  private findNearbyVehicle(maxDist: number = 5.4): SimVehicle | null {
    if (this.currentVehicle) return null;
    let best: SimVehicle | null = null;
    let bestDist = maxDist;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private toggleEnterExitVehicle() {
    this.conversingNpcId = null;
    if (this.currentVehicle) {
      const v = this.currentVehicle;
      v.isPlayerDriven = false;
      v.hasDriver = false; // Parked empty on the road until someone drives it!
      v.rig.driverGroup.visible = false;
      v.rig.leftBlinkerMat.color.setHex(0x451a03);
      v.rig.rightBlinkerMat.color.setHex(0x451a03);

      // Step out onto the adjacent curb / sidewalk edge cleanly
      const exitX = v.x + Math.cos(v.heading) * 2.4;
      const exitZ = v.z - Math.sin(v.heading) * 2.4;
      const safe = this.resolveBuildingCollision(exitX, exitZ, 0.5);
      this.playerX = safe.x;
      this.playerZ = safe.z;
      this.playerHeading = v.heading;
      this.currentVehicle = null;
      this.playerRig.group.visible = true;
      this.playerRig.group.position.set(
        this.playerX,
        this.isOnSidewalk(this.playerX, this.playerZ) ? 0.25 : 0,
        this.playerZ
      );
      soundEngine.playDoorChime();
      return;
    }

    const nearby = this.findNearbyVehicle(5.6);
    if (nearby) {
      const wasOccupied = nearby.hasDriver;
      if (wasOccupied) {
        this.ejectCarjackedDriver(nearby);
      }

      this.currentVehicle = nearby;
      this.lastPlayerVehicleName = nearby.name;
      nearby.isPlayerDriven = true;
      nearby.hasDriver = true;
      nearby.inTurnArc = false;
      nearby.rig.driverGroup.visible = true;
      nearby.rig.leftBlinkerMat.color.setHex(0x451a03);
      nearby.rig.rightBlinkerMat.color.setHex(0x451a03);
      this.playerRig.group.visible = false;
      soundEngine.playDoorChime();

      if (nearby.type === 'POLICE') {
        this.addCrimeHeat(2, 'Hijacked LSPD Cruiser');
      } else if (wasOccupied) {
        this.addCrimeHeat(1, `Grand Theft Auto (${nearby.name})`);
        this.frightenNearbyNPCs(nearby.x, nearby.z, 16, 'Whoa! They just carjacked somebody right in the street!');
      } else {
        this.showNotification(`Driving ${nearby.name}`, 2.0);
      }
    }
  }

  private frightenNearbyNPCs(ox: number, oz: number, radius: number, shoutLine?: string) {
    let shouted = false;
    for (const npc of this.npcs) {
      if (npc.state === 'RAGDOLL') continue;
      const d = Math.hypot(npc.x - ox, npc.z - oz);
      if (d < radius) {
        if (this.unlockedSkills.has('syn_4_kingpin') && npc.profile.playerTrust >= 55) {
          continue;
        }
        npc.state = 'FLEEING';
        npc.stateTimer = 5.5;
        npc.heading = Math.atan2(npc.x - ox, npc.z - oz);
        if (!shouted && shoutLine) {
          this.triggerNPCBark(npc, shoutLine, 'ALARMED', 3.6, true, false);
          shouted = true;
        }
      }
    }
  }

  private performOnFootMelee() {
    this.conversingNpcId = null;
    this.attackSwingTimer = 0.28;
    soundEngine.playActionPulse();

    const heavyKnuckles = this.unlockedSkills.has('cmb_2_knuckles');
    const reachDist = heavyKnuckles ? 2.1 : 1.6;
    const damage = heavyKnuckles ? 105 : 55;

    const reachX = this.playerX + Math.sin(this.playerHeading) * reachDist;
    const reachZ = this.playerZ + Math.cos(this.playerHeading) * reachDist;

    for (const npc of this.npcs) {
      if (npc.state === 'RAGDOLL') continue;
      const d = Math.hypot(npc.x - reachX, npc.z - reachZ);
      if (d < (heavyKnuckles ? 2.3 : 1.85)) {
        npc.health -= damage;
        npc.profile.playerTrust = Math.max(-100, npc.profile.playerTrust - 50);
        this.spawnParticles(npc.x, 1.2, npc.z, 0xfef08a, 8);
        soundEngine.playImpact(0.7);
        this.cameraShake = 0.26;
        this.hitstopTimer = 0.04;

        if (npc.health <= 0) {
          npc.state = 'RAGDOLL';
          npc.stateTimer = 6.5;
          npc.rig.group.rotation.x = -Math.PI / 2;
          npc.rig.group.position.y = 0.28;
          this.spawnCashDrop(npc.x, npc.z, npc.cashCarry);
          this.grantSkillXp('COMBAT', 45, 'Street Takedown');
          this.addCrimeHeat(1, 'Assault on Pedestrian');
        } else {
          if (npc.role === 'JOGGER' || npc.role === 'OFFICER' || npc.role === 'MECHANIC') {
            npc.state = 'COMBAT';
            npc.stateTimer = 8.0;
            this.triggerNPCBark(
              npc,
              'Big mistake! Let’s settle this right here!',
              'ALARMED',
              3.5,
              true,
              true
            );
          } else {
            npc.state = 'FLEEING';
            npc.stateTimer = 6.0;
            this.triggerNPCBark(
              npc,
              'Help! Officer! Somebody stop them!',
              'ALARMED',
              3.5,
              true,
              true
            );
          }
        }
        this.frightenNearbyNPCs(this.playerX, this.playerZ, 18, 'Whoa, fight breaking out—back up!');
        break;
      }
    }
  }

  private triggerActiveSkills(dt: number) {
    if (this.nitroCooldown > 0) this.nitroCooldown = Math.max(0, this.nitroCooldown - dt);
    if (this.nitroActiveTimer > 0) this.nitroActiveTimer = Math.max(0, this.nitroActiveTimer - dt);
    if (this.shockwaveCooldown > 0) this.shockwaveCooldown = Math.max(0, this.shockwaveCooldown - dt);
    if (this.bribeCooldown > 0) this.bribeCooldown = Math.max(0, this.bribeCooldown - dt);

    if (this.unlockedSkills.has('cmb_4_kevlar') && this.playerArmor < 100) {
      this.playerArmor = Math.min(100, this.playerArmor + 3 * dt);
    }

    if (this.unlockedSkills.has('syn_4_kingpin')) {
      this.kingpinDividendTimer += dt;
      if (this.kingpinDividendTimer >= 10) {
        this.kingpinDividendTimer = 0;
        this.playerCash += 45;
      }
    }

    if (
      this.justPressedKeys.has('KeyX') &&
      this.unlockedSkills.has('drv_3_nitro') &&
      this.currentVehicle &&
      this.nitroCooldown <= 0
    ) {
      this.nitroCooldown = 8.0;
      this.nitroActiveTimer = 2.2;
      this.currentVehicle.speed = Math.min(
        this.currentVehicle.maxSpeed * 1.45,
        Math.max(18, this.currentVehicle.speed + 16)
      );
      soundEngine.playHorn(1.18);
      this.spawnParticles(this.currentVehicle.x, 0.5, this.currentVehicle.z, 0x38bdf8, 14);
      this.grantSkillXp('DRIVING', 30, 'Nitrous Purge Boost!');
    }

    if (
      this.justPressedKeys.has('KeyQ') &&
      this.unlockedSkills.has('cmb_3_shockwave') &&
      !this.currentVehicle &&
      this.shockwaveCooldown <= 0
    ) {
      this.shockwaveCooldown = 12.0;
      soundEngine.playImpact(1.0);
      this.cameraShake = 0.5;
      this.spawnParticles(this.playerX, 0.9, this.playerZ, 0xf43f5e, 20);
      let hitCount = 0;
      for (const npc of this.npcs) {
        if (npc.state === 'RAGDOLL') continue;
        if (Math.hypot(npc.x - this.playerX, npc.z - this.playerZ) < 8.0) {
          npc.state = 'RAGDOLL';
          npc.stateTimer = 5.5;
          npc.rig.group.rotation.x = -Math.PI / 2;
          npc.rig.group.position.y = 0.28;
          hitCount++;
        }
      }
      this.grantSkillXp('COMBAT', 40 + hitCount * 15, 'Concussive Shockwave!');
    }

    if (
      this.justPressedKeys.has('KeyZ') &&
      this.unlockedSkills.has('syn_3_ghost_dispatch') &&
      this.wantedLevel > 0 &&
      this.bribeCooldown <= 0
    ) {
      this.bribeCooldown = 20.0;
      this.wantedLevel = Math.max(0, this.wantedLevel - 2);
      soundEngine.playDoorChime();
      this.grantSkillXp('SYNDICATE', 50, 'LSPD Scanner Jammed (-2 ★)');
    }
  }

  private updateAtmosphere(dt: number) {
    // Animate Pacific Ocean normal waves & Vespucci beach surf foam
    if (this.waterNormalTex) {
      this.waterNormalTex.offset.x = (this.waterNormalTex.offset.x + dt * 0.042) % 1;
      this.waterNormalTex.offset.y = (this.waterNormalTex.offset.y + dt * 0.026) % 1;
    }
    if (this.surfFoamMesh) {
      this.surfFoamMesh.position.x = -148.5 + Math.sin(this.elapsedSeconds * 1.6) * 1.4;
    }
    if (this.customsRingMesh) {
      this.customsRingMesh.rotation.z -= dt * 1.6;
    }

    // Real-time 1:1 clock pacing: 1 elapsed second = 1 clock second
    this.timeOfDay = (this.timeOfDay + dt / 3600) % 24;
    const sunAngle = ((this.timeOfDay - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(sunAngle);

    const skyColor = new THREE.Color();
    const sunColor = new THREE.Color();
    let windowEmissive = 0.2;

    if (elevation > 0.25) {
      skyColor.setHex(0x93c5fd);
      sunColor.setHex(0xfff6e0);
      this.skyDomeMat.color.setHex(0xffffff);
      this.sunOrbMat.color.setHex(0xfffbeb);
      this.sunLight.intensity = 2.25;
      this.hemiLight.intensity = 0.95;
      this.streetLampBulbMat.color.setHex(0x64748b);
      windowEmissive = 0.16;
    } else if (elevation > -0.12) {
      const t = (elevation + 0.12) / 0.37;
      skyColor.lerpColors(new THREE.Color(0xf97316), new THREE.Color(0x93c5fd), t);
      sunColor.setHex(0xfb923c);
      this.skyDomeMat.color.lerpColors(new THREE.Color(0xfdba74), new THREE.Color(0xffffff), t);
      this.sunOrbMat.color.setHex(0xf97316);
      this.sunLight.intensity = 1.55;
      this.hemiLight.intensity = 0.7;
      this.streetLampBulbMat.color.setHex(0xfef08a);
      windowEmissive = THREE.MathUtils.lerp(0.95, 0.24, t);
    } else {
      skyColor.setHex(0x0b1324);
      sunColor.setHex(0x60a5fa);
      this.skyDomeMat.color.setHex(0x1e293b);
      this.sunOrbMat.color.setHex(0xe2e8f0);
      this.sunLight.intensity = 0.62;
      this.hemiLight.intensity = 0.48;
      this.streetLampBulbMat.color.setHex(0xfef08a);
      windowEmissive = 1.15;
    }

    for (const mat of this.buildingMaterials) {
      mat.emissiveIntensity = windowEmissive;
    }

    this.scene.background = skyColor;
    this.fog.color.copy(skyColor);

    const focusX = this.currentVehicle ? this.currentVehicle.x : this.playerX;
    const focusZ = this.currentVehicle ? this.currentVehicle.z : this.playerZ;
    this.sunLight.position.set(
      focusX + Math.cos(sunAngle) * 85,
      Math.max(28, Math.abs(elevation) * 115 + 25),
      focusZ + 55
    );
    this.sunLight.target.position.set(focusX, 0, focusZ);
    this.sunLight.color.copy(sunColor);

    this.sunOrbMesh.position.set(
      Math.cos(sunAngle) * 380,
      Math.max(32, elevation * 260 + 68),
      -260
    );
  }

  private updateTrafficLights(dt: number) {
    this.trafficPhaseTimer += dt;
    if (this.trafficPhaseTimer > 16.0) {
      this.trafficPhaseTimer = 0;
      this.nsGreen = !this.nsGreen;
      const nsHex = this.nsGreen ? 0x22c55e : 0xef4444;
      const ewHex = this.nsGreen ? 0xef4444 : 0x22c55e;
      for (const b of this.trafficBulbs) {
        b.nsBulb.color.setHex(nsHex);
        b.ewBulb.color.setHex(ewHex);
      }
    }
  }

  // ==========================================================================
  // MOBILE TOUCHSCREEN + PC MOUSE "ARROW" LOOK & ANALOG JOYSTICK API
  // ==========================================================================

  /**
   * Rotates the 3D free-look camera ("the arrow") from Touchscreen swipe OR PC Mouse movement.
   * Moving right (dxPx > 0) turns right; moving up (dyPx < 0) looks up.
   */
  public rotateCameraLook(dxPx: number, dyPx: number, sensitivity: number = 0.0055) {
    if (this.screenState !== 'PLAYING') return;
    this.cameraYaw = normalizeAngle(this.cameraYaw - dxPx * sensitivity);
    this.cameraPitch = THREE.MathUtils.clamp(
      this.cameraPitch - dyPx * sensitivity * 0.65,
      -0.32,
      0.56
    );
    this.timeSinceLastLookInput = 0;
  }

  public setTouchJoystick(x: number, y: number) {
    this.touchMoveX = THREE.MathUtils.clamp(x, -1, 1);
    this.touchMoveY = THREE.MathUtils.clamp(y, -1, 1);
  }

  public setTouchThrottle(val: number) {
    this.touchThrottle = THREE.MathUtils.clamp(val, -1, 1);
  }

  public setTouchSprint(held: boolean) {
    this.touchSprintHeld = held;
  }

  public setTouchHandbrake(held: boolean) {
    this.touchHandbrakeHeld = held;
  }

  public cycleRadioStation() {
    this.radioStationIndex = (this.radioStationIndex + 1) % RADIO_STATIONS.length;
    soundEngine.playDoorChime();
    this.showNotification(`Radio: ${RADIO_STATIONS[this.radioStationIndex]}`, 2.0);
    this.emitHud();
  }

  public triggerTouchVehicleToggle() {
    if (this.screenState !== 'PLAYING') return;
    this.toggleEnterExitVehicle();
    if (this.currentVehicle) {
      this.cameraYaw = this.currentVehicle.heading;
    }
    this.emitHud();
  }

  public triggerTouchMelee() {
    if (this.screenState !== 'PLAYING' || this.currentVehicle) return;
    this.performOnFootMelee();
    this.emitHud();
  }

  public triggerTouchAimShot() {
    if (this.screenState !== 'PLAYING' || this.currentVehicle) return;
    this.performAimedTacticalShot();
    this.emitHud();
  }

  public triggerTouchPOI() {
    if (this.screenState !== 'PLAYING') return;
    this.interactWithNearbyPOI();
    this.emitHud();
  }

  public triggerTouchHorn() {
    if (this.screenState !== 'PLAYING' || !this.currentVehicle) return;
    soundEngine.playHorn();
    const pv = this.currentVehicle;
    this.frightenNearbyNPCs(
      pv.x,
      pv.z,
      15,
      DODGE_BARKS[Math.floor(Math.random() * DODGE_BARKS.length)]
    );
    for (const v of this.vehicles) {
      if (v === pv || !v.hasDriver) continue;
      if (Math.hypot(v.x - pv.x, v.z - pv.z) < 22) {
        v.targetLaneOffset = v.laneOffset > 2.2 ? 4.3 : 2.0;
        v.evadeTimer = 3.0;
      }
    }
  }

  public triggerTouchSkill(skill: 'NITRO' | 'PULSE' | 'JAMMER') {
    if (this.screenState !== 'PLAYING') return;
    if (skill === 'NITRO') this.justPressedKeys.add('KeyX');
    if (skill === 'PULSE') this.justPressedKeys.add('KeyQ');
    if (skill === 'JAMMER') this.justPressedKeys.add('KeyZ');
  }

  /**
   * Fires a high-velocity tactical pulse straight along the Touchscreen / PC Mouse "Arrow" reticle!
   */
  private performAimedTacticalShot() {
    if (this.shotCooldownTimer > 0) return;
    this.shotCooldownTimer = 0.26;
    this.conversingNpcId = null;

    // Snap player torso toward the "arrow" look direction when firing!
    this.playerHeading = this.cameraYaw;
    this.playerRig.group.rotation.y = this.playerHeading;
    this.attackSwingTimer = 0.18;

    soundEngine.playStunShot();
    this.cameraShake = 0.14;

    const dirX = Math.sin(this.cameraYaw);
    const dirY = Math.sin(this.cameraPitch) * 0.45;
    const dirZ = Math.cos(this.cameraYaw);

    const startY = (this.isOnSidewalk(this.playerX, this.playerZ) ? 0.25 : 0) + 1.38;
    const startX = this.playerX + dirX * 0.65;
    const startZ = this.playerZ + dirZ * 0.65;

    const tracerMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 1.35),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    tracerMesh.position.set(startX, startY, startZ);
    tracerMesh.rotation.y = this.cameraYaw;
    this.scene.add(tracerMesh);
    this.shotTracers.push({
      mesh: tracerMesh,
      vx: dirX * 82,
      vy: dirY * 82,
      vz: dirZ * 82,
      life: 0,
      maxLife: 0.36,
    });

    // Raycast hit check along the camera aim arrow against NPCs & Vehicles (up to 34m)
    let hitNpc: SimNPC | null = null;
    let bestT = 34;

    for (const npc of this.npcs) {
      if (npc.state === 'RAGDOLL') continue;
      const rx = npc.x - this.playerX;
      const rz = npc.z - this.playerZ;
      const proj = rx * dirX + rz * dirZ;
      if (proj > 0.8 && proj < bestT) {
        const perp = Math.abs(rx * dirZ - rz * dirX);
        if (perp < 1.15) {
          bestT = proj;
          hitNpc = npc;
        }
      }
    }

    if (hitNpc) {
      const dmg = this.unlockedSkills.has('cmb_2_knuckles') ? 75 : 52;
      hitNpc.health -= dmg;
      hitNpc.profile.playerTrust = Math.max(-100, hitNpc.profile.playerTrust - 55);
      this.spawnParticles(hitNpc.x, 1.25, hitNpc.z, 0x38bdf8, 10);
      soundEngine.playImpact(0.65);

      if (hitNpc.health <= 0) {
        hitNpc.state = 'RAGDOLL';
        hitNpc.stateTimer = 6.5;
        hitNpc.rig.group.rotation.x = -Math.PI / 2;
        hitNpc.rig.group.position.y = 0.28;
        this.spawnCashDrop(hitNpc.x, hitNpc.z, hitNpc.cashCarry);
        this.grantSkillXp('COMBAT', 50, 'Tactical Takedown');
        this.addCrimeHeat(1, 'Discharged Tactical Pulse');
      } else {
        hitNpc.state =
          hitNpc.role === 'OFFICER' || hitNpc.role === 'MECHANIC' ? 'COMBAT' : 'FLEEING';
        hitNpc.stateTimer = 7.5;
        this.triggerNPCBark(
          hitNpc,
          'Shots fired!! Take cover right now!!',
          'ALARMED',
          3.8,
          true,
          true
        );
        this.addCrimeHeat(1, 'Street Firefight');
      }
      this.frightenNearbyNPCs(this.playerX, this.playerZ, 22, 'Everybody get down!!');
      return;
    }

    // Check vehicle hit along the arrow ray
    for (const v of this.vehicles) {
      const rx = v.x - this.playerX;
      const rz = v.z - this.playerZ;
      const proj = rx * dirX + rz * dirZ;
      if (proj > 1.2 && proj < 34) {
        const perp = Math.abs(rx * dirZ - rz * dirX);
        if (perp < 1.85) {
          v.health = Math.max(25, v.health - 18);
          this.spawnParticles(v.x, 0.95, v.z, 0xfbbf24, 9);
          soundEngine.playImpact(0.6);
          if (v.hasDriver && v.type !== 'POLICE') {
            v.driverStyle = 'FREEROAM_RACER';
            v.evadeTimer = 5.0;
            v.targetLaneOffset = v.laneOffset > 0 ? -2.6 : 3.4;
            soundEngine.playHorn(1.12);
          } else if (v.type === 'POLICE') {
            this.addCrimeHeat(2, 'Fired on LSPD Cruiser');
          }
          break;
        }
      }
    }
  }

  private updatePlayer(dt: number) {
    this.triggerActiveSkills(dt);
    this.timeSinceLastLookInput += dt;
    if (this.shotCooldownTimer > 0) this.shotCooldownTimer = Math.max(0, this.shotCooldownTimer - dt);
    if (this.customsCooldown > 0) this.customsCooldown = Math.max(0, this.customsCooldown - dt);
    if (this.nearMissCooldown > 0) this.nearMissCooldown = Math.max(0, this.nearMissCooldown - dt);

    if (this.justPressedKeys.has('KeyF')) {
      this.toggleEnterExitVehicle();
      if (this.currentVehicle) this.cameraYaw = this.currentVehicle.heading;
    }
    if (this.justPressedKeys.has('KeyE')) {
      if (this.conversingNpcId !== null) {
        this.selectNPCDialogueOption('LEAVE');
      } else if (this.findNearbyNPC(4.5)) {
        this.openNearbyNPCConversation();
      } else {
        this.toggleEnterExitVehicle();
      }
    }
    if (this.justPressedKeys.has('KeyG')) {
      this.interactWithNearbyPOI();
    }
    if (this.justPressedKeys.has('KeyR')) {
      if (this.currentVehicle) {
        this.cycleRadioStation();
      } else {
        this.performAimedTacticalShot();
      }
    }
    if (this.justPressedKeys.has('KeyC') || this.justPressedKeys.has('KeyV')) {
      this.cycleCameraMode();
    }

    const kbForward =
      (this.heldKeys.has('KeyW') || this.heldKeys.has('ArrowUp') ? 1 : 0) -
      (this.heldKeys.has('KeyS') || this.heldKeys.has('ArrowDown') ? 1 : 0);
    const kbTurn =
      (this.heldKeys.has('KeyA') || this.heldKeys.has('ArrowLeft') ? 1 : 0) -
      (this.heldKeys.has('KeyD') || this.heldKeys.has('ArrowRight') ? 1 : 0);

    const joyMag = Math.hypot(this.touchMoveX, this.touchMoveY);

    // PUSH-UP AUTO-SPRINT RULE:
    // Normal joystick tilt walks/jogs; keeping the joystick pushed UP at the top locks into SPRINT/RUN!
    const pushUpAutoSprint =
      !this.currentVehicle &&
      this.touchMoveY >= 0.78 &&
      Math.abs(this.touchMoveX) <= 0.56;

    const sprinting =
      this.heldKeys.has('ShiftLeft') ||
      this.heldKeys.has('ShiftRight') ||
      this.touchSprintHeld ||
      pushUpAutoSprint;
    this.isCurrentlySprinting = Boolean(!this.currentVehicle && sprinting);

    const handbrake = this.heldKeys.has('Space') || this.touchHandbrakeHeld;

    if (this.currentVehicle) {
      const v = this.currentVehicle;

      if (this.justPressedKeys.has('KeyH')) {
        this.triggerTouchHorn();
      }

      const driveForward =
        this.touchThrottle !== 0
          ? this.touchThrottle
          : Math.abs(this.touchMoveY) > 0.22
          ? this.touchMoveY
          : kbForward;
      const driveTurn = Math.abs(this.touchMoveX) > 0.08 ? -this.touchMoveX : kbTurn;

      const torqueMult = this.unlockedSkills.has('drv_1_torque') ? 1.22 : 1.0;
      const topSpeedMult =
        (this.unlockedSkills.has('drv_1_torque') ? 1.12 : 1.0) *
        (this.nitroActiveTimer > 0 ? 1.32 : 1.0);
      const gripMult = this.unlockedSkills.has('drv_2_chassis') ? 1.25 : 1.0;

      if (driveForward > 0.05 || this.nitroActiveTimer > 0) {
        v.speed += v.accel * Math.max(0.4, driveForward) * torqueMult * dt;
      } else if (driveForward < -0.05) {
        v.speed += v.accel * driveForward * 1.15 * dt;
      } else {
        v.speed *= Math.exp(-2.2 * dt);
      }

      if (handbrake) {
        v.speed *= Math.exp(-4.6 * dt);
        if (Math.abs(v.speed) > 9) {
          soundEngine.playTireScreech(0.75);
          this.smokeEmitTimer += dt;
          if (this.smokeEmitTimer > 0.08) {
            this.smokeEmitTimer = 0;
            this.spawnParticles(v.x, 0.25, v.z, 0xe2e8f0, 2);
          }
        }
      }

      const effectiveMax = v.maxSpeed * topSpeedMult;
      v.speed = THREE.MathUtils.clamp(v.speed, -v.maxSpeed * 0.42, effectiveMax);

      if (Math.abs(v.speed) > 0.4) {
        const steerSign = v.speed >= 0 ? 1 : -1;
        const steerRate = (handbrake ? 3.25 : 2.4) * gripMult;
        v.heading += driveTurn * steerRate * steerSign * Math.min(1, Math.abs(v.speed) / 7) * dt;
      }

      v.steerAngle = THREE.MathUtils.damp(v.steerAngle, driveTurn * 0.44, 12, dt);
      for (const pivot of v.rig.frontWheelPivots) {
        pivot.rotation.y = v.steerAngle;
      }

      if (Math.abs(v.speed) > 18) {
        this.drivingXpAccumulator += dt * Math.abs(v.speed) * 0.45;
        if (this.drivingXpAccumulator >= 35) {
          this.drivingXpAccumulator = 0;
          this.grantSkillXp('DRIVING', 35);
        }
        if (this.unlockedSkills.has('drv_4_autorepair') && v.health < 100) {
          v.health = Math.min(100, v.health + 6 * dt);
        }

        // GTA High-Speed Near-Miss Street Challenge
        if (this.nearMissCooldown <= 0) {
          for (const other of this.vehicles) {
            if (other === v) continue;
            const dNear = Math.hypot(other.x - v.x, other.z - v.z);
            if (dNear > 3.25 && dNear < 4.5) {
              this.nearMissCooldown = 3.2;
              this.playerCash += 40;
              this.grantSkillXp('DRIVING', 25, 'High-Speed Near Miss! +$40');
              break;
            }
          }
        }
      }

      (v.rig.brakeLights.material as THREE.MeshBasicMaterial).color.setHex(
        driveForward < -0.05 || handbrake ? 0xff2a2a : 0x7f1d1d
      );

      const nextX = v.x + Math.sin(v.heading) * v.speed * dt;
      const nextZ = v.z + Math.cos(v.heading) * v.speed * dt;

      // STRICT ROAD CONTAINMENT: Player's car stays 100% on the asphalt road!
      const roadClamp = this.constrainVehicleToRoad(nextX, nextZ, v.heading);

      if (roadClamp.hitCurb && Math.abs(v.speed) > 9) {
        const dmgScale = this.unlockedSkills.has('drv_2_chassis') ? 0.45 : 1.0;
        soundEngine.playImpact(Math.min(0.65, Math.abs(v.speed) / 34));
        this.cameraShake = Math.min(0.32, Math.abs(v.speed) * 0.012);
        this.spawnParticles(roadClamp.x, 0.35, roadClamp.z, 0xfbbf24, 3);
        v.health = Math.max(20, v.health - Math.abs(v.speed) * 0.14 * dmgScale);
        v.speed *= 0.86;
      }

      v.x = roadClamp.x;
      v.z = roadClamp.z;
      v.heading = roadClamp.heading;
      v.rig.group.position.set(v.x, 0, v.z);
      v.rig.group.rotation.y = v.heading;
      v.rig.group.rotation.z = THREE.MathUtils.damp(
        v.rig.group.rotation.z,
        -driveTurn * Math.min(0.085, Math.abs(v.speed) * 0.0032),
        10,
        dt
      );

      for (const w of v.rig.wheels) {
        w.rotation.x += v.speed * dt * 2.2;
      }

      // Check Solis Customs Drive-Thru Road Gantry (x = 56, z = -26)
      if (
        this.customsCooldown <= 0 &&
        Math.hypot(v.x - CUSTOMS_ROAD_X, v.z - CUSTOMS_ROAD_Z) < 5.6
      ) {
        this.customsCooldown = 9.0;
        v.health = 100;
        this.resprayColorIndex = (this.resprayColorIndex + 1) % CUSTOMS_RESPRAY_COLORS.length;
        const freshPaint = CUSTOMS_RESPRAY_COLORS[this.resprayColorIndex];
        v.rig.bodyMat.color.setHex(freshPaint);
        if (this.wantedLevel > 0) {
          this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        }
        soundEngine.playMissionComplete();
        this.spawnParticles(v.x, 1.3, v.z, freshPaint, 18);
        this.grantSkillXp('DRIVING', 55, 'Solis Customs: Repaired & Resprayed!');
      }

      this.playerX = v.x;
      this.playerZ = v.z;
      this.playerHeading = v.heading;

      // Gently align chase camera behind the car if user isn't actively swiping/moving the look arrow
      if (this.timeSinceLastLookInput > 1.8 && Math.abs(v.speed) > 1.5) {
        const diff = normalizeAngle(v.heading - this.cameraYaw);
        this.cameraYaw = normalizeAngle(this.cameraYaw + diff * Math.min(1, dt * 3.8));
      }

      soundEngine.updateEngine(true, v.speed / v.maxSpeed, Math.abs(driveForward) > 0.05);
      soundEngine.updateRadio(true, this.radioStationIndex, dt);
    } else {
      soundEngine.updateEngine(false, 0, false);

      if (this.justPressedKeys.has('Space')) {
        this.performOnFootMelee();
      }

      const sprintBonus = this.unlockedSkills.has('cmb_1_conditioning') ? 1.2 : 1.0;
      const baseFootSpeed = (sprinting ? 10.2 : 5.0) * sprintBonus;
      let moveX = 0;
      let moveZ = 0;

      const analogForward = joyMag > 0.08 ? this.touchMoveY : kbForward;
      const analogRight = joyMag > 0.08 ? this.touchMoveX : -kbTurn;

      if (Math.abs(analogForward) > 0.05 || Math.abs(analogRight) > 0.05) {
        if (this.conversingNpcId !== null) {
          const convNpc = this.npcs.find((n) => n.id === this.conversingNpcId);
          if (convNpc && Math.hypot(convNpc.x - this.playerX, convNpc.z - this.playerZ) > 5.8) {
            convNpc.profile.lastCustomReply = null;
            convNpc.state = 'SCHEDULE_COMMUTE';
            this.conversingNpcId = null;
          }
        }

        // Exact Three.js camera-relative movement:
        // Camera Forward = (sin(cameraYaw), cos(cameraYaw)); Screen-Right = (-cos(cameraYaw), sin(cameraYaw))
        const inputAngle = Math.atan2(analogRight, analogForward);
        const worldAngle = this.cameraYaw - inputAngle;
        const speedScale = sprinting
          ? 1.0
          : joyMag > 0.08
          ? Math.min(1, Math.max(0.35, joyMag))
          : 1;
        const effectiveSpeed = baseFootSpeed * speedScale;

        moveX = Math.sin(worldAngle) * effectiveSpeed;
        moveZ = Math.cos(worldAngle) * effectiveSpeed;
        this.playerSpeed = effectiveSpeed;

        const angleDiff = normalizeAngle(worldAngle - this.playerHeading);
        this.playerHeading += angleDiff * Math.min(1, dt * 13);

        this.playerWalkCycle += dt * (sprinting ? 14.5 : 8.8) * speedScale;
      } else {
        this.playerSpeed = 0;
        this.isCurrentlySprinting = false;
      }

      const res = this.resolveBuildingCollision(
        this.playerX + moveX * dt,
        this.playerZ + moveZ * dt,
        0.48
      );
      this.playerX = res.x;
      this.playerZ = res.z;

      const groundY = this.isOnSidewalk(this.playerX, this.playerZ) ? 0.25 : 0;
      this.playerRig.group.position.set(this.playerX, groundY, this.playerZ);
      this.playerRig.group.rotation.y = this.playerHeading;

      if (this.attackSwingTimer > 0) this.attackSwingTimer -= dt;

      poseCharacterRig(this.playerRig, {
        walkCycle: this.playerWalkCycle,
        speed: this.playerSpeed,
        sprinting: sprinting && this.playerSpeed > 0,
        idleTime: this.elapsedSeconds,
        talking: this.conversingNpcId !== null,
        meleeSwing: this.attackSwingTimer > 0,
      });
    }
  }

  // ==========================================================================
  // GTA-5 MULTI-DRIVER ROAD GRAPH AI: AUTONOMOUS TURNS, BLINKERS & LANE SWERVES
  // Cars run 100% on the road, turn left/right/U-turn at intersections, overtake
  // slower cars, honk, and roam around San Solis like other live players!
  // ==========================================================================

  private chooseValidIntersectionTurn(v: SimVehicle, ix: number, iz: number): CardinalDir {
    const cur = v.travelDir;
    const candidates: CardinalDir[] = [];

    const checkValid = (dir: CardinalDir) => {
      const d = DIR_DELTA[dir];
      const nix = ix + d.dix;
      const niz = iz + d.diz;
      return nix >= -2 && nix <= 2 && niz >= -2 && niz <= 2;
    };

    const leftDir = TURN_LEFT_MAP[cur];
    const rightDir = TURN_RIGHT_MAP[cur];
    const straightOk = checkValid(cur);
    const leftOk = checkValid(leftDir);
    const rightOk = checkValid(rightDir);

    if (straightOk) candidates.push(cur);
    if (leftOk) candidates.push(leftDir);
    if (rightOk) candidates.push(rightDir);

    if (candidates.length === 0) {
      return TURN_UTURN_MAP[cur];
    }

    // LSPD Police Interceptors dynamically pick the road avenue that closes in on the player!
    if (v.type === 'POLICE' && this.wantedLevel > 0) {
      let bestDir = candidates[0];
      let bestScore = Infinity;
      for (const c of candidates) {
        const d = DIR_DELTA[c];
        const nextX = (ix + d.dix) * BLOCK_PITCH;
        const nextZ = (iz + d.diz) * BLOCK_PITCH;
        const distToPlayer = Math.hypot(this.playerX - nextX, this.playerZ - nextZ);
        if (distToPlayer < bestScore) {
          bestScore = distToPlayer;
          bestDir = c;
        }
      }
      return bestDir;
    }

    // Freeroam Street Racers ("like other players playing and going here and there") turn frequently to explore!
    if (v.driverStyle === 'FREEROAM_RACER') {
      const turnChoices = candidates.filter((c) => c !== cur);
      if (turnChoices.length > 0 && Math.random() < 0.65) {
        return turnChoices[Math.floor(Math.random() * turnChoices.length)];
      }
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    // Everyday city drivers mix straight cruising with frequent left & right turns across districts
    if (straightOk && Math.random() < 0.44) {
      return cur;
    }
    const turnsOnly = candidates.filter((c) => c !== cur);
    if (turnsOnly.length > 0) {
      return turnsOnly[Math.floor(Math.random() * turnsOnly.length)];
    }
    return candidates[0];
  }

  private beginIntersectionTurnArc(v: SimVehicle, ix: number, iz: number, outDir: CardinalDir) {
    const cx = ix * BLOCK_PITCH;
    const cz = iz * BLOCK_PITCH;
    const inDelta = DIR_DELTA[v.travelDir];
    const outDelta = DIR_DELTA[outDir];

    // Right-hand vectors (-fz, fx)
    const inRx = -inDelta.fz;
    const inRz = inDelta.fx;
    const outRx = -outDelta.fz;
    const outRz = outDelta.fx;

    const outLane = 3.2;

    v.turnStartX = v.x;
    v.turnStartZ = v.z;
    v.turnEndX = cx + outDelta.fx * 7.0 + outRx * outLane;
    v.turnEndZ = cz + outDelta.fz * 7.0 + outRz * outLane;

    if (outDir === v.travelDir) {
      // Straight across intersection (smooth lane alignment)
      v.turnCtrlX = (v.turnStartX + v.turnEndX) * 0.5;
      v.turnCtrlZ = (v.turnStartZ + v.turnEndZ) * 0.5;
    } else if (outDir === TURN_UTURN_MAP[v.travelDir]) {
      // Clean U-Turn inside intersection box
      v.turnCtrlX = cx + inDelta.fx * 2.5;
      v.turnCtrlZ = cz + inDelta.fz * 2.5;
    } else {
      // Exact orthogonal lane-intersection Bezier control point (100% inside asphalt box!)
      v.turnCtrlX = cx + inRx * v.laneOffset + outRx * outLane;
      v.turnCtrlZ = cz + inRz * v.laneOffset + outRz * outLane;
    }

    const chord = Math.hypot(v.turnEndX - v.turnStartX, v.turnEndZ - v.turnStartZ);
    v.turnLength = Math.max(6.5, chord * 1.16);
    v.turnProgress = 0;
    v.inTurnArc = true;
    v.travelDir = outDir;
    v.laneOffset = outLane;
    v.targetLaneOffset = outLane;
    v.roadLineIndex = outDir === 'N' || outDir === 'S' ? ix : iz;
    v.nextInterIx = THREE.MathUtils.clamp(ix + outDelta.dix, -2, 2);
    v.nextInterIz = THREE.MathUtils.clamp(iz + outDelta.diz, -2, 2);
  }

  private updateVehiclesAI(dt: number) {
    let nearestPoliceDist = 999;
    const blinkPulse = Math.sin(this.elapsedSeconds * 9.5) > 0;

    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];

      if (v.honkCooldown > 0) v.honkCooldown -= dt;
      if (v.evadeTimer > 0) {
        v.evadeTimer -= dt;
        if (v.evadeTimer <= 0) {
          v.targetLaneOffset = 3.2;
        }
      }

      if (v.rig.sirenBar) {
        if (this.wantedLevel > 0) {
          v.sirenTimer += dt * 9;
          const flash = Math.sin(v.sirenTimer) > 0;
          (v.rig.sirenBar.redLight.material as THREE.MeshBasicMaterial).color.setHex(
            flash ? 0xff3b3b : 0x450a0a
          );
          (v.rig.sirenBar.blueLight.material as THREE.MeshBasicMaterial).color.setHex(
            !flash ? 0x3b82f6 : 0x172554
          );
        } else {
          (v.rig.sirenBar.redLight.material as THREE.MeshBasicMaterial).color.setHex(0x450a0a);
          (v.rig.sirenBar.blueLight.material as THREE.MeshBasicMaterial).color.setHex(0x172554);
        }
      }

      if (v.isPlayerDriven) continue;

      // Driverless parked cars coast to a stop on the road and stay parked until driven!
      if (!v.hasDriver) {
        v.speed = THREE.MathUtils.damp(v.speed, 0, 5.0, dt);
        if (Math.abs(v.speed) > 0.05) {
          const nx = v.x + Math.sin(v.heading) * v.speed * dt;
          const nz = v.z + Math.cos(v.heading) * v.speed * dt;
          const clamped = this.constrainVehicleToRoad(nx, nz, v.heading);
          v.x = clamped.x;
          v.z = clamped.z;
          v.heading = clamped.heading;
        }
        this.resolvePlayerCarCollision(v);
        v.rig.group.position.set(v.x, 0, v.z);
        v.rig.group.rotation.y = v.heading;
        continue;
      }

      if (v.type === 'POLICE' && this.wantedLevel > 0) {
        const distP = Math.hypot(this.playerX - v.x, this.playerZ - v.z);
        nearestPoliceDist = Math.min(nearestPoliceDist, distP);

        if (distP < 4.0) {
          if (this.currentVehicle) {
            if (Math.abs(this.currentVehicle.speed) < 3.5) {
              this.playerHealth -= 18 * dt;
            }
          } else {
            this.playerHealth -= 28 * dt;
          }
          if (this.playerHealth <= 0 && this.screenState === 'PLAYING') {
            this.playerHealth = 0;
            this.screenState = 'BUSTED';
            soundEngine.stopContinuousSounds();
            this.emitHud();
          }
        }
      }

      // Check obstacles ahead (player on foot/car, crossing pedestrians, or slower vehicles)
      const fwdX = Math.sin(v.heading);
      const fwdZ = Math.cos(v.heading);
      let shouldStop = false;
      let obstacleToPass: { x: number; z: number; speed: number } | null = null;

      // 1. Check player ahead
      const dxP = this.playerX - v.x;
      const dzP = this.playerZ - v.z;
      const aheadPlayer = dxP * fwdX + dzP * fwdZ;
      const latPlayer = dxP * fwdZ - dzP * fwdX; // Signed lateral offset
      if (aheadPlayer > 1.2 && aheadPlayer < 15.5 && Math.abs(latPlayer) < 2.6) {
        if (v.type === 'POLICE' && this.wantedLevel > 0) {
          // Police nudge toward player's lane on the road to intercept!
          v.targetLaneOffset = THREE.MathUtils.clamp(v.laneOffset - Math.sign(latPlayer) * 1.4, -4.5, 4.8);
        } else if (aheadPlayer > 5.5 && !v.inTurnArc) {
          // Smart GTA Driver Evasion: Swerve into adjacent clear lane on the road to drive around you!
          obstacleToPass = {
            x: this.playerX,
            z: this.playerZ,
            speed: this.currentVehicle ? Math.abs(this.currentVehicle.speed) : 0,
          };
        } else {
          shouldStop = true;
        }
      }

      // 2. Yield to pedestrians in crosswalks
      if (!(v.type === 'POLICE' && this.wantedLevel > 0)) {
        for (const npc of this.npcs) {
          if (npc.state === 'RAGDOLL') continue;
          const dxN = npc.x - v.x;
          const dzN = npc.z - v.z;
          const aheadN = dxN * fwdX + dzN * fwdZ;
          const latN = Math.abs(dxN * fwdZ - dzN * fwdX);
          if (aheadN > 1.0 && aheadN < 9.5 && latN < 2.2) {
            shouldStop = true;
            break;
          }
        }
      }

      // 3. Check other vehicles ahead (queue cleanly OR change lanes to overtake like real players!)
      for (let j = 0; j < this.vehicles.length; j++) {
        if (i === j) continue;
        const other = this.vehicles[j];
        const dx = other.x - v.x;
        const dz = other.z - v.z;
        const ahead = dx * fwdX + dz * fwdZ;
        const lateral = Math.abs(dx * fwdZ - dz * fwdX);
        if (ahead > 1.8 && ahead < 12.5 && lateral < 2.3) {
          if (
            !v.inTurnArc &&
            ahead > 5.2 &&
            (v.driverStyle === 'FREEROAM_RACER' ||
              (v.type === 'POLICE' && this.wantedLevel > 0) ||
              Math.abs(other.speed) < 2.5)
          ) {
            obstacleToPass = { x: other.x, z: other.z, speed: Math.abs(other.speed) };
          } else {
            shouldStop = true;
          }
          break;
        }
      }

      // Execute smart lane-change swerve within the asphalt road when overtaking/evading!
      if (obstacleToPass && !v.inTurnArc && v.evadeTimer <= 0) {
        v.targetLaneOffset = v.laneOffset > 0.5 ? -2.6 : 3.4;
        v.evadeTimer = 3.4;
        if (
          v.honkCooldown <= 0 &&
          Math.hypot(v.x - this.playerX, v.z - this.playerZ) < 26
        ) {
          v.honkCooldown = 6.5;
          soundEngine.playHorn(0.92 + (i % 4) * 0.08);
        }
      }

      // Plan turn & check traffic signal before entering the upcoming intersection
      const interX = v.nextInterIx * BLOCK_PITCH;
      const interZ = v.nextInterIz * BLOCK_PITCH;
      const dInfo = DIR_DELTA[v.travelDir];
      const distToInterCenter =
        (interX - v.x) * dInfo.fx + (interZ - v.z) * dInfo.fz;

      if (!v.inTurnArc) {
        if (distToInterCenter < 22 && v.plannedOutDir === null) {
          const chosen = this.chooseValidIntersectionTurn(v, v.nextInterIx, v.nextInterIz);
          v.plannedOutDir = chosen;
          if (chosen === TURN_LEFT_MAP[v.travelDir]) v.blinkerSide = -1;
          else if (chosen === TURN_RIGHT_MAP[v.travelDir]) v.blinkerSide = 1;
          else v.blinkerSide = 0;
        }

        // Red-light compliance (Right-turn on red allowed after slowing; Police with sirens run reds; occasional impatient racer!)
        const isNS = v.travelDir === 'N' || v.travelDir === 'S';
        const redLight = (isNS && !this.nsGreen) || (!isNS && this.nsGreen);
        const pursuingPolice = v.type === 'POLICE' && this.wantedLevel > 0;
        const turningRight = v.plannedOutDir === TURN_RIGHT_MAP[v.travelDir];

        if (
          redLight &&
          !pursuingPolice &&
          !turningRight &&
          distToInterCenter > 7.2 &&
          distToInterCenter < 16.5
        ) {
          shouldStop = true;
        }
      }

      // Target cruise speed based on driver personality
      let baseCruise = 14.8 * this.trafficDensityMultiplier;
      if (v.type === 'POLICE' && this.wantedLevel > 0) {
        baseCruise = 26.5;
      } else if (v.driverStyle === 'FREEROAM_RACER') {
        baseCruise = 22.5;
      } else if (v.driverStyle === 'CAUTIOUS') {
        baseCruise = 12.2;
      }
      if (v.inTurnArc) {
        baseCruise *= v.driverStyle === 'FREEROAM_RACER' ? 0.78 : 0.65;
      }

      v.speed = THREE.MathUtils.damp(v.speed, shouldStop ? 0 : baseCruise, 4.4, dt);
      (v.rig.brakeLights.material as THREE.MeshBasicMaterial).color.setHex(
        shouldStop || v.speed < 1.5 ? 0xff2a2a : 0x7f1d1d
      );

      // Update amber turn-signal blinkers
      v.rig.leftBlinkerMat.color.setHex(
        v.blinkerSide === -1 && blinkPulse ? 0xf59e0b : 0x451a03
      );
      v.rig.rightBlinkerMat.color.setHex(
        v.blinkerSide === 1 && blinkPulse ? 0xf59e0b : 0x451a03
      );

      const prevHeading = v.heading;

      if (v.inTurnArc) {
        // Advance smoothly along intersection Bezier turn curve
        v.turnProgress += (v.speed * dt) / v.turnLength;
        const t = Math.min(1, v.turnProgress);
        const omt = 1 - t;

        const bx =
          omt * omt * v.turnStartX +
          2 * omt * t * v.turnCtrlX +
          t * t * v.turnEndX;
        const bz =
          omt * omt * v.turnStartZ +
          2 * omt * t * v.turnCtrlZ +
          t * t * v.turnEndZ;

        // Analytical Bezier derivative for exact tangent heading
        const tx =
          2 * omt * (v.turnCtrlX - v.turnStartX) +
          2 * t * (v.turnEndX - v.turnCtrlX);
        const tz =
          2 * omt * (v.turnCtrlZ - v.turnStartZ) +
          2 * t * (v.turnEndZ - v.turnCtrlZ);
        if (Math.hypot(tx, tz) > 0.001) {
          v.heading = Math.atan2(tx, tz);
        }

        v.x = bx;
        v.z = bz;

        if (t >= 1) {
          v.inTurnArc = false;
          v.plannedOutDir = null;
          v.blinkerSide = 0;
          v.heading = DIR_HEADING[v.travelDir];
        }
      } else {
        // Trigger turn arc as car enters the 7.0m intersection box
        if (distToInterCenter <= 7.0) {
          const outDir =
            v.plannedOutDir ??
            this.chooseValidIntersectionTurn(v, v.nextInterIx, v.nextInterIz);
          this.beginIntersectionTurnArc(v, v.nextInterIx, v.nextInterIz, outDir);
        } else {
          // Cruise smoothly down the asphalt road corridor with smooth lane-keeping / lane-swerving
          v.laneOffset = THREE.MathUtils.damp(v.laneOffset, v.targetLaneOffset, 3.8, dt);
          const roadCenter = v.roadLineIndex * BLOCK_PITCH;
          const rightX = -dInfo.fz;
          const rightZ = dInfo.fx;

          if (v.travelDir === 'N' || v.travelDir === 'S') {
            const desiredX = roadCenter + rightX * v.laneOffset;
            const latErr = desiredX - v.x;
            v.x += THREE.MathUtils.clamp(latErr * 4.5, -6.5, 6.5) * dt;
            v.z += dInfo.fz * v.speed * dt;
            const steerYaw = Math.atan2(THREE.MathUtils.clamp(latErr * 0.35, -0.45, 0.45), 1) * dInfo.fz;
            v.heading = THREE.MathUtils.damp(v.heading, DIR_HEADING[v.travelDir] + steerYaw, 8, dt);
          } else {
            const desiredZ = roadCenter + rightZ * v.laneOffset;
            const latErr = desiredZ - v.z;
            v.z += THREE.MathUtils.clamp(latErr * 4.5, -6.5, 6.5) * dt;
            v.x += dInfo.fx * v.speed * dt;
            const steerYaw = -Math.atan2(THREE.MathUtils.clamp(latErr * 0.35, -0.45, 0.45), 1) * dInfo.fx;
            v.heading = THREE.MathUtils.damp(v.heading, DIR_HEADING[v.travelDir] + steerYaw, 8, dt);
          }
        }
      }

      // Guarantee 100% road containment for every AI car too!
      const roadSafe = this.constrainVehicleToRoad(v.x, v.z, v.heading);
      v.x = roadSafe.x;
      v.z = roadSafe.z;

      this.resolvePlayerCarCollision(v);

      const yawRate = dt > 0.001 ? normalizeAngle(v.heading - prevHeading) / dt : 0;
      v.steerAngle = THREE.MathUtils.damp(
        v.steerAngle,
        THREE.MathUtils.clamp(yawRate * 0.22, -0.44, 0.44),
        10,
        dt
      );
      for (const pivot of v.rig.frontWheelPivots) {
        pivot.rotation.y = v.steerAngle;
      }

      v.rig.group.position.set(v.x, 0, v.z);
      v.rig.group.rotation.y = v.heading;
      v.rig.group.rotation.z = THREE.MathUtils.damp(
        v.rig.group.rotation.z,
        -THREE.MathUtils.clamp(yawRate * 0.03, -0.07, 0.07),
        8,
        dt
      );

      for (const w of v.rig.wheels) {
        w.rotation.x += v.speed * dt * 2.2;
      }
    }

    soundEngine.updateSiren(this.wantedLevel, nearestPoliceDist, dt);
  }

  private resolvePlayerCarCollision(v: SimVehicle) {
    if (!this.currentVehicle || this.currentVehicle === v) return;
    const pv = this.currentVehicle;
    const dx = v.x - pv.x;
    const dz = v.z - pv.z;
    const dist = Math.hypot(dx, dz);

    if (dist < 3.15 && dist > 0.01) {
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = 3.15 - dist;

      // Push apart and immediately clamp BOTH cars strictly onto the asphalt road!
      const vSafe = this.constrainVehicleToRoad(v.x + nx * overlap * 0.55, v.z + nz * overlap * 0.55, v.heading);
      const pvSafe = this.constrainVehicleToRoad(pv.x - nx * overlap * 0.45, pv.z - nz * overlap * 0.45, pv.heading);
      v.x = vSafe.x;
      v.z = vSafe.z;
      pv.x = pvSafe.x;
      pv.z = pvSafe.z;
      pv.rig.group.position.set(pv.x, 0, pv.z);
      this.playerX = pv.x;
      this.playerZ = pv.z;

      const relSpeed = Math.abs(pv.speed - v.speed);
      if (relSpeed > 6.5) {
        soundEngine.playImpact(Math.min(1, relSpeed / 24));
        this.cameraShake = Math.min(0.55, relSpeed * 0.02);
        this.spawnParticles((v.x + pv.x) * 0.5, 0.9, (v.z + pv.z) * 0.5, 0xfbbf24, 6);
        pv.speed *= 0.65;

        // Occupied AI driver reacts like a real GTA driver: honks & swerves away!
        if (v.hasDriver && v.type !== 'POLICE') {
          if (v.honkCooldown <= 0) {
            v.honkCooldown = 4.0;
            soundEngine.playHorn(1.08);
          }
          v.targetLaneOffset = v.laneOffset > 0 ? -2.5 : 3.5;
          v.evadeTimer = 4.5;
        }

        if (v.type === 'POLICE') {
          this.addCrimeHeat(2, 'Rammed LSPD Cruiser');
        }
      }
    }
  }

  // ==========================================================================
  // REALISTIC HUMAN PEDESTRIAN AI: SIDEWALKS, CROSSWALKS, REAL VOICES & GESTURES
  // ==========================================================================

  private updateNPCs(dt: number) {
    const phase = getSchedulePhaseForHour(this.timeOfDay);
    const closestNpc = this.findNearbyNPC(4.5);

    if (closestNpc && !this.currentVehicle && this.screenState === 'PLAYING') {
      this.targetHighlightRing.visible = true;
      const gy = this.isOnSidewalk(closestNpc.x, closestNpc.z) ? 0.27 : 0.04;
      this.targetHighlightRing.position.set(closestNpc.x, gy, closestNpc.z);
      this.targetHighlightRing.rotation.z += dt * 1.5;
    } else {
      this.targetHighlightRing.visible = false;
    }

    for (const npc of this.npcs) {
      if (npc.barkTimer > 0) {
        npc.barkTimer -= dt;
        if (npc.barkTimer <= 0) npc.barkText = null;
      }
      if (npc.barkCooldown > 0) npc.barkCooldown -= dt;

      if (npc.state === 'RAGDOLL') {
        npc.stateTimer -= dt;
        if (npc.stateTimer <= 0) {
          npc.state = 'SCHEDULE_COMMUTE';
          npc.health = 100;
          npc.rig.group.rotation.x = 0;
        }
        continue;
      }

      const dxP = this.playerX - npc.x;
      const dzP = this.playerZ - npc.z;
      const distPlayer = Math.hypot(dxP, dzP);
      let headYaw = 0;
      if (distPlayer < 10.5) {
        const angleToPlayer = Math.atan2(dxP, dzP);
        const relYaw = normalizeAngle(angleToPlayer - npc.heading);
        if (Math.abs(relYaw) < 1.38) {
          headYaw = relYaw * 0.68;
        }
      }

      if (npc.state === 'CONVERSING_PLAYER') {
        poseCharacterRig(npc.rig, {
          walkCycle: 0,
          speed: 0,
          idleTime: this.elapsedSeconds + npc.idleSeed,
          talking: true,
          headYaw: 0,
        });
        continue;
      }

      // Check collision or near-miss with fast-approaching vehicle on crosswalks/curbs!
      if (this.currentVehicle) {
        const pv = this.currentVehicle;
        const dVeh = Math.hypot(npc.x - pv.x, npc.z - pv.z);

        if (dVeh < 2.1 && Math.abs(pv.speed) > 4.5) {
          npc.state = 'RAGDOLL';
          npc.stateTimer = 7.0;
          npc.profile.playerTrust = Math.max(-100, npc.profile.playerTrust - 60);
          npc.rig.group.rotation.x = -Math.PI / 2;
          npc.rig.group.position.y = 0.28;
          soundEngine.playImpact(0.8);
          this.cameraShake = 0.35;
          this.hitstopTimer = 0.04;
          this.spawnParticles(npc.x, 1.0, npc.z, 0xf87171, 10);
          this.spawnCashDrop(npc.x, npc.z, npc.cashCarry);
          this.addCrimeHeat(1, 'Hit & Run');
          this.frightenNearbyNPCs(npc.x, npc.z, 22, 'Oh my god!! Somebody call an ambulance!');
          continue;
        } else if (dVeh < 8.0 && Math.abs(pv.speed) > 9.5 && npc.state !== 'DODGING_CAR') {
          const carFwdX = Math.sin(pv.heading);
          const carFwdZ = Math.cos(pv.heading);
          const toNpcX = npc.x - pv.x;
          const toNpcZ = npc.z - pv.z;
          const forwardDot = toNpcX * carFwdX + toNpcZ * carFwdZ;
          const lateralDist = toNpcX * carFwdZ - toNpcZ * carFwdX;

          if (forwardDot > 0 && Math.abs(lateralDist) < 3.6) {
            npc.state = 'DODGING_CAR';
            npc.stateTimer = 1.4;
            const sideSign = lateralDist >= 0 ? 1 : -1;
            npc.heading = pv.heading + sideSign * (Math.PI / 2);
            this.triggerNPCBark(
              npc,
              DODGE_BARKS[npc.id % DODGE_BARKS.length],
              'ALARMED',
              3.5,
              true,
              false
            );
          }
        }
      }

      let moveSpeed = npc.role === 'JOGGER' ? 3.85 : 1.78;
      let isSprinting = npc.role === 'JOGGER';
      let isTalking = false;
      let isWaving = false;
      let isCowering = false;
      let isCheckingPhone = false;

      if (npc.state === 'DODGING_CAR') {
        moveSpeed = 6.2;
        isSprinting = true;
        isCowering = true;
        npc.stateTimer -= dt;
        if (npc.stateTimer <= 0) npc.state = 'SCHEDULE_COMMUTE';
      } else if (npc.state === 'FLEEING') {
        moveSpeed = 5.6;
        isSprinting = true;
        isCowering = true;
        npc.stateTimer -= dt;
        if (npc.stateTimer <= 0) npc.state = 'SCHEDULE_COMMUTE';
      } else if (npc.state === 'COMBAT') {
        moveSpeed = 4.4;
        isSprinting = true;
        npc.stateTimer -= dt;
        npc.heading = Math.atan2(this.playerX - npc.x, this.playerZ - npc.z);
        if (distPlayer < 1.65 && !this.currentVehicle) {
          moveSpeed = 0;
          npc.attackCooldown -= dt;
          if (npc.attackCooldown <= 0) {
            npc.attackCooldown = 1.1;
            if (this.playerArmor > 0) {
              this.playerArmor = Math.max(0, this.playerArmor - 8);
            } else {
              this.playerHealth = Math.max(0, this.playerHealth - 8);
            }
            soundEngine.playImpact(0.4);
          }
        }
        if (npc.stateTimer <= 0) npc.state = 'SCHEDULE_COMMUTE';
      } else if (npc.state === 'SOCIALIZING') {
        moveSpeed = 0;
        isTalking = true;
        npc.stateTimer -= dt;
        if (npc.stateTimer <= 0) {
          npc.state = 'SCHEDULE_COMMUTE';
          npc.profile.socialCooldown = 15.0;
        }
      } else {
        if (npc.profile.socialCooldown > 0) npc.profile.socialCooldown -= dt;

        // Spontaneous natural human street speech & audible greetings when player walks past!
        if (distPlayer < 11.5 && npc.barkCooldown <= 0 && !npc.barkText) {
          if (npc.profile.playerTrust >= 50) {
            this.triggerNPCBark(
              npc,
              ALLY_GREETINGS[npc.id % ALLY_GREETINGS.length],
              'FRIENDLY',
              3.8,
              true,
              false
            );
          } else if (Math.random() < 0.45) {
            const lines = AMBIENT_CHATTER_BY_ROLE[npc.role];
            const chosen = lines[(npc.id + Math.floor(this.elapsedSeconds / 7)) % lines.length];
            this.triggerNPCBark(npc, chosen, 'NEUTRAL', 3.8, true, false);
          } else {
            npc.barkCooldown = 6.5;
          }
        }

        // Two-way realistic sidewalk conversations between friends/coworkers!
        if (npc.profile.socialCooldown <= 0) {
          for (const rel of npc.profile.relationships) {
            if (rel.affinity > 0) {
              const other = this.npcs.find((o) => o.id === rel.targetNpcId);
              if (
                other &&
                other.state === 'SCHEDULE_COMMUTE' &&
                Math.hypot(other.x - npc.x, other.z - npc.z) < 3.2
              ) {
                npc.state = 'SOCIALIZING';
                other.state = 'SOCIALIZING';
                npc.stateTimer = 6.0;
                other.stateTimer = 6.0;
                npc.heading = Math.atan2(other.x - npc.x, other.z - npc.z);
                other.heading = Math.atan2(npc.x - other.x, npc.z - other.z);
                this.triggerNPCBark(
                  npc,
                  `Yo ${other.profile.name.split(' ')[0]}, how’s your day going?`,
                  'FRIENDLY',
                  3.2,
                  true,
                  false
                );
                this.triggerNPCBark(
                  other,
                  SOCIAL_PAIR_REPLIES[other.id % SOCIAL_PAIR_REPLIES.length],
                  'FRIENDLY',
                  3.8,
                  false,
                  false
                );
                break;
              }
            }
          }
        }

        const targetAnchor =
          phase === 'MORNING_COMMUTE' || phase === 'WORK_SHIFT'
            ? npc.profile.workAnchor
            : phase === 'EVENING_SOCIAL'
            ? npc.profile.leisureAnchor
            : npc.profile.homeAnchor;

        const dx = targetAnchor.x - npc.x;
        const dz = targetAnchor.z - npc.z;
        const distToAnchor = Math.hypot(dx, dz);

        if (distToAnchor < 3.8) {
          // Instead of freezing forever ("unplayed"), citizens stroll along their local block!
          const patrolOffset = Math.sin(this.elapsedSeconds * 0.35 + npc.idleSeed) * 9.0;
          const desiredHeading = patrolOffset >= 0 ? 0 : Math.PI;
          npc.state = 'AT_DESTINATION';
          moveSpeed = npc.role === 'VENDOR' ? 0 : 1.15;
          if (moveSpeed > 0) {
            npc.heading += normalizeAngle(desiredHeading - npc.heading) * Math.min(1, dt * 4.5);
          }
          isCheckingPhone = npc.usesPhoneHabit && moveSpeed === 0;
          isTalking = npc.role === 'VENDOR' || (npc.barkText !== null && npc.barkTimer > 0);
        } else {
          let desiredHeading = npc.heading;
          if (Math.abs(dx) > 3.5) {
            desiredHeading = dx > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            desiredHeading = dz > 0 ? 0 : Math.PI;
          }

          const nextStepX = npc.x + Math.sin(desiredHeading) * 1.4;
          const nextStepZ = npc.z + Math.cos(desiredHeading) * 1.4;
          let waitingAtCurb = false;

          for (const idx of GRID_INDICES) {
            const rc = idx * BLOCK_PITCH;
            const steppingIntoXRoad =
              Math.abs(npc.x - rc) >= ROAD_WIDTH * 0.5 && Math.abs(nextStepX - rc) < ROAD_WIDTH * 0.5;
            const steppingIntoZRoad =
              Math.abs(npc.z - rc) >= ROAD_WIDTH * 0.5 && Math.abs(nextStepZ - rc) < ROAD_WIDTH * 0.5;

            if (steppingIntoXRoad && this.nsGreen) {
              waitingAtCurb = true;
              break;
            }
            if (steppingIntoZRoad && !this.nsGreen) {
              waitingAtCurb = true;
              break;
            }
          }

          if (waitingAtCurb) {
            npc.state = 'WAITING_SIGNAL';
            moveSpeed = 0;
            isCheckingPhone = npc.usesPhoneHabit;
          } else {
            npc.state = 'SCHEDULE_COMMUTE';
            npc.heading += normalizeAngle(desiredHeading - npc.heading) * Math.min(1, dt * 6.0);
            isCheckingPhone = npc.usesPhoneHabit && roleAllowsWalkingPhone(npc.role);
          }
        }

        if (distPlayer < 5.0 && npc.profile.playerTrust >= 45) {
          isWaving = true;
        }
        if (npc.barkText !== null && npc.barkTimer > 0 && !isCowering) {
          isTalking = true;
        }
      }

      const nx = npc.x + Math.sin(npc.heading) * moveSpeed * dt;
      const nz = npc.z + Math.cos(npc.heading) * moveSpeed * dt;
      const col = this.resolveBuildingCollision(nx, nz, 0.45);

      if (col.hit || Math.abs(col.x) > 125 || Math.abs(col.z) > 125) {
        npc.heading += Math.PI * 0.5;
      }

      npc.x = col.x;
      npc.z = col.z;

      const groundY = this.isOnSidewalk(npc.x, npc.z) ? 0.25 : 0;
      npc.rig.group.position.set(npc.x, groundY, npc.z);
      npc.rig.group.rotation.y = npc.heading;

      if (moveSpeed > 0.15) {
        npc.walkCycle += dt * moveSpeed * (isSprinting ? 3.5 : 3.9);
      }

      poseCharacterRig(npc.rig, {
        walkCycle: npc.walkCycle,
        speed: moveSpeed,
        sprinting: isSprinting,
        idleTime: this.elapsedSeconds + npc.idleSeed,
        checkingPhone: isCheckingPhone,
        talking: isTalking,
        waving: isWaving,
        cowering: isCowering,
        headYaw,
        meleeSwing: npc.state === 'COMBAT' && distPlayer < 1.9,
      });
    }
  }

  private collectProjectedSpeechBubbles(): AmbientSpeechBubble[] {
    if (this.screenState !== 'PLAYING' || this.conversingNpcId !== null) return [];

    const bubbles: AmbientSpeechBubble[] = [];
    for (const npc of this.npcs) {
      if (!npc.barkText || npc.barkTimer <= 0 || npc.state === 'RAGDOLL') continue;
      const dist = Math.hypot(npc.x - this.playerX, npc.z - this.playerZ);
      if (dist > 22) continue;

      _projVec.set(npc.x, 2.38, npc.z);
      _projVec.project(this.camera);

      if (_projVec.z > 0 && _projVec.z < 1 && Math.abs(_projVec.x) < 0.92 && Math.abs(_projVec.y) < 0.88) {
        bubbles.push({
          id: npc.id,
          speakerName: npc.profile.name.split(' ')[0],
          text: npc.barkText,
          screenX: (_projVec.x * 0.5 + 0.5) * 100,
          screenY: (-_projVec.y * 0.5 + 0.5) * 100,
          mood: npc.barkMood,
        });
        if (bubbles.length >= 3) break;
      }
    }
    return bubbles;
  }

  private updatePOIsPickupsAndMission(dt: number) {
    const t = performance.now() * 0.0025;
    for (const poi of this.poiEntities) {
      if (poi.info.completed) continue;
      poi.floatingIcon.rotation.y += dt * 1.8;
      const baseIconY = poi.info.type === 'TIME_TRIAL_RING' ? 5.3 : 2.85;
      poi.floatingIcon.position.y = baseIconY + Math.sin(t + poi.info.x) * 0.25;
      poi.beaconRing.rotation.z -= dt * 0.8;

      if (
        !poi.info.discovered &&
        Math.hypot(poi.info.x - this.playerX, poi.info.z - this.playerZ) < 28
      ) {
        poi.info.discovered = true;
        this.grantSkillXp('SYNDICATE', 25, `Discovered POI: ${poi.info.title}`);
      }
    }

    for (let i = this.cashPickups.length - 1; i >= 0; i--) {
      const c = this.cashPickups[i];
      c.age += dt;
      c.mesh.rotation.y += dt * 3;
      if (Math.hypot(c.x - this.playerX, c.z - this.playerZ) < 3.0) {
        this.playerCash += c.amount;
        soundEngine.playDoorChime();
        this.showNotification(`Picked up $${c.amount}`, 1.6);
        this.scene.remove(c.mesh);
        this.cashPickups.splice(i, 1);
      } else if (c.age > 35) {
        this.scene.remove(c.mesh);
        this.cashPickups.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.08, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.scale.setScalar(Math.max(0.01, 1 - p.life / p.maxLife));
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.shotTracers.length - 1; i >= 0; i--) {
      const tr = this.shotTracers[i];
      tr.life += dt;
      tr.mesh.position.x += tr.vx * dt;
      tr.mesh.position.y += tr.vy * dt;
      tr.mesh.position.z += tr.vz * dt;
      if (tr.life >= tr.maxLife) {
        this.scene.remove(tr.mesh);
        this.shotTracers.splice(i, 1);
      }
    }

    if (this.wantedLevel > 0) {
      this.timeSinceLastCrime += dt;
      if (this.timeSinceLastCrime > 22) {
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        this.timeSinceLastCrime = 12;
        if (this.wantedLevel === 0) {
          this.grantSkillXp('DRIVING', 60, 'Evaded LSPD Pursuit!');
        }
      }
    }

    this.missionRingMesh.rotation.z += dt * 1.4;
    const activeMission = MISSIONS[this.missionIndex % MISSIONS.length];
    if (
      Math.hypot(this.playerX - activeMission.targetX, this.playerZ - activeMission.targetZ) < 6.2 &&
      this.screenState === 'PLAYING'
    ) {
      const payoutMult = this.unlockedSkills.has('syn_1_silver_tongue') ? 1.25 : 1.0;
      const reward = Math.round(activeMission.reward * payoutMult);
      this.playerCash += reward;
      this.completedMissions += 1;
      this.missionIndex = (this.missionIndex + 1) % MISSIONS.length;
      this.syncMissionBeacon();
      soundEngine.playMissionComplete();
      this.spawnParticles(this.playerX, 1.5, this.playerZ, 0xfbbf24, 18);
      this.grantSkillXp(
        this.currentVehicle ? 'DRIVING' : 'SYNDICATE',
        140,
        `Contract Complete! +$${reward.toLocaleString()}`
      );
    }

    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.notificationText = null;
    }
  }

  private updateCamera(dt: number) {
    if (this.screenState === 'TITLE') {
      this.titleOrbitAngle += dt * 0.14;
      const radius = 62;
      this.camera.position.set(
        Math.cos(this.titleOrbitAngle) * radius,
        28,
        Math.sin(this.titleOrbitAngle) * radius
      );
      this.camera.lookAt(0, 5, 0);
      return;
    }

    const fx = this.playerX;
    const fz = this.playerZ;
    const lookYaw = this.cameraYaw;

    if (this.cameraMode === 'TOP_DOWN') {
      _desiredCamPos.set(fx, 48, fz - 12);
      _camTarget.set(fx, 0, fz);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 6, dt);
    } else if (this.cameraMode === 'HOOD' && this.currentVehicle) {
      const h = this.currentVehicle.heading;
      _desiredCamPos.set(fx + Math.sin(h) * 0.6, 1.55, fz + Math.cos(h) * 0.6);
      _camTarget.set(
        fx + Math.sin(lookYaw) * 20,
        1.3 + Math.sin(this.cameraPitch) * 6,
        fz + Math.cos(lookYaw) * 20
      );
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 68, 6, dt);
    } else {
      const speedRatio = this.currentVehicle
        ? Math.abs(this.currentVehicle.speed) / this.currentVehicle.maxSpeed
        : this.isCurrentlySprinting
        ? 0.45
        : 0;
      const distBack = this.currentVehicle ? 8.8 + speedRatio * 2.2 : 5.6;
      const baseHeight = this.currentVehicle ? 3.6 + speedRatio * 0.55 : 2.55;
      const pitchSin = Math.sin(this.cameraPitch);

      _desiredCamPos.set(
        fx - Math.sin(lookYaw) * distBack * Math.cos(this.cameraPitch * 0.5),
        Math.max(1.05, baseHeight - pitchSin * 2.2),
        fz - Math.cos(lookYaw) * distBack * Math.cos(this.cameraPitch * 0.5)
      );
      _camTarget.set(
        fx + Math.sin(lookYaw) * 6.5,
        (this.currentVehicle ? 1.35 : 1.65) + pitchSin * 4.2,
        fz + Math.cos(lookYaw) * 6.5
      );
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 58 + speedRatio * 10, 6, dt);
    }

    this.camera.updateProjectionMatrix();
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _desiredCamPos.x, 12, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _desiredCamPos.y, 12, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _desiredCamPos.z, 12, dt);

    if (this.cameraShake > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake *= Math.exp(-8 * dt);
    } else {
      this.cameraShake = 0;
    }

    this.camera.lookAt(_camTarget);
  }

  private getDistrictName(x: number, z: number): string {
    if (x < -80) return 'Vespucci Beach & Marina';
    if (z < -75) return 'Vinewood Boulevard';
    if (x > 75 && z > 75) return 'Southport Harbor';
    if (Math.abs(x) < 48 && Math.abs(z) < 48) return 'Downtown Solis Core';
    return 'Midtown Financial District';
  }

  private buildActiveInteractionSnapshot(): ActiveNPCInteraction | null {
    if (this.conversingNpcId === null) return null;
    const npc = this.npcs.find((n) => n.id === this.conversingNpcId);
    if (!npc) return null;

    const phase = getSchedulePhaseForHour(this.timeOfDay);
    const ctx = buildContextualDialogue(
      npc.profile,
      npc.role,
      phase,
      this.wantedLevel,
      this.scrapParts,
      this.playerCash,
      this.lastPlayerVehicleName
    );

    return {
      npcId: npc.id,
      name: npc.profile.name,
      role: npc.role,
      schedulePhase: phase,
      currentActivity: ctx.currentActivity,
      personalObjective: npc.profile.personalObjective,
      objectiveCompleted: npc.profile.objectiveCompleted,
      playerTrust: npc.profile.playerTrust,
      moodLabel: getMoodLabel(npc.profile.playerTrust, this.wantedLevel, npc.role),
      dialogueLine: ctx.line,
      relationships: npc.profile.relationships,
      options: ctx.options,
    };
  }

  private emitHud() {
    const m = MISSIONS[this.missionIndex % MISSIONS.length];
    const nearbyVeh = this.findNearbyVehicle(5.6);
    const nearbyNpc = this.findNearbyNPC(4.5);
    const nearbyPoi = this.findNearbyPOI(7.2);

    const blips: MinimapBlip[] = [
      { x: this.playerX, z: this.playerZ, type: 'PLAYER', rotation: this.cameraYaw },
      { x: m.targetX, z: m.targetZ, type: 'OBJECTIVE' },
      { x: CUSTOMS_ROAD_X, z: CUSTOMS_ROAD_Z, type: 'CUSTOMS' },
    ];

    for (const p of this.poiEntities) {
      if (!p.info.completed) {
        blips.push({ x: p.info.x, z: p.info.z, type: 'POI' });
      }
    }

    for (const v of this.vehicles) {
      if (v.isPlayerDriven) continue;
      if (Math.hypot(v.x - this.playerX, v.z - this.playerZ) < 95) {
        blips.push({
          x: v.x,
          z: v.z,
          type: v.type === 'POLICE' ? 'POLICE' : 'VEHICLE',
        });
      }
    }

    for (const npc of this.npcs) {
      if (npc.state === 'COMBAT') {
        blips.push({ x: npc.x, z: npc.z, type: 'NPC_HOSTILE' });
      } else if (npc.profile.playerTrust >= 50) {
        blips.push({ x: npc.x, z: npc.z, type: 'NPC_FRIEND' });
      }
    }

    this.onHudUpdate({
      screen: this.screenState,
      health: Math.round(this.playerHealth),
      maxHealth: this.playerMaxHealth,
      armor: Math.round(this.playerArmor),
      cash: Math.round(this.playerCash),
      wantedLevel: this.wantedLevel,
      wantedCooldownProgress: this.wantedLevel > 0 ? Math.min(1, this.timeSinceLastCrime / 22) : 0,
      speedKmh: this.currentVehicle ? Math.round(Math.abs(this.currentVehicle.speed) * 3.8) : 0,
      inVehicle: Boolean(this.currentVehicle),
      vehicleName: this.currentVehicle ? this.currentVehicle.name : 'On Foot',
      vehicleHealth: this.currentVehicle ? Math.round(this.currentVehicle.health) : 100,
      districtName: this.getDistrictName(this.playerX, this.playerZ),
      timeOfDayHours: this.timeOfDay,
      weather: this.weather,
      cameraMode: this.cameraMode,
      trafficDensity: this.trafficDensityMultiplier,
      activeNPCsCount: this.npcs.length,
      activeVehiclesCount: this.vehicles.length,
      policeUnitsCount: this.vehicles.filter((v) => v.type === 'POLICE').length,
      nearInteractableVehicle: nearbyVeh ? nearbyVeh.name : null,
      nearInteractableNPC: nearbyNpc
        ? {
            id: nearbyNpc.id,
            name: nearbyNpc.profile.name,
            role: nearbyNpc.role,
            trust: nearbyNpc.profile.playerTrust,
          }
        : null,
      nearInteractablePOI: nearbyPoi ? nearbyPoi.info : null,
      activeNPCInteraction: this.buildActiveInteractionSnapshot(),
      ambientBarks: this.collectProjectedSpeechBubbles(),
      progression: {
        level: this.playerLevel,
        xp: Math.round(this.playerXp),
        nextLevelXp: xpForLevel(this.playerLevel),
        skillPoints: this.skillPoints,
        unlockedSkillIds: Array.from(this.unlockedSkills),
        branchXp: { ...this.branchXp },
        scrapParts: this.scrapParts,
        craftedMedkits: this.craftedMedkits,
        craftedArmorPlates: this.craftedArmorPlates,
        activeCooldowns: {
          nitroReady: this.unlockedSkills.has('drv_3_nitro') && this.nitroCooldown <= 0,
          nitroCooldown: Math.ceil(this.nitroCooldown),
          bribeReady: this.unlockedSkills.has('syn_3_ghost_dispatch') && this.bribeCooldown <= 0,
          bribeCooldown: Math.ceil(this.bribeCooldown),
          shockwaveReady: this.unlockedSkills.has('cmb_3_shockwave') && this.shockwaveCooldown <= 0,
          shockwaveCooldown: Math.ceil(this.shockwaveCooldown),
        },
      },
      activePOIs: this.poiEntities.map((e) => e.info),
      worldSeed: this.worldSeed,
      mission: { ...m, completedCount: this.completedMissions },
      playerX: this.playerX,
      playerZ: this.playerZ,
      playerHeading: this.cameraYaw,
      isSprinting: this.isCurrentlySprinting,
      radioStation: RADIO_STATIONS[this.radioStationIndex],
      blips,
      muted: soundEngine.isMuted(),
      notification: this.notificationText,
    });
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (gl && typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextFrame = () => {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);
    this.elapsedSeconds += dt;

    if (this.screenState === 'TITLE') {
      this.updateAtmosphere(dt);
      this.updateTrafficLights(dt);
      this.updateVehiclesAI(dt);
      this.updateNPCs(dt);
      this.updateCamera(dt);
    } else if (this.screenState === 'PLAYING') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.updateAtmosphere(dt);
        this.updateTrafficLights(dt);
        this.updatePlayer(dt);
        this.updateVehiclesAI(dt);
        this.updateNPCs(dt);
        this.updatePOIsPickupsAndMission(dt);
      }
      this.updateCamera(dt);
    }

    this.justPressedKeys.clear();
    this.renderer.render(this.scene, this.camera);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.07) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }

    this.scheduleNextFrame();
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (!this.heldKeys.has(e.code)) {
      this.justPressedKeys.add(e.code);

      if (this.screenState === 'TITLE' && (e.code === 'Enter' || e.code === 'Space')) {
        this.startGame();
      } else if (this.screenState === 'BUSTED' && (e.code === 'Enter' || e.code === 'Space')) {
        this.startGame();
      } else if (e.code === 'Escape') {
        if (this.conversingNpcId !== null) {
          this.selectNPCDialogueOption('LEAVE');
        } else if (this.screenState === 'PLAYING' || this.screenState === 'PAUSED') {
          this.togglePause();
        }
      }
    }

    this.heldKeys.add(e.code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.heldKeys.delete(e.code);
  };

  private handleBlur = () => {
    this.heldKeys.clear();
    this.justPressedKeys.clear();
    soundEngine.stopContinuousSounds();
  };

  private handleResize = () => {
    if (!this.container || this.disposed) return;
    const { w, h } = this.getViewportSize();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private bindEvents() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('resize', this.handleResize);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
    }
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    soundEngine.stopContinuousSounds();
    soundEngine.stopVoice();

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('resize', this.handleResize);

    this.renderer.dispose();
  }
}

function roleAllowsWalkingPhone(role: NPCRole): boolean {
  return role === 'CIVILIAN' || role === 'TOURIST';
}
