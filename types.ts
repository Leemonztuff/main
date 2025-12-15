
import React from 'react';

export enum GameState {
  TITLE,
  CHARACTER_CREATION,
  OVERWORLD,
  TOWN_EXPLORATION,
  BATTLE_INIT,
  BATTLE_TACTICAL,
  BATTLE_RESOLUTION,
  BATTLE_VICTORY,
  BATTLE_DEFEAT,
  LOCAL_MAP,
  LEVEL_UP,
  SUMMONING,
  TEMPLE_HUB,
  PARTY_MANAGEMENT
}

export enum Dimension {
  NORMAL = 'NORMAL',
  UPSIDE_DOWN = 'UPSIDE_DOWN'
}

export enum WeatherType {
  NONE = 'NONE',
  RAIN = 'RAIN',
  SNOW = 'SNOW',
  FOG = 'FOG',
  ASH = 'ASH',
  RED_STORM = 'RED_STORM'
}

export interface PositionComponent {
  x: number;
  y: number;
}

export interface HexCell {
  q: number;
  r: number;
  terrain: TerrainType;
  height?: number;
  weather: WeatherType;
  isExplored: boolean;
  isVisible: boolean;
  hasPortal?: boolean;
  hasEncounter?: boolean;
  poiType?: 'VILLAGE' | 'CASTLE' | 'RUINS' | 'SHOP' | 'INN' | 'PLAZA' | 'EXIT' | 'TEMPLE';
  regionName?: string;
}

export enum TerrainType {
  GRASS = 'GRASS',
  PLAINS = 'PLAINS',
  FOREST = 'FOREST',
  JUNGLE = 'JUNGLE',
  MOUNTAIN = 'MOUNTAIN',
  WATER = 'WATER',
  CASTLE = 'CASTLE',
  VILLAGE = 'VILLAGE',
  DESERT = 'DESERT',
  SWAMP = 'SWAMP',
  RUINS = 'RUINS',
  TUNDRA = 'TUNDRA',
  TAIGA = 'TAIGA',
  COBBLESTONE = 'COBBLESTONE',
  DIRT_ROAD = 'DIRT_ROAD',
  STONE_FLOOR = 'STONE_FLOOR',
  CAVE_FLOOR = 'CAVE_FLOOR',
  FUNGUS = 'FUNGUS',
  LAVA = 'LAVA',
  CHASM = 'CHASM',
  WALL_HOUSE = 'WALL_HOUSE',
  WOOD_FLOOR = 'WOOD_FLOOR',
  SAVANNAH = 'SAVANNAH',
  WASTELAND = 'WASTELAND',
  BADLANDS = 'BADLANDS'
}

export enum CharacterClass {
  FIGHTER = 'FIGHTER',
  RANGER = 'RANGER',
  WIZARD = 'WIZARD',
  CLERIC = 'CLERIC',
  ROGUE = 'ROGUE',
  BARBARIAN = 'BARBARIAN',
  PALADIN = 'PALADIN',
  SORCERER = 'SORCERER',
  WARLOCK = 'WARLOCK',
  DRUID = 'DRUID',
  BARD = 'BARD'
}

export enum CharacterRace {
  HUMAN = 'Human',
  ELF = 'Elf',
  DWARF = 'Dwarf',
  HALFLING = 'Halfling',
  DRAGONBORN = 'Dragonborn',
  GNOME = 'Gnome',
  TIEFLING = 'Tiefling',
  HALF_ORC = 'Half-Orc'
}

export enum CreatureType {
  HUMANOID = 'Humanoid',
  UNDEAD = 'Undead',
  BEAST = 'Beast',
  ELEMENTAL = 'Elemental',
  ABERRATION = 'Aberration',
  GIANT = 'Giant',
  CONSTRUCT = 'Construct',
  FIEND = 'Fiend',
  DRAGON = 'Dragon',
  MONSTROSITY = 'Monstrosity',
  CELESTIAL = 'Celestial',
  PLANT = 'Plant'
}

export interface Entity {
  id: string;
  defId?: string;
  name: string;
  type: 'PLAYER' | 'ENEMY' | 'NPC';
  equipment?: Partial<Record<EquipmentSlot, Item>>;
  stats: CombatStatsComponent;
  visual: VisualComponent;
  position?: PositionComponent;
  aiBehavior?: AIBehavior;
}

