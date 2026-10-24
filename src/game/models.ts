import * as THREE from 'three';
import { NPCRole, VehicleType } from './types';
import { NPCAppearanceConfig, NPCStrideStyle } from './npcSystem';

export interface CharacterRig {
  group: THREE.Group;
  hips: THREE.Group;
  chest: THREE.Group;
  headGroup: THREE.Group;
  leftLeg: THREE.Group;
  leftShin: THREE.Group;
  rightLeg: THREE.Group;
  rightShin: THREE.Group;
  leftArm: THREE.Group;
  leftForearm: THREE.Group;
  rightArm: THREE.Group;
  rightForearm: THREE.Group;
  phoneProp?: THREE.Mesh;
  briefcaseProp?: THREE.Group;
  carriesCoffeeCup?: boolean;
}

export interface VehicleRig {
  group: THREE.Group;
  bodyMat: THREE.MeshPhysicalMaterial;
  wheels: THREE.Mesh[];
  frontWheelPivots: THREE.Group[];
  driverGroup: THREE.Group;
  leftBlinkerMat: THREE.MeshBasicMaterial;
  rightBlinkerMat: THREE.MeshBasicMaterial;
  sirenBar?: {
    redLight: THREE.Mesh;
    blueLight: THREE.Mesh;
  };
  brakeLights: THREE.Mesh;
}

// ============================================================================
// SHARED ANATOMICAL GEOMETRIES FOR REALISTIC HUMAN SILHOUETTES (ZERO GC LEAK)
// ============================================================================

const sharedWheelGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.29, 22);
sharedWheelGeo.rotateZ(Math.PI / 2);

const sharedRimRingGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.305, 18);
sharedRimRingGeo.rotateZ(Math.PI / 2);

const sharedBrakeDiscGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.26, 14);
sharedBrakeDiscGeo.rotateZ(Math.PI / 2);

const sharedSpokeGeo = new THREE.BoxGeometry(0.315, 0.045, 0.46);

// Sculpted organic human head (ellipsoid cranium + jawline)
const craniumGeo = new THREE.SphereGeometry(0.145, 18, 16);
craniumGeo.scale(0.92, 1.08, 0.98);

const jawGeo = new THREE.CylinderGeometry(0.11, 0.082, 0.12, 12);
const neckGeo = new THREE.CylinderGeometry(0.062, 0.072, 0.12, 10);
const noseGeo = new THREE.ConeGeometry(0.022, 0.055, 6);
noseGeo.rotateX(Math.PI / 2);

const eyeWhiteGeo = new THREE.SphereGeometry(0.021, 8, 8);
const pupilGeo = new THREE.SphereGeometry(0.011, 6, 6);
const browGeo = new THREE.BoxGeometry(0.042, 0.011, 0.012);
const earGeo = new THREE.SphereGeometry(0.028, 8, 8);
earGeo.scale(0.45, 0.9, 0.65);

// Sculpted anatomical torsos across 4 body builds (Slim, Average, Athletic, Stocky)
const chestSlimGeo = new THREE.CylinderGeometry(0.182, 0.142, 0.42, 14);
chestSlimGeo.scale(1.02, 1, 0.66);

const chestAverageGeo = new THREE.CylinderGeometry(0.205, 0.162, 0.43, 14);
chestAverageGeo.scale(1.06, 1, 0.68);

const chestAthleticGeo = new THREE.CylinderGeometry(0.228, 0.158, 0.45, 14);
chestAthleticGeo.scale(1.12, 1, 0.69);

const chestStockyGeo = new THREE.CylinderGeometry(0.232, 0.195, 0.43, 14);
chestStockyGeo.scale(1.14, 1, 0.78);

const pelvisGeo = new THREE.CylinderGeometry(0.165, 0.155, 0.19, 14);
pelvisGeo.scale(1.04, 1, 0.72);

const collarGeo = new THREE.TorusGeometry(0.082, 0.022, 8, 14);
collarGeo.rotateX(Math.PI / 2);

// Layered Garment Geometries (Hoodie hood/pocket, Open Jacket panels, Shorts cuffs)
const hoodieHoodGeo = new THREE.TorusGeometry(0.105, 0.038, 8, 14, Math.PI * 1.25);
hoodieHoodGeo.rotateX(Math.PI * 0.42);
hoodieHoodGeo.rotateZ(Math.PI * 0.88);

const kangarooPocketGeo = new THREE.BoxGeometry(0.2, 0.11, 0.032);
const openJacketPanelGeo = new THREE.BoxGeometry(0.115, 0.41, 0.045);
const shortsCuffGeo = new THREE.CylinderGeometry(0.086, 0.081, 0.18, 10);

// Hair, Hats, Facial Hair & Street Prop Shared Geometries
const afroCrownGeo = new THREE.SphereGeometry(0.182, 14, 12);
afroCrownGeo.scale(1.04, 0.96, 1.04);

const longHairBackGeo = new THREE.BoxGeometry(0.24, 0.28, 0.09);
const longHairSideGeo = new THREE.CapsuleGeometry(0.038, 0.16, 5, 8);

const beanieDomeGeo = new THREE.SphereGeometry(0.149, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58);
const beanieCuffGeo = new THREE.TorusGeometry(0.142, 0.024, 8, 16);
beanieCuffGeo.rotateX(Math.PI / 2);

const bucketCrownGeo = new THREE.CylinderGeometry(0.132, 0.148, 0.09, 14);
const bucketBrimGeo = new THREE.CylinderGeometry(0.195, 0.215, 0.016, 16);

const goateeGeo = new THREE.BoxGeometry(0.056, 0.052, 0.03);
const fullBeardGeo = new THREE.CylinderGeometry(0.116, 0.088, 0.105, 12, 1, false, -Math.PI * 0.48, Math.PI * 0.96);
const mustacheGeo = new THREE.BoxGeometry(0.068, 0.015, 0.022);

const shoppingBagGeo = new THREE.BoxGeometry(0.08, 0.28, 0.24);
const bagHandleGeo = new THREE.TorusGeometry(0.055, 0.009, 6, 12, Math.PI);
bagHandleGeo.rotateY(Math.PI / 2);

const coffeeCupGeo = new THREE.CylinderGeometry(0.036, 0.028, 0.1, 10);
const coffeeLidGeo = new THREE.CylinderGeometry(0.039, 0.039, 0.018, 10);

const crossbodyStrapGeo = new THREE.BoxGeometry(0.042, 0.46, 0.26);
const crossbodyPouchGeo = new THREE.BoxGeometry(0.075, 0.13, 0.16);

// Rounded anatomical limbs (thigh, knee, calf, sneaker, upper arm, forearm, hand)
const thighGeo = new THREE.CapsuleGeometry(0.076, 0.27, 6, 12);
thighGeo.translate(0, -0.17, 0);

const shinGeo = new THREE.CapsuleGeometry(0.06, 0.27, 6, 12);
shinGeo.translate(0, -0.17, 0);

const shoeSoleGeo = new THREE.BoxGeometry(0.115, 0.035, 0.24);
const shoeUpperGeo = new THREE.CapsuleGeometry(0.055, 0.1, 6, 10);
shoeUpperGeo.rotateX(Math.PI / 2);

