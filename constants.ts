
import { TerrainType, CharacterClass, Attributes, CharacterRace, Item, ItemRarity, EquipmentSlot, Spell, SpellType, Ability, Skill, DamageType, ProgressionNode, Difficulty, WeatherType } from './types';

// SWITCH TO JSDELIVR CDN FOR RELIABLE WEB PREVIEW
export const WESNOTH_BASE_URL = "https://cdn.jsdelivr.net/gh/wesnoth/wesnoth@master/data/core/images";
export const MC_BASE_URL = "https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.19.3/assets/minecraft/textures/block";

export const NOISE_TEXTURE_URL = `data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E`;

export const HEX_SIZE = 32;
export const BATTLE_MAP_SIZE = 16;
export const DEFAULT_MAP_WIDTH = 40;
export const DEFAULT_MAP_HEIGHT = 30;

export const TERRAIN_COLORS: Record<TerrainType, string> = {
    [TerrainType.GRASS]: '#4ade80',
    [TerrainType.PLAINS]: '#bef264',
    [TerrainType.FOREST]: '#15803d',
    [TerrainType.JUNGLE]: '#14532d',
    [TerrainType.MOUNTAIN]: '#57534e',
    [TerrainType.WATER]: '#3b82f6',
    [TerrainType.CASTLE]: '#a8a29e',
    [TerrainType.VILLAGE]: '#fbbf24',
    [TerrainType.DESERT]: '#fde047',
    [TerrainType.SWAMP]: '#3f6212',
    [TerrainType.RUINS]: '#78716c',
    [TerrainType.TUNDRA]: '#e5e7eb',
    [TerrainType.TAIGA]: '#065f46',
    [TerrainType.COBBLESTONE]: '#525252',
    [TerrainType.DIRT_ROAD]: '#92400e',
    [TerrainType.STONE_FLOOR]: '#44403c',
    [TerrainType.CAVE_FLOOR]: '#292524',
    [TerrainType.FUNGUS]: '#7e22ce',
    [TerrainType.LAVA]: '#ef4444',
    [TerrainType.CHASM]: '#020617',
    [TerrainType.WALL_HOUSE]: '#713f12',
    [TerrainType.WOOD_FLOOR]: '#78350f',
    [TerrainType.SAVANNAH]: '#d97706',
    [TerrainType.WASTELAND]: '#7f1d1d',
    [TerrainType.BADLANDS]: '#c2410c'
};

export const TERRAIN_MOVEMENT_COST: Record<TerrainType, number> = {
    [TerrainType.GRASS]: 1,
    [TerrainType.PLAINS]: 1,
    [TerrainType.FOREST]: 2,
    [TerrainType.JUNGLE]: 3,
    [TerrainType.MOUNTAIN]: 3,
    [TerrainType.WATER]: 99,
    [TerrainType.CASTLE]: 1,
    [TerrainType.VILLAGE]: 1,
    [TerrainType.DESERT]: 2,
    [TerrainType.SWAMP]: 3,
    [TerrainType.RUINS]: 2,
    [TerrainType.TUNDRA]: 2,
    [TerrainType.TAIGA]: 2,
    [TerrainType.COBBLESTONE]: 1,
    [TerrainType.DIRT_ROAD]: 1,
    [TerrainType.STONE_FLOOR]: 1,
    [TerrainType.CAVE_FLOOR]: 1,
    [TerrainType.FUNGUS]: 2,
    [TerrainType.LAVA]: 99,
    [TerrainType.CHASM]: 99,
    [TerrainType.WALL_HOUSE]: 99,
    [TerrainType.WOOD_FLOOR]: 1,
    [TerrainType.SAVANNAH]: 1,
    [TerrainType.WASTELAND]: 2,
    [TerrainType.BADLANDS]: 2
};

export const RARITY_COLORS: Record<ItemRarity, string> = {
    [ItemRarity.COMMON]: '#9ca3af',
    [ItemRarity.UNCOMMON]: '#22c55e',
    [ItemRarity.RARE]: '#3b82f6',
    [ItemRarity.VERY_RARE]: '#a855f7',
    [ItemRarity.LEGENDARY]: '#fbbf24'
};

export const DAMAGE_ICONS: Record<DamageType, string> = {
    [DamageType.SLASHING]: `${WESNOTH_BASE_URL}/attacks/sword-human.png`,
    [DamageType.PIERCING]: `${WESNOTH_BASE_URL}/attacks/spear.png`,
    [DamageType.BLUDGEONING]: `${WESNOTH_BASE_URL}/attacks/mace.png`,
    [DamageType.FIRE]: `${WESNOTH_BASE_URL}/attacks/fireball.png`,
    [DamageType.COLD]: `${WESNOTH_BASE_URL}/attacks/iceball.png`,
    [DamageType.LIGHTNING]: `${WESNOTH_BASE_URL}/attacks/lightning.png`,
    [DamageType.POISON]: `${WESNOTH_BASE_URL}/attacks/fang.png`,
    [DamageType.ACID]: `${WESNOTH_BASE_URL}/attacks/slime.png`,
    [DamageType.NECROTIC]: `${WESNOTH_BASE_URL}/attacks/dark-missile.png`,
    [DamageType.RADIANT]: `${WESNOTH_BASE_URL}/attacks/lightbeam.png`,
    [DamageType.FORCE]: `${WESNOTH_BASE_URL}/attacks/magic-missile.png`,
    [DamageType.THUNDER]: `${WESNOTH_BASE_URL}/attacks/lightning.png`,
    [DamageType.PSYCHIC]: `${WESNOTH_BASE_URL}/attacks/touch-zombie.png`,
    [DamageType.MAGIC]: `${WESNOTH_BASE_URL}/attacks/magic-missile.png`
};

