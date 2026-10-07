// Shared contract for the 无尽守御 combo simulator.
//
// Rule: every number the simulator uses is a Param that records where it came
// from. Nothing is guessed. When a required number is unknown, code records a
// MissingParam instead of inventing a value, and any result that depended on
// it is marked incomplete.

// Where a number came from, in order of trust:
// - pack:        game resource pack entry (5165 等), the authority once imported
// - measured:    in-game measurement by the team
// - card:        original glyph card text (data/initial-library.json)
// - primer:      阅读前瞻 text (data/initial-primer.json)
// - description: in-game talent description text (data/hero-talents.json);
//                known to differ from actual values, so never "verified"
// - repo:        other structured repo data (e.g. rune effects)
// - public:      widely published ranked-mode formula, not yet checked
//                against the pack
// - fixture:     synthetic value used only by tests
export type SourceKind =
  | 'pack'
  | 'measured'
  | 'card'
  | 'primer'
  | 'description'
  | 'repo'
  | 'public'
  | 'fixture';

export type Provenance = {
  kind: SourceKind;
  // File plus locator, e.g. "data/initial-library.json#doc-glyph-030" or
  // "pack 5165 entry 12345". Must be specific enough to re-check by hand.
  ref: string;
  note?: string;
};

export type ParamUnit =
  | 'flat'
  | 'percent' // 15 means 15%
  | 'ratio' // 1.5 means 150%
  | 'seconds'
  | 'frames'
  | 'count'
  | 'meters';

export type Param = {
  value: number;
  unit: ParamUnit;
  source: Provenance;
  // true only for pack or measured values
  verified: boolean;
};

export type MissingParam = {
  // Stable key, e.g. "glyph:doc-glyph-042:fire-pool-damage"
  key: string;
  // What number is missing, in Chinese for reports
  what: string;
  // Which effect or calculation needs it
  neededFor: string;
};

export type StatKey =
  | 'physAtk' // 物理攻击
  | 'magicAtk' // 法术攻击
  | 'physAtkPct' // 攻击力百分比提升
  | 'magicDamagePct' // 法术伤害百分比提升（雕文“法术伤害”），与法术攻击分开
  | 'maxHp' // 最大生命
  | 'physDef' // 物理防御
  | 'magicDef' // 法术防御
  | 'physPenFlat' // 物理穿透（固定值）
  | 'physPenPct' // 物理穿透（百分比）
  | 'magicPenFlat' // 法术穿透（固定值）
  | 'magicPenPct' // 法术穿透（百分比）
  | 'attackSpeedPct' // 攻速加成
  | 'critRatePct' // 暴击率
  | 'critDamagePct' // 暴击效果 / 暴击伤害
  | 'cdrPct' // 冷却缩减
  | 'moveSpeedPct' // 移速
  | 'physLifestealPct' // 物理吸血
  | 'magicLifestealPct' // 法术吸血
  | 'hpRegen' // 生命回复
  | 'tenacityPct' // 韧性
  | 'damageAmpPct' // 伤害增幅
  | 'outputRatePct' // 输出率
  | 'damageReductionPct'; // 免伤 / 减伤

export type StatMod = { stat: StatKey; value: Param };

export type DamageType = 'physical' | 'magic' | 'true';

export type DamageSpec = {
  type: DamageType;
  base: Param;
  ratios: Array<{ stat: StatKey; ratio: Param }>;
  // Percentage of the target's max HP
  targetMaxHpPct?: Param;
  canCrit: boolean;
  // Free-form tags that triggers and filters match on: 'basic',
  // 'enhanced-basic', 'skill1', 'skill2', 'skill3', 'glyph', 'proc', ...
  tags: string[];
};

export type HitSpec = {
  atFrame: Param;
  damage: DamageSpec;
};

export type ActionModel = {
  id: string;
  name: string;
  totalFrames: Param;
  hits: HitSpec[];
  tags: string[];
};

export type SkillModel = {
  slot: number; // 0 = basic attack, 1..4 = skills
  name: string;
  cooldown?: Param; // seconds; absent for basic attack
  action: ActionModel;
};

export type HeroModel = {
  heroId: string;
  heroName: string;
  // e.g. 'ranged', 'melee'
  tags: string[];
  base: Partial<Record<StatKey, Param>>;
  skills: SkillModel[];
  passives: EffectSource[];
  missing: MissingParam[];
};

export type Trigger =
  | 'battleStart'
  | 'cast' // any skill cast
  | 'hit' // any damage instance dealt
  | 'basicHit'
  | 'enhancedBasicHit'
  | 'skillHit'
  | 'crit'
  | 'kill'
  | 'periodic'
  | 'damageTaken'
  | 'shieldConsumed';

