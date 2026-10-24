import * as THREE from 'three';
import {
  ActiveNPCDialogueOption,
  NPCDailyAnchor,
  NPCRelationshipLink,
  NPCRole,
  SchedulePhase,
} from './types';

export type NPCBodyBuild = 'SLIM' | 'ATHLETIC' | 'AVERAGE' | 'STOCKY';
export type NPCOutfitStyle =
  | 'TEE_SHORTS'
  | 'HOODIE_JEANS'
  | 'OPEN_JACKET'
  | 'TANK_ATHLETIC'
  | 'SUIT_BLAZER'
  | 'UNIFORM_VEST';
export type NPCHairStyle =
  | 'SHORT_FADE'
  | 'TEXTURED_QUIFF'
  | 'PONYTAIL'
  | 'AFRO_CURLS'
  | 'LONG_LAYERED'
  | 'BASEBALL_CAP'
  | 'BEANIE_HAT'
  | 'BUCKET_HAT'
  | 'PEAKED_CAP';
export type NPCFacialHair = 'NONE' | 'GOATEE' | 'FULL_BEARD' | 'MUSTACHE';
export type NPCPropStyle =
  | 'NONE'
  | 'BACKPACK'
  | 'BRIEFCASE'
  | 'SHOPPING_BAG'
  | 'COFFEE_CUP'
  | 'CROSSBODY_BAG';
export type NPCStrideStyle = 'RELAXED' | 'BRISK' | 'SWAGGER' | 'ENERGETIC';

export interface NPCAppearanceConfig {
  bodyBuild: NPCBodyBuild;
  heightScale: number;
  widthScale: number;
  outfitStyle: NPCOutfitStyle;
  hairStyle: NPCHairStyle;
  capBackwards: boolean;
  facialHair: NPCFacialHair;
  wearsSunglasses: boolean;
  sunglassTintHex: number;
  wearsHeadphones: boolean;
  propStyle: NPCPropStyle;
  primaryTopHex: number;
  secondaryLayerHex: number;
  bottomHex: number;
  shoeHex: number;
  shoeSoleHex: number;
  skinHex: number;
  hairHex: number;
  accessoryHex: number;
}

export interface RichNPCProfile {
  name: string;
  voiceSeed: number;
  appearance: NPCAppearanceConfig;
  walkSpeedMultiplier: number; // Individual pace multiplier (e.g. 0.72 leisurely stroll .. 1.38 brisk power-walk)
  animCadenceMultiplier: number; // Step frequency variation so crowds never march in lockstep
  strideStyle: NPCStrideStyle;
  homeAnchor: NPCDailyAnchor;
  workAnchor: NPCDailyAnchor;
  leisureAnchor: NPCDailyAnchor;
  personalObjective: string;
  objectiveType: 'SCRAP_DELIVERY' | 'CASH_INVEST' | 'COURTESY_CHECK';
  objectiveScrapNeeded: number;
  objectiveCompleted: boolean;
  playerTrust: number; // -100 to +100
  relationships: NPCRelationshipLink[];
  socialCooldown: number;
  partnerNpcId: number | null;
  lastCustomReply: string | null;
}

const FIRST_NAMES = [
  'Mateo', 'Elena', 'Marcus', 'Priya', 'Devon', 'Sofia', 'Liam', 'Nadia',
  'Carlos', 'Hannah', 'Tariq', 'Chloe', 'Julian', 'Mei', 'Andre', 'Valeria',
  'Dante', 'Kira', 'Omar', 'Tessa', 'Victor', 'Sienna', 'Malik', 'Rosa',
  'Lucas', 'Zara', 'Hector', 'Amara', 'Noah', 'Camila', 'Jaxon', 'Layla',
];

const LAST_NAMES = [
  'Vega', 'Mercer', 'Chen', 'Patel', 'Kowalski', 'Reyes', 'Brooks', 'Alvarez',
  'Vance', 'Moreno', 'Sato', 'Silva', 'Rossi', 'Navarro', 'Kim', 'Cross',
  'Delgado', 'Sterling', 'Okafor', 'Bennett',
];

