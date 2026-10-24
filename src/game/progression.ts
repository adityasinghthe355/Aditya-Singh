import { SkillBranchId, SkillNodeDef } from './types';

export const SKILL_TREE_CATALOG: SkillNodeDef[] = [
  // ==========================================================================
  // BRANCH 1: WHEELMAN & VELOCITY (Driving, Vehicle Engineering, Nitro)
  // ==========================================================================
  {
    id: 'drv_1_torque',
    branch: 'DRIVING',
    tier: 1,
    name: 'Twin-Scroll Tuning',
    type: 'PASSIVE',
    cost: 1,
    description: 'Calibrates throttle response across every hijacked or owned vehicle.',
    effectSummary: '+22% Vehicle Acceleration & +12% Top Speed',
  },
  {
    id: 'drv_2_chassis',
    branch: 'DRIVING',
    tier: 2,
    name: 'Reinforced Rollcage',
    type: 'PASSIVE',
    cost: 1,
    prerequisiteId: 'drv_1_torque',
    description: 'Absorbs high-speed collision shock and strengthens steering grip.',
    effectSummary: '-55% Vehicle Crash Damage & +25% Drift Grip',
  },
  {
    id: 'drv_3_nitro',
    branch: 'DRIVING',
    tier: 3,
    name: 'Nitrous Purge Boost',
    type: 'ACTIVE',
    cost: 2,
    prerequisiteId: 'drv_2_chassis',
    description: 'Unlocks the Nitro Boost touch pad while driving for instant acceleration.',
    effectSummary: 'Active Touch Skill: +45 KM/H Surge (8s Cooldown)',
  },
  {
    id: 'drv_4_autorepair',
    branch: 'DRIVING',
    tier: 4,
    name: 'Nano-Weld Alternator',
    type: 'PASSIVE',
    cost: 2,
    prerequisiteId: 'drv_3_nitro',
    description: 'Continuously repairs engine and bodywork while cruising at high speed.',
    effectSummary: 'Regenerates +6 Vehicle Integrity/sec at speed',
  },

  // ==========================================================================
  // BRANCH 2: STREET ENFORCER (Combat, Ballistics/Melee, Armor & Shockwave)
  // ==========================================================================
  {
    id: 'cmb_1_conditioning',
    branch: 'COMBAT',
    tier: 1,
    name: 'Adrenaline Conditioning',
    type: 'PASSIVE',
    cost: 1,
    description: 'Hardens cardiovascular stamina and raises maximum vitality.',
    effectSummary: '+35 Max Health & +20% Foot Sprint Velocity',
  },
  {
    id: 'cmb_2_knuckles',
    branch: 'COMBAT',
    tier: 2,
    name: 'Kinetic Impact Strikes',
    type: 'PASSIVE',
    cost: 1,
    prerequisiteId: 'cmb_1_conditioning',
    description: 'Delivers heavy concussive strikes with extended reach.',
    effectSummary: '+85% Melee Damage & Wider Strike Arc',
  },
  {
    id: 'cmb_3_shockwave',
    branch: 'COMBAT',
    tier: 3,
    name: 'Concussive Pulse',
    type: 'ACTIVE',
    cost: 2,
    prerequisiteId: 'cmb_2_knuckles',
    description: 'Unlocks the Shockwave touch pad on foot to knock back nearby threats.',
    effectSummary: 'Active Touch Skill: 8m Knockdown Pulse (12s CD)',
  },
  {
    id: 'cmb_4_kevlar',
    branch: 'COMBAT',
    tier: 4,
    name: 'Reactive Kevlar Weave',
    type: 'PASSIVE',
    cost: 2,
    prerequisiteId: 'cmb_3_shockwave',
    description: 'Slowly regenerates tactical armor plates outside of combat.',
    effectSummary: 'Passive +3 Armor/sec Regeneration',
  },

  // ==========================================================================
  // BRANCH 3: SYNDICATE FIXER (Trading, NPC Diplomacy, Crafting & Police Bribe)
  // ==========================================================================
  {
    id: 'syn_1_silver_tongue',
    branch: 'SYNDICATE',
    tier: 1,
    name: 'Street Broker Charisma',
    type: 'PASSIVE',
    cost: 1,
    description: 'Builds rapport faster with San Solis locals, vendors, and contacts.',
    effectSummary: '+60% NPC Trust Gain & +25% Contract/POI Payouts',
  },
  {
    id: 'syn_2_salvage',
    branch: 'SYNDICATE',
    tier: 2,
    name: 'Black-Market Artisan',
    type: 'PASSIVE',
    cost: 1,
    prerequisiteId: 'syn_1_silver_tongue',
    description: 'Extracts extra scrap components from caches and halves crafting costs.',
    effectSummary: '+50% Scrap Yield & Efficient Field Crafting',
  },
  {
    id: 'syn_3_ghost_dispatch',
    branch: 'SYNDICATE',
    tier: 3,
    name: 'Scanner Jammer',
    type: 'ACTIVE',
    cost: 2,
    prerequisiteId: 'syn_2_salvage',
    description: 'Unlocks the Scanner Jammer touch pad during police pursuits.',
    effectSummary: 'Active Touch Skill: Clears 2 Wanted Stars (20s CD)',
  },
  {
    id: 'syn_4_kingpin',
    branch: 'SYNDICATE',
    tier: 4,
    name: 'Solis Syndicate Dividend',
    type: 'PASSIVE',
    cost: 2,
    prerequisiteId: 'syn_3_ghost_dispatch',
    description: 'Allied NPCs share street intelligence and passive neighborhood tribute.',
    effectSummary: 'Earn +$45 every 10s + Allied NPCs defend you',
  },
];

export const BRANCH_META: Record<
  SkillBranchId,
  { title: string; subtitle: string; accentClass: string }
> = {
  DRIVING: {
    title: 'Wheelman & Velocity',
    subtitle: 'Earned by high-speed driving, clean drifts, and vehicle runs',
    accentClass: 'text-amber-400',
  },
  COMBAT: {
    title: 'Street Enforcer',
    subtitle: 'Earned by melee takedowns, surviving pursuits, and tactical defense',
    accentClass: 'text-rose-400',
  },
  SYNDICATE: {
    title: 'Syndicate Fixer',
    subtitle: 'Earned by NPC diplomacy, street trading, crafting, and POI discovery',
    accentClass: 'text-sky-400',
  },
};

export function xpForLevel(level: number): number {
  return 250 + (level - 1) * 200;
}
