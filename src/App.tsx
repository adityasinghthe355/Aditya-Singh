import React, { useEffect, useRef, useState } from 'react';
import {
  Car,
  Compass,
  Moon,
  Pause,
  Play,
  Radio,
  ShieldAlert,
  Sparkles,
  Sun,
  Sunset,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CitySimulationEngine } from './game/CitySimulationEngine';
import { HudSnapshot, WeatherMode } from './game/types';
import { MinimapRadar } from './components/MinimapRadar';
import { NPCDialogueSheet } from './components/NPCDialogueSheet';
import { ProgressionAndWorldModal } from './components/ProgressionAndWorldModal';
import { MobileTouchController } from './components/MobileTouchController';

const INITIAL_HUD: HudSnapshot = {
  screen: 'TITLE',
  health: 100,
  maxHealth: 100,
  armor: 50,
  cash: 950,
  wantedLevel: 0,
  wantedCooldownProgress: 0,
  speedKmh: 0,
  inVehicle: false,
  vehicleName: 'On Foot',
  vehicleHealth: 100,
  districtName: 'Downtown Solis Core',
  timeOfDayHours: 15.5,
  weather: 'CLEAR',
  cameraMode: 'CHASE',
  trafficDensity: 1.0,
  activeNPCsCount: 46,
  activeVehiclesCount: 16,
  policeUnitsCount: 0,
  nearInteractableVehicle: null,
  nearInteractableNPC: null,
  nearInteractablePOI: null,
  activeNPCInteraction: null,
  ambientBarks: [],
  progression: {
    level: 1,
    xp: 0,
    nextLevelXp: 250,
    skillPoints: 1,
    unlockedSkillIds: [],
    branchXp: { DRIVING: 0, COMBAT: 0, SYNDICATE: 0 },
    scrapParts: 2,
    craftedMedkits: 1,
    craftedArmorPlates: 0,
    activeCooldowns: {
      nitroReady: false,
      nitroCooldown: 0,
      bribeReady: false,
      bribeCooldown: 0,
      shockwaveReady: false,
      shockwaveCooldown: 0,
    },
  },
  activePOIs: [],
  worldSeed: 40921,
  mission: {
    id: 1,
    title: 'Sunset Pier Drop-Off',
    description: 'Drive along the road to the Vespucci Coastal Intersection Beacon.',
    targetX: -112,
    targetZ: 56,
    reward: 1500,
    completedCount: 0,
  },
  playerX: 9.2,
  playerZ: 12,
  playerHeading: 0,
  isSprinting: false,
  radioStation: 'West Coast Synth FM',
  blips: [],
  muted: false,
  notification: null,
};