const upperArmGeo = new THREE.CapsuleGeometry(0.056, 0.21, 6, 10);
upperArmGeo.translate(0, -0.13, 0);

const forearmGeo = new THREE.CapsuleGeometry(0.046, 0.2, 6, 10);
forearmGeo.translate(0, -0.12, 0);

const handGeo = new THREE.SphereGeometry(0.046, 8, 8);
handGeo.scale(0.82, 1.1, 0.65);

export function buildVehicleModel(
  type: VehicleType,
  primaryHex: number,
  shadowTex: THREE.Texture,
  isSoftwareGl: boolean
): VehicleRig {
  const group = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.35, 5.8),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: primaryHex,
    metalness: 0.78,
    roughness: 0.16,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.55,
  });

  const secondaryColor =
    type === 'POLICE' ? 0xf8fafc : type === 'TAXI' ? 0xfacc15 : primaryHex;
  const accentBodyMat = new THREE.MeshPhysicalMaterial({
    color: secondaryColor,
    metalness: 0.65,
    roughness: 0.22,
    clearcoat: isSoftwareGl ? 0 : 0.9,
    envMapIntensity: 1.4,
  });

  const carbonTrimMat = new THREE.MeshStandardMaterial({
    color: 0x11151c,
    metalness: 0.45,
    roughness: 0.55,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.92,
    roughness: 0.15,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1322,
    metalness: 0.25,
    roughness: 0.06,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    transparent: true,
    opacity: 0.56,
    envMapIntensity: 1.8,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x121417,
    metalness: 0.08,
    roughness: 0.86,
  });

  const isSUV = type === 'SUV';
  const isSports = type === 'SPORTS';
  const width = isSUV ? 2.24 : isSports ? 2.18 : 2.06;
  const length = isSUV ? 4.88 : isSports ? 4.72 : 4.62;
  const halfL = length * 0.5;

  const rimMat = new THREE.MeshStandardMaterial({
    color: isSports ? 0xf1f5f9 : 0xcbd5e1,
    metalness: 0.9,
    roughness: 0.18,
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: isSports ? 0xef4444 : 0xf59e0b,
    metalness: 0.5,
    roughness: 0.35,
  });

  // 1. Sculpted Aerodynamic Side-Profile Lower Body (ExtrudeGeometry with smooth bevels!)
  const bodyProfile = new THREE.Shape();
  if (isSports) {
    // Sleek Exotic Wedge Supercar Profile (+X in shape = +Z front of car)
    bodyProfile.moveTo(-halfL, 0.32);
    bodyProfile.lineTo(halfL - 0.18, 0.26); // Low front splitter nose
    bodyProfile.quadraticCurveTo(halfL + 0.04, 0.44, halfL - 0.25, 0.64); // Aerodynamic nose curve
    bodyProfile.lineTo(0.85, 0.82); // Sloped sculpted hood
    bodyProfile.lineTo(-halfL + 0.35, 0.92); // Rising rear haunch
    bodyProfile.lineTo(-halfL, 0.84); // Rear deck
    bodyProfile.closePath();
  } else if (isSUV) {
    // Muscular Luxury V8 SUV Profile
    bodyProfile.moveTo(-halfL, 0.38);
    bodyProfile.lineTo(halfL - 0.12, 0.36);
    bodyProfile.quadraticCurveTo(halfL + 0.02, 0.68, halfL - 0.16, 0.98);
    bodyProfile.lineTo(0.92, 1.06);
    bodyProfile.lineTo(-halfL + 0.1, 1.08);
    bodyProfile.lineTo(-halfL, 0.96);
    bodyProfile.closePath();
  } else {
    // Sleek Modern Sport Sedan / Interceptor Profile
    bodyProfile.moveTo(-halfL, 0.34);
    bodyProfile.lineTo(halfL - 0.14, 0.31);
    bodyProfile.quadraticCurveTo(halfL + 0.03, 0.56, halfL - 0.2, 0.78);
    bodyProfile.lineTo(0.88, 0.9);
    bodyProfile.lineTo(-halfL + 0.2, 0.96);
    bodyProfile.lineTo(-halfL, 0.86);
    bodyProfile.closePath();
  }

  const bodyExtrudeDepth = width - 0.22;
  const lowerHullGeo = new THREE.ExtrudeGeometry(bodyProfile, {
    depth: bodyExtrudeDepth,
    bevelEnabled: true,
    bevelThickness: 0.11,
    bevelSize: 0.09,
    bevelSegments: 3,
  });
  // Rotate so shape +X aligns with +Z (vehicle forward) and center along X!
  lowerHullGeo.rotateY(-Math.PI / 2);
  lowerHullGeo.translate(bodyExtrudeDepth * 0.5, 0, 0);

  const hull = new THREE.Mesh(lowerHullGeo, bodyMat);
  hull.castShadow = !isSoftwareGl;
  hull.receiveShadow = !isSoftwareGl;
  group.add(hull);

  // 2. Sculpted Raked Greenhouse Cabin & Fastback Roofline (ExtrudeGeometry!)
  const cabinProfile = new THREE.Shape();
  const beltY = isSUV ? 1.02 : isSports ? 0.78 : 0.88;
  const roofTopY = isSUV ? 1.72 : isSports ? 1.26 : 1.44;
  if (isSports) {
    cabinProfile.moveTo(-1.45, beltY);
    cabinProfile.lineTo(0.92, beltY - 0.02);
    cabinProfile.lineTo(0.22, roofTopY); // Steeply raked supercar windshield
    cabinProfile.quadraticCurveTo(-0.45, roofTopY + 0.04, -1.38, beltY + 0.08); // Fastback teardrop canopy
    cabinProfile.closePath();
  } else if (isSUV) {
    cabinProfile.moveTo(-2.15, beltY);
    cabinProfile.lineTo(0.95, beltY);
    cabinProfile.lineTo(0.38, roofTopY);
    cabinProfile.lineTo(-1.88, roofTopY);
    cabinProfile.lineTo(-2.15, beltY + 0.08);
    cabinProfile.closePath();
  } else {
    cabinProfile.moveTo(-1.62, beltY);
    cabinProfile.lineTo(0.92, beltY);
    cabinProfile.lineTo(0.32, roofTopY);
    cabinProfile.lineTo(-0.88, roofTopY);
    cabinProfile.lineTo(-1.62, beltY + 0.06);
    cabinProfile.closePath();
  }

  const cabinDepth = width * 0.76;
  const cabinGeo = new THREE.ExtrudeGeometry(cabinProfile, {
    depth: cabinDepth,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  cabinGeo.rotateY(-Math.PI / 2);
  cabinGeo.translate(cabinDepth * 0.5, 0, 0);

  const cabinGlass = new THREE.Mesh(cabinGeo, glassMat);
  group.add(cabinGlass);

  // Painted Roof Panel Cap
  const roofCapLen = isSUV ? 2.15 : isSports ? 0.92 : 1.18;
  const roofCapZ = isSUV ? -0.74 : isSports ? -0.28 : -0.28;
  const roofCap = new THREE.Mesh(
    new THREE.BoxGeometry(cabinDepth * 0.96, 0.06, roofCapLen),
    accentBodyMat
  );
  roofCap.position.set(0, roofTopY + 0.03, roofCapZ);
  roofCap.castShadow = !isSoftwareGl;
  group.add(roofCap);

  // 3. Lower Carbon Aero Splitter, Side Skirts & Rear Diffuser + Chrome Dual Exhausts
  const underTray = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.02, 0.12, length + 0.06),
    carbonTrimMat
  );
  underTray.position.y = 0.28;
  group.add(underTray);

  const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.24, 10);
  exhaustGeo.rotateX(Math.PI / 2);
  const exL = new THREE.Mesh(exhaustGeo, chromeMat);
  exL.position.set(-width * 0.26, 0.29, -halfL - 0.05);
  const exR = exL.clone();
  exR.position.x = width * 0.26;
  group.add(exL, exR);

  // Police Push-Bar Bullbar & Roof Lightbar
  if (type === 'SPORTS') {
    const spoilerWing = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.92, 0.06, 0.32),
      carbonTrimMat
    );
    spoilerWing.position.set(0, 1.12, -halfL + 0.22);
    spoilerWing.rotation.x = 0.08;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.18), carbonTrimMat);
    strutL.position.set(-width * 0.28, 1.0, -halfL + 0.22);
    const strutR = strutL.clone();
    strutR.position.x = width * 0.28;
    group.add(spoilerWing, strutL, strutR);
  }

  if (type === 'TAXI') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.18, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    sign.position.set(0, roofTopY + 0.13, roofCapZ);
    group.add(sign);
  }

  let sirenBar: VehicleRig['sirenBar'];
  if (type === 'POLICE') {
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.08, 0.26), carbonTrimMat);
    barBase.position.set(0, roofTopY + 0.08, roofCapZ + 0.1);
    const redLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.11, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    redLight.position.set(-0.28, roofTopY + 0.12, roofCapZ + 0.1);
    const blueLight = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.11, 0.22),
      new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
    );
    blueLight.position.set(0.28, roofTopY + 0.12, roofCapZ + 0.1);

    // Police front push-bumper ram bar
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.36, 0.12), carbonTrimMat);
    pushBar.position.set(0, 0.48, halfL + 0.08);
    group.add(barBase, redLight, blueLight, pushBar);
    sirenBar = { redLight, blueLight };
  }

  // 4. Crisp Xenon/LED Projector Headlights, Grille & Full-Width LED Brake Bar
  const headY = isSports ? 0.56 : isSUV ? 0.74 : 0.62;
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const drlMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd });

  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.1), headlightMat);
  headL.position.set(-width * 0.33, headY, halfL + 0.02);
  headL.rotation.y = -0.12;
  const headR = headL.clone();
  headR.position.x = width * 0.33;
  headR.rotation.y = 0.12;

  const drlStrip = new THREE.Mesh(new THREE.BoxGeometry(width * 0.82, 0.035, 0.08), drlMat);
  drlStrip.position.set(0, headY - 0.08, halfL + 0.03);

  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.44, isSUV ? 0.3 : 0.18, 0.09),
    carbonTrimMat
  );
  grille.position.set(0, headY - 0.06, halfL + 0.02);
  group.add(headL, headR, drlStrip, grille);

  const tailY = isSports ? 0.74 : isSUV ? 0.88 : 0.78;
  const brakeLights = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.86, 0.13, 0.09),
    new THREE.MeshBasicMaterial({ color: 0x991b1b })
  );
  brakeLights.position.set(0, tailY, -halfL - 0.06);
  group.add(brakeLights);

  // 5. Visible Seated Driver Silhouette inside Cabin (randomized shirt & skin tones)
  const driverShirts = [0x1e293b, 0x2563eb, 0xdc2626, 0x059669, 0xf8fafc, 0x7c3aed, 0xd97706];
  const driverSkins = [0xf7d3b5, 0xdfa77c, 0xb07043, 0x734224, 0x57311a];
  const randShirt =
    type === 'POLICE'
      ? 0x172554
      : driverShirts[Math.floor(Math.random() * driverShirts.length)];
  const randSkin = driverSkins[Math.floor(Math.random() * driverSkins.length)];

  const driverGroup = new THREE.Group();
  const seatDriverY = beltY - 0.06;
  const drvTorso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.22, 5, 8),
    new THREE.MeshStandardMaterial({
      color: randShirt,
      roughness: 0.75,
    })
  );
  drvTorso.position.set(-width * 0.18, seatDriverY + 0.1, 0.05);
  const drvHead = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 10, 10),
    new THREE.MeshStandardMaterial({ color: randSkin, roughness: 0.6 })
  );
  drvHead.position.set(-width * 0.18, seatDriverY + 0.31, 0.03);
  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.105, 0.02, 6, 12),
    carbonTrimMat
  );
  steeringWheel.position.set(-width * 0.18, seatDriverY + 0.15, 0.34);
  steeringWheel.rotation.x = -0.45;
  driverGroup.add(drvTorso, drvHead, steeringWheel);
  group.add(driverGroup);

  // Sculpted Wing Mirrors
  const mirrorL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.11), bodyMat);
  mirrorL.position.set(-width * 0.45, beltY + 0.06, 0.48);
  const mirrorR = mirrorL.clone();
  mirrorR.position.x = width * 0.45;
  group.add(mirrorL, mirrorR);

  // Amber Left & Right Turn Signal Blinkers
  const leftBlinkerMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
  const rightBlinkerMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });

  const blinkerGeo = new THREE.BoxGeometry(0.15, 0.1, 0.1);
  const blinkFL = new THREE.Mesh(blinkerGeo, leftBlinkerMat);
  blinkFL.position.set(width * 0.43, headY, halfL + 0.01);
  const blinkRL = new THREE.Mesh(blinkerGeo, leftBlinkerMat);
  blinkRL.position.set(width * 0.43, tailY, -halfL - 0.05);

  const blinkFR = new THREE.Mesh(blinkerGeo, rightBlinkerMat);
  blinkFR.position.set(-width * 0.43, headY, halfL + 0.01);
  const blinkRR = new THREE.Mesh(blinkerGeo, rightBlinkerMat);
  blinkRR.position.set(-width * 0.43, tailY, -halfL - 0.05);

  group.add(blinkFL, blinkRL, blinkFR, blinkRR);

  // 6. Multi-Spoke Alloy Wheels + Brake Discs + Calipers + Steerable Front Pivots
  const wheels: THREE.Mesh[] = [];
  const frontWheelPivots: THREE.Group[] = [];
  const wheelX = width * 0.47;
  const wheelZ = length * 0.31;
  const wheelOffsets: [number, number, number, boolean][] = [
    [-wheelX, 0.39, wheelZ, true],
    [wheelX, 0.39, wheelZ, true],
    [-wheelX, 0.39, -wheelZ, false],
    [wheelX, 0.39, -wheelZ, false],
  ];

  for (const [wx, wy, wz, isFront] of wheelOffsets) {
    const wheelMesh = new THREE.Mesh(sharedWheelGeo, tireMat);
    const rimRing = new THREE.Mesh(sharedRimRingGeo, rimMat);
    const disc = new THREE.Mesh(sharedBrakeDiscGeo, chromeMat);
    const spoke1 = new THREE.Mesh(sharedSpokeGeo, rimMat);
    const spoke2 = new THREE.Mesh(sharedSpokeGeo, rimMat);
    spoke2.rotation.x = Math.PI / 3;
    const spoke3 = new THREE.Mesh(sharedSpokeGeo, rimMat);
    spoke3.rotation.x = -Math.PI / 3;
    wheelMesh.add(rimRing, disc, spoke1, spoke2, spoke3);

    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.12), caliperMat);
    caliper.position.set(0, 0.08, -0.11);

    if (isFront) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(wx, wy, wz);
      steerPivot.add(wheelMesh, caliper);
      group.add(steerPivot);
      frontWheelPivots.push(steerPivot);
    } else {
      const rearHub = new THREE.Group();
      rearHub.position.set(wx, wy, wz);
      rearHub.add(wheelMesh, caliper);
      group.add(rearHub);
    }
    wheels.push(wheelMesh);
  }

  return {
    group,
    bodyMat,
    wheels,
    frontWheelPivots,
    driverGroup,
    leftBlinkerMat,
    rightBlinkerMat,
    sirenBar,
    brakeLights,
  };
}