export const CORRUPTION_THRESHOLDS = {
    TIER_1: 20,
    TIER_2: 50,
    TIER_3: 80
};

export const XP_TABLE: Record<number, number> = {
    1: 300, 2: 900, 3: 2700, 4: 6500, 5: 14000, 6: 23000, 7: 34000, 8: 48000, 9: 64000, 10: 85000
};

export const DIFFICULTY_SETTINGS = {
    [Difficulty.EASY]: { enemyStatMod: 0.8, xpMod: 1.2 },
    [Difficulty.NORMAL]: { enemyStatMod: 1.0, xpMod: 1.0 },
    [Difficulty.HARD]: { enemyStatMod: 1.2, xpMod: 0.8 }
};

export const BASE_STATS: Record<CharacterClass, Attributes> = {
    [CharacterClass.FIGHTER]: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 10, CHA: 8 },
    [CharacterClass.RANGER]: { STR: 12, DEX: 16, CON: 12, INT: 10, WIS: 14, CHA: 8 },
    [CharacterClass.WIZARD]: { STR: 8, DEX: 14, CON: 12, INT: 16, WIS: 10, CHA: 10 },
    [CharacterClass.CLERIC]: { STR: 14, DEX: 10, CON: 14, INT: 8, WIS: 16, CHA: 10 },
    [CharacterClass.ROGUE]: { STR: 10, DEX: 16, CON: 12, INT: 12, WIS: 10, CHA: 10 },
    [CharacterClass.BARBARIAN]: { STR: 16, DEX: 14, CON: 16, INT: 8, WIS: 10, CHA: 8 },
    [CharacterClass.PALADIN]: { STR: 16, DEX: 10, CON: 14, INT: 8, WIS: 10, CHA: 16 },
    [CharacterClass.SORCERER]: { STR: 8, DEX: 14, CON: 14, INT: 10, WIS: 10, CHA: 16 },
    [CharacterClass.WARLOCK]: { STR: 10, DEX: 14, CON: 12, INT: 10, WIS: 8, CHA: 16 },
    [CharacterClass.DRUID]: { STR: 10, DEX: 14, CON: 14, INT: 10, WIS: 16, CHA: 8 },
    [CharacterClass.BARD]: { STR: 8, DEX: 16, CON: 12, INT: 10, WIS: 10, CHA: 16 }
};

export const RACE_BONUS: Record<CharacterRace, Partial<Attributes>> = {
    [CharacterRace.HUMAN]: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 },
    [CharacterRace.ELF]: { DEX: 2, INT: 1 },
    [CharacterRace.DWARF]: { CON: 2, STR: 1 },
    [CharacterRace.HALFLING]: { DEX: 2, CHA: 1 },
    [CharacterRace.DRAGONBORN]: { STR: 2, CHA: 1 },
    [CharacterRace.GNOME]: { INT: 2, CON: 1 },
    [CharacterRace.TIEFLING]: { CHA: 2, INT: 1 },
    [CharacterRace.HALF_ORC]: { STR: 2, CON: 1 }
};

export enum ClassArchetype {
    MARTIAL = 'MARTIAL',
    CASTER = 'CASTER',
    HYBRID = 'HYBRID'
}

export const CLASS_CONFIG: Record<CharacterClass, { icon: string, hex: string, archetype: ClassArchetype }> = {
    [CharacterClass.FIGHTER]: { icon: `${WESNOTH_BASE_URL}/units/human-loyalists/swordsman.png`, hex: '#ef4444', archetype: ClassArchetype.MARTIAL },
    [CharacterClass.RANGER]: { icon: `${WESNOTH_BASE_URL}/units/human-loyalists/huntsman.png`, hex: '#22c55e', archetype: ClassArchetype.HYBRID },
    [CharacterClass.WIZARD]: { icon: `${WESNOTH_BASE_URL}/units/human-magi/red-mage.png`, hex: '#3b82f6', archetype: ClassArchetype.CASTER },
    [CharacterClass.CLERIC]: { icon: `${WESNOTH_BASE_URL}/units/human-magi/white-mage.png`, hex: '#eab308', archetype: ClassArchetype.CASTER },
    [CharacterClass.ROGUE]: { icon: `${WESNOTH_BASE_URL}/units/human-outlaws/thief.png`, hex: '#a8a29e', archetype: ClassArchetype.MARTIAL },
    [CharacterClass.BARBARIAN]: { icon: `${WESNOTH_BASE_URL}/units/human-outlaws/thug.png`, hex: '#dc2626', archetype: ClassArchetype.MARTIAL },
    [CharacterClass.PALADIN]: { icon: `${WESNOTH_BASE_URL}/units/human-loyalists/paladin.png`, hex: '#f59e0b', archetype: ClassArchetype.HYBRID },
    [CharacterClass.SORCERER]: { icon: `${WESNOTH_BASE_URL}/units/human-magi/silver-mage.png`, hex: '#db2777', archetype: ClassArchetype.CASTER },
    [CharacterClass.WARLOCK]: { icon: `${WESNOTH_BASE_URL}/units/human-magi/dark-adept.png`, hex: '#7e22ce', archetype: ClassArchetype.CASTER },
    [CharacterClass.DRUID]: { icon: `${WESNOTH_BASE_URL}/units/elves-wood/shaman.png`, hex: '#65a30d', archetype: ClassArchetype.CASTER },
    [CharacterClass.BARD]: { icon: `${WESNOTH_BASE_URL}/units/human-loyalists/fencer.png`, hex: '#f472b6', archetype: ClassArchetype.CASTER }
};

