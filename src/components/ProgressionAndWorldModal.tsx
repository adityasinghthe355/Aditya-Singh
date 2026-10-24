import React, { useState } from 'react';
import {
  PlayerProgressionSnapshot,
  ProceduralPOIInfo,
  SkillBranchId,
} from '../game/types';
import { BRANCH_META, SKILL_TREE_CATALOG } from '../game/progression';
import { Check, Compass, Hammer, Lock, RefreshCw, Sparkles, X } from 'lucide-react';

interface ProgressionAndWorldModalProps {
  progression: PlayerProgressionSnapshot;
  activePOIs: ProceduralPOIInfo[];
  worldSeed: number;
  onUnlockSkill: (skillId: string) => void;
  onCraftItem: (item: 'MEDKIT' | 'ARMOR') => void;
  onUseItem: (item: 'MEDKIT' | 'ARMOR') => void;
  onRegenerateWorld: () => void;
  onClose: () => void;
}

export const ProgressionAndWorldModal: React.FC<ProgressionAndWorldModalProps> = ({
  progression,
  activePOIs,
  worldSeed,
  onUnlockSkill,
  onCraftItem,
  onUseItem,
  onRegenerateWorld,
  onClose,
}) => {
  const [tab, setTab] = useState<'SKILLS' | 'CRAFTING' | 'WORLD'>('SKILLS');
  const [selectedBranch, setSelectedBranch] = useState<SkillBranchId>('DRIVING');
  const branches: SkillBranchId[] = ['DRIVING', 'COMBAT', 'SYNDICATE'];

  const activeBranchMeta = BRANCH_META[selectedBranch];
  const activeBranchNodes = SKILL_TREE_CATALOG.filter((n) => n.branch === selectedBranch);

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-3"
    >
      <div className="flex h-full max-h-[92%] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0f172a] shadow-2xl">
        {/* Compact Landscape Header + Segmented Tabs on One Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2.5">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
              <span className="font-mono-tabular font-semibold text-amber-400">
                Lv.{progression.level}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {progression.xp}/{progression.nextLevelXp} XP
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular font-semibold text-emerald-400">
                {progression.skillPoints} SP
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-sky-300">
                {progression.scrapParts} Salvage
              </span>
            </div>
            <h2 className="font-display text-base font-bold text-white">
              Skills, Crafting &amp; World POIs
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-slate-900 p-1">
              <button
                onClick={() => setTab('SKILLS')}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  tab === 'SKILLS'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 active:bg-slate-800'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>Skills</span>
              </button>
              <button
                onClick={() => setTab('CRAFTING')}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  tab === 'CRAFTING'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 active:bg-slate-800'
                }`}
              >
                <Hammer className="h-3.5 w-3.5 shrink-0" />
                <span>Crafting</span>
              </button>
              <button
                onClick={() => setTab('WORLD')}
                className={`flex min-h-[38px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition ${
                  tab === 'WORLD'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 active:bg-slate-800'
                }`}
              >
                <Compass className="h-3.5 w-3.5 shrink-0" />
                <span>POIs</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-slate-300 active:scale-95"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Widescreen Landscape Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {tab === 'SKILLS' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="grid flex-1 grid-cols-3 gap-1.5">
                  {branches.map((branch) => {
                    const isSelected = selectedBranch === branch;
                    const shortLabel =
                      branch === 'DRIVING'
                        ? 'Wheelman'
                        : branch === 'COMBAT'
                        ? 'Enforcer'
                        : 'Syndicate';
                    return (
                      <button
                        key={branch}
                        onClick={() => setSelectedBranch(branch)}
                        className={`flex min-h-[40px] items-center justify-between rounded-xl border px-3 py-1.5 transition ${
                          isSelected
                            ? 'border-amber-400/50 bg-slate-800 text-white'
                            : 'border-white/10 bg-slate-900/60 text-slate-400'
                        }`}
                      >
                        <span className="text-xs font-semibold">{shortLabel}</span>
                        <span className="font-mono-tabular text-[10px] text-slate-400">
                          {Math.round(progression.branchXp[branch])} XP
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-slate-400">
                <span className={`font-semibold ${activeBranchMeta.accentClass}`}>
                  {activeBranchMeta.title}:
                </span>{' '}
                {activeBranchMeta.subtitle}
              </div>

              {/* 2-Column Landscape Skill Grid */}
              <div className="grid grid-cols-2 gap-2">
                {activeBranchNodes.map((node) => {
                  const unlocked = progression.unlockedSkillIds.includes(node.id);
                  const prereqMet =
                    !node.prerequisiteId ||
                    progression.unlockedSkillIds.includes(node.prerequisiteId);
                  const canAfford = progression.skillPoints >= node.cost;
                  const canUnlock = !unlocked && prereqMet && canAfford;

                  return (
                    <div
                      key={node.id}
                      className={`rounded-xl border p-3 ${
                        unlocked
                          ? 'border-emerald-500/40 bg-emerald-950/20'
                          : prereqMet
                          ? 'border-white/15 bg-slate-900/80'
                          : 'border-white/5 bg-slate-950/40 opacity-65'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] text-slate-400">
                            Tier {node.tier} · {node.type === 'ACTIVE' ? 'Active Skill' : 'Passive'}
                          </div>
                          <div className="text-xs font-semibold text-white">{node.name}</div>
                        </div>

                        {unlocked ? (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 shrink-0">
                            <Check className="h-3.5 w-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            disabled={!canUnlock}
                            onClick={() => onUnlockSkill(node.id)}
                            className={`flex min-h-[38px] items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition shrink-0 ${
                              canUnlock
                                ? 'bg-amber-500 text-slate-950 active:scale-95'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {!prereqMet && <Lock className="h-3 w-3" />}
                            <span>{node.cost} SP</span>
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-300">
                        {node.description}
                      </p>
                      <div className="mt-1 text-[11px] font-medium text-amber-300">
                        {node.effectSummary}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'CRAFTING' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5">
                <div className="text-[11px] font-semibold text-sky-400">
                  Salvage Inventory: {progression.scrapParts} Parts
                </div>
                <h3 className="mt-0.5 font-display text-sm font-bold text-white">
                  Street Medkit Syringe
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">
                  Synthesizes emergency restorative from street salvage. Restores +55 Health on demand.
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Owned: {progression.craftedMedkits}</span>
                  <span>
                    Cost: {progression.unlockedSkillIds.includes('syn_2_salvage') ? 1 : 2} Salvage
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onCraftItem('MEDKIT')}
                    className="flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 active:scale-95"
                  >
                    Craft (+45 XP)
                  </button>
                  <button
                    onClick={() => onUseItem('MEDKIT')}
                    disabled={progression.craftedMedkits <= 0}
                    className="flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40 active:scale-95"
                  >
                    Use Medkit
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3.5">
                <div className="text-[11px] font-semibold text-sky-400">
                  Salvage Inventory: {progression.scrapParts} Parts
                </div>
                <h3 className="mt-0.5 font-display text-sm font-bold text-white">
                  Ballistic Kevlar Plate
                </h3>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">
                  Reinforces your street vest with composite plating. Restores +60 Tactical Armor immediately.
                </p>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Owned: {progression.craftedArmorPlates}</span>
                  <span>
                    Cost: {progression.unlockedSkillIds.includes('syn_2_salvage') ? 1 : 2} Salvage
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onCraftItem('ARMOR')}
                    className="flex min-h-[40px] items-center justify-center rounded-xl bg-amber-500 px-2.5 py-1.5 text-xs font-bold text-slate-950 active:scale-95"
                  >
                    Craft (+45 XP)
                  </button>
                  <button
                    onClick={() => onUseItem('ARMOR')}
                    disabled={progression.craftedArmorPlates <= 0}
                    className="flex min-h-[40px] items-center justify-center rounded-xl border border-white/15 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40 active:scale-95"
                  >
                    Equip Plate
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'WORLD' && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/85 p-3">
                <div>
                  <div className="font-mono-tabular text-xs font-semibold text-sky-400">
                    Active World Seed #{worldSeed}
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Cyan diamonds on radar mark live POIs; pink square marks Solis Customs road respray bay.
                  </p>
                </div>
                <button
                  onClick={onRegenerateWorld}
                  className="flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl bg-sky-400 px-3.5 py-1.5 text-xs font-bold text-slate-950 active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>New Seed POIs</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {activePOIs.map((poi) => (
                  <div
                    key={poi.id}
                    className={`rounded-xl border p-2.5 ${
                      poi.completed
                        ? 'border-emerald-500/30 bg-emerald-950/15 opacity-70'
                        : 'border-white/10 bg-slate-900/75'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{poi.type.replace('_', ' ')}</span>
                      <span className="font-mono-tabular text-emerald-400">
                        +${poi.rewardCash} · +{poi.rewardScrap} Salvage
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-white">
                      {poi.title}{' '}
                      <span className="text-[10px] font-normal text-slate-400">
                        {poi.completed ? '· Cleared' : poi.discovered ? '· Nearby' : ''}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-300">{poi.subtitle}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