// ============================================================================
// RANDOMIZED DIVERSE ARTICULATED HUMAN CHARACTER BUILDER
// Supports 4 body builds, 6 layered outfits, 9 hairstyles/hats, facial hair,
// multi-channel randomized palettes, street props, and custom gait styles!
// ============================================================================

export function buildCharacterModel(
  role: NPCRole | 'PLAYER',
  shirtHex: number,
  pantsHex: number,
  skinHex: number,
  shadowTex: THREE.Texture,
  isSoftwareGl: boolean,
  variantSeed: number = 0,
  appearance?: NPCAppearanceConfig
): CharacterRig {
  const group = new THREE.Group();

  // Soft contact shadow grounded flush on pavement
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  const buildType =
    appearance?.bodyBuild ?? (role === 'PLAYER' ? 'ATHLETIC' : variantSeed % 2 === 1 ? 'SLIM' : 'AVERAGE');
  const heightScale =
    appearance?.heightScale ??
    (role === 'PLAYER' ? 1.02 : 0.94 + ((variantSeed * 17) % 14) * 0.01);
  const widthScale = appearance?.widthScale ?? 1.0;

  // Non-uniform build scaling around y = 0 keeps feet flush on sidewalks!
  group.scale.set(widthScale, heightScale, widthScale * 0.97);

  const outfitStyle =
    appearance?.outfitStyle ??
    (role === 'PLAYER'
      ? 'OPEN_JACKET'
      : role === 'OFFICER' || role === 'VENDOR'
      ? 'UNIFORM_VEST'
      : role === 'BUSINESS'
      ? 'SUIT_BLAZER'
      : role === 'JOGGER'
      ? 'TANK_ATHLETIC'
      : 'TEE_SHORTS');

  const resolvedSkinHex = appearance?.skinHex ?? skinHex;
  const resolvedTopHex = appearance?.primaryTopHex ?? shirtHex;
  const resolvedInnerHex =
    appearance?.secondaryLayerHex ?? (role === 'PLAYER' ? 0xf8fafc : 0xe2e8f0);
  const resolvedBottomHex = appearance?.bottomHex ?? pantsHex;
  const resolvedShoeHex =
    appearance?.shoeHex ??
    (role === 'JOGGER' ? 0xf8fafc : role === 'OFFICER' ? 0x090d16 : 0x1e293b);
  const resolvedSoleHex =
    appearance?.shoeSoleHex ??
    (role === 'OFFICER' || role === 'BUSINESS' ? 0x111827 : 0xf1f5f9);
  const resolvedHairHex =
    appearance?.hairHex ??
    [0x181310, 0x3b2618, 0x5c3a21, 0x8d5b32, 0xd4a359, 0x262626][variantSeed % 6];
  const resolvedAccentHex = appearance?.accessoryHex ?? 0x0284c7;

  const skinMat = new THREE.MeshStandardMaterial({
    color: resolvedSkinHex,
    roughness: 0.58,
    metalness: 0.02,
  });

  const primaryTopMat = new THREE.MeshStandardMaterial({
    color: resolvedTopHex,
    roughness: outfitStyle === 'SUIT_BLAZER' ? 0.46 : 0.72,
    metalness: 0.06,
  });

  const secondaryLayerMat = new THREE.MeshStandardMaterial({
    color: resolvedInnerHex,
    roughness: 0.66,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: resolvedBottomHex,
    roughness: 0.82,
    metalness: 0.04,
  });

  const hairMat = new THREE.MeshStandardMaterial({
    color: resolvedHairHex,
    roughness: 0.84,
    metalness: 0.05,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: resolvedAccentHex,
    roughness: 0.62,
    metalness: 0.1,
  });

  const shoeUpperMat = new THREE.MeshStandardMaterial({
    color: resolvedShoeHex,
    roughness: 0.52,
  });
  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: resolvedSoleHex,
    roughness: 0.76,
  });

  // --------------------------------------------------------------------------
  // 1. HIPS & PELVIS ROOT (Y = 0.82m)
  // --------------------------------------------------------------------------
  const hips = new THREE.Group();
  hips.position.set(0, 0.82, 0);
  group.add(hips);

  const pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
  if (buildType === 'STOCKY') pelvisMesh.scale.set(1.12, 1, 0.82);
  pelvisMesh.castShadow = !isSoftwareGl;
  hips.add(pelvisMesh);

  const belt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.168, 0.168, 0.042, 14),
    new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.45 })
  );
  belt.scale.set(buildType === 'STOCKY' ? 1.13 : 1.05, 1, 0.74);
  belt.position.y = 0.08;
  hips.add(belt);

  // --------------------------------------------------------------------------
  // 2. ARTICULATED LEGS WITH SHORTS / TROUSERS / CUFFS & SNEAKERS/SHOES
  // --------------------------------------------------------------------------
  const wearsShorts = outfitStyle === 'TEE_SHORTS' || outfitStyle === 'TANK_ATHLETIC';

  const buildLeg = (sideX: number) => {
    const hipJoint = new THREE.Group();
    hipJoint.position.set(sideX, -0.02, 0);

    const thighMesh = new THREE.Mesh(
      thighGeo,
      wearsShorts && buildType === 'SLIM' ? skinMat : pantsMat
    );
    thighMesh.castShadow = !isSoftwareGl;
    hipJoint.add(thighMesh);

    if (wearsShorts) {
      const shortCuff = new THREE.Mesh(shortsCuffGeo, pantsMat);
      shortCuff.position.y = -0.1;
      hipJoint.add(shortCuff);
    }

    const kneeJoint = new THREE.Group();
    kneeJoint.position.set(0, -0.37, 0);
    hipJoint.add(kneeJoint);

    const shinMesh = new THREE.Mesh(shinGeo, wearsShorts ? skinMat : pantsMat);
    shinMesh.castShadow = !isSoftwareGl;
    kneeJoint.add(shinMesh);

    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.39, 0.035);
    const sole = new THREE.Mesh(shoeSoleGeo, shoeSoleMat);
    sole.position.y = -0.015;
    const upper = new THREE.Mesh(shoeUpperGeo, shoeUpperMat);
    upper.position.set(0, 0.025, -0.01);
    footGroup.add(sole, upper);
    kneeJoint.add(footGroup);

    hips.add(hipJoint);
    return { hipJoint, kneeJoint };
  };

  const legSpacing = buildType === 'STOCKY' ? 0.115 : 0.105;
  const leftLegRig = buildLeg(-legSpacing);
  const rightLegRig = buildLeg(legSpacing);

  // --------------------------------------------------------------------------
  // 3. SCULPTED CHEST & MULTI-STYLE LAYERED OUTFITS
  // --------------------------------------------------------------------------
  const chest = new THREE.Group();
  chest.position.set(0, 0.1, 0);
  hips.add(chest);

  const selectedChestGeo =
    buildType === 'SLIM'
      ? chestSlimGeo
      : buildType === 'ATHLETIC'
      ? chestAthleticGeo
      : buildType === 'STOCKY'
      ? chestStockyGeo
      : chestAverageGeo;

  // Base torso uses inner shirt on OPEN_JACKET so the open jacket panels frame it cleanly!
  const torsoBaseMat = outfitStyle === 'OPEN_JACKET' ? secondaryLayerMat : primaryTopMat;
  const torsoMesh = new THREE.Mesh(selectedChestGeo, torsoBaseMat);
  torsoMesh.position.y = 0.22;
  torsoMesh.castShadow = !isSoftwareGl;
  chest.add(torsoMesh);

  const collar = new THREE.Mesh(
    collarGeo,
    outfitStyle === 'TANK_ATHLETIC' ? skinMat : secondaryLayerMat
  );
  collar.position.set(0, 0.43, 0.01);
  chest.add(collar);

  if (outfitStyle === 'OPEN_JACKET') {
    const leftPanel = new THREE.Mesh(openJacketPanelGeo, primaryTopMat);
    leftPanel.position.set(-0.088, 0.22, 0.125);
    leftPanel.rotation.y = 0.14;
    const rightPanel = new THREE.Mesh(openJacketPanelGeo, primaryTopMat);
    rightPanel.position.set(0.088, 0.22, 0.125);
    rightPanel.rotation.y = -0.14;
    const backJacket = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.42, 0.05),
      primaryTopMat
    );
    backJacket.position.set(0, 0.22, -0.12);
    chest.add(leftPanel, rightPanel, backJacket);
  } else if (outfitStyle === 'HOODIE_JEANS') {
    const hoodFold = new THREE.Mesh(hoodieHoodGeo, primaryTopMat);
    hoodFold.position.set(0, 0.43, -0.055);
    const pocket = new THREE.Mesh(kangarooPocketGeo, primaryTopMat);
    pocket.position.set(0, 0.1, 0.142);
    chest.add(hoodFold, pocket);
  } else if (outfitStyle === 'SUIT_BLAZER') {
    const shirtFront = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.34, 0.025),
      secondaryLayerMat
    );
    shirtFront.position.set(0, 0.25, 0.138);
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.28, 0.03), accentMat);
    tie.position.set(0, 0.24, 0.148);
    chest.add(shirtFront, tie);
  } else if (outfitStyle === 'UNIFORM_VEST') {
    if (role === 'OFFICER') {
      const dutyVest = new THREE.Mesh(
        new THREE.CylinderGeometry(0.224, 0.184, 0.34, 12),
        new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.62 })
      );
      dutyVest.scale.set(1.08, 1, 0.74);
      dutyVest.position.y = 0.23;
      const badge = new THREE.Mesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.015, 6),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 })
      );
      badge.rotation.x = Math.PI / 2;
      badge.position.set(-0.08, 0.32, 0.158);
      chest.add(dutyVest, badge);
    } else if (role === 'VENDOR') {
      const apron = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.42, 0.026),
        secondaryLayerMat
      );
      apron.position.set(0, 0.12, 0.146);
      chest.add(apron);
    } else {
      // Utility / Work Vest for Mechanics & Crew
      const workVest = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.18, 0.34, 12),
        accentMat
      );
      workVest.scale.set(1.07, 1, 0.73);
      workVest.position.y = 0.23;
      chest.add(workVest);
    }
  }

  // Carried Torso Props (Backpack or Crossbody Sling Bag)
  const propStyle = appearance?.propStyle ?? (role === 'PLAYER' ? 'BACKPACK' : 'NONE');
  if (propStyle === 'BACKPACK') {
    const pack = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.18, 6, 10),
      accentMat
    );
    pack.scale.set(1.1, 1, 0.55);
    pack.position.set(0, 0.24, -0.165);
    chest.add(pack);
  } else if (propStyle === 'CROSSBODY_BAG') {
    const strap = new THREE.Mesh(crossbodyStrapGeo, accentMat);
    strap.position.set(0, 0.22, 0);
    strap.rotation.z = 0.58;
    const pouch = new THREE.Mesh(crossbodyPouchGeo, accentMat);
    pouch.position.set(0.15, 0.08, -0.06);
    chest.add(strap, pouch);
  }

  // --------------------------------------------------------------------------
  // 4. ORGANIC HEAD, FACIAL FEATURES, BEARDS, HAIRSTYLES & HATS
  // --------------------------------------------------------------------------
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.48, 0);
  chest.add(headGroup);

  const neck = new THREE.Mesh(neckGeo, skinMat);
  neck.position.y = 0.03;
  headGroup.add(neck);

  const cranium = new THREE.Mesh(craniumGeo, skinMat);
  cranium.position.set(0, 0.17, 0);
  cranium.castShadow = !isSoftwareGl;
  headGroup.add(cranium);

  const jaw = new THREE.Mesh(jawGeo, skinMat);
  jaw.scale.set(0.95, 1, 0.92);
  jaw.position.set(0, 0.11, 0.015);
  headGroup.add(jaw);

  const earL = new THREE.Mesh(earGeo, skinMat);
  earL.position.set(-0.132, 0.16, 0);
  const earR = earL.clone();
  earR.position.x = 0.132;
  headGroup.add(earL, earR);

  const nose = new THREE.Mesh(noseGeo, skinMat);
  nose.position.set(0, 0.155, 0.148);
  headGroup.add(nose);

  const wearsSunglasses =
    appearance?.wearsSunglasses ??
    (role === 'TOURIST' || role === 'OFFICER' || (variantSeed % 4 === 0 && role !== 'PLAYER'));

  if (wearsSunglasses) {
    const frameMat = new THREE.MeshPhysicalMaterial({
      color: appearance?.sunglassTintHex ?? 0x090d16,
      metalness: 0.82,
      roughness: 0.12,
      clearcoat: isSoftwareGl ? 0 : 1.0,
    });
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.036, 0.02), frameMat);
    lensL.position.set(-0.048, 0.178, 0.138);
    const lensR = lensL.clone();
    lensR.position.x = 0.048;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.008, 0.015), frameMat);
    bridge.position.set(0, 0.184, 0.142);
    headGroup.add(lensL, lensR, bridge);
  } else {
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });

    for (const sx of [-0.046, 0.046]) {
      const eyeW = new THREE.Mesh(eyeWhiteGeo, whiteMat);
      eyeW.scale.set(1.1, 0.75, 0.6);
      eyeW.position.set(sx, 0.176, 0.132);

      const pupil = new THREE.Mesh(pupilGeo, darkMat);
      pupil.position.set(sx, 0.176, 0.145);

      const brow = new THREE.Mesh(browGeo, hairMat);
      brow.position.set(sx, 0.202, 0.136);
      brow.rotation.z = sx < 0 ? 0.06 : -0.06;

      headGroup.add(eyeW, pupil, brow);
    }
  }

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.048, 0.009, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x7c3f34, roughness: 0.6 })
  );
  mouth.position.set(0, 0.105, 0.132);
  headGroup.add(mouth);

  // Facial Hair Variants
  const facialHair = appearance?.facialHair ?? 'NONE';
  if (facialHair === 'GOATEE') {
    const gt = new THREE.Mesh(goateeGeo, hairMat);
    gt.position.set(0, 0.075, 0.126);
    headGroup.add(gt);
  } else if (facialHair === 'FULL_BEARD') {
    const bd = new THREE.Mesh(fullBeardGeo, hairMat);
    bd.position.set(0, 0.095, 0.022);
    headGroup.add(bd);
  } else if (facialHair === 'MUSTACHE') {
    const ms = new THREE.Mesh(mustacheGeo, hairMat);
    ms.position.set(0, 0.122, 0.138);
    headGroup.add(ms);
  }

  // 9 Hairstyles & Hats
  const hairStyle =
    appearance?.hairStyle ??
    (role === 'OFFICER'
      ? 'PEAKED_CAP'
      : role === 'PLAYER'
      ? 'TEXTURED_QUIFF'
      : (['SHORT_FADE', 'TEXTURED_QUIFF', 'PONYTAIL'] as const)[variantSeed % 3]);

  if (hairStyle === 'PEAKED_CAP') {
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.14, 0.075, 14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
    );
    crown.position.set(0, 0.285, 0);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 0.016, 12, 1, false, -Math.PI * 0.4, Math.PI * 0.8),
      new THREE.MeshStandardMaterial({ color: 0x020617, roughness: 0.2, metalness: 0.4 })
    );
    visor.position.set(0, 0.25, 0.055);
    headGroup.add(crown, visor);
  } else if (hairStyle === 'BASEBALL_CAP') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.148, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      accentMat
    );
    dome.position.set(0, 0.185, 0);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.158, 0.012, 0.12), accentMat);
    const isBack = appearance?.capBackwards ?? false;
    brim.position.set(0, 0.222, isBack ? -0.135 : 0.135);
    brim.rotation.x = isBack ? -0.14 : 0.12;
    headGroup.add(dome, brim);
  } else if (hairStyle === 'BEANIE_HAT') {
    const dome = new THREE.Mesh(beanieDomeGeo, accentMat);
    dome.position.set(0, 0.195, 0);
    const cuff = new THREE.Mesh(beanieCuffGeo, accentMat);
    cuff.position.set(0, 0.22, 0);
    headGroup.add(dome, cuff);
  } else if (hairStyle === 'BUCKET_HAT') {
    const crown = new THREE.Mesh(bucketCrownGeo, accentMat);
    crown.position.set(0, 0.275, 0);
    const brim = new THREE.Mesh(bucketBrimGeo, accentMat);
    brim.position.set(0, 0.23, 0);
    headGroup.add(crown, brim);
  } else if (hairStyle === 'AFRO_CURLS') {
    const afro = new THREE.Mesh(afroCrownGeo, hairMat);
    afro.position.set(0, 0.235, -0.015);
    headGroup.add(afro);
  } else {
    const hairCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.151, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
      hairMat
    );
    hairCap.scale.set(0.95, 1.05, 1.02);
    hairCap.position.set(0, 0.185, -0.01);
    headGroup.add(hairCap);

    if (hairStyle === 'TEXTURED_QUIFF') {
      const quiff = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.11, 6, 8), hairMat);
      quiff.rotation.z = Math.PI / 2;
      quiff.position.set(0, 0.295, 0.085);
      headGroup.add(quiff);
    } else if (hairStyle === 'PONYTAIL') {
      const ponytail = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.16, 6, 8), hairMat);
      ponytail.position.set(0, 0.13, -0.145);
      ponytail.rotation.x = 0.28;
      headGroup.add(ponytail);
    } else if (hairStyle === 'LONG_LAYERED') {
      const backLocks = new THREE.Mesh(longHairBackGeo, hairMat);
      backLocks.position.set(0, 0.06, -0.105);
      const sideL = new THREE.Mesh(longHairSideGeo, hairMat);
      sideL.position.set(-0.125, 0.07, 0.02);
      const sideR = sideL.clone();
      sideR.position.x = 0.125;
      headGroup.add(backLocks, sideL, sideR);
    }
  }

  // Over-ear Wireless Headphones
  if (appearance?.wearsHeadphones) {
    const hpMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      metalness: 0.55,
      roughness: 0.28,
    });
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.152, 0.012, 8, 16, Math.PI),
      hpMat
    );
    band.position.set(0, 0.172, 0);
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.028, 10), accentMat);
    cupL.rotation.z = Math.PI / 2;
    cupL.position.set(-0.148, 0.16, 0);
    const cupR = cupL.clone();
    cupR.position.x = 0.148;
    headGroup.add(band, cupL, cupR);
  }

  // --------------------------------------------------------------------------
  // 5. ARTICULATED TWO-STAGE ARMS & HANDHELD PROPS
  // --------------------------------------------------------------------------
  const isSleeveless = outfitStyle === 'TANK_ATHLETIC';
  const isShortSleeve = outfitStyle === 'TEE_SHORTS' || role === 'VENDOR';
  const isLongSleeve =
    outfitStyle === 'HOODIE_JEANS' ||
    outfitStyle === 'OPEN_JACKET' ||
    outfitStyle === 'SUIT_BLAZER' ||
    role === 'OFFICER';

  const buildArm = (sideX: number) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(sideX, 0.39, 0);

    const upperMesh = new THREE.Mesh(
      upperArmGeo,
      isSleeveless || isShortSleeve ? skinMat : primaryTopMat
    );
    upperMesh.castShadow = !isSoftwareGl;
    shoulder.add(upperMesh);

    if (isShortSleeve) {
      const sleeveCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.064, 0.062, 0.12, 10),
        primaryTopMat
      );
      sleeveCap.position.y = -0.055;
      shoulder.add(sleeveCap);
    }

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.27, 0);
    shoulder.add(elbow);

    const foreMesh = new THREE.Mesh(forearmGeo, isLongSleeve ? primaryTopMat : skinMat);
    foreMesh.castShadow = !isSoftwareGl;
    elbow.add(foreMesh);

    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.set(0, -0.24, 0);
    elbow.add(hand);

    chest.add(shoulder);
    return { shoulder, elbow, hand };
  };

  const shoulderOffset =
    buildType === 'SLIM'
      ? 0.212
      : buildType === 'STOCKY'
      ? 0.268
      : buildType === 'ATHLETIC'
      ? 0.258
      : 0.238;
  const leftArmRig = buildArm(-shoulderOffset);
  const rightArmRig = buildArm(shoulderOffset);

  let phoneProp: THREE.Mesh | undefined;
  let briefcaseProp: THREE.Group | undefined;
  let carriesCoffeeCup = false;

  if (role !== 'PLAYER' && role !== 'OFFICER') {
    phoneProp = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.095, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8 })
    );
    phoneProp.position.set(0, -0.26, 0.045);
    phoneProp.rotation.x = -Math.PI / 3;
    phoneProp.visible = false;
    rightArmRig.elbow.add(phoneProp);
  }

  if (propStyle === 'BRIEFCASE') {
    briefcaseProp = new THREE.Group();
    const caseBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.26, 0.34),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.45, metalness: 0.2 })
    );
    caseBody.position.set(-0.03, -0.36, 0);
    briefcaseProp.add(caseBody);
    leftArmRig.elbow.add(briefcaseProp);
  } else if (propStyle === 'SHOPPING_BAG') {
    const bagGroup = new THREE.Group();
    const bagBody = new THREE.Mesh(shoppingBagGeo, accentMat);
    bagBody.position.set(-0.035, -0.39, 0);
    const bagHandle = new THREE.Mesh(
      bagHandleGeo,
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 })
    );
    bagHandle.position.set(-0.035, -0.25, 0);
    bagGroup.add(bagBody, bagHandle);
    leftArmRig.elbow.add(bagGroup);
  } else if (propStyle === 'COFFEE_CUP') {
    carriesCoffeeCup = true;
    const cupGroup = new THREE.Group();
    const cup = new THREE.Mesh(
      coffeeCupGeo,
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.7 })
    );
    const lid = new THREE.Mesh(
      coffeeLidGeo,
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    lid.position.y = 0.055;
    cupGroup.position.set(0, -0.25, 0.055);
    cupGroup.rotation.x = Math.PI * 0.35;
    cupGroup.add(cup, lid);
    leftArmRig.elbow.add(cupGroup);
  }

  return {
    group,
    hips,
    chest,
    headGroup,
    leftLeg: leftLegRig.hipJoint,
    leftShin: leftLegRig.kneeJoint,
    rightLeg: rightLegRig.hipJoint,
    rightShin: rightLegRig.kneeJoint,
    leftArm: leftArmRig.shoulder,
    leftForearm: leftArmRig.elbow,
    rightArm: rightArmRig.shoulder,
    rightForearm: rightArmRig.elbow,
    phoneProp,
    briefcaseProp,
    carriesCoffeeCup,
  };
}

