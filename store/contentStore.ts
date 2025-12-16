
import { create } from 'zustand';
import { ITEMS, BASE_STATS, ASSETS, SPELLS, SKILLS, SUMMON_DEFINITIONS } from '../constants';
import { Item, CharacterClass, TerrainType, CreatureType, DamageType, Dimension, Spell, Skill, EnemyDefinition, LootEntry } from '../types';
import { getSupabase } from '../services/supabaseClient';

interface GameConfig {
    mapScale: number;
    moistureOffset: number;
    tempOffset: number;
}

interface ContentState {
    items: Record<string, Item>;
    spells: Record<string, Spell>;
    skills: Record<string, Skill>;
    classStats: Record<CharacterClass, any>;
    gameConfig: GameConfig;
    
    // Dynamic Enemy Data
    enemies: Record<string, EnemyDefinition>;
    encounters: Partial<Record<TerrainType, string[]>>; // Terrain -> List of Enemy IDs

    isLoading: boolean;

    // Actions
    updateItem: (id: string, data: Item) => void;
    createItem: (item: Item) => void;
    deleteItem: (id: string) => void;
    
    updateEnemy: (id: string, data: EnemyDefinition) => void;
    createEnemy: (enemy: EnemyDefinition) => void;
    deleteEnemy: (id: string) => void;
    
    updateSpell: (id: string, data: Spell) => void;
    createSpell: (spell: Spell) => void;
    deleteSpell: (id: string) => void;

    updateSkill: (id: string, data: Skill) => void;
    createSkill: (skill: Skill) => void;
    deleteSkill: (id: string) => void;
    
    updateEncounterTable: (terrain: TerrainType, enemyIds: string[]) => void;

    updateClassStats: (cls: CharacterClass, stats: any) => void;
    updateConfig: (config: Partial<GameConfig>) => void;
    
    // Cloud Sync Actions
    fetchContentFromCloud: () => Promise<void>;
    publishContentToCloud: () => Promise<void>;
    resetToDefaults: () => void;
    
    exportData: () => string;
}

// ... (DEFAULT_ENEMIES and DEFAULT_ENCOUNTERS remain unchanged, assuming implicit inclusion from previous step context or kept for brevity if this is a patch)
// Since I must output full content for the file, I will include the defaults again to be safe.