export interface GameStateData {
  // ...
}

export interface SaveMetadata {
  slotIndex: number;
  timestamp: number;
  summary: {
    charName: string;
    level: number;
    class: CharacterClass;
    location: string;
  }
}

export enum EquipmentSlot { MAIN_HAND = 'main_hand', OFF_HAND = 'off_hand', BODY = 'body' }
export enum ItemRarity { COMMON = 'Common', UNCOMMON = 'Uncommon', RARE = 'Rare', VERY_RARE = 'Very Rare', LEGENDARY = 'Legendary' }
export enum DamageType { SLASHING = 'Slashing', PIERCING = 'Piercing', BLUDGEONING = 'Bludgeoning', FIRE = 'Fire', COLD = 'Cold', LIGHTNING = 'Lightning', POISON = 'Poison', ACID = 'Acid', NECROTIC = 'Necrotic', RADIANT = 'Radiant', FORCE = 'Force', THUNDER = 'Thunder', PSYCHIC = 'Psychic', MAGIC = 'Magic' }
export enum SpellType { DAMAGE = 'DAMAGE', HEAL = 'HEAL', BUFF = 'BUFF', DEBUFF = 'DEBUFF', UTILITY = 'UTILITY' }
export enum AIBehavior { BASIC_MELEE = 'BASIC_MELEE', AGRESSIVE_BEAST = 'AGRESSIVE_BEAST', DEFENSIVE = 'DEFENSIVE', SPELLCASTER = 'SPELLCASTER', HEALER = 'HEALER' }
export enum Difficulty { EASY = 'EASY', NORMAL = 'NORMAL', HARD = 'HARD' }
export enum Ability { STR = 'STR', DEX = 'DEX', CON = 'CON', INT = 'INT', WIS = 'WIS', CHA = 'CHA' }
export enum BattleAction { MOVE = 'MOVE', ATTACK = 'ATTACK', MAGIC = 'MAGIC', SKILL = 'SKILL', ITEM = 'ITEM', WAIT = 'WAIT' }

// Extended Combat Stats
export interface CombatStatsComponent {
  level: number;
  class: CharacterClass;
  race?: CharacterRace;
  creatureType?: string;
  xp: number;
  xpToNextLevel: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  ac: number;
  initiativeBonus: number;
  speed: number;
  attributes: Attributes;
  baseAttributes: Attributes;
  spellSlots: { current: number, max: number };
  corruption?: number;
  activeCooldowns: Record<string, number>;
  statusEffects?: Record<string, number>;
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  attackDamageType?: DamageType;
  knownSpells?: string[];
  knownSkills?: string[];
  maxActions?: number;
  // New Summoning Properties
  rarity?: ItemRarity; // Reuse ItemRarity for Character Rarity
  affinity?: DamageType; // Elemental affinity
  traits?: string[]; // Flavor traits (e.g. "Brave", "Fragile")
}

// --- EFFECT SYSTEM ---
export enum EffectType {
  DAMAGE = 'DAMAGE',
  HEAL = 'HEAL',
  BUFF_STAT = 'BUFF_STAT',
  DEBUFF_STAT = 'DEBUFF_STAT',
  APPLY_STATUS = 'APPLY_STATUS',
  REMOVE_STATUS = 'REMOVE_STATUS',
  RESTORE_RESOURCE = 'RESTORE_RESOURCE', // Mana, Stamina
  TELEPORT = 'TELEPORT',
  TRANSFORM = 'TRANSFORM',
  SUMMON = 'SUMMON',
  DISPEL = 'DISPEL',
  REVIVE = 'REVIVE',
  MODIFY_ACTION = 'MODIFY_ACTION' // e.g. Extra Attack, Action Surge
}

export enum EffectTarget {
  SELF = 'SELF',
  TARGET = 'TARGET',
  ALL_ALLIES = 'ALL_ALLIES',
  ALL_ENEMIES = 'ALL_ENEMIES',
  AREA = 'AREA'
}

export enum EffectDuration {
  INSTANT = 'INSTANT',
  ROUNDS = 'ROUNDS',
  PERMANENT = 'PERMANENT' // Until rest or dispelled
}