// Helper for natural multi-joint human walk, run, custom stride personalities, idle breathing, phone-checking, and cowering
export function poseCharacterRig(
  rig: CharacterRig,
  opts: {
    walkCycle: number;
    speed: number;
    sprinting?: boolean;
    strideStyle?: NPCStrideStyle;
    idleTime?: number;
    checkingPhone?: boolean;
    talking?: boolean;
    waving?: boolean;
    cowering?: boolean;
    headYaw?: number;
    headPitch?: number;
    meleeSwing?: boolean;
  }
) {
  const {
    walkCycle,
    speed,
    sprinting = false,
    strideStyle = 'RELAXED',
    idleTime = 0,
    checkingPhone = false,
    talking = false,
    waving = false,
    cowering = false,
    headYaw = 0,
    headPitch = 0,
    meleeSwing = false,
  } = opts;

  if (rig.phoneProp) {
    rig.phoneProp.visible = checkingPhone;
  }

  rig.headGroup.rotation.y = THREE.MathUtils.clamp(headYaw, -0.75, 0.75);
  rig.headGroup.rotation.x = checkingPhone ? 0.38 : THREE.MathUtils.clamp(headPitch, -0.4, 0.4);

  if (speed > 0.2) {
    const strideScale =
      strideStyle === 'BRISK'
        ? 1.12
        : strideStyle === 'ENERGETIC'
        ? 1.18
        : strideStyle === 'SWAGGER'
        ? 1.04
        : 0.88;

    const bounceMult =
      strideStyle === 'ENERGETIC' ? 1.32 : strideStyle === 'RELAXED' ? 0.8 : 1.05;
    const swaggerRoll = strideStyle === 'SWAGGER' ? 0.065 : strideStyle === 'RELAXED' ? 0.02 : 0.032;
    const postureLean = strideStyle === 'BRISK' ? 0.085 : strideStyle === 'SWAGGER' ? -0.02 : 0.035;

    const amp = sprinting
      ? 0.74
      : Math.min(0.58, (0.2 + speed * 0.082) * strideScale);
    const lPhase = Math.sin(walkCycle);
    const rPhase = Math.sin(walkCycle + Math.PI);

    rig.leftLeg.rotation.x = lPhase * amp;
    rig.rightLeg.rotation.x = rPhase * amp;

    rig.leftShin.rotation.x = Math.max(0, -lPhase) * (sprinting ? 1.15 : 0.78 * strideScale) + 0.06;
    rig.rightShin.rotation.x = Math.max(0, -rPhase) * (sprinting ? 1.15 : 0.78 * strideScale) + 0.06;

    rig.hips.position.y =
      0.82 + Math.abs(Math.cos(walkCycle)) * (sprinting ? 0.048 : 0.024 * bounceMult);
    rig.chest.rotation.y = -lPhase * (strideStyle === 'SWAGGER' ? 0.16 : 0.11);
    rig.chest.rotation.z = lPhase * swaggerRoll;
    rig.chest.rotation.x = sprinting ? 0.16 : cowering ? 0.22 : postureLean;

    if (cowering) {
      rig.leftArm.rotation.x = -1.15 + lPhase * 0.25;
      rig.leftForearm.rotation.x = -1.1;
      rig.rightArm.rotation.x = -1.15 + rPhase * 0.25;
      rig.rightForearm.rotation.x = -1.1;
      rig.leftArm.rotation.z = 0.22;
      rig.rightArm.rotation.z = -0.22;
    } else {
      const armScale =
        strideStyle === 'RELAXED' ? 0.65 : strideStyle === 'ENERGETIC' ? 1.1 : 0.88;
      const armAmp = sprinting ? 0.66 : amp * armScale;

      if (rig.carriesCoffeeCup && !sprinting) {
        // Hold coffee cup steady at chest/waist level while strolling!
        rig.leftArm.rotation.x = -0.52 + rPhase * 0.08;
        rig.leftArm.rotation.z = 0.12;
        rig.leftForearm.rotation.x = -1.02;
      } else {
        rig.leftArm.rotation.x = rPhase * armAmp;
        rig.leftArm.rotation.z = strideStyle === 'SWAGGER' ? 0.09 : 0.05;
        rig.leftForearm.rotation.x =
          sprinting || strideStyle === 'BRISK'
            ? -0.82
            : -0.22 - Math.max(0, rPhase) * 0.25;
      }

      if (meleeSwing) {
        rig.rightArm.rotation.x = -1.55;
        rig.rightForearm.rotation.x = -0.35;
      } else if (waving) {
        rig.rightArm.rotation.x = -2.35;
        rig.rightArm.rotation.z = -0.35 + Math.sin(idleTime * 9) * 0.28;
        rig.rightForearm.rotation.x = -0.4;
      } else if (checkingPhone) {
        rig.rightArm.rotation.x = -0.75;
        rig.rightForearm.rotation.x = -1.05;
        rig.rightArm.rotation.z = -0.15;
      } else {
        rig.rightArm.rotation.x = lPhase * armAmp;
        rig.rightArm.rotation.z = strideStyle === 'SWAGGER' ? -0.09 : -0.05;
        rig.rightForearm.rotation.x =
          sprinting || strideStyle === 'BRISK'
            ? -0.82
            : -0.22 - Math.max(0, lPhase) * 0.25;
      }
    }
  } else {
    const breath = Math.sin(idleTime * 2.1) * 0.012;
    rig.hips.position.y = 0.82 + breath * 0.5;
    rig.chest.rotation.x = breath;
    rig.chest.rotation.y = Math.sin(idleTime * 0.7) * 0.04;
    rig.chest.rotation.z = 0;

    rig.leftLeg.rotation.x = 0;
    rig.rightLeg.rotation.x = 0.03;
    rig.leftShin.rotation.x = 0.02;
    rig.rightShin.rotation.x = 0.05;

    if (rig.carriesCoffeeCup && !talking) {
      rig.leftArm.rotation.x = -0.5 + Math.sin(idleTime * 1.4) * 0.04;
      rig.leftArm.rotation.z = 0.12;
      rig.leftForearm.rotation.x = -1.05;
    } else {
      rig.leftArm.rotation.x = talking ? -0.25 + Math.sin(idleTime * 4.2) * 0.18 : 0.03;
      rig.leftArm.rotation.z = 0.06;
      rig.leftForearm.rotation.x = talking ? -0.65 : -0.14;
    }

    if (meleeSwing) {
      rig.rightArm.rotation.x = -1.55;
      rig.rightForearm.rotation.x = -0.35;
    } else if (waving) {
      rig.rightArm.rotation.x = -2.4;
      rig.rightArm.rotation.z = -0.35 + Math.sin(idleTime * 9) * 0.28;
      rig.rightForearm.rotation.x = -0.45;
    } else if (checkingPhone) {
      rig.rightArm.rotation.x = -0.78;
      rig.rightArm.rotation.z = -0.18;
      rig.rightForearm.rotation.x = -1.1;
    } else if (talking) {
      rig.rightArm.rotation.x = -0.42 + Math.cos(idleTime * 5.1) * 0.24;
      rig.rightArm.rotation.z = -0.1;
      rig.rightForearm.rotation.x = -0.78 + Math.sin(idleTime * 4.5) * 0.2;
    } else {
      rig.rightArm.rotation.x = -0.02;
      rig.rightArm.rotation.z = -0.06;
      rig.rightForearm.rotation.x = -0.14;
    }
  }
}