const SKIN_TONES = [
  0xffe4cc, 0xf7d3b5, 0xedc09b, 0xdfa77c, 0xc98a5b,
  0xb07043, 0x8f5630, 0x734224, 0x57311a, 0x3f2313,
];

const HAIR_TONES = [
  0x120f0e, 0x241914, 0x3d2618, 0x5c3820, 0x7c4722,
  0xa16228, 0xd4a253, 0xe8c987, 0x6b2135, 0x52525b,
];

const STREETWEAR_TOPS = [
  0xf8fafc, 0xe2e8f0, 0x2563eb, 0x0284c7, 0x0ea5e9, 0x38bdf8,
  0xdc2626, 0xef4444, 0xf97316, 0xf59e0b, 0xeab308, 0x84cc16,
  0x10b981, 0x059669, 0x0d9488, 0x7c3aed, 0x9333ea, 0xdb2777,
  0xec4899, 0xf43f5e, 0x1e293b, 0x334155, 0x78350f, 0xfde047,
];

const INNER_LAYER_TOPS = [
  0xf8fafc, 0xf1f5f9, 0x0f172a, 0x1e293b, 0xfef08a, 0xbae6fd, 0xfecdd3, 0xd1fae5,
];

const TAILORED_SUIT_TOPS = [
  0x0f172a, 0x1e293b, 0x334155, 0x27272a, 0x1e3a8a, 0x3f3f46, 0x44403c, 0x312e81,
];

const BOTTOMS_PALETTE = [
  0x1e293b, 0x1e3a8a, 0x2563eb, 0x334155, 0x0f172a, 0x44403c,
  0x78716c, 0xd6d3d1, 0xa8a29e, 0x365314, 0x3f3f46, 0x57534e,
  0x172554, 0x713f12,
];

const SHOE_UPPERS = [
  0xf8fafc, 0x0f172a, 0x1e293b, 0xdc2626, 0x2563eb, 0xd97706, 0x44403c, 0x10b981,
];

const ACCESSORY_COLORS = [
  0x0f172a, 0x1e293b, 0xdc2626, 0x0284c7, 0xf59e0b, 0x10b981, 0xec4899, 0x7c3aed, 0xf8fafc,
];

const SUNGLASS_TINTS = [0x090d16, 0x1e1b4b, 0x451a03, 0x083344, 0x3b0764];