export type Condition =
  | { kind: 'selfHpBelowPct'; value: Param }
  | { kind: 'selfHpAbovePct'; value: Param }
  | { kind: 'targetHpBelowPct'; value: Param }
  | { kind: 'targetHpAbovePct'; value: Param }
  | { kind: 'stationaryFor'; value: Param } // seconds
  | { kind: 'targetDistanceAbove'; value: Param } // meters
  | { kind: 'selfUntargetable' }
  | { kind: 'rangedHero' }
  | { kind: 'tag'; tag: string };

export type EffectSpec =
  // Always-on stat change, optionally gated by conditions
  | { kind: 'stat'; mod: StatMod; when?: Condition[] }
  // Timed buff granted on a trigger
  | {
      kind: 'buff';
      on: Trigger;
      filterTags?: string[];
      mods: StatMod[];
      duration: Param;
      maxStacks?: Param;
      stackRule: 'refresh' | 'independent' | 'no-refresh';
      internalCooldown?: Param;
      periodSeconds?: Param; // for on: 'periodic'
      when?: Condition[];
    }
  // Extra damage instance on a trigger
  | {
      kind: 'proc';
      on: Trigger;
      filterTags?: string[];
      everyN?: Param;
      chance?: Param;
      internalCooldown?: Param;
      periodSeconds?: Param; // for on: 'periodic'
      damage: DamageSpec;
      when?: Condition[];
    }
  // Cooldown reduction on a trigger
  | {
      kind: 'cooldown';
      on: Trigger;
      filterTags?: string[];
      skillSlot: number;
      reduce: Param;
      mode: 'seconds' | 'percent-of-remaining' | 'percent-of-total';
    }
  // Stat converted from another stat, e.g. 暴击转化
  | { kind: 'conversion'; from: StatKey; to: StatKey; ratio: Param }
  // Damage multiplier or extra damage tied to conditions
  | {
      kind: 'damageMod';
      mod: 'amp' | 'extraTrue';
      value: Param;
      filterTags?: string[];
      when?: Condition[];
    }
  // Needs bespoke code; params documented, implementation keyed by id
  | { kind: 'custom'; id: string; params: Record<string, Param> }
  // Does not change damage in this simulator (movement, vision, gold, ...)
  // or cannot be modeled yet; kept so reports stay complete
  | { kind: 'unmodeled'; reason: string };

export type EffectOwner = 'core' | 'talent' | 'glyph' | 'rune' | 'mode';

export type EffectSource = {
  id: string;
  name: string;
  owner: EffectOwner;
  // Original text the effect was read from
  text: string;
  effects: EffectSpec[];
  missing: MissingParam[];
};

export type TargetModel = {
  id: string;
  name: string;
  maxHp: Param;
  physDef: Param;
  magicDef: Param;
  attack?: Param;
  notes: string[];
};

// A formula rule that is a choice rather than a number, with the same
// provenance requirements as Param.
export type FormulaChoice<T extends string> = {
  value: T;
  source: Provenance;
  verified: boolean;
};

// Every field is optional on purpose: an absent field means the rule is not
// yet known. The engine records a MissingParam when a calculation needs an
// absent rule, skips that factor, and marks the result incomplete.
export type FormulaConfig = {
  // reduction = def / (def + constant)
  defenseConstant?: Param;
  // Base crit damage multiplier before 暴击效果 bonuses, as ratio (2 = 200%)
  critBaseRatio?: Param;
  attackSpeedCapPct?: Param;
  cdrCapPct?: Param;
  // Logic frames per second for action timelines
  framesPerSecond?: Param;
  // Order of percentage and flat penetration
  penetrationOrder?: FormulaChoice<'pct-then-flat' | 'flat-then-pct'>;
  // Whether 攻击力 x% applies to total attack or bonus attack only
  attackPctBase?: FormulaChoice<'total' | 'bonus'>;
  // How different damage amplification categories combine
  ampStacking?: FormulaChoice<'additive' | 'multiplicative'>;
  // Whether amplification also applies to true damage
  trueDamageAmplified?: FormulaChoice<'yes' | 'no'>;
  // How attack speed shortens the basic attack action:
  // interval = totalFrames / (1 + attackSpeedPct / 100)
  attackSpeedRule?: FormulaChoice<'divide-total-frames'>;
};

export type RngMode = { mode: 'expected' } | { mode: 'seeded'; seed: number };

export type DamageEvent = {
  timeSeconds: number;
  sourceId: string;
  tags: string[];
  type: DamageType;
  amount: number;
  crit: boolean;
};

export type SimResult = {
  totalDamage: number;
  dps: number;
  durationSeconds: number;
  byTag: Record<string, number>;
  bySource: Record<string, number>;
  events: DamageEvent[];
  missing: MissingParam[];
  // Unverified inputs that were used (description, public, fixture, ...)
  assumptions: string[];
  // false whenever missing is non-empty
  complete: boolean;
};
