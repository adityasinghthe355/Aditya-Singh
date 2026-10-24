import React from 'react';
import { MinimapBlip } from '../game/types';

interface MinimapProps {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  blips: MinimapBlip[];
  wantedLevel: number;
  size?: number;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const MinimapRadar: React.FC<MinimapProps> = ({
  playerX,
  playerZ,
  playerHeading,
  blips,
  wantedLevel,
  size = 92,
}) => {
  const half = size / 2;
  const scale = size / 192;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/15 shadow-xl ${
        wantedLevel > 0 ? 'bg-[#141220]/90' : 'bg-[#0d121c]/90'
      }`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <g transform={`translate(${half}, ${half})`}>
          {/* Pacific Coastline Tint on West */}
          <rect
            x={(-320 - playerX) * scale}
            y={-180}
            width={195 * scale}
            height={360}
            fill="#0369a1"
            opacity={0.45}
          />

          {[-2, -1, 0, 1, 2].map((idx) => {
            const roadWorld = idx * 56;
            const relX = (roadWorld - playerX) * scale;
            const relZ = (roadWorld - playerZ) * scale;
            return (
              <React.Fragment key={idx}>
                <line x1={relX} y1={-160} x2={relX} y2={160} stroke="#334155" strokeWidth={6.5} />
                <line x1={-160} y1={relZ} x2={160} y2={relZ} stroke="#334155" strokeWidth={6.5} />
              </React.Fragment>
            );
          })}

          {blips.map((b, i) => {
            if (b.type === 'PLAYER') return null;
            const dx = clamp((b.x - playerX) * scale, -half + 9, half - 9);
            const dz = clamp((b.z - playerZ) * scale, -half + 9, half - 9);

            if (b.type === 'OBJECTIVE') {
              return (
                <g key={`obj-${i}`} transform={`translate(${dx}, ${dz})`}>
                  <rect
                    x={-4.5}
                    y={-4.5}
                    width={9}
                    height={9}
                    transform="rotate(45)"
                    fill="#f59e0b"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                  />
                </g>
              );
            }

            if (b.type === 'CUSTOMS') {
              return (
                <g key={`cus-${i}`} transform={`translate(${dx}, ${dz})`}>
                  <rect
                    x={-4}
                    y={-4}
                    width={8}
                    height={8}
                    rx={2}
                    fill="#e879f9"
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                </g>
              );
            }

            if (b.type === 'POI') {
              return (
                <polygon
                  key={`poi-${i}`}
                  points={`${dx},${dz - 4.2} ${dx + 4},${dz} ${dx},${dz + 4.2} ${dx - 4},${dz}`}
                  fill="#38bdf8"
                  stroke="#0f172a"
                  strokeWidth={1}
                />
              );
            }

            if (b.type === 'POLICE') {
              return (
                <circle
                  key={`pol-${i}`}
                  cx={dx}
                  cy={dz}
                  r={4}
                  fill="#ef4444"
                  stroke="#eff6ff"
                  strokeWidth={1.2}
                />
              );
            }

            if (b.type === 'NPC_FRIEND') {
              return <circle key={`ally-${i}`} cx={dx} cy={dz} r={2.8} fill="#22c55e" />;
            }

            if (b.type === 'NPC_HOSTILE') {
              return <circle key={`hos-${i}`} cx={dx} cy={dz} r={2.8} fill="#f97316" />;
            }

            return (
              <circle
                key={`veh-${i}`}
                cx={dx}
                cy={dz}
                r={2}
                fill="#94a3b8"
                opacity={0.72}
              />
            );
          })}

          <g transform={`rotate(${(-playerHeading * 180) / Math.PI + 180})`}>
            <polygon
              points="0,-6.5 5,5.5 0,3 -5,5.5"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth={1.4}
            />
          </g>
        </g>
      </svg>
      <div className="pointer-events-none absolute top-1 left-1.5 text-[9px] font-bold tracking-wider text-slate-300">
        N
      </div>
    </div>
  );
};