const _tmpColor = new THREE.Color();

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitterColorHex(baseHex: number, hRange = 0.04, sRange = 0.1, lRange = 0.08): number {
  _tmpColor.setHex(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  _tmpColor.getHSL(hsl);
  hsl.h = (hsl.h + (Math.random() * 2 - 1) * hRange + 1) % 1;
  hsl.s = THREE.MathUtils.clamp(hsl.s + (Math.random() * 2 - 1) * sRange, 0, 1);
  hsl.l = THREE.MathUtils.clamp(hsl.l + (Math.random() * 2 - 1) * lRange, 0.06, 0.94);
  _tmpColor.setHSL(hsl.h, hsl.s, hsl.l);
  return _tmpColor.getHex();
}

export function generateRandomAppearanceForRole(role: NPCRole): {
  appearance: NPCAppearanceConfig;
  walkSpeedMultiplier: number;
  animCadenceMultiplier: number;
  strideStyle: NPCStrideStyle;
} {
  // 1. Body Build & Natural Height/Width Proportions
  let bodyBuild: NPCBodyBuild = pickRandom(['SLIM', 'ATHLETIC', 'AVERAGE', 'STOCKY']);
  if (role === 'JOGGER') {
    bodyBuild = Math.random() < 0.55 ? 'ATHLETIC' : 'SLIM';
  } else if (role === 'OFFICER') {
    bodyBuild = Math.random() < 0.65 ? 'ATHLETIC' : 'STOCKY';
  } else if (role === 'MECHANIC') {
    bodyBuild = Math.random() < 0.55 ? 'STOCKY' : 'AVERAGE';
  }

  const heightScale = 0.91 + Math.random() * 0.18; // 0.91x to 1.09x
  const widthBase =
    bodyBuild === 'SLIM'
      ? 0.91
      : bodyBuild === 'ATHLETIC'
      ? 1.03
      : bodyBuild === 'STOCKY'
      ? 1.13
      : 0.99;
  const widthScale = widthBase + (Math.random() * 0.06 - 0.03);

  // 2. Outfit Silhouette per Role + Random Street Variety
  let outfitStyle: NPCOutfitStyle = 'TEE_SHORTS';
  if (role === 'OFFICER') {
    outfitStyle = 'UNIFORM_VEST';
  } else if (role === 'BUSINESS') {
    outfitStyle = Math.random() < 0.72 ? 'SUIT_BLAZER' : 'OPEN_JACKET';
  } else if (role === 'JOGGER') {
    outfitStyle = Math.random() < 0.6 ? 'TANK_ATHLETIC' : 'TEE_SHORTS';
  } else if (role === 'MECHANIC') {
    outfitStyle = Math.random() < 0.55 ? 'UNIFORM_VEST' : 'HOODIE_JEANS';
  } else if (role === 'VENDOR') {
    outfitStyle = Math.random() < 0.65 ? 'UNIFORM_VEST' : 'OPEN_JACKET';
  } else if (role === 'TOURIST') {
    outfitStyle = pickRandom(['TEE_SHORTS', 'TANK_ATHLETIC', 'OPEN_JACKET']);
  } else {
    outfitStyle = pickRandom(['TEE_SHORTS', 'HOODIE_JEANS', 'OPEN_JACKET', 'TANK_ATHLETIC']);
  }

  // 3. Hairstyles & Hats
  let hairStyle: NPCHairStyle = pickRandom([
    'SHORT_FADE',
    'TEXTURED_QUIFF',
    'PONYTAIL',
    'AFRO_CURLS',
    'LONG_LAYERED',
    'BASEBALL_CAP',
    'BEANIE_HAT',
  ]);
  if (role === 'OFFICER') {
    hairStyle = Math.random() < 0.8 ? 'PEAKED_CAP' : 'SHORT_FADE';
  } else if (role === 'TOURIST' && Math.random() < 0.45) {
    hairStyle = 'BUCKET_HAT';
  } else if (role === 'MECHANIC' && Math.random() < 0.55) {
    hairStyle = Math.random() < 0.65 ? 'BASEBALL_CAP' : 'BEANIE_HAT';
  } else if (role === 'BUSINESS') {
    hairStyle = pickRandom(['SHORT_FADE', 'TEXTURED_QUIFF', 'PONYTAIL', 'LONG_LAYERED']);
  }

  const capBackwards = hairStyle === 'BASEBALL_CAP' && role !== 'OFFICER' && Math.random() < 0.38;

  const canHaveBeard =
    hairStyle !== 'PONYTAIL' && hairStyle !== 'LONG_LAYERED' && Math.random() < 0.34;
  const facialHair: NPCFacialHair = canHaveBeard
    ? pickRandom(['GOATEE', 'FULL_BEARD', 'MUSTACHE'])
    : 'NONE';

  // 4. Randomized Clothing Colors with Organic HSL Fabric Variation
  let primaryTopHex = jitterColorHex(pickRandom(STREETWEAR_TOPS), 0.05, 0.12, 0.09);
  if (role === 'OFFICER') {
    primaryTopHex = pickRandom([0x172554, 0x0f172a, 0x1e3a8a]);
  } else if (role === 'BUSINESS') {
    primaryTopHex = jitterColorHex(pickRandom(TAILORED_SUIT_TOPS), 0.02, 0.06, 0.06);
  } else if (role === 'MECHANIC') {
    primaryTopHex = jitterColorHex(
      pickRandom([0xb45309, 0x9a3412, 0x334155, 0x1d4ed8, 0x44403c]),
      0.03,
      0.08,
      0.06
    );
  }

  const secondaryLayerHex = jitterColorHex(pickRandom(INNER_LAYER_TOPS), 0.03, 0.08, 0.05);
  const bottomHex =
    role === 'OFFICER'
      ? 0x0f172a
      : jitterColorHex(pickRandom(BOTTOMS_PALETTE), 0.03, 0.08, 0.07);

  const shoeHex =
    role === 'OFFICER' || role === 'BUSINESS'
      ? pickRandom([0x090d16, 0x292524, 0x451a03])
      : jitterColorHex(pickRandom(SHOE_UPPERS), 0.03, 0.08, 0.06);
  const shoeSoleHex =
    role === 'OFFICER' || role === 'BUSINESS' ? 0x111827 : pickRandom([0xf8fafc, 0xe2e8f0, 0xfef08a]);

  const skinHex = jitterColorHex(pickRandom(SKIN_TONES), 0.01, 0.04, 0.03);
  const hairHex = jitterColorHex(pickRandom(HAIR_TONES), 0.02, 0.06, 0.05);
  const accessoryHex = jitterColorHex(pickRandom(ACCESSORY_COLORS), 0.04, 0.1, 0.07);

  // 5. Sunglasses, Headphones & Handheld / Carried Street Props
  const wearsSunglasses =
    role === 'TOURIST'
      ? Math.random() < 0.72
      : role === 'OFFICER'
      ? Math.random() < 0.65
      : Math.random() < 0.34;
  const sunglassTintHex = pickRandom(SUNGLASS_TINTS);

  const wearsHeadphones =
    role === 'JOGGER'
      ? Math.random() < 0.7
      : role === 'CIVILIAN' && hairStyle !== 'BUCKET_HAT' && hairStyle !== 'PEAKED_CAP'
      ? Math.random() < 0.25
      : false;

  let propStyle: NPCPropStyle = 'NONE';
  if (role === 'BUSINESS') {
    propStyle = pickRandom(['BRIEFCASE', 'COFFEE_CUP', 'NONE']);
  } else if (role === 'TOURIST') {
    propStyle = pickRandom(['BACKPACK', 'CROSSBODY_BAG', 'SHOPPING_BAG']);
  } else if (role === 'CIVILIAN') {
    propStyle = pickRandom(['NONE', 'SHOPPING_BAG', 'COFFEE_CUP', 'BACKPACK', 'CROSSBODY_BAG']);
  } else if (role === 'VENDOR') {
    propStyle = Math.random() < 0.4 ? 'CROSSBODY_BAG' : 'NONE';
  }

  // 6. Individualized Walking Animation Speed & Gait Personality
  let walkSpeedMultiplier = 0.74 + Math.random() * 0.62; // 0.74x .. 1.36x
  let strideStyle: NPCStrideStyle = pickRandom(['RELAXED', 'BRISK', 'SWAGGER', 'ENERGETIC']);

  if (role === 'JOGGER') {
    walkSpeedMultiplier = 0.86 + Math.random() * 0.42; // Varied coastal joggers & tempo runners
    strideStyle = 'ENERGETIC';
  } else if (role === 'TOURIST') {
    walkSpeedMultiplier = 0.68 + Math.random() * 0.38; // Sightseeing leisurely pace
    strideStyle = Math.random() < 0.7 ? 'RELAXED' : 'SWAGGER';
  } else if (role === 'BUSINESS') {
    walkSpeedMultiplier = 0.94 + Math.random() * 0.44; // Hurried Midtown commuters
    strideStyle = Math.random() < 0.75 ? 'BRISK' : 'RELAXED';
  } else if (role === 'OFFICER') {
    walkSpeedMultiplier = 0.88 + Math.random() * 0.28;
    strideStyle = 'SWAGGER';
  }

  // Shorter heights naturally step slightly quicker; add organic per-person cadence variance
  const animCadenceMultiplier =
    (1 / heightScale) * (0.84 + Math.random() * 0.38);

  return {
    appearance: {
      bodyBuild,
      heightScale,
      widthScale,
      outfitStyle,
      hairStyle,
      capBackwards,
      facialHair,
      wearsSunglasses,
      sunglassTintHex,
      wearsHeadphones,
      propStyle,
      primaryTopHex,
      secondaryLayerHex,
      bottomHex,
      shoeHex,
      shoeSoleHex,
      skinHex,
      hairHex,
      accessoryHex,
    },
    walkSpeedMultiplier,
    animCadenceMultiplier,
    strideStyle,
  };
}

const PLAZA_HUB = { label: 'Solis Central Park Fountain', x: 24, z: 24 };
const MARINA_PROMENADE = { label: 'Vespucci Marina Boardwalk', x: -104, z: 18 };
const DOWNTOWN_TOWER = { label: 'Midtown Financial Exchange', x: -24, z: -28 };
const VINEWOOD_CAFE = { label: 'Vinewood Espresso Terrace', x: 32, z: -82 };
const HARBOR_DOCK = { label: 'Southport Auto & Salvage', x: 84, z: 82 };

export function getSchedulePhaseForHour(hour: number): SchedulePhase {
  if (hour >= 6 && hour < 9.5) return 'MORNING_COMMUTE';
  if (hour >= 9.5 && hour < 17.5) return 'WORK_SHIFT';
  if (hour >= 17.5 && hour < 22) return 'EVENING_SOCIAL';
  return 'NIGHT_REST';
}

export function generateNPCProfiles(count: number): {
  profiles: RichNPCProfile[];
  roles: NPCRole[];
} {
  const coreRoles: NPCRole[] = [
    'VENDOR',
    'MECHANIC',
    'BUSINESS',
    'CIVILIAN',
    'JOGGER',
    'TOURIST',
    'OFFICER',
  ];
  const weightedStreetRoles: NPCRole[] = [
    'CIVILIAN',
    'CIVILIAN',
    'TOURIST',
    'JOGGER',
    'BUSINESS',
    'VENDOR',
    'MECHANIC',
    'OFFICER',
  ];

  const roles: NPCRole[] = [];
  const names: string[] = [];

  for (let i = 0; i < count; i++) {
    // Guarantee every archetype appears at least twice, then randomize the rest of the crowd
    const role = i < 14 ? coreRoles[i % coreRoles.length] : pickRandom(weightedStreetRoles);
    roles.push(role);
    const fn = FIRST_NAMES[(i + Math.floor(Math.random() * 5)) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3 + Math.floor(Math.random() * 7)) % LAST_NAMES.length];
    names.push(`${fn} ${ln}`);
  }

  const anchorsByIndex = (i: number, role: NPCRole) => {
    const homeX = ((i * 47 + Math.floor(Math.random() * 22)) % 180) - 90;
    const homeZ = ((i * 61 + Math.floor(Math.random() * 22)) % 180) - 90;
    const homeAnchor: NPCDailyAnchor = {
      label:
        homeX < -40
          ? 'Vespucci Lofts'
          : homeZ < -40
          ? 'Vinewood Hills Apartments'
          : 'Midtown Residences',
      x: homeX,
      z: homeZ,
    };

    let workAnchor: NPCDailyAnchor = DOWNTOWN_TOWER;
    if (role === 'VENDOR') {
      workAnchor = {
        label: 'Marina Street Market',
        x: -96 + (i % 3) * 8,
        z: 32 - (i % 4) * 10,
      };
    } else if (role === 'MECHANIC') {
      workAnchor = {
        label: HARBOR_DOCK.label,
        x: HARBOR_DOCK.x - (i % 4) * 6,
        z: HARBOR_DOCK.z,
      };
    } else if (role === 'JOGGER' || role === 'TOURIST') {
      workAnchor = {
        label: MARINA_PROMENADE.label,
        x: -104,
        z: -48 + (i % 8) * 15,
      };
    } else if (role === 'OFFICER') {
      workAnchor = { label: 'Central Precinct Beat', x: 8.8, z: -46 + (i % 3) * 18 };
    } else {
      workAnchor = {
        label: DOWNTOWN_TOWER.label,
        x: -32 + (i % 5) * 14,
        z: -32 + (i % 3) * 14,
      };
    }

    const leisurePool = [PLAZA_HUB, MARINA_PROMENADE, VINEWOOD_CAFE];
    const baseLeisure = leisurePool[i % leisurePool.length];
    const leisureAnchor: NPCDailyAnchor = {
      label: baseLeisure.label,
      x: baseLeisure.x + ((i % 5) - 2) * 3.8,
      z: baseLeisure.z + (((i * 2) % 5) - 2) * 3.8,
    };

    return { homeAnchor, workAnchor, leisureAnchor };
  };

  const objectivesByRole: Record<
    NPCRole,
    { text: string; type: RichNPCProfile['objectiveType']; scrap: number }
  > = {
    MECHANIC: {
      text: 'Track down 2 clean Salvage Parts to finish tuning a twin-turbo coupe.',
      type: 'SCRAP_DELIVERY',
      scrap: 2,
    },
    VENDOR: {
      text: 'Split $120 on a fresh crate of Marina streetwear before evening rush.',
      type: 'CASH_INVEST',
      scrap: 0,
    },
    BUSINESS: {
      text: 'Get a pulse on Downtown traffic before heading into a client meeting.',
      type: 'COURTESY_CHECK',
      scrap: 0,
    },
    CIVILIAN: {
      text: 'Grab 1 Salvage Part to patch up our apartment block’s backup generator.',
      type: 'SCRAP_DELIVERY',
      scrap: 1,
    },
    JOGGER: {
      text: 'Finish a 5K coastal run and check if Vespucci Blvd is clear.',
      type: 'COURTESY_CHECK',
      scrap: 0,
    },
    TOURIST: {
      text: 'Find the best skyline viewpoint and local spots around Central Plaza.',
      type: 'COURTESY_CHECK',
      scrap: 0,
    },
    OFFICER: {
      text: 'Keep reckless street racers off the Midtown crosswalks.',
      type: 'COURTESY_CHECK',
      scrap: 0,
    },
  };

  const profiles: RichNPCProfile[] = [];
  for (let i = 0; i < count; i++) {
    const role = roles[i];
    const { homeAnchor, workAnchor, leisureAnchor } = anchorsByIndex(i, role);
    const objSpec = objectivesByRole[role];
    const diversity = generateRandomAppearanceForRole(role);

    const friendIdx = (i + 1) % count;
    const secondIdx = (i + 5) % count;
    const relationships: NPCRelationshipLink[] = [
      {
        targetNpcId: friendIdx + 1,
        targetName: names[friendIdx],
        affinity: 68,
        relationLabel: i % 2 === 0 ? 'Best Friend' : 'Colleague',
      },
      {
        targetNpcId: secondIdx + 1,
        targetName: names[secondIdx],
        affinity: i % 3 === 0 ? -45 : 42,
        relationLabel: i % 3 === 0 ? 'Rival' : 'Neighbor',
      },
    ];

    profiles.push({
      name: names[i],
      voiceSeed: i + 11 + Math.floor(Math.random() * 17),
      appearance: diversity.appearance,
      walkSpeedMultiplier: diversity.walkSpeedMultiplier,
      animCadenceMultiplier: diversity.animCadenceMultiplier,
      strideStyle: diversity.strideStyle,
      homeAnchor,
      workAnchor,
      leisureAnchor,
      personalObjective: objSpec.text,
      objectiveType: objSpec.type,
      objectiveScrapNeeded: objSpec.scrap,
      objectiveCompleted: false,
      playerTrust: role === 'OFFICER' ? 5 : 15,
      relationships,
      socialCooldown: Math.random() * 6,
      partnerNpcId: null,
      lastCustomReply: null,
    });
  }

  return { profiles, roles };
}