export const RACE_ICONS: Record<CharacterRace, string> = {
    [CharacterRace.HUMAN]: `${WESNOTH_BASE_URL}/units/human-loyalists/lieutenant.png`,
    [CharacterRace.ELF]: `${WESNOTH_BASE_URL}/units/elves-wood/hero.png`,
    [CharacterRace.DWARF]: `${WESNOTH_BASE_URL}/units/dwarves/steelclad.png`,
    [CharacterRace.HALFLING]: `${WESNOTH_BASE_URL}/units/human-outlaws/footpad.png`,
    [CharacterRace.DRAGONBORN]: `${WESNOTH_BASE_URL}/units/drakes/fighter.png`,
    [CharacterRace.GNOME]: `${WESNOTH_BASE_URL}/units/dwarves/thunderer.png`,
    [CharacterRace.TIEFLING]: `${WESNOTH_BASE_URL}/units/undead-necromancers/dark-sorcerer.png`,
    [CharacterRace.HALF_ORC]: `${WESNOTH_BASE_URL}/units/orcs/warrior.png`
};

export const ASSETS = {
    WESNOTH_BASE_URL: WESNOTH_BASE_URL,
    UNITS: {
        PLAYER: `${WESNOTH_BASE_URL}/units/human-loyalists/lieutenant.png`,
        GOBLIN: `${WESNOTH_BASE_URL}/units/goblins/spearman.png`,
        ORC: `${WESNOTH_BASE_URL}/units/orcs/grunt.png`,
        ORC_ARCHER: `${WESNOTH_BASE_URL}/units/orcs/archer.png`,
        SKELETON: `${WESNOTH_BASE_URL}/units/undead-skeletal/skeleton.png`, 
        SKELETON_ARCHER: `${WESNOTH_BASE_URL}/units/undead-skeletal/archer.png`, 
        NECROMANCER: `${WESNOTH_BASE_URL}/units/undead-necromancers/dark-sorcerer.png`,
        WOLF: `${WESNOTH_BASE_URL}/units/monsters/wolf.png`,
        BAT: `${WESNOTH_BASE_URL}/units/monsters/vampire-bat.png`,
        SPIDER: `${WESNOTH_BASE_URL}/units/monsters/giant-spider.png`, 
        ZOMBIE: `${WESNOTH_BASE_URL}/units/undead/walking-corpse.png`,
        TROLL: `${WESNOTH_BASE_URL}/units/trolls/whelp.png`,
        GHOUL: `${WESNOTH_BASE_URL}/units/undead/ghoul.png`,
        LICH: `${WESNOTH_BASE_URL}/units/undead-necromancers/ancient-lich.png`,
        MUD_CRAWLER: `${WESNOTH_BASE_URL}/units/monsters/mudcrawler.png`,
        
        PLAYER_FIGHTER: `${WESNOTH_BASE_URL}/units/human-loyalists/swordsman.png`,
        PLAYER_WIZARD: `${WESNOTH_BASE_URL}/units/human-magi/red-mage.png`,
        PLAYER_ROGUE: `${WESNOTH_BASE_URL}/units/human-outlaws/thief.png`,
        PLAYER_CLERIC: `${WESNOTH_BASE_URL}/units/human-magi/white-mage.png`,
        PLAYER_BARBARIAN: `${WESNOTH_BASE_URL}/units/human-outlaws/thug.png`,
        PLAYER_BARD: `${WESNOTH_BASE_URL}/units/human-loyalists/fencer.png`,
        PLAYER_DRUID: `${WESNOTH_BASE_URL}/units/elves-wood/shaman.png`,
        PLAYER_PALADIN: `${WESNOTH_BASE_URL}/units/human-loyalists/paladin.png`, 
        PLAYER_RANGER: `${WESNOTH_BASE_URL}/units/human-loyalists/huntsman.png`,
        PLAYER_SORCERER: `${WESNOTH_BASE_URL}/units/human-magi/silver-mage.png`,
        PLAYER_WARLOCK: `${WESNOTH_BASE_URL}/units/human-magi/dark-adept.png`,
        
        ELF_FIGHTER: `${WESNOTH_BASE_URL}/units/elves-wood/hero.png`,
        ELF_ARCHER: `${WESNOTH_BASE_URL}/units/elves-wood/archer.png`,
        DWARF_FIGHTER: `${WESNOTH_BASE_URL}/units/dwarves/steelclad.png`,
        DWARF_GUARD: `${WESNOTH_BASE_URL}/units/dwarves/guardsman.png`,
        
        PLAYER_HALFLING: `${WESNOTH_BASE_URL}/units/human-outlaws/footpad.png`,
        PLAYER_DRAGONBORN: `${WESNOTH_BASE_URL}/units/drakes/fighter.png`,
        PLAYER_GNOME: `${WESNOTH_BASE_URL}/units/dwarves/thunderer.png`,
        PLAYER_TIEFLING: `${WESNOTH_BASE_URL}/units/undead-necromancers/dark-sorcerer.png`,
        PLAYER_HALF_ORC: `${WESNOTH_BASE_URL}/units/orcs/warrior.png`,
    },
    TERRAIN: {
        [TerrainType.GRASS]: `${WESNOTH_BASE_URL}/terrain/grass/green.png`,
        [TerrainType.PLAINS]: `${WESNOTH_BASE_URL}/terrain/grass/semi-dry.png`,
        [TerrainType.TAIGA]: `${WESNOTH_BASE_URL}/terrain/grass/dry.png`,
        [TerrainType.JUNGLE]: `${WESNOTH_BASE_URL}/terrain/grass/green.png`,
        [TerrainType.TUNDRA]: `${WESNOTH_BASE_URL}/terrain/frozen/snow.png`,
        [TerrainType.FOREST]: `${WESNOTH_BASE_URL}/terrain/grass/green.png`,
        [TerrainType.WATER]: `${WESNOTH_BASE_URL}/terrain/water/coast.png`,
        [TerrainType.MOUNTAIN]: `${WESNOTH_BASE_URL}/terrain/mountains/basic.png`,
        [TerrainType.VILLAGE]: `${WESNOTH_BASE_URL}/terrain/village/human-cottage.png`,
        [TerrainType.CASTLE]: `${WESNOTH_BASE_URL}/terrain/flat/dirt.png`,
        [TerrainType.RUINS]: `${WESNOTH_BASE_URL}/terrain/flat/dirt.png`,
        [TerrainType.DESERT]: `${WESNOTH_BASE_URL}/terrain/sand/desert.png`,
        [TerrainType.SWAMP]: `${WESNOTH_BASE_URL}/terrain/swamp/water-tile.png`,
        [TerrainType.CAVE_FLOOR]: `${WESNOTH_BASE_URL}/terrain/cave/floor.png`,
        [TerrainType.FUNGUS]: `${WESNOTH_BASE_URL}/terrain/cave/fungus-tile.png`,
        [TerrainType.LAVA]: `${WESNOTH_BASE_URL}/terrain/chasm/lava.png`,
        [TerrainType.CHASM]: `${WESNOTH_BASE_URL}/terrain/chasm/earthy.png`,
        [TerrainType.COBBLESTONE]: `${WESNOTH_BASE_URL}/terrain/path/cobble.png`,
        [TerrainType.DIRT_ROAD]: `${WESNOTH_BASE_URL}/terrain/path/dirt.png`,
        [TerrainType.WOOD_FLOOR]: `${WESNOTH_BASE_URL}/terrain/interior/wooden.png`, 
        [TerrainType.STONE_FLOOR]: `${WESNOTH_BASE_URL}/terrain/interior/stone.png`, 
        [TerrainType.WALL_HOUSE]: `${WESNOTH_BASE_URL}/terrain/walls/stone.png`,
        [TerrainType.SAVANNAH]: `${WESNOTH_BASE_URL}/terrain/grass/semi-dry.png`, 
        [TerrainType.WASTELAND]: `${WESNOTH_BASE_URL}/terrain/flat/dirt.png`,
        [TerrainType.BADLANDS]: `${WESNOTH_BASE_URL}/terrain/sand/desert.png`,
    },
    BLOCK_TEXTURES: {
        [TerrainType.GRASS]: `${MC_BASE_URL}/grass_block_top.png`,
        [TerrainType.WATER]: `${MC_BASE_URL}/blue_concrete.png`,
        [TerrainType.MOUNTAIN]: `${MC_BASE_URL}/stone.png`,
        [TerrainType.DESERT]: `${MC_BASE_URL}/sand.png`,
        [TerrainType.CASTLE]: `${MC_BASE_URL}/stone_bricks.png`,
        [TerrainType.LAVA]: `${MC_BASE_URL}/lava_still.png`,
        [TerrainType.SWAMP]: `${MC_BASE_URL}/mycelium_top.png`,
        [TerrainType.STONE_FLOOR]: `${MC_BASE_URL}/stone.png`,
        [TerrainType.VILLAGE]: `${MC_BASE_URL}/oak_planks.png`,
        [TerrainType.COBBLESTONE]: `${MC_BASE_URL}/cobblestone.png`,
        [TerrainType.DIRT_ROAD]: `${MC_BASE_URL}/podzol_top.png`,
        [TerrainType.PLAINS]: `${MC_BASE_URL}/grass_block_top.png`,
        [TerrainType.FOREST]: `${MC_BASE_URL}/grass_block_top.png`,
        [TerrainType.JUNGLE]: `${MC_BASE_URL}/grass_block_top.png`,
        [TerrainType.TAIGA]: `${MC_BASE_URL}/podzol_top.png`,
        [TerrainType.TUNDRA]: `${MC_BASE_URL}/snow.png`,
        [TerrainType.RUINS]: `${MC_BASE_URL}/mossy_cobblestone.png`,
        [TerrainType.CAVE_FLOOR]: `${MC_BASE_URL}/cobblestone.png`,
        [TerrainType.FUNGUS]: `${MC_BASE_URL}/mycelium_top.png`,
        [TerrainType.CHASM]: `${MC_BASE_URL}/black_concrete.png`,
        [TerrainType.WOOD_FLOOR]: `${MC_BASE_URL}/oak_planks.png`,
        [TerrainType.WALL_HOUSE]: `${MC_BASE_URL}/bricks.png`,
        [TerrainType.SAVANNAH]: `${MC_BASE_URL}/grass_block_top.png`, 
        [TerrainType.WASTELAND]: `${MC_BASE_URL}/podzol_top.png`,
        [TerrainType.BADLANDS]: `${MC_BASE_URL}/sand.png`, 
    },
    OVERLAYS: {
        [TerrainType.FOREST]: [
            `${WESNOTH_BASE_URL}/terrain/forest/pine-tile.png`,
            `${WESNOTH_BASE_URL}/terrain/forest/deciduous-summer-tile.png`
        ], 
        [TerrainType.JUNGLE]: `${WESNOTH_BASE_URL}/terrain/forest/rainforest-tile.png`, 
        [TerrainType.TAIGA]: `${WESNOTH_BASE_URL}/terrain/forest/snow-forest-tile.png`, 
        [TerrainType.MOUNTAIN]: [
            `${WESNOTH_BASE_URL}/terrain/mountains/basic-tile.png`,
            `${WESNOTH_BASE_URL}/terrain/mountains/dry-tile.png`
        ], 
        [TerrainType.VILLAGE]: `${WESNOTH_BASE_URL}/terrain/village/human-cottage.png`, 
        [TerrainType.CASTLE]: `${WESNOTH_BASE_URL}/terrain/castle/castle.png`, 
        [TerrainType.RUINS]: `${WESNOTH_BASE_URL}/terrain/castle/ruin.png`, 
        [TerrainType.FUNGUS]: `${WESNOTH_BASE_URL}/terrain/cave/fungus-tile.png`,
    },
    TEMPLE_ICON: `${WESNOTH_BASE_URL}/terrain/castle/outside-dwarven/dwarven-keep-tile.png`,
    PORTAL_ICON: `${WESNOTH_BASE_URL}/scenery/summoning-center.png`,
    
    DECORATIONS: {
        GRASS_1: `${MC_BASE_URL}/fern.png`,
        FLOWER_1: `${MC_BASE_URL}/poppy.png`,
        ROCK_1: `${MC_BASE_URL}/cobblestone.png`,
        MUSHROOM: `${MC_BASE_URL}/brown_mushroom.png`
    },
    WEATHER: {
        RAIN: `${WESNOTH_BASE_URL}/weather/rain-heavy.png`,
    },
    PROJECTILES: {
        FIREBALL: `${WESNOTH_BASE_URL}/projectiles/fireball-n.png`,
        ICE: `${WESNOTH_BASE_URL}/projectiles/missile-n.png`,
        ARROW: `${WESNOTH_BASE_URL}/projectiles/missile-n.png`,
        LIGHTNING: `${WESNOTH_BASE_URL}/projectiles/lightning-n.png`,
        MAGIC: `${WESNOTH_BASE_URL}/projectiles/magic-missile-n.png`,
        HOLY: `${WESNOTH_BASE_URL}/projectiles/whitemissile-n.png`,
        DARK: `${WESNOTH_BASE_URL}/projectiles/darkmissile-n.png`,
        CLAW: `${WESNOTH_BASE_URL}/attacks/claws-undead.png`,
    },
    ANIMATIONS: {
        HEAL: [
            `${WESNOTH_BASE_URL}/halo/elven/druid-healing1.png`,
            `${WESNOTH_BASE_URL}/halo/elven/druid-healing2.png`,
            `${WESNOTH_BASE_URL}/halo/elven/druid-healing3.png`,
            `${WESNOTH_BASE_URL}/halo/elven/druid-healing4.png`,
            `${WESNOTH_BASE_URL}/halo/elven/druid-healing5.png`
        ],
        EXPLOSION: [
            `${WESNOTH_BASE_URL}/projectiles/fire-burst-small-1.png`,
            `${WESNOTH_BASE_URL}/projectiles/fire-burst-small-2.png`,
            `${WESNOTH_BASE_URL}/projectiles/fire-burst-small-3.png`,
            `${WESNOTH_BASE_URL}/projectiles/fire-burst-small-4.png`,
        ]
    }
};

