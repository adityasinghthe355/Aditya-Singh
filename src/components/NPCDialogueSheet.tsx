import React from 'react';
import { ActiveNPCDialogueOption, ActiveNPCInteraction } from '../game/types';
import { MessageSquare, Users, X } from 'lucide-react';

interface NPCDialogueSheetProps {
  interaction: ActiveNPCInteraction;
  onSelectOption: (optionId: ActiveNPCDialogueOption['id']) => void;
}

export const NPCDialogueSheet: React.FC<NPCDialogueSheetProps> = ({
  interaction,
  onSelectOption,
}) => {
  const trustColor =
    interaction.playerTrust >= 50
      ? 'text-emerald-400'
      : interaction.playerTrust <= -20
      ? 'text-rose-400'
      : 'text-sky-300';

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto mx-auto w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0d121c]/95 p-3 shadow-2xl"
    >
      {/* Compact Landscape Header: Name, Role, Schedule Activity & Trust */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-semibold text-amber-400">{interaction.name}</span>
            <span aria-hidden="true">·</span>
            <span>{interaction.role}</span>
            <span aria-hidden="true">·</span>
            <span>{interaction.currentActivity}</span>
            <span aria-hidden="true">·</span>
            <span className={trustColor}>
              {interaction.moodLabel} (
              {interaction.playerTrust >= 0
                ? `+${interaction.playerTrust}`
                : interaction.playerTrust}
              )
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
            <span>
              Goal:{' '}
              <span className={interaction.objectiveCompleted ? 'text-emerald-400' : 'text-slate-200'}>
                {interaction.objectiveCompleted
                  ? 'Completed with your help'
                  : interaction.personalObjective}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-slate-400" />
              {interaction.relationships
                .map((r) => `${r.targetName} (${r.relationLabel})`)
                .join(' · ')}
            </span>
          </div>
        </div>

        <button
          onClick={() => onSelectOption('LEAVE')}
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-900 text-slate-300 active:scale-95"
          aria-label="Close Conversation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Contextual Spoken Line */}
      <div className="mt-2 flex items-start gap-2">
        <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
        <p className="text-xs leading-snug text-slate-100">
          &ldquo;{interaction.dialogueLine}&rdquo;
        </p>
      </div>

      {/* 2-Column Landscape Mobile Dialogue Choices */}
      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {interaction.options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onSelectOption(opt.id)}
            className={`flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-1.5 text-left transition active:scale-[0.99] ${
              opt.id === 'PROVOKE'
                ? 'border-rose-500/35 bg-rose-950/35 active:bg-rose-950/60'
                : opt.id === 'HELP_OBJECTIVE'
                ? 'border-amber-400/40 bg-amber-500/15 active:bg-amber-500/25'
                : 'border-white/10 bg-slate-900/90 active:bg-slate-800'
            }`}
          >
            <span className="text-xs font-semibold text-white">{opt.label}</span>
            <span className="text-[10px] leading-tight text-slate-300 truncate w-full">
              {opt.subtitle}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