export function getMoodLabel(trust: number, wantedLevel: number, role: NPCRole): string {
  if (wantedLevel >= 2 && role === 'OFFICER') return 'On Alert';
  if (wantedLevel >= 3) return 'Nervous';
  if (trust >= 60) return 'Solid Homie';
  if (trust >= 25) return 'Chill';
  if (trust >= -15) return 'Casual';
  if (trust >= -50) return 'Annoyed';
  return 'Hostile';
}

export function buildContextualDialogue(
  profile: RichNPCProfile,
  role: NPCRole,
  phase: SchedulePhase,
  wantedLevel: number,
  playerScrap: number,
  playerCash: number,
  nearbyPlayerCarName: string | null = null
): { line: string; currentActivity: string; options: ActiveNPCDialogueOption[] } {
  const activityMap: Record<SchedulePhase, string> = {
    MORNING_COMMUTE: `Heading to ${profile.workAnchor.label}`,
    WORK_SHIFT: `On shift near ${profile.workAnchor.label}`,
    EVENING_SOCIAL: `Hanging out at ${profile.leisureAnchor.label}`,
    NIGHT_REST: `Walking home to ${profile.homeAnchor.label}`,
  };

  const rel = profile.relationships[0];
  const firstName = rel.targetName.split(' ')[0];
  let line = '';

  if (profile.lastCustomReply) {
    line = profile.lastCustomReply;
  } else if (wantedLevel > 0 && role === 'OFFICER') {
    line = `Whoa, hold up right there! Dispatch just flagged your description on the scanner—don't make any sudden moves.`;
  } else if (wantedLevel >= 2 && profile.playerTrust < 50) {
    line = `Man, hear all those sirens?! Cops are tearing up the avenue right now, don't drag me into your mess!`;
  } else if (profile.playerTrust <= -25) {
    line = `Seriously? After the stunt you pulled earlier, you got nerve walking up to me. Make it quick.`;
  } else if (profile.playerTrust >= 55) {
    line = nearbyPlayerCarName
      ? `Yo, what's good! Clean ${nearbyPlayerCarName} you parked back there. ${firstName} and I always got your back on this block.`
      : `Hey, good seeing you out here! ${firstName} was just saying you're the realest person in San Solis.`;
  } else {
    if (role === 'MECHANIC') {
      line = nearbyPlayerCarName
        ? `Hey! Noticed you rolling around in that ${nearbyPlayerCarName}. I'm at ${profile.workAnchor.label} trying to ${profile.personalObjective.charAt(0).toLowerCase() + profile.personalObjective.slice(1)}`
        : `What's up? Just stepped out of the bay—drivers out here keep cooking their clutches at every red light.`;
    } else if (role === 'VENDOR') {
      line = `Yo, welcome! Best street hookups on this side of ${profile.workAnchor.label}. Everybody's out hustling today, huh?`;
    } else if (role === 'TOURIST') {
      line = `Oh hey! Sorry, I'm still figuring out these blocks—people drive like maniacs down the boulevard, it's wild!`;
    } else if (role === 'JOGGER') {
      line = `Phew—catching my breath for a sec! Nearly got clipped by a sports car taking that corner way too hot.`;
    } else if (role === 'BUSINESS') {
      line =
        phase === 'EVENING_SOCIAL'
          ? `Finally off the clock. Meeting ${firstName} by ${profile.leisureAnchor.label} to unwind.`
          : `Man, my phone hasn't stopped buzzing all day. Just grabbing some air before heading back to ${profile.workAnchor.label}.`;
    } else if (role === 'OFFICER') {
      line = `Afternoon, citizen. Keep your driving clean on the asphalt and watch the crosswalks—lots of foot traffic today.`;
    } else {
      line =
        phase === 'NIGHT_REST'
          ? `Crazy how loud the city stays at night. Just walking back to ${profile.homeAnchor.label}. What's going on?`
          : `Hey there! Just meeting up with ${firstName} around ${profile.leisureAnchor.label}. Anything exciting happening on your end?`;
    }
  }

  const options: ActiveNPCDialogueOption[] = [
    {
      id: 'CHAT',
      label: 'Talk & Catch Up',
      subtitle: 'Have a real street conversation (+Trust & +35 Syndicate XP)',
    },
  ];

  if (!profile.objectiveCompleted) {
    if (profile.objectiveType === 'SCRAP_DELIVERY') {
      options.push({
        id: 'HELP_OBJECTIVE',
        label: `Hook Them Up (${profile.objectiveScrapNeeded} Salvage)`,
        subtitle:
          playerScrap >= profile.objectiveScrapNeeded
            ? `Hand over parts · They pay you $320 + huge respect`
            : `Need ${profile.objectiveScrapNeeded} Salvage Parts (check cyan POIs curbside)`,
      });
    } else if (profile.objectiveType === 'CASH_INVEST') {
      options.push({
        id: 'HELP_OBJECTIVE',
        label: 'Pitch In $120 on Their Hustle',
        subtitle:
          playerCash >= 120
            ? 'Split the crate · Get $280 back + 2 Salvage Parts'
            : 'Need $120 cash on hand',
      });
    } else {
      options.push({
        id: 'HELP_OBJECTIVE',
        label: 'Give Local Street Tip',
        subtitle: 'Help them out · Earn $180 tip & neighborhood trust',
      });
    }
  }

  if (role === 'VENDOR' || role === 'MECHANIC') {
    options.push({
      id: 'TRADE_DEAL',
      label: role === 'MECHANIC' ? 'Buy 2 Salvage Parts ($90)' : 'Grab Street Snack & Vest ($85)',
      subtitle:
        role === 'MECHANIC'
          ? 'Spare turbo & chassis parts straight from the shop'
          : 'Restores +40 Health & +40 Armor on the spot',
    });
  }

  options.push(
    {
      id: 'PROVOKE',
      label: 'Talk Trash & Shake Down',
      subtitle: 'Start street drama (-45 Trust, alerts nearby friends & LSPD)',
    },
    {
      id: 'LEAVE',
      label: 'Alright, Catch You Later',
      subtitle: 'Wrap up chat and keep moving',
    }
  );

  return {
    line,
    currentActivity: activityMap[phase],
    options,
  };
}