export function buildPalmTreeModel(isSoftwareGl: boolean): THREE.Group {
  const tree = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x7c5a43,
    roughness: 0.9,
  });
  const frondMat = new THREE.MeshStandardMaterial({
    color: 0x2f7a44,
    roughness: 0.52,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const coconutMat = new THREE.MeshStandardMaterial({
    color: 0x452b1a,
    roughness: 0.8,
  });

  // Graceful curved California fan-palm trunk
  const segments = 7;
  for (let i = 0; i < segments; i++) {
    const rBottom = 0.27 - i * 0.022;
    const rTop = 0.24 - i * 0.022;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, 1.15, 10), trunkMat);
    const curveX = Math.sin(i * 0.26) * 0.42;
    seg.position.set(curveX, 0.56 + i * 1.06, 0);
    seg.rotation.z = -Math.cos(i * 0.26) * 0.09;
    seg.castShadow = !isSoftwareGl;
    tree.add(seg);
  }

  const topY = 0.56 + segments * 1.03;
  const topX = Math.sin((segments - 1) * 0.26) * 0.42;

  // Coconut cluster at crown
  for (let c = 0; c < 4; c++) {
    const ca = (c / 4) * Math.PI * 2;
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), coconutMat);
    nut.position.set(topX + Math.sin(ca) * 0.18, topY - 0.16, Math.cos(ca) * 0.18);
    tree.add(nut);
  }

  // Sculpted multi-segment arching tropical palm fronds (zero flat boxy planks!)
  const frondCount = 9;
  for (let f = 0; f < frondCount; f++) {
    const angle = (f / frondCount) * Math.PI * 2;
    const frondBranch = new THREE.Group();
    frondBranch.position.set(topX, topY, 0);
    frondBranch.rotation.y = angle + (f % 2) * 0.12;

    const seg1 = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.25, 5), frondMat);
    seg1.scale.set(1.15, 1, 0.18);
    seg1.rotation.x = Math.PI * 0.36;
    seg1.position.set(0, 0.15, 0.58);

    const seg2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.35, 5), frondMat);
    seg2.scale.set(1.0, 1, 0.14);
    seg2.rotation.x = Math.PI * 0.58;
    seg2.position.set(0, -0.05, 1.58);

    frondBranch.add(seg1, seg2);
    tree.add(frondBranch);
  }

  return tree;
}