export const getSprite = (race: CharacterRace, cls: CharacterClass): string => {
    switch (race) {
        case CharacterRace.ELF: return ASSETS.UNITS.ELF_FIGHTER;
        case CharacterRace.DWARF: return ASSETS.UNITS.DWARF_FIGHTER;
        case CharacterRace.HALFLING: return ASSETS.UNITS.PLAYER_HALFLING;
        case CharacterRace.DRAGONBORN: return ASSETS.UNITS.PLAYER_DRAGONBORN;
        case CharacterRace.GNOME: return ASSETS.UNITS.PLAYER_GNOME;
        case CharacterRace.TIEFLING: return ASSETS.UNITS.PLAYER_TIEFLING;
        case CharacterRace.HALF_ORC: return ASSETS.UNITS.PLAYER_HALF_ORC;
    }
    
    switch(cls) {
        case CharacterClass.WIZARD: return ASSETS.UNITS.PLAYER_WIZARD;
        case CharacterClass.ROGUE: return ASSETS.UNITS.PLAYER_ROGUE;
        case CharacterClass.CLERIC: return ASSETS.UNITS.PLAYER_CLERIC;
        case CharacterClass.BARBARIAN: return ASSETS.UNITS.PLAYER_BARBARIAN;
        case CharacterClass.BARD: return ASSETS.UNITS.PLAYER_BARD;
        case CharacterClass.DRUID: return ASSETS.UNITS.PLAYER_DRUID;
        case CharacterClass.PALADIN: return ASSETS.UNITS.PLAYER_PALADIN;
        case CharacterClass.RANGER: return ASSETS.UNITS.PLAYER_RANGER;
        case CharacterClass.SORCERER: return ASSETS.UNITS.PLAYER_SORCERER;
        case CharacterClass.WARLOCK: return ASSETS.UNITS.PLAYER_WARLOCK;
    }
    
    return ASSETS.UNITS.PLAYER_FIGHTER;
};

