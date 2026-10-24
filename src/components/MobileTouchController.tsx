import React, { useRef, useState } from 'react';
import {
  Car,
  Compass,
  Crosshair,
  HandMetal,
  LogOut,
  MessageCircle,
  Radio,
  ShieldAlert,
  Volume2,
  Zap,
} from 'lucide-react';
import { HudSnapshot } from '../game/types';

interface MobileTouchControllerProps {
  hud: HudSnapshot;
  isRotated90: boolean;
  onJoystickMove: (x: number, y: number) => void;
  onThrottleChange: (val: number) => void;
  onHandbrakeHold: (held: boolean) => void;
  onEnterExitVehicle: () => void;
  onTalkNPC: () => void;
  onClaimPOI: () => void;
  onMelee: () => void;
  onAimShot: () => void;
  onCycleRadio: () => void;
  onHorn: () => void;
  onTriggerSkill: (skill: 'NITRO' | 'PULSE' | 'JAMMER') => void;
}

export const MobileTouchController: React.FC<MobileTouchControllerProps> = ({
  hud,
  isRotated90,
  onJoystickMove,
  onThrottleChange,
  onHandbrakeHold,
  onEnterExitVehicle,
  onTalkNPC,
  onClaimPOI,
  onMelee,
  onAimShot,
  onCycleRadio,
  onHorn,
  onTriggerSkill,
}) => {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const maxRadius = 42;

  const normX = knobOffset.x / maxRadius;
  const normY = -knobOffset.y / maxRadius;
  const isPushUpSprint = !hud.inVehicle && normY >= 0.78 && Math.abs(normX) <= 0.56;

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    if (!baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const rawDx = clientX - cx;
    const rawDy = clientY - cy;

    // Remap pointer axes cleanly if portrait viewport is rotated 90° clockwise into landscape
    const dx = isRotated90 ? rawDy : rawDx;
    const dy = isRotated90 ? -rawDx : rawDy;

    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clamped;
    const ky = Math.sin(angle) * clamped;

    setKnobOffset({ x: kx, y: ky });
    // +X = right, +Y = up/forward (holding UP >= 0.78 triggers auto-sprint!)
    onJoystickMove(kx / maxRadius, -ky / maxRadius);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    e.stopPropagation();
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onJoystickMove(0, 0);
  };

  const unlockedNitro = hud.progression.unlockedSkillIds.includes('drv_3_nitro');
  const unlockedShockwave = hud.progression.unlockedSkillIds.includes('cmb_3_shockwave');
  const unlockedJammer = hud.progression.unlockedSkillIds.includes('syn_3_ghost_dispatch');

  if (hud.activeNPCInteraction) {
    return null;
  }

  return (
    <div className="pointer-events-none flex w-full items-end justify-between px-4 pb-2.5 pt-1">
      {/* =====================================================================
          LEFT THUMB ZONE: MOVEMENT JOYSTICK WITH PUSH-UP AUTO-SPRINT ZONE
          (Joystick moves only — hold UP at top to Sprint/Run!)
      ===================================================================== */}
      <div className="flex flex-col items-center gap-1">
        {!hud.inVehicle && (
          <div
            className={`rounded-md border px-2 py-0.5 text-[9px] font-extrabold tracking-wider transition-colors ${
              isPushUpSprint || hud.isSprinting
                ? 'border-emerald-300 bg-emerald-500 text-slate-950 shadow-md'
                : 'border-white/15 bg-[#0d121c]/80 text-slate-300'
            }`}
          >
            ▲ HOLD UP = SPRINT
          </div>
        )}

        <div
          ref={baseRef}
          onPointerDown={handleStickDown}
          onPointerMove={handleStickMove}
          onPointerUp={handleStickUp}
          onPointerCancel={handleStickUp}
          className="pointer-events-auto relative h-[120px] w-[120px] touch-none select-none"
        >
          <svg viewBox="0 0 120 120" className="h-full w-full drop-shadow-xl">
            {/* Outer Base Ring */}
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="rgba(13, 18, 28, 0.78)"
              stroke={isPushUpSprint ? '#34d399' : 'rgba(255,255,255,0.22)'}
              strokeWidth="2.5"
            />
            {/* Top Sprint Sector Highlight Arc (On Foot) */}
            {!hud.inVehicle && (
              <path
                d="M 32 22 A 48 48 0 0 1 88 22"
                fill="none"
                stroke={isPushUpSprint ? '#10b981' : 'rgba(52, 211, 153, 0.42)'}
                strokeWidth={isPushUpSprint ? '5' : '3'}
                strokeLinecap="round"
              />
            )}
            {/* Inner Deadzone Guide */}
            <circle
              cx="60"
              cy="60"
              r="22"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.2"
            />
            {/* Analog Stick Thumb Knob */}
            <circle
              cx={60 + knobOffset.x}
              cy={60 + knobOffset.y}
              r="21"
              fill={isPushUpSprint ? '#10b981' : '#f59e0b'}
              stroke={isPushUpSprint ? '#d1fae5' : '#fef08a'}
              strokeWidth="2.5"
            />
          </svg>
        </div>

        <span className="text-[10px] font-semibold tracking-wider text-slate-300/85">
          {hud.inVehicle ? 'STEER CAR' : isPushUpSprint ? 'SPRINTING' : 'WALK / JOG'}
        </span>
      </div>

      {/* =====================================================================
          RIGHT THUMB ZONE: LANDSCAPE GTA ACTION CLUSTER (DRIVING VS ON-FOOT)
      ===================================================================== */}
      {hud.inVehicle ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-col items-end gap-1.5"
        >
          {/* Upper Row: POI Claim, Nitro, Jammer, Radio FM, Horn, Exit */}
          <div className="flex items-center gap-1.5">
            {hud.nearInteractablePOI && (
              <button
                onPointerDown={() => onClaimPOI()}
                className="flex min-h-[42px] items-center gap-1.5 rounded-xl border border-sky-400/50 bg-sky-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 shadow-lg active:scale-95"
              >
                <Compass className="h-4 w-4" />
                <span>Claim</span>
              </button>
            )}

            {unlockedNitro && (
              <button
                onPointerDown={() => onTriggerSkill('NITRO')}
                disabled={!hud.progression.activeCooldowns.nitroReady}
                className="flex h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-amber-400/50 bg-[#0d121c]/90 px-2.5 text-xs font-bold text-amber-300 shadow-lg disabled:opacity-40 active:scale-95"
                aria-label="Nitrous Boost"
              >
                <Zap className="h-4 w-4" />
              </button>
            )}

            {unlockedJammer && hud.wantedLevel > 0 && (
              <button
                onPointerDown={() => onTriggerSkill('JAMMER')}
                disabled={!hud.progression.activeCooldowns.bribeReady}
                className="flex h-[42px] min-w-[42px] items-center justify-center rounded-xl border border-sky-400/50 bg-[#0d121c]/90 px-2.5 text-xs font-bold text-sky-300 shadow-lg disabled:opacity-40 active:scale-95"
                aria-label="Jammer"
              >
                <ShieldAlert className="h-4 w-4" />
              </button>
            )}

            <button
              onPointerDown={() => onCycleRadio()}
              className="flex h-[42px] items-center gap-1 rounded-xl border border-fuchsia-400/40 bg-[#0d121c]/90 px-2.5 text-[11px] font-bold text-fuchsia-200 shadow-lg active:scale-95"
              aria-label="Switch Radio Station"
            >
              <Radio className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>FM</span>
            </button>

            <button
              onPointerDown={() => onHorn()}
              className="flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-white/20 bg-[#0d121c]/88 text-slate-200 shadow-lg active:scale-95"
              aria-label="Horn"
            >
              <Volume2 className="h-4 w-4" />
            </button>

            <button
              onPointerDown={() => onEnterExitVehicle()}
              className="flex h-[42px] items-center gap-1 rounded-xl border border-rose-400/45 bg-[#1f1218]/92 px-3 text-xs font-bold text-rose-200 shadow-lg active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span>Exit</span>
            </button>
          </div>

          {/* Lower Pedals Row: Drift Handbrake, Brake/Reverse, Gas Pedal */}
          <div className="flex items-end gap-2">
            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onHandbrakeHold(true);
              }}
              onPointerUp={() => onHandbrakeHold(false)}
              onPointerCancel={() => onHandbrakeHold(false)}
              className="flex h-[52px] min-w-[54px] touch-none flex-col items-center justify-center rounded-2xl border border-amber-400/45 bg-[#0d121c]/90 px-2.5 text-[10px] font-extrabold text-amber-300 shadow-lg active:bg-amber-500/30"
            >
              <span>DRIFT</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onThrottleChange(-1);
              }}
              onPointerUp={() => onThrottleChange(0)}
              onPointerCancel={() => onThrottleChange(0)}
              className="flex h-[60px] w-[60px] touch-none flex-col items-center justify-center rounded-2xl border border-rose-400/45 bg-rose-950/90 text-xs font-bold text-rose-200 shadow-xl active:bg-rose-700"
            >
              <span>BRAKE</span>
              <span className="text-[9px] opacity-75">REV</span>
            </button>

            <button
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                onThrottleChange(1);
              }}
              onPointerUp={() => onThrottleChange(0)}
              onPointerCancel={() => onThrottleChange(0)}
              className="flex h-[74px] w-[72px] touch-none flex-col items-center justify-center rounded-2xl border-2 border-emerald-400/65 bg-emerald-600/92 font-display text-sm font-extrabold text-white shadow-xl active:bg-emerald-500"
            >
              <span>GAS</span>
              <span className="font-mono-tabular text-[11px] font-semibold text-emerald-100">
                {hud.speedKmh} km/h
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto flex flex-col items-end gap-2"
        >
          {/* Contextual Pop-up Touch Actions (Talk to NPC / Drive Nearby Car / Claim POI) */}
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {hud.nearInteractableNPC && (
              <button
                onPointerDown={() => onTalkNPC()}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-300/60 bg-emerald-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 shadow-xl active:scale-95"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Talk</span>
              </button>
            )}

            {hud.nearInteractablePOI && (
              <button
                onPointerDown={() => onClaimPOI()}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-sky-300/60 bg-sky-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 shadow-xl active:scale-95"
              >
                <Compass className="h-4 w-4" />
                <span>Claim POI</span>
              </button>
            )}

            {hud.nearInteractableVehicle && (
              <button
                onPointerDown={() => onEnterExitVehicle()}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300/65 bg-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 shadow-xl active:scale-95"
              >
                <Car className="h-4 w-4" />
                <span>Drive</span>
              </button>
            )}
          </div>

          {/* Core On-Foot Action Cluster: Active Skills + Melee Strike + Aimed Fire (Shoots at Arrow!) */}
          <div className="flex items-center gap-2">
            {unlockedShockwave && (
              <button
                onPointerDown={() => onTriggerSkill('PULSE')}
                disabled={!hud.progression.activeCooldowns.shockwaveReady}
                className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-rose-400/50 bg-[#0d121c]/90 text-rose-300 shadow-lg disabled:opacity-40 active:scale-95"
                aria-label="Shockwave"
              >
                <Zap className="h-5 w-5" />
              </button>
            )}

            {unlockedJammer && hud.wantedLevel > 0 && (
              <button
                onPointerDown={() => onTriggerSkill('JAMMER')}
                disabled={!hud.progression.activeCooldowns.bribeReady}
                className="flex h-[48px] w-[48px] items-center justify-center rounded-full border border-sky-400/50 bg-[#0d121c]/90 text-sky-300 shadow-lg disabled:opacity-40 active:scale-95"
                aria-label="Scanner Jammer"
              >
                <ShieldAlert className="h-5 w-5" />
              </button>
            )}

            <button
              onPointerDown={() => onMelee()}
              className="flex h-[56px] w-[56px] touch-none flex-col items-center justify-center rounded-full border border-rose-400/55 bg-[#1f1218]/92 text-rose-200 shadow-xl active:scale-95 active:bg-rose-800"
            >
              <HandMetal className="h-5 w-5" />
              <span className="mt-0.5 text-[9px] font-extrabold">MELEE</span>
            </button>

            <button
              onPointerDown={() => onAimShot()}
              className="flex h-[66px] w-[66px] touch-none flex-col items-center justify-center rounded-full border-2 border-sky-300/75 bg-sky-500/92 text-slate-950 shadow-xl active:scale-95 active:bg-sky-400"
            >
              <Crosshair className="h-6 w-6" />
              <span className="mt-0.5 text-[9px] font-extrabold">SHOOT</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