export function buildTrafficLightAssembly(): {
  group: THREE.Group;
  nsBulb: THREE.MeshBasicMaterial;
  ewBulb: THREE.MeshBasicMaterial;
} {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.7,
    roughness: 0.35,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 5.4, 8), poleMat);
  pole.position.y = 2.7;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.12), poleMat);
  arm.position.set(1.3, 5.1, 0);
  group.add(arm);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 1.05, 0.42),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
  );
  housing.position.set(2.3, 4.85, 0);
  group.add(housing);

  const nsBulb = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const ewBulb = new THREE.MeshBasicMaterial({ color: 0xef4444 });

  const bulbNS = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), nsBulb);
  bulbNS.position.set(2.3, 4.85, 0.22);
  const bulbNSMirror = bulbNS.clone();
  bulbNSMirror.position.z = -0.22;

  const bulbEW = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), ewBulb);
  bulbEW.position.set(2.52, 4.85, 0);
  const bulbEWMirror = bulbEW.clone();
  bulbEWMirror.position.x = 2.08;

  group.add(bulbNS, bulbNSMirror, bulbEW, bulbEWMirror);
  return { group, nsBulb, ewBulb };
}

export function buildStreetLampAssembly(
  sharedLampBulbMat: THREE.MeshBasicMaterial
): THREE.Group {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.72,
    roughness: 0.36,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.45, 8), poleMat);
  base.position.y = 0.22;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.9, 8), poleMat);
  shaft.position.y = 2.65;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.08), poleMat);
  arm.position.set(0.58, 5.05, 0);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.12, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6, roughness: 0.4 })
  );
  hood.position.set(1.12, 5.04, 0);

  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.07, 0.22), sharedLampBulbMat);
  bulb.position.set(1.12, 4.96, 0);

  group.add(base, shaft, arm, hood, bulb);
  return group;
}