export const ITEMS: Record<string, Item> = {
    POTION_HEALING: { id: 'potion_healing', name: 'Healing Potion', type: 'consumable', rarity: ItemRarity.COMMON, description: 'Restores 2d4+2 HP.', icon: `${WESNOTH_BASE_URL}/items/potion-red.png`, effect: { type: 'heal_hp', amount: 0 } },
    POTION_MANA: { id: 'potion_mana', name: 'Mana Potion', type: 'consumable', rarity: ItemRarity.UNCOMMON, description: 'Restores 1 Spell Slot.', icon: `${WESNOTH_BASE_URL}/items/potion-blue.png`, effect: { type: 'restore_mana', amount: 1 } },
    POTION_STRENGTH: { id: 'potion_strength', name: 'Potion of Giant Strength', type: 'consumable', rarity: ItemRarity.RARE, description: 'Increases STR temporarily.', icon: `${WESNOTH_BASE_URL}/items/potion-orange.png`, effect: { type: 'buff_str', amount: 2 } },
    RATION: { id: 'ration', name: 'Ration', type: 'consumable', rarity: ItemRarity.COMMON, description: 'Used to camp and recover fatigue.', icon: `${WESNOTH_BASE_URL}/items/grain-sheaf.png` },
    LONGSWORD: { id: 'longsword', name: 'Longsword', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Versatile melee weapon.', icon: `${WESNOTH_BASE_URL}/items/sword.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.SLASHING, diceCount: 1, diceSides: 8 } },
    GREATAXE: { id: 'greataxe', name: 'Greataxe', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Heavy melee weapon.', icon: `${WESNOTH_BASE_URL}/attacks/battleaxe.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.SLASHING, diceCount: 1, diceSides: 12 } },
    DAGGER: { id: 'dagger', name: 'Dagger', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Light finesse weapon.', icon: `${WESNOTH_BASE_URL}/items/dagger.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.PIERCING, diceCount: 1, diceSides: 4, properties: ['Finesse'] } },
    SHORTSWORD: { id: 'shortsword', name: 'Shortsword', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Light melee weapon.', icon: `${WESNOTH_BASE_URL}/attacks/saber-human.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.PIERCING, diceCount: 1, diceSides: 6, properties: ['Finesse'] } },
    SHORTBOW: { id: 'shortbow', name: 'Shortbow', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Ranged weapon.', icon: `${WESNOTH_BASE_URL}/items/bow.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.PIERCING, diceCount: 1, diceSides: 6, properties: ['Range'] } },
    QUARTERSTAFF: { id: 'quarterstaff', name: 'Quarterstaff', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Simple melee weapon.', icon: `${WESNOTH_BASE_URL}/items/staff.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.BLUDGEONING, diceCount: 1, diceSides: 6 } },
    MACE: { id: 'mace', name: 'Mace', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Simple melee weapon.', icon: `${WESNOTH_BASE_URL}/attacks/mace.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.BLUDGEONING, diceCount: 1, diceSides: 6 } },
    SHIELD: { id: 'shield', name: 'Shield', type: 'equipment', rarity: ItemRarity.COMMON, description: '+2 AC.', icon: `${WESNOTH_BASE_URL}/items/shield.png`, equipmentStats: { slot: EquipmentSlot.OFF_HAND, ac: 2 } },
    LEATHER_ARMOR: { id: 'leather_armor', name: 'Leather Armor', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Light armor (AC 11).', icon: `${WESNOTH_BASE_URL}/items/armor.png`, equipmentStats: { slot: EquipmentSlot.BODY, ac: 11 } },
    CHAIN_SHIRT: { id: 'chain_shirt', name: 'Chain Shirt', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Medium armor (AC 13).', icon: `${WESNOTH_BASE_URL}/items/armor.png`, equipmentStats: { slot: EquipmentSlot.BODY, ac: 13 } },
    CHAIN_MAIL: { id: 'chain_mail', name: 'Chain Mail', type: 'equipment', rarity: ItemRarity.COMMON, description: 'Heavy armor (AC 16).', icon: `${WESNOTH_BASE_URL}/items/armor.png`, equipmentStats: { slot: EquipmentSlot.BODY, ac: 16 } },
    FLAME_TONGUE: { id: 'flame_tongue', name: 'Flame Tongue', type: 'equipment', rarity: ItemRarity.RARE, description: 'Magic sword that deals fire damage.', icon: `${WESNOTH_BASE_URL}/items/sword-flaming.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.FIRE, diceCount: 2, diceSides: 6, properties: ['Magical'] } },
    VORPAL_SWORD: { id: 'vorpal_sword', name: 'Vorpal Sword', type: 'equipment', rarity: ItemRarity.LEGENDARY, description: '+3 Weapon. Decapitates on crit.', icon: `${WESNOTH_BASE_URL}/items/sword-holy.png`, equipmentStats: { slot: EquipmentSlot.MAIN_HAND, damageType: DamageType.SLASHING, diceCount: 1, diceSides: 8, properties: ['Magical'] }, flavorText: 'Snicker-snack!' },
    SACRED_ELIXIR: { id: 'sacred_elixir', name: 'Sacred Elixir', type: 'consumable', rarity: ItemRarity.LEGENDARY, description: 'Fully restores HP and cures corruption.', icon: `${WESNOTH_BASE_URL}/items/holy-water.png`, flavorText: 'Tears of a forgotten god.' }
};

export const SPELLS: Record<string, Spell> = {
    'magic_missile': { id: 'magic_missile', name: 'Magic Missile', level: 1, range: 6, type: SpellType.DAMAGE, damageType: DamageType.FORCE, diceCount: 3, diceSides: 4, description: 'Create 3 glowing darts of magical force.', animation: 'MAGIC', icon: `${WESNOTH_BASE_URL}/projectiles/magic-missile-n.png` },
    'cure_wounds': { id: 'cure_wounds', name: 'Cure Wounds', level: 1, range: 1, type: SpellType.HEAL, diceCount: 1, diceSides: 8, description: 'A creature you touch regains hit points.', animation: 'HEAL', icon: `${WESNOTH_BASE_URL}/halo/elven/druid-healing5.png` },
    'fireball': { id: 'fireball', name: 'Fireball', level: 3, range: 8, type: SpellType.DAMAGE, damageType: DamageType.FIRE, diceCount: 8, diceSides: 6, aoeRadius: 2, aoeType: 'CIRCLE', description: 'A bright streak flashes to a point you choose then blossoms.', animation: 'EXPLOSION', icon: `${WESNOTH_BASE_URL}/projectiles/fireball-n.png` },
    'guiding_bolt': { id: 'guiding_bolt', name: 'Guiding Bolt', level: 1, range: 6, type: SpellType.DAMAGE, damageType: DamageType.RADIANT, diceCount: 4, diceSides: 6, description: 'A flash of light streaks toward a creature.', animation: 'HOLY', icon: `${WESNOTH_BASE_URL}/projectiles/whitemissile-n.png` },
    'healing_word': { id: 'healing_word', name: 'Healing Word', level: 1, range: 6, type: SpellType.HEAL, diceCount: 1, diceSides: 4, description: 'A creature of your choice regains hit points. Bonus Action.', animation: 'HEAL', icon: `${WESNOTH_BASE_URL}/halo/elven/druid-healing5.png` }
};

export const SKILLS: Record<string, Skill> = {
    'second_wind': { id: 'second_wind', name: 'Second Wind', description: 'Regain HP.', staminaCost: 5, cooldown: 3, range: 0, damageMultiplier: 0, effect: 'HEAL_SELF', isBonusAction: true, icon: '' },
    'action_surge': { id: 'action_surge', name: 'Action Surge', description: 'Take an additional action.', staminaCost: 10, cooldown: 5, range: 0, damageMultiplier: 0, effect: 'ACTION_RESET', icon: '' },
    'sneak_attack': { id: 'sneak_attack', name: 'Sneak Attack', description: 'Deal extra damage to distracted enemies.', staminaCost: 0, cooldown: 0, range: 0, damageMultiplier: 0, effect: 'PASSIVE', icon: '' },
    'rage': { id: 'rage', name: 'Rage', description: 'Advantage on STR, resistance to physical damage.', staminaCost: 5, cooldown: 10, range: 0, damageMultiplier: 0, effect: 'APPLY_EFFECT', statusEffect: 'RAGE', isBonusAction: true, icon: '' },
    'bardic_inspiration': { id: 'bardic_inspiration', name: 'Bardic Inspiration', description: 'Grant an ally a bonus die.', staminaCost: 3, cooldown: 3, range: 6, damageMultiplier: 0, effect: 'APPLY_EFFECT', statusEffect: 'BARDIC', isBonusAction: true, icon: '' },
    'wild_shape': { id: 'wild_shape', name: 'Wild Shape', description: 'Transform into a beast.', staminaCost: 10, cooldown: 20, range: 0, damageMultiplier: 0, effect: 'TRANSFORM', icon: '' },
    'lay_on_hands': { id: 'lay_on_hands', name: 'Lay on Hands', description: 'Heal a creature.', staminaCost: 5, cooldown: 5, range: 1, damageMultiplier: 0, effect: 'HEAL_SELF', icon: '' }, // Can target self or other
    'smite': { id: 'smite', name: 'Divine Smite', description: 'Expend spell slot for radiant damage.', staminaCost: 0, cooldown: 0, range: 0, damageMultiplier: 0, effect: 'PASSIVE_TRIGGER', icon: '' },
    'misty_step': { id: 'misty_step', name: 'Misty Step', description: 'Teleport 6 tiles.', staminaCost: 5, cooldown: 3, range: 6, damageMultiplier: 0, effect: 'TELEPORT', isBonusAction: true, icon: '' }
};

export const CLASS_TREES: Record<CharacterClass, ProgressionNode[]> = {
    [CharacterClass.FIGHTER]: [
        { level: 1, featureName: 'Fighting Style', description: 'Specialized combat training.', passiveEffect: 'FIGHTING_STYLE' },
        { level: 1, featureName: 'Second Wind', description: 'Heal yourself in battle.', unlocksSkill: 'second_wind' },
        { level: 2, featureName: 'Action Surge', description: 'Act twice in a turn.', unlocksSkill: 'action_surge' },
        { level: 5, featureName: 'Extra Attack', description: 'Attack twice per action.', passiveEffect: 'EXTRA_ATTACK' }
    ],
    [CharacterClass.ROGUE]: [
        { level: 1, featureName: 'Sneak Attack', description: 'Extra damage on advantage.', passiveEffect: 'SNEAK_ATTACK' },
        { level: 2, featureName: 'Cunning Action', description: 'Dash/Disengage as bonus.', unlocksSkill: 'cunning_action' } // Placeholder skill
    ],
    [CharacterClass.WIZARD]: [
        { level: 1, featureName: 'Spellcasting', description: 'Cast wizard spells.', unlocksSpell: 'magic_missile' },
        { level: 5, featureName: 'Fireball', description: 'Explosive fire magic.', unlocksSpell: 'fireball' }
    ],
    [CharacterClass.CLERIC]: [
        { level: 1, featureName: 'Spellcasting', description: 'Cast cleric spells.', unlocksSpell: 'cure_wounds' },
        { level: 1, featureName: 'Guiding Bolt', description: 'Radiant damage.', unlocksSpell: 'guiding_bolt' }
    ],
    [CharacterClass.BARBARIAN]: [
        { level: 1, featureName: 'Rage', description: 'Enter a battle frenzy.', unlocksSkill: 'rage' }
    ],
    [CharacterClass.PALADIN]: [
        { level: 1, featureName: 'Lay on Hands', description: 'Healing touch.', unlocksSkill: 'lay_on_hands' },
        { level: 2, featureName: 'Divine Smite', description: 'Radiant weapon strikes.', unlocksSkill: 'smite' }
    ],
    [CharacterClass.RANGER]: [
        { level: 2, featureName: 'Spellcasting', description: 'Nature magic.', unlocksSpell: 'cure_wounds' },
        { level: 2, featureName: 'Hunters Mark', description: 'Mark foes for damage.', unlocksSpell: 'hunters_mark' } // Placeholder
    ],
    [CharacterClass.BARD]: [
        { level: 1, featureName: 'Bardic Inspiration', description: 'Inspire allies.', unlocksSkill: 'bardic_inspiration' },
        { level: 1, featureName: 'Healing Word', description: 'Ranged healing.', unlocksSpell: 'healing_word' }
    ],
    [CharacterClass.DRUID]: [
        { level: 1, featureName: 'Spellcasting', description: 'Nature magic.', unlocksSpell: 'cure_wounds' },
        { level: 2, featureName: 'Wild Shape', description: 'Transform into beasts.', unlocksSkill: 'wild_shape' }
    ],
    [CharacterClass.SORCERER]: [
        { level: 1, featureName: 'Spellcasting', description: 'Innate magic.', unlocksSpell: 'magic_missile' }
    ],
    [CharacterClass.WARLOCK]: [
        { level: 1, featureName: 'Pact Magic', description: 'Eldritch power.', unlocksSpell: 'eldritch_blast' }, // Placeholder
        { level: 3, featureName: 'Misty Step', description: 'Teleport.', unlocksSkill: 'misty_step' }
    ]
};

export const RACE_SKILLS: Record<CharacterRace, string[]> = {
    [CharacterRace.HUMAN]: [],
    [CharacterRace.ELF]: [], // Could add Perception proficiency
    [CharacterRace.DWARF]: [],
    [CharacterRace.HALFLING]: [], // Lucky is passive
    [CharacterRace.DRAGONBORN]: ['breath_weapon'], // Placeholder
    [CharacterRace.GNOME]: [],
    [CharacterRace.TIEFLING]: ['hellish_rebuke'], // Placeholder
    [CharacterRace.HALF_ORC]: []
};
