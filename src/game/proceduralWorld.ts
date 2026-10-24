import * as THREE from 'three';
import { ProceduralPOIInfo, ProceduralPOIType } from './types';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LivePOIEntity {
  info: ProceduralPOIInfo;
  group: THREE.Group;
  beaconRing: THREE.Mesh;
  floatingIcon: THREE.Mesh;
}

const POI_TEMPLATES: Record<
  ProceduralPOIType,
  { titles: string[]; subtitles: string; color: number; cash: number; xp: number; scrap: number }
> = {
  SALVAGE_DROP: {
    titles: ['Smuggler Crate Cache', 'Harbor Turbo Salvage', 'Abandoned Tuner Parts'],
    subtitles: 'Pull up curbside or walk over and tap Claim POI to collect high-grade parts.',
    color: 0x38bdf8,
    cash: 240,
    xp: 85,
    scrap: 3,
  },
  STREET_MARKET: {
    titles: ['Pop-Up Night Bazaar', 'Vespucci Curbside Kiosk', 'Underground Parts Pop-Up'],
    subtitles: 'Curbside street vendor deal — tap Claim POI for cash & salvage.',
    color: 0x10b981,
    cash: 340,
    xp: 95,
    scrap: 2,
  },
  SYNDICATE_STASH: {
    titles: ['Encrypted Dead-Drop', 'Vinewood Courier Case', 'Fixer Lockbox'],
    subtitles: 'Tap Claim POI to crack the lockbox (high payout, may alert LSPD).',
    color: 0xa855f7,
    cash: 620,
    xp: 130,
    scrap: 2,
  },
  TIME_TRIAL_RING: {
    titles: ['Apex Street Sprint Gate', 'Boulevard Speed Checkpoint', 'Coastal Nitrous Gate'],
    subtitles: 'Drive right up the road gate and tap Claim POI for the street-racing purse.',
    color: 0xf59e0b,
    cash: 480,
    xp: 120,
    scrap: 1,
  },
  CITIZEN_DISPUTE: {
    titles: ['Curbside Fender-Bender', 'Stranded Motorist Aid', 'Street Vendor Stand-Off'],
    subtitles: 'Tap Claim POI to settle the street incident for neighborhood respect & cash.',
    color: 0xf43f5e,
    cash: 390,
    xp: 110,
    scrap: 2,
  },
};

// Curbside sidewalk coordinates (8.4m from road centerline — clear of asphalt traffic lanes yet reachable from road or sidewalk!)
const CURBSIDE_POI_SLOTS: [number, number][] = [
  [-103.6, -42],
  [-103.6, 18],
  [-103.6, 84],
  [-47.6, -86],
  [-47.6, 28],
  [-47.6, 98],
  [8.4, -84],
  [8.4, 24],
  [8.4, 88],
  [64.4, -38],
  [64.4, 38],
  [103.6, -82],
  [103.6, -22],
  [103.6, 44],
  [-84, -103.6],
  [82, 103.6],
];

// Road-centered slots strictly for drive-through TIME_TRIAL_RING arches (zero solid roadblocks!)
const ROAD_GATE_SLOTS: { x: number; z: number; rotY: number }[] = [
  { x: -112, z: -28, rotY: 0 },
  { x: 0, z: -84, rotY: 0 },
  { x: 56, z: 28, rotY: 0 },
  { x: -28, z: 56, rotY: Math.PI / 2 },
  { x: 84, z: 0, rotY: Math.PI / 2 },
];