function formatClock(hoursFloat: number): string {
  const totalSeconds = Math.floor(hoursFloat * 3600) % (24 * 3600);
  const h24 = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} ${suffix}`;
}

type ViewportOrientationMode = 'DESKTOP_ROTATED_PHONE' | 'NATIVE_LANDSCAPE' | 'AUTO_ROTATE_90';

function detectViewportMode(): ViewportOrientationMode {
  if (typeof window === 'undefined') return 'DESKTOP_ROTATED_PHONE';
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < h) return 'AUTO_ROTATE_90';
  if (h <= 540) return 'NATIVE_LANDSCAPE';
  return 'DESKTOP_ROTATED_PHONE';
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<CitySimulationEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [skillsModalOpen, setSkillsModalOpen] = useState<boolean>(false);
  const [toolsDrawerOpen, setToolsDrawerOpen] = useState<boolean>(false);
  const [viewportMode, setViewportMode] = useState<ViewportOrientationMode>(detectViewportMode);

  // Touchscreen & PC Mouse "Arrow" Free-Look Tracking Refs
  const lookTouchPointerId = useRef<number | null>(null);
  const lastTouchPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePos = useRef<{ x: number; y: number } | null>(null);
  const mouseDownStart = useRef<{ x: number; y: number } | null>(null);

  const isRotated90 = viewportMode === 'AUTO_ROTATE_90';

  useEffect(() => {
    const onResize = () => setViewportMode(detectViewportMode());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!canvasMountRef.current) return;
    const engine = new CitySimulationEngine(canvasMountRef.current, (snapshot) => {
      setHud(snapshot);
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const cycleTimePreset = () => {
    const order: WeatherMode[] = ['CLEAR', 'SUNSET', 'NIGHT'];
    const next = order[(order.indexOf(hud.weather) + 1) % order.length];
    engineRef.current?.setWeatherMode(next);
  };

  // Remap screen deltas when portrait viewport is auto-rotated 90° clockwise into landscape
  const toLandscapeDelta = (rawDx: number, rawDy: number) => ({
    dx: isRotated90 ? rawDy : rawDx,
    dy: isRotated90 ? -rawDx : rawDy,
  });

  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hud.screen !== 'PLAYING' || skillsModalOpen || hud.activeNPCInteraction) return;

    if (e.pointerType === 'mouse') {
      mouseDownStart.current = { x: e.clientX, y: e.clientY };
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (lookTouchPointerId.current === null) {
      e.currentTarget.setPointerCapture(e.pointerId);
      lookTouchPointerId.current = e.pointerId;
      lastTouchPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (hud.screen !== 'PLAYING' || skillsModalOpen || hud.activeNPCInteraction) return;

    // PC MOUSE = THE ARROW OF THIS GAME (smoothly steers the 3D look arrow on mouse movement!)
    if (e.pointerType === 'mouse') {
      if (lastMousePos.current) {
        const rawDx = e.clientX - lastMousePos.current.x;
        const rawDy = e.clientY - lastMousePos.current.y;
        const { dx, dy } = toLandscapeDelta(rawDx, rawDy);
        if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
          engineRef.current?.rotateCameraLook(dx, dy, 0.0058);
        }
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // MOBILE TOUCHSCREEN = THE ARROW OF THIS GAME (touch & drag turns the 3D look arrow!)
    if (lookTouchPointerId.current === e.pointerId) {
      const rawDx = e.clientX - lastTouchPos.current.x;
      const rawDy = e.clientY - lastTouchPos.current.y;
      lastTouchPos.current = { x: e.clientX, y: e.clientY };
      const { dx, dy } = toLandscapeDelta(rawDx, rawDy);
      engineRef.current?.rotateCameraLook(dx, dy, 0.0068);
    }
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      if (mouseDownStart.current && hud.screen === 'PLAYING' && !hud.inVehicle) {
        const moved = Math.hypot(
          e.clientX - mouseDownStart.current.x,
          e.clientY - mouseDownStart.current.y
        );
        if (moved < 6) {
          engineRef.current?.triggerTouchAimShot();
        }
      }
      mouseDownStart.current = null;
      return;
    }

    if (lookTouchPointerId.current === e.pointerId) {
      lookTouchPointerId.current = null;
    }
  };

  const handleLookPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      lastMousePos.current = null;
      mouseDownStart.current = null;
    }
  };

  const phoneShellClass =
    viewportMode === 'AUTO_ROTATE_90'
      ? 'fixed left-1/2 top-1/2 h-[100dvw] w-[100dvh] -translate-x-1/2 -translate-y-1/2 rotate-90 overflow-hidden bg-[#0b0f17]'
      : viewportMode === 'NATIVE_LANDSCAPE'
      ? 'relative h-full w-full overflow-hidden bg-[#0b0f17]'
      : 'relative h-[min(90vh,448px)] w-[min(96vw,960px)] overflow-hidden rounded-[40px] border-[6px] border-slate-800 bg-[#0b0f17] shadow-[0_24px_80px_rgba(0,0,0,0.88)]';

  const healthWidth = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const armorWidth = Math.max(0, Math.min(100, hud.armor));

  return (
    <div className="flex h-full w-full select-none items-center justify-center overflow-hidden bg-[#04070d] text-slate-100">
      {/* HORIZONTALLY ROTATED MOBILE PHONE SHELL (Landscape Widescreen Smartphone) */}
      <div className={phoneShellClass}>
        {/* Subtle Sideways Smartphone Camera/Speaker Island on PC Frame */}
        {viewportMode === 'DESKTOP_ROTATED_PHONE' && (
          <div className="pointer-events-none absolute left-2 top-1/2 z-30 h-16 w-1.5 -translate-y-1/2 rounded-full bg-slate-900/90 ring-1 ring-white/10" />
        )}

        {/* Isolated Next-Gen 3D WebGL Canvas */}
        <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

        {/* Full-Screen Touchscreen & PC Mouse "Arrow" Free-Look Surface */}
        {hud.screen === 'PLAYING' && (
          <div
            onPointerDown={handleLookPointerDown}
            onPointerMove={handleLookPointerMove}
            onPointerUp={handleLookPointerUp}
            onPointerCancel={handleLookPointerUp}
            onPointerLeave={handleLookPointerLeave}
            className="absolute inset-0 z-[5] touch-none cursor-crosshair"
          />
        )}

        {/* =====================================================================
            CENTER GTA AIM ARROW / RETICLE ("THE ARROW" OF TOUCHSCREEN & MOUSE)
        ===================================================================== */}
        {hud.screen === 'PLAYING' && !hud.activeNPCInteraction && !skillsModalOpen && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 z-[8] -translate-x-1/2 -translate-y-1/2">
            <svg width="34" height="34" viewBox="0 0 34 34" className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              <circle
                cx="17"
                cy="17"
                r="9"
                fill="none"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1.4"
              />
              {/* Crisp Directional Aim Arrowhead */}
              <polygon points="17,4 20.5,10 17,8.4 13.5,10" fill="#38bdf8" />
              <circle cx="17" cy="17" r="2" fill="#fde047" />
              <line x1="3" y1="17" x2="7" y2="17" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
              <line x1="27" y1="17" x2="31" y2="17" stroke="rgba(255,255,255,0.7)" strokeWidth="1.4" />
            </svg>
          </div>
        )}

        {/* =====================================================================
            ROTATED LANDSCAPE TITLE SCREEN — STRICTLY "Sandysaurus Simulator"
        ===================================================================== */}
        {hud.screen === 'TITLE' && (
          <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between bg-gradient-to-t from-black/88 via-black/30 to-black/55 px-7 py-4">
            <div className="flex items-center justify-end">
              <button
                onClick={() => engineRef.current?.toggleMute()}
                className="pointer-events-auto flex min-h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-white/15 bg-[#0f172a]/90 px-3 text-slate-200 active:scale-95"
                aria-label={hud.muted ? 'Unmute' : 'Mute'}
              >
                {hud.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            </div>

            <div className="my-auto flex flex-col items-center text-center">
              {/* Strictly "Sandysaurus Simulator" — Nothing Else in the Title Lockup */}
              <svg
                viewBox="0 0 560 98"
                className="mb-4 w-full max-w-[480px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.9)]"
                aria-label="Sandysaurus Simulator"
              >
                <defs>
                  <linearGradient id="sandyLandscapeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="55%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#ea580c" />
                  </linearGradient>
                </defs>
                <text
                  x="280"
                  y="46"
                  textAnchor="middle"
                  fill="url(#sandyLandscapeGrad)"
                  fontFamily="Oxanium, sans-serif"
                  fontWeight="800"
                  fontSize="46"
                  letterSpacing="1.8"
                >
                  Sandysaurus
                </text>
                <text
                  x="280"
                  y="88"
                  textAnchor="middle"
                  fill="#f8fafc"
                  fontFamily="Oxanium, sans-serif"
                  fontWeight="700"
                  fontSize="36"
                  letterSpacing="2.4"
                >
                  Simulator
                </text>
              </svg>

              <button
                onClick={() => engineRef.current?.startGame()}
                className="pointer-events-auto flex min-h-[50px] w-full max-w-[240px] items-center justify-center gap-2.5 rounded-2xl bg-amber-500 px-6 py-3 font-display text-base font-extrabold tracking-wide text-slate-950 shadow-xl active:scale-95"
              >
                <Play className="h-5 w-5 fill-current" />
                <span>Tap to Play</span>
              </button>
            </div>

            <div className="text-center text-[11px] font-medium text-slate-300/90">
              Left Joystick Moves (Hold UP = Sprint) · Touch Screen or Move PC Mouse to Aim Arrow
            </div>
          </div>
        )}

        {/* =====================================================================
            LANDSCAPE MOBILE GAMEPLAY HUD
        ===================================================================== */}
        {hud.screen !== 'TITLE' && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
            {/* Live Projected Street Pedestrian Chatter Bubbles (Zero Inline Styles) */}
            {hud.ambientBarks.length > 0 && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
                {hud.ambientBarks.map((bark) => (
                  <foreignObject
                    key={bark.id}
                    x={`${Math.max(8, Math.min(72, bark.screenX - 12))}%`}
                    y={`${Math.max(6, Math.min(76, bark.screenY - 10))}%`}
                    width="220"
                    height="56"
                    className="overflow-visible"
                  >
                    <div
                      className={`inline-block max-w-[210px] rounded-xl border px-2.5 py-1 text-[10px] font-medium shadow-md ${
                        bark.mood === 'ALARMED'
                          ? 'border-rose-400/50 bg-[#1f0d14]/92 text-rose-200'
                          : bark.mood === 'FRIENDLY'
                          ? 'border-emerald-400/40 bg-[#0d1c16]/92 text-emerald-200'
                          : 'border-white/15 bg-[#0d121c]/88 text-slate-200'
                      }`}
                    >
                      <span className="font-semibold text-amber-300">{bark.speakerName}: </span>
                      <span>&ldquo;{bark.text}&rdquo;</span>
                    </div>
                  </foreignObject>
                ))}
              </svg>
            )}

            {/* TOP LANDSCAPE STATUS BAR */}
            <div className="flex items-start justify-between gap-3 px-4 pt-2.5">
              {/* Top-Left: Radar + Vitals + Active Contract */}
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1">
                  <MinimapRadar
                    playerX={hud.playerX}
                    playerZ={hud.playerZ}
                    playerHeading={hud.playerHeading}
                    blips={hud.blips}
                    wantedLevel={hud.wantedLevel}
                    size={88}
                  />
                  {/* Health & Armor SVG Bar */}
                  <div className="w-[88px] rounded-md border border-white/10 bg-[#0d121c]/90 p-1">
                    <svg viewBox="0 0 208 6" className="block h-1.5 w-full">
                      <rect x="0" y="0" width="100" height="6" rx="2" fill="#1e293b" />
                      <rect x="0" y="0" width={healthWidth} height="6" rx="2" fill="#10b981" />
                      <rect x="108" y="0" width="100" height="6" rx="2" fill="#1e293b" />
                      <rect x="108" y="0" width={armorWidth} height="6" rx="2" fill="#38bdf8" />
                    </svg>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="max-w-[190px] rounded-xl border border-white/10 bg-[#0d121c]/85 px-2.5 py-1.5 text-[10px] leading-tight text-slate-200">
                    <div className="font-semibold text-amber-400 truncate">{hud.mission.title}</div>
                    <div className="mt-0.5 text-slate-300">{hud.districtName}</div>
                    <div className="mt-0.5 font-mono-tabular font-semibold text-emerald-400">
                      Contract +${hud.mission.reward.toLocaleString()}
                    </div>
                  </div>

                  {hud.inVehicle && (
                    <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0d121c]/85 px-2.5 py-1 text-[10px] text-slate-200">
                      <Radio className="h-3 w-3 text-fuchsia-400" />
                      <span className="truncate font-medium text-fuchsia-200">
                        {hud.radioStation}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-emerald-300">
                        {hud.vehicleHealth}%
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Transient Toast */}
              {hud.notification && (
                <div className="mx-auto max-w-[320px] rounded-xl border border-amber-400/35 bg-[#0d121c]/92 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-300 shadow-lg">
                  {hud.notification}
                </div>
              )}

              {/* Top-Right: Wanted Stars, Cash, Real-Time Clock & Quick Action Buttons */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto flex flex-col items-end gap-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-white/10 bg-[#0d121c]/88 px-2.5 py-1 font-mono-tabular text-[11px] font-medium text-slate-200">
                    {formatClock(hud.timeOfDayHours)}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d121c]/90 px-2.5 py-1 shadow-lg">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          viewBox="0 0 24 24"
                          className={`h-3.5 w-3.5 ${
                            star <= hud.wantedLevel
                              ? 'fill-amber-400 text-amber-400'
                              : 'fill-slate-700/60 text-slate-700'
                          }`}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-mono-tabular text-sm font-bold text-emerald-400">
                      ${hud.cash.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Top Action Icon Strip */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSkillsModalOpen(true)}
                    className="flex h-[40px] items-center gap-1 rounded-xl border border-amber-400/40 bg-[#0d121c]/92 px-2.5 text-xs font-bold text-amber-300 shadow active:scale-95"
                    aria-label="Skills & Crafting"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Lv.{hud.progression.level}</span>
                  </button>

                  <button
                    onClick={() => setToolsDrawerOpen((v) => !v)}
                    className="flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-white/15 bg-[#0d121c]/92 text-sky-300 shadow active:scale-95"
                    aria-label="Sandbox Tools"
                  >
                    <Car className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => engineRef.current?.togglePause()}
                    className="flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-white/15 bg-[#0d121c]/92 text-slate-200 shadow active:scale-95"
                    aria-label="Pause"
                  >
                    <Pause className="h-4 w-4" />
                  </button>
                </div>

                {/* Expandable Landscape Quick-Tools Menu */}
                {toolsDrawerOpen && (
                  <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/15 bg-[#0d121c]/95 p-2 shadow-2xl">
                    <button
                      onClick={() => {
                        engineRef.current?.spawnDropSportsCar();
                        setToolsDrawerOpen(false);
                      }}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 text-[11px] font-semibold text-amber-300 active:bg-slate-800 whitespace-nowrap"
                    >
                      <Car className="h-3.5 w-3.5" />
                      <span>Drop GT Car</span>
                    </button>

                    <button
                      onClick={() => {
                        engineRef.current?.regenerateProceduralPOIs();
                        setToolsDrawerOpen(false);
                      }}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 text-[11px] font-semibold text-sky-300 active:bg-slate-800 whitespace-nowrap"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>New Seed POIs</span>
                    </button>

                    <button
                      onClick={() => engineRef.current?.cycleCameraMode()}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 text-[11px] font-semibold text-slate-200 active:bg-slate-800 whitespace-nowrap"
                    >
                      <Video className="h-3.5 w-3.5 text-sky-400" />
                      <span>Cam: {hud.cameraMode.replace('_', ' ')}</span>
                    </button>

                    <button
                      onClick={cycleTimePreset}
                      className="flex min-h-[38px] items-center gap-1.5 rounded-xl bg-slate-900 px-2.5 text-[11px] font-semibold text-slate-200 active:bg-slate-800 whitespace-nowrap"
                    >
                      {hud.weather === 'CLEAR' ? (
                        <Sun className="h-3.5 w-3.5 text-amber-400" />
                      ) : hud.weather === 'SUNSET' ? (
                        <Sunset className="h-3.5 w-3.5 text-orange-400" />
                      ) : (
                        <Moon className="h-3.5 w-3.5 text-indigo-300" />
                      )}
                      <span>Time: {hud.weather}</span>
                    </button>

                    {hud.wantedLevel > 0 && (
                      <button
                        onClick={() => {
                          engineRef.current?.clearWantedLevel();
                          setToolsDrawerOpen(false);
                        }}
                        className="col-span-2 flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl bg-amber-500/20 px-2.5 text-[11px] font-semibold text-amber-300 whitespace-nowrap"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>Clear LSPD Heat</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Interactive NPC Bottom Sheet OR Dual-Thumb Landscape Touch Controller */}
            <div className="mt-auto w-full">
              {hud.activeNPCInteraction ? (
                <div className="px-3 pb-2">
                  <NPCDialogueSheet
                    interaction={hud.activeNPCInteraction}
                    onSelectOption={(optId) => engineRef.current?.selectNPCDialogueOption(optId)}
                  />
                </div>
              ) : (
                <MobileTouchController
                  hud={hud}
                  isRotated90={isRotated90}
                  onJoystickMove={(x, y) => engineRef.current?.setTouchJoystick(x, y)}
                  onThrottleChange={(val) => engineRef.current?.setTouchThrottle(val)}
                  onHandbrakeHold={(held) => engineRef.current?.setTouchHandbrake(held)}
                  onEnterExitVehicle={() => engineRef.current?.triggerTouchVehicleToggle()}
                  onTalkNPC={() => engineRef.current?.openNearbyNPCConversation()}
                  onClaimPOI={() => engineRef.current?.triggerTouchPOI()}
                  onMelee={() => engineRef.current?.triggerTouchMelee()}
                  onAimShot={() => engineRef.current?.triggerTouchAimShot()}
                  onCycleRadio={() => engineRef.current?.cycleRadioStation()}
                  onHorn={() => engineRef.current?.triggerTouchHorn()}
                  onTriggerSkill={(s) => engineRef.current?.triggerTouchSkill(s)}
                />
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            LANDSCAPE SKILL TREES, CRAFTING & PROCEDURAL WORLD MODAL
        ===================================================================== */}
        {skillsModalOpen && hud.screen === 'PLAYING' && (
          <ProgressionAndWorldModal
            progression={hud.progression}
            activePOIs={hud.activePOIs}
            worldSeed={hud.worldSeed}
            onUnlockSkill={(id) => engineRef.current?.unlockSkillNode(id)}
            onCraftItem={(item) => engineRef.current?.craftFieldItem(item)}
            onUseItem={(item) => engineRef.current?.useCraftedItem(item)}
            onRegenerateWorld={() => engineRef.current?.regenerateProceduralPOIs()}
            onClose={() => setSkillsModalOpen(false)}
          />
        )}

        {/* =====================================================================
            LANDSCAPE PAUSE & BUSTED MODAL
        ===================================================================== */}
        {(hud.screen === 'PAUSED' || hud.screen === 'BUSTED') && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-4"
          >
            <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f172a] p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-white">
                  {hud.screen === 'BUSTED' ? 'BUSTED' : 'Paused'}
                </h2>
                <button
                  onClick={() => engineRef.current?.toggleMute()}
                  className="flex h-[40px] w-[40px] items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-slate-200"
                >
                  {hud.muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {hud.screen === 'BUSTED'
                  ? 'LSPD officers apprehended you. Tap below to respawn at Central Precinct Plaza (-$150 bail).'
                  : 'Left Joystick walks/jogs (hold UP at top to Sprint). Touch & drag the screen—or move your Mouse on PC—to steer the Aim Arrow.'}
              </p>

              <button
                onClick={() =>
                  hud.screen === 'BUSTED'
                    ? engineRef.current?.startGame()
                    : engineRef.current?.togglePause()
                }
                className="mt-4 flex min-h-[46px] w-full items-center justify-center rounded-xl bg-amber-500 font-display text-sm font-extrabold text-slate-950 active:scale-95"
              >
                {hud.screen === 'BUSTED' ? 'RESPAWN IN CITY' : 'RESUME GAME'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