const DEFAULT_ENEMIES: Record<string, EnemyDefinition> = {
    'goblin_spearman': { 
        id: 'goblin_spearman', name: 'Goblin', type: CreatureType.HUMANOID, sprite: ASSETS.UNITS.GOBLIN, 
        hp: 7, ac: 15, xpReward: 50, damage: 5, initiativeBonus: 2,
        attackDamageType: DamageType.PIERCING,
        lootTable: [{ itemId: 'dagger', chance: 0.1 }],
        validDimensions: [Dimension.NORMAL]
    },
    'skeleton': { 
        id: 'skeleton', name: 'Skeleton', type: CreatureType.UNDEAD, sprite: ASSETS.UNITS.SKELETON, 
        hp: 13, ac: 13, xpReward: 50, damage: 5, initiativeBonus: 2,
        attackDamageType: DamageType.PIERCING, 
        vulnerabilities: [DamageType.BLUDGEONING],
        immunities: [DamageType.POISON],
        lootTable: [{ itemId: 'shortsword', chance: 0.05 }],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'skeleton_archer': { 
        id: 'skeleton_archer', name: 'Skel. Archer', type: CreatureType.UNDEAD, sprite: ASSETS.UNITS.SKELETON_ARCHER, 
        hp: 13, ac: 13, xpReward: 50, damage: 6, initiativeBonus: 2,
        attackDamageType: DamageType.PIERCING, 
        vulnerabilities: [DamageType.BLUDGEONING],
        immunities: [DamageType.POISON],
        lootTable: [{ itemId: 'shortbow', chance: 0.1 }],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'zombie': { 
        id: 'zombie', name: 'Zombie', type: CreatureType.UNDEAD, sprite: ASSETS.UNITS.ZOMBIE, 
        hp: 22, ac: 8, xpReward: 50, damage: 4, initiativeBonus: -2,
        attackDamageType: DamageType.BLUDGEONING, 
        immunities: [DamageType.POISON],
        resistances: [DamageType.PIERCING], 
        lootTable: [],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'giant_bat': { 
        id: 'giant_bat', name: 'Giant Bat', type: CreatureType.BEAST, sprite: ASSETS.UNITS.BAT, 
        hp: 22, ac: 13, xpReward: 50, damage: 5, initiativeBonus: 3,
        attackDamageType: DamageType.PIERCING,
        lootTable: [],
        validDimensions: [Dimension.NORMAL]
    },
    'mud_crawler': {
        id: 'mud_crawler', name: 'Mud Mephit', type: CreatureType.ELEMENTAL, sprite: ASSETS.UNITS.MUD_CRAWLER,
        hp: 27, ac: 11, xpReward: 100, damage: 4, initiativeBonus: 1,
        attackDamageType: DamageType.BLUDGEONING,
        immunities: [DamageType.POISON],
        lootTable: [],
        validDimensions: [Dimension.NORMAL]
    },
    'orc_grunt': { 
        id: 'orc_grunt', name: 'Orc Warrior', type: CreatureType.HUMANOID, sprite: ASSETS.UNITS.ORC, 
        hp: 15, ac: 13, xpReward: 100, damage: 9, initiativeBonus: 1,
        attackDamageType: DamageType.SLASHING, 
        lootTable: [{ itemId: 'greataxe', chance: 0.1 }],
        validDimensions: [Dimension.NORMAL]
    },
    'orc_archer': { 
        id: 'orc_archer', name: 'Orc Archer', type: CreatureType.HUMANOID, sprite: ASSETS.UNITS.ORC_ARCHER, 
        hp: 15, ac: 13, xpReward: 100, damage: 7, initiativeBonus: 1,
        attackDamageType: DamageType.PIERCING, 
        lootTable: [{ itemId: 'shortbow', chance: 0.15 }],
        validDimensions: [Dimension.NORMAL]
    },
    'dire_wolf': { 
        id: 'dire_wolf', name: 'Dire Wolf', type: CreatureType.BEAST, sprite: ASSETS.UNITS.WOLF, 
        hp: 37, ac: 14, xpReward: 200, damage: 10, initiativeBonus: 2,
        attackDamageType: DamageType.PIERCING,
        lootTable: [],
        validDimensions: [Dimension.NORMAL]
    },
    'giant_spider': { 
        id: 'giant_spider', name: 'Giant Spider', type: CreatureType.BEAST, sprite: ASSETS.UNITS.SPIDER, 
        hp: 26, ac: 14, xpReward: 200, damage: 7, initiativeBonus: 3,
        attackDamageType: DamageType.POISON,
        lootTable: [],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'ghoul': { 
        id: 'ghoul', name: 'Ghoul', type: CreatureType.UNDEAD, sprite: ASSETS.UNITS.GHOUL, 
        hp: 22, ac: 12, xpReward: 200, damage: 7, initiativeBonus: 2,
        attackDamageType: DamageType.NECROTIC, 
        immunities: [DamageType.POISON],
        lootTable: [],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'cultist_sorcerer': { 
        id: 'cultist_sorcerer', name: 'Dark Acolyte', type: CreatureType.HUMANOID, sprite: ASSETS.UNITS.NECROMANCER, 
        hp: 22, ac: 12, xpReward: 250, damage: 8, initiativeBonus: 1,
        attackDamageType: DamageType.NECROTIC, 
        resistances: [DamageType.NECROTIC],
        lootTable: [{ itemId: 'potion_mana', chance: 0.3 }],
        validDimensions: [Dimension.NORMAL]
    },
    'troll': { 
        id: 'troll', name: 'Cave Troll', type: CreatureType.GIANT, sprite: ASSETS.UNITS.TROLL, 
        hp: 84, ac: 15, xpReward: 1800, damage: 14, initiativeBonus: 1,
        attackDamageType: DamageType.SLASHING, 
        vulnerabilities: [DamageType.FIRE, DamageType.ACID], 
        lootTable: [{ itemId: 'potion_strength', chance: 0.2 }],
        validDimensions: [Dimension.NORMAL]
    },
    'fire_elemental': { 
        id: 'fire_elemental', name: 'Fire Elemental', type: CreatureType.ELEMENTAL, sprite: `${ASSETS.WESNOTH_BASE_URL}/units/monsters/fire-elemental.png`, 
        hp: 65, ac: 13, xpReward: 1500, damage: 12, initiativeBonus: 3,
        attackDamageType: DamageType.FIRE,
        immunities: [DamageType.FIRE, DamageType.POISON],
        vulnerabilities: [DamageType.COLD],
        resistances: [DamageType.BLUDGEONING, DamageType.PIERCING, DamageType.SLASHING], 
        lootTable: [{ itemId: 'flame_tongue', chance: 0.05 }],
        validDimensions: [Dimension.NORMAL, Dimension.UPSIDE_DOWN]
    },
    'mind_flayer': { 
        id: 'mind_flayer', name: 'Mind Flayer', type: CreatureType.ABERRATION, sprite: `${ASSETS.WESNOTH_BASE_URL}/units/undead-necromancers/ancient-lich.png`, 
        hp: 71, ac: 15, xpReward: 2900, damage: 15, initiativeBonus: 3,
        attackDamageType: DamageType.PSYCHIC,
        resistances: [DamageType.MAGIC], 
        lootTable: [{ itemId: 'potion_mana', chance: 0.5 }],
        validDimensions: [Dimension.UPSIDE_DOWN] 
    },
    'shadow_stalker': { 
        id: 'shadow_stalker', name: 'Shadow Stalker', type: CreatureType.FIEND,
        sprite: ASSETS.UNITS.SHADOW, // UPDATED TO USE CORRECT CONSTANT
        hp: 40, ac: 14, xpReward: 450, damage: 10, initiativeBonus: 4,
        attackDamageType: DamageType.NECROTIC, 
        resistances: [DamageType.BLUDGEONING, DamageType.PIERCING, DamageType.SLASHING],
        vulnerabilities: [DamageType.RADIANT],
        validDimensions: [Dimension.UPSIDE_DOWN]
    },
    'abyssal_horror': { 
        id: 'abyssal_horror', name: 'Abyssal Horror', type: CreatureType.ABERRATION,
        sprite: `${ASSETS.WESNOTH_BASE_URL}/units/monsters/cuttlefish.png`, 
        hp: 130, ac: 16, xpReward: 5000, damage: 18, initiativeBonus: 2,
        attackDamageType: DamageType.ACID,
        resistances: [DamageType.COLD, DamageType.LIGHTNING],
        immunities: [DamageType.PSYCHIC],
        lootTable: [{ itemId: 'vorpal_sword', chance: 0.1 }],
        validDimensions: [Dimension.UPSIDE_DOWN]
    },
    'lich_lord': { 
        id: 'lich_lord', name: 'Lich Lord', type: CreatureType.UNDEAD, sprite: ASSETS.UNITS.LICH, 
        hp: 135, ac: 17, xpReward: 10000, damage: 20, initiativeBonus: 3,
        attackDamageType: DamageType.NECROTIC, 
        resistances: [DamageType.COLD, DamageType.LIGHTNING],
        immunities: [DamageType.POISON, DamageType.BLUDGEONING, DamageType.PIERCING, DamageType.SLASHING],
        vulnerabilities: [DamageType.RADIANT],
        lootTable: [{ itemId: 'sacred_elixir', chance: 1.0 }, { itemId: 'vorpal_sword', chance: 0.5 }],
        validDimensions: [Dimension.UPSIDE_DOWN]
    }
};

const DEFAULT_ENCOUNTERS: Partial<Record<TerrainType, string[]>> = {
    [TerrainType.GRASS]: ['goblin_spearman', 'giant_bat', 'mud_crawler'],
    [TerrainType.PLAINS]: ['goblin_spearman', 'orc_grunt', 'dire_wolf'],
    [TerrainType.FOREST]: ['goblin_spearman', 'dire_wolf', 'giant_spider', 'orc_archer'],
    [TerrainType.JUNGLE]: ['giant_spider', 'zombie', 'orc_grunt'],
    [TerrainType.MOUNTAIN]: ['orc_grunt', 'orc_archer', 'giant_bat', 'troll'],
    [TerrainType.SWAMP]: ['zombie', 'ghoul', 'mud_crawler', 'giant_spider'],
    [TerrainType.RUINS]: ['skeleton', 'skeleton_archer', 'ghoul', 'cultist_sorcerer'],
    [TerrainType.DESERT]: ['skeleton', 'fire_elemental', 'giant_spider'],
    [TerrainType.TUNDRA]: ['dire_wolf', 'troll', 'orc_grunt'],
    [TerrainType.CAVE_FLOOR]: ['shadow_stalker', 'mind_flayer'], 
    [TerrainType.FUNGUS]: ['shadow_stalker', 'abyssal_horror'],
    [TerrainType.CHASM]: ['shadow_stalker', 'fire_elemental', 'abyssal_horror'],
    [TerrainType.LAVA]: ['fire_elemental', 'lich_lord'],
    [TerrainType.BADLANDS]: ['skeleton', 'ghoul', 'mind_flayer'],
};

// Normalize Data by ID for Store Consistency
const normalizeById = <T extends { id: string }>(record: Record<string, T>): Record<string, T> => {
    return Object.values(record).reduce((acc, item) => {
        acc[item.id] = item;
        return acc;
    }, {} as Record<string, T>);
};

const normalizedItems = normalizeById(ITEMS);
const normalizedSpells = normalizeById(SPELLS);
const normalizedSkills = normalizeById(SKILLS);
const normalizedSummons = normalizeById(SUMMON_DEFINITIONS);

const fullBestiary = { ...DEFAULT_ENEMIES, ...normalizedSummons };

const initialState = {
    items: normalizedItems,
    spells: normalizedSpells,
    skills: normalizedSkills,
    classStats: { ...BASE_STATS },
    gameConfig: { mapScale: 0.12, moistureOffset: 150, tempOffset: 300 },
    enemies: fullBestiary,
    encounters: DEFAULT_ENCOUNTERS,
    isLoading: false
};

export const useContentStore = create<ContentState>((set, get) => ({
    ...initialState,
    updateItem: (id, data) => set(state => ({ items: { ...state.items, [id]: data } })),
    createItem: (item) => set(state => ({ items: { ...state.items, [item.id]: item } })),
    deleteItem: (id) => set(state => { const n = { ...state.items }; delete n[id]; return { items: n }; }),
    updateEnemy: (id, data) => set(state => ({ enemies: { ...state.enemies, [id]: data } })),
    createEnemy: (enemy) => set(state => ({ enemies: { ...state.enemies, [enemy.id]: enemy } })),
    deleteEnemy: (id) => set(state => { const n = { ...state.enemies }; delete n[id]; return { enemies: n }; }),
    
    updateSpell: (id, data) => set(state => ({ spells: { ...state.spells, [id]: data } })),
    createSpell: (spell) => set(state => ({ spells: { ...state.spells, [spell.id]: spell } })),
    deleteSpell: (id) => set(state => { const n = { ...state.spells }; delete n[id]; return { spells: n }; }),

    updateSkill: (id, data) => set(state => ({ skills: { ...state.skills, [id]: data } })),
    createSkill: (skill) => set(state => ({ skills: { ...state.skills, [skill.id]: skill } })),
    deleteSkill: (id) => set(state => { const n = { ...state.skills }; delete n[id]; return { skills: n }; }),

    updateEncounterTable: (terrain, enemyIds) => set(state => ({ encounters: { ...state.encounters, [terrain]: enemyIds } })),
    updateClassStats: (cls, stats) => set(state => ({ classStats: { ...state.classStats, [cls]: stats } })),
    updateConfig: (config) => set(state => ({ gameConfig: { ...state.gameConfig, ...config } })),
    
    fetchContentFromCloud: async () => {
        const supabase = getSupabase();
        if (!supabase) return;
        set({ isLoading: true });
        try {
            const { data, error } = await supabase.from('game_definitions').select('*');
            if (error) throw error;
            if (data) {
                const newItems: Record<string, Item> = { ...normalizedItems };
                const newEnemies: Record<string, EnemyDefinition> = { ...fullBestiary };
                const newSpells: Record<string, Spell> = { ...normalizedSpells };
                const newSkills: Record<string, Skill> = { ...normalizedSkills };
                
                data.forEach((row: any) => {
                    if (row.category === 'ITEM') newItems[row.id] = row.data;
                    if (row.category === 'ENEMY') newEnemies[row.id] = row.data;
                    if (row.category === 'SPELL') newSpells[row.id] = row.data;
                    if (row.category === 'SKILL') newSkills[row.id] = row.data;
                });
                
                set({ items: newItems, enemies: newEnemies, spells: newSpells, skills: newSkills, isLoading: false });
                console.log("Content synced from Supabase.");
            }
        } catch (e) {
            console.error("Failed to fetch cloud content:", e);
            set({ isLoading: false });
        }
    },

    publishContentToCloud: async () => {
        const supabase = getSupabase();
        if (!supabase) { alert("Supabase not configured or available."); return; }
        const state = get();
        const { items, enemies, spells, skills } = state;
        set({ isLoading: true });
        const rows = [
            ...Object.values(items).map((i: Item) => ({ id: i.id, category: 'ITEM', data: i })),
            ...Object.values(enemies).map((e: EnemyDefinition) => ({ id: e.id, category: 'ENEMY', data: e })),
            ...Object.values(spells).map((s: Spell) => ({ id: s.id, category: 'SPELL', data: s })),
            ...Object.values(skills).map((s: Skill) => ({ id: s.id, category: 'SKILL', data: s })),
        ];
        try {
            const { error } = await supabase.from('game_definitions').upsert(rows, { onConflict: 'id' });
            if (error) throw error;
            alert("Successfully published content to Cloud Database!");
        } catch (e: any) {
            console.error("Failed to publish content:", e);
            alert(`Upload failed: ${e.message}`);
        } finally {
            set({ isLoading: false });
        }
    },

    resetToDefaults: () => {
        set(initialState);
        localStorage.removeItem('epic_earth_admin_data');
    },

    exportData: () => {
        const state = get();
        return JSON.stringify({
            items: state.items,
            enemies: state.enemies,
            spells: state.spells,
            skills: state.skills,
            classStats: state.classStats,
            gameConfig: state.gameConfig
        }, null, 2);
    }
}));