export interface EffectDefinition {
  type: EffectType;
  target: EffectTarget;
  // Value calculation
  baseAmount?: number;
  diceCount?: number;
  diceSides?: number;
  statScaling?: Ability; // e.g. STR for damage
  scalingFactor?: number; // e.g. 1.0 * STR
  // Specifics
  damageType?: DamageType;
  statToModify?: Ability | 'AC' | 'SPEED' | 'INITIATIVE' | 'MAX_HP';
  resourceType?: 'MANA' | 'STAMINA' | 'HP';
  statusId?: string; // For APPLY_STATUS (e.g. 'POISONED', 'RAGE')
  duration?: EffectDuration;
  durationRounds?: number;
  summon?: string; // DefId for SUMMON or TRANSFORM
  range?: number; // For TELEPORT
  // Conditions
  condition?: 'HP_BELOW_50' | 'IS_UNDEAD' | 'HAS_ADVANTAGE';
  // Visuals
  animationKey?: string;
}

export interface Item {
  id: string;
  name: string;
  type: 'equipment' | 'consumable' | 'key';
  rarity: ItemRarity;
  description: string;
  icon: string;
  flavorText?: string;
  effects?: EffectDefinition[]; // Replaces simple 'effect'
  equipmentStats?: {
    slot: EquipmentSlot;
    ac?: number;
    damageType?: DamageType;
    diceCount?: number;
    diceSides?: number;
    properties?: string[];
    passiveEffects?: EffectDefinition[]; // Effects active while equipped
  };
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  range: number;
  type: SpellType;
  description: string;
  animation: string;
  icon: string;
  manaCost?: number; // Explicit cost
  effects: EffectDefinition[]; // Replaces hardcoded damage fields
  aoeRadius?: number;
  aoeType?: 'CIRCLE' | 'CONE' | 'LINE';
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  staminaCost: number;
  cooldown: number;
  range: number;
  isBonusAction?: boolean;
  effects: EffectDefinition[]; // Replaces hardcoded fields
  aoeRadius?: number;
  aoeType?: 'CIRCLE' | 'CONE';
  animation?: string;
  icon: string;
}
export interface VisualComponent { color: string; modelType: 'billboard' | 'voxel'; spriteUrl: string; }
export interface Attributes { STR: number; DEX: number; CON: number; INT: number; WIS: number; CHA: number; }
export interface InventorySlot { item: Item; quantity: number; }
export interface LootDrop { id: string; position: PositionComponent; items: Item[]; gold: number; rarity: ItemRarity; }
export interface DamagePopup { id: string; position: number[]; amount: string | number; color: string; isCrit: boolean; timestamp: number; }
export interface SpellEffectData { id: string; type: string; startPos: number[]; endPos: number[]; color: string; duration: number; timestamp: number; animationKey?: string; variant?: string; projectileSprite?: string; textureUrl?: string; }
export interface OverworldEntity { id: string; defId?: string; name: string; sprite: string; dimension: Dimension; q: number; r: number; visionRange: number; }
export interface Quest { id: string; title: string; description: string; completed: boolean; type: 'MAIN' | 'SIDE'; }
export interface BattleCell { x: number; z: number; height: number; offsetY: number; color: string; textureUrl: string; isObstacle: boolean; blocksSight: boolean; movementCost: number; }
export interface ProgressionNode { level: number; featureName: string; description: string; unlocksSkill?: string; unlocksSpell?: string; passiveEffect?: string; }

export interface GameLogEntry {
  id: string;
  message: string;
  type: 'info' | 'combat' | 'narrative' | 'roll' | 'levelup';
  timestamp: number;
}

export interface LootEntry {
  itemId: string;
  chance: number; // 0.0 to 1.0 (e.g., 0.25 = 25%)
}

export interface EnemyDefinition {
  id: string;
  name: string;
  type: CreatureType;
  sprite: string; // URL
  hp: number;
  ac: number;
  xpReward: number;
  damage: number; // Base damage (e.g. 4 = 1d4 approx)
  attackDamageType?: DamageType; // Innate damage type if no weapon
  initiativeBonus: number;
  resistances?: DamageType[];
  vulnerabilities?: DamageType[];
  immunities?: DamageType[];
  lootTable?: LootEntry[];
  validDimensions?: Dimension[]; // Strict spawn rules
}