export function generateProceduralPOIs(
  seed: number,
  scene: THREE.Scene,
  count: number = 7
): LivePOIEntity[] {
  const rand = mulberry32(seed);
  const types: ProceduralPOIType[] = [
    'SALVAGE_DROP',
    'STREET_MARKET',
    'SYNDICATE_STASH',
    'TIME_TRIAL_RING',
    'CITIZEN_DISPUTE',
  ];

  const slots = [...CURBSIDE_POI_SLOTS];
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const entities: LivePOIEntity[] = [];

  for (let i = 0; i < Math.min(count, slots.length); i++) {
    const type = types[Math.floor(rand() * types.length)];
    const tpl = POI_TEMPLATES[type];
    const title = tpl.titles[Math.floor(rand() * tpl.titles.length)];

    let x = slots[i][0];
    let z = slots[i][1];
    let baseY = 0.22; // Flush on raised sidewalk slab
    let archRotY = 0;

    if (type === 'TIME_TRIAL_RING') {
      const gate = ROAD_GATE_SLOTS[i % ROAD_GATE_SLOTS.length];
      x = gate.x;
      z = gate.z;
      baseY = 0; // Sits across the asphalt road with open drive-through clearance
      archRotY = gate.rotY;
    }

    const group = new THREE.Group();
    group.position.set(x, baseY, z);
    group.rotation.y = archRotY;

    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.05, 24),
      new THREE.MeshBasicMaterial({
        color: tpl.color,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    beaconRing.rotation.x = -Math.PI / 2;
    beaconRing.position.y = 0.04;
    group.add(beaconRing);

    if (type === 'TIME_TRIAL_RING') {
      // Sleek drive-through overhead racing gantry flanking the road curbs (cars drive cleanly underneath!)
      const pillarMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.65,
        roughness: 0.35,
      });
      const neonMat = new THREE.MeshBasicMaterial({ color: tpl.color });

      const leftPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 4.6, 10), pillarMat);
      leftPillar.position.set(-6.4, 2.3, 0);
      const rightPillar = leftPillar.clone();
      rightPillar.position.set(6.4, 2.3, 0);

      const crossbar = new THREE.Mesh(new THREE.BoxGeometry(13.2, 0.42, 0.42), neonMat);
      crossbar.position.set(0, 4.5, 0);

      group.add(leftPillar, rightPillar, crossbar);
    } else if (type === 'SALVAGE_DROP' || type === 'SYNDICATE_STASH') {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.78, 0.85),
        new THREE.MeshStandardMaterial({
          color: type === 'SYNDICATE_STASH' ? 0x3b0764 : 0x1e3a8a,
          metalness: 0.65,
          roughness: 0.35,
        })
      );
      crate.position.y = 0.39;
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.14, 0.9),
        new THREE.MeshStandardMaterial({ color: tpl.color, metalness: 0.8, roughness: 0.2 })
      );
      trim.position.y = 0.72;
      group.add(crate, trim);
    } else if (type === 'STREET_MARKET') {
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 0.82, 0.82),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 })
      );
      counter.position.y = 0.41;
      const canopy = new THREE.Mesh(
        new THREE.ConeGeometry(1.45, 0.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.6 })
      );
      canopy.position.y = 2.15;
      canopy.rotation.y = Math.PI / 4;
      group.add(counter, canopy);
    } else {
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.55, 0.32, 12),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 })
      );
      base.position.y = 0.16;
      group.add(base);
    }

    const floatingIcon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.44, 0),
      new THREE.MeshStandardMaterial({
        color: tpl.color,
        emissive: tpl.color,
        emissiveIntensity: 0.45,
        metalness: 0.4,
        roughness: 0.2,
      })
    );
    floatingIcon.position.y = type === 'TIME_TRIAL_RING' ? 5.3 : 2.85;
    group.add(floatingIcon);

    scene.add(group);

    entities.push({
      info: {
        id: `poi_${seed}_${i}`,
        seed,
        type,
        title,
        subtitle: tpl.subtitles,
        x,
        z,
        rewardCash: Math.round(tpl.cash * (0.85 + rand() * 0.4)),
        rewardXp: tpl.xp,
        rewardScrap: tpl.scrap,
        discovered: false,
        completed: false,
      },
      group,
      beaconRing,
      floatingIcon,
    });
  }

  return entities;
}