export function buildNaturalChatReply(profile: RichNPCProfile, role: NPCRole, turnSeed: number): string {
  const friendName = profile.relationships[0]?.targetName.split(' ')[0] || 'my friend';
  const poolByRole: Record<NPCRole, string[]> = {
    MECHANIC: [
      `Haha for real! Tell you what, if you spot any smuggler crates by the curb, grab 'em—those turbo parts are pure gold.`,
      `Word on Southport is some street racers have been drifting the coastal corners nonstop. Music to my ears, honestly.`,
      `Me and ${friendName} are rebuilding a V8 this weekend. Stop by anytime you need parts!`,
    ],
    VENDOR: [
      `Appreciate you stopping by! Half the folks rushing down Midtown don't even look up from their phones.`,
      `${friendName} told me business by Vespucci Marina is booming today—people love the ocean breeze.`,
      `Stay sharp out there, alright? When the sirens start wailing, everybody scatters fast!`,
    ],
    BUSINESS: [
      `Honestly, it's refreshing talking to someone normal for five seconds instead of staring at spreadsheets.`,
      `${friendName} swears the espresso on Vinewood Blvd is the only thing keeping Midtown running.`,
      `Traffic on the main avenues gets wild—at least drivers stay off the sidewalks around here!`,
    ],
    JOGGER: [
      `Right?! Nothing beats running along the palms by Vespucci Beach when the sun hits the water.`,
      `I raced ${friendName} down to the fountain earlier and barely won. Gotta keep the pace up!`,
      `Good chatting with you—stay safe out on those intersections!`,
    ],
    TOURIST: [
      `No way, thanks for the tip! This whole city feels so alive—every corner has something going on.`,
      `I just snapped a shot of those sports cars tearing past the palms. My friends back home won't believe it!`,
      `You locals really know how to live! Might grab coffee over by Vinewood next.`,
    ],
    OFFICER: [
      `Glad to hear it. Long as folks keep their wheels on the asphalt and don't start brawls, it's a good shift.`,
      `Between me and ${friendName}, we've clocked three tuned coupes flying down the coast already today.`,
      `Stay safe out there, citizen. Holler if anybody gives you trouble.`,
    ],
    CIVILIAN: [
      `Haha seriously! Me and ${friendName} were just laughing about the exact same thing earlier.`,
      `Man, I love this neighborhood—always cars cruising by, people hanging out by the plaza, never a dull moment.`,
      `Respect for being cool. Most people barely say hi anymore—catch me anytime you're around the block!`,
    ],
  };

  const lines = poolByRole[role];
  return lines[Math.abs(turnSeed) % lines.length];
}
