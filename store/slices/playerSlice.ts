
import { StateCreator } from 'zustand';
import { CharacterRace, CharacterClass, Attributes, Difficulty, EquipmentSlot, Item, Ability, Entity, CombatStatsComponent, VisualComponent, Dimension, GameState, CreatureType, ItemRarity } from '../../types';
import { calculateHp, getModifier, calculateVisionRange, getCorruptionPenalty, rollDice } from '../../services/dndRules';
import { BASE_STATS, RACE_BONUS, XP_TABLE, getSprite, CLASS_TREES, RACE_SKILLS } from '../../constants';
import { sfx } from '../../services/SoundSystem';
import { SummoningService } from '../../services/SummoningService';
import { useContentStore } from '../contentStore';

export interface PlayerSlice {
  party: (Entity & { stats: CombatStatsComponent, visual: VisualComponent })[];
  characterPool: (Entity & { stats: CombatStatsComponent, visual: VisualComponent })[]; // Reserves
  createCharacter: (name: string, race: CharacterRace, cls: CharacterClass, stats: Attributes, difficulty: Difficulty) => void;
  recalculateStats: (entity: Entity & { stats: CombatStatsComponent }) => CombatStatsComponent;
  applyLevelUp: (characterId: string, bonusAttributes: Partial<Attributes>) => void;
  summonCharacter: (seed: string, method: 'FORCE' | 'STABILIZE') => void;
  swapPartyMember: (partyIndex: number, poolIndex: number) => void;
  addToParty: (poolIndex: number) => void;
  removeFromParty: (partyIndex: number) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getCasterSlots = (cls: CharacterClass, level: number) => {
    if ([CharacterClass.WIZARD, CharacterClass.CLERIC, CharacterClass.DRUID, CharacterClass.SORCERER, CharacterClass.BARD].includes(cls)) return { current: level + 1, max: level + 1 }; 
    if (cls === CharacterClass.WARLOCK) return { current: Math.ceil(level/2), max: Math.ceil(level/2) };
    if ([CharacterClass.PALADIN, CharacterClass.RANGER].includes(cls)) return { current: Math.floor(level/2), max: Math.floor(level/2) };
    return { current: 0, max: 0 };
}

const getHitDie = (cls: CharacterClass) => {
    if (cls === CharacterClass.BARBARIAN) return 12;
    if ([CharacterClass.FIGHTER, CharacterClass.PALADIN, CharacterClass.RANGER].includes(cls)) return 10;
    if ([CharacterClass.WIZARD, CharacterClass.SORCERER].includes(cls)) return 6;
    return 8; 
}

const calculateMaxStamina = (con: number, level: number) => {
    return 10 + getModifier(con) + Math.floor(level / 2);
}

// --- STATS PIPELINE STRATEGIES ---

type StatModifier = (stats: CombatStatsComponent, entity: Entity) => CombatStatsComponent;

const BaseStatsModifier: StatModifier = (stats, entity) => {
    // Recalculate basics derived from Attributes and Level
    const conMod = getModifier(stats.attributes.CON);
    const hitDie = getHitDie(stats.class);
    
    // Base HP calculation
    const baseHp = calculateHp(stats.level, stats.attributes.CON, hitDie, stats.race);
    
    // Base Stamina
    const baseStamina = calculateMaxStamina(stats.attributes.CON, stats.level);

    return {
        ...stats,
        maxHp: baseHp,
        maxStamina: baseStamina,
        initiativeBonus: getModifier(stats.attributes.DEX)
    };
};

const RaceModifier: StatModifier = (stats, entity) => {
    let speed = 30;
    let staminaBonus = 0;

    switch (stats.race) {
        case CharacterRace.ELF: 
            speed = 35; 
            break;
        case CharacterRace.DWARF: 
        case CharacterRace.HALFLING: 
            speed = 25; 
            break;
        case CharacterRace.HUMAN:
            staminaBonus = 3;
            break;
    }

    return {
        ...stats,
        speed,
        maxStamina: stats.maxStamina + staminaBonus
    };
};

const EquipmentModifier: StatModifier = (stats, entity) => {
    let armorAc = 10; // Base unarmored
    let shieldBonus = 0;
    let attributeBonuses: Partial<Attributes> = {};

    Object.values(entity.equipment || {}).forEach((item: any) => {
        if (!item || !item.equipmentStats) return;
        
        // Attributes (e.g. Belt of Giant Strength)
        if (item.equipmentStats.modifiers) {
            Object.entries(item.equipmentStats.modifiers).forEach(([key, val]) => { 
                if (val) attributeBonuses[key as keyof Attributes] = (attributeBonuses[key as keyof Attributes] || 0) + (val as number); 
            });
        }
        
        // AC
        if (item.equipmentStats.slot === EquipmentSlot.BODY && item.equipmentStats.ac) {
            armorAc = item.equipmentStats.ac;
        }
        if (item.equipmentStats.slot === EquipmentSlot.OFF_HAND && item.equipmentStats.ac) {
            shieldBonus = item.equipmentStats.ac;
        }
    });

    // Apply Attribute bonuses first as they affect DEX mod
    const newAttributes = { ...stats.attributes };
    Object.entries(attributeBonuses).forEach(([k, v]) => {
        // @ts-ignore
        newAttributes[k] += v;
    });

    // Calculate AC with Armor rules
    let dexMod = getModifier(newAttributes.DEX);
    if (armorAc >= 16) dexMod = 0; // Heavy Armor: No Dex
    else if (armorAc >= 13) dexMod = Math.min(2, dexMod); // Medium Armor: Max 2 Dex

    return {
        ...stats,
        attributes: newAttributes,
        ac: armorAc + dexMod + shieldBonus
    };
};

const ClassModifier: StatModifier = (stats, entity) => {
    let acBonus = 0;
    
    // Fighter Defense Style: +1 AC if wearing armor
    const hasArmor = entity.equipment?.[EquipmentSlot.BODY] !== undefined;
    if (stats.class === CharacterClass.FIGHTER && hasArmor) {
        acBonus += 1;
    }

    // Barbarian Unarmored Defense (CON to AC) if no armor
    if (stats.class === CharacterClass.BARBARIAN && !hasArmor) {
        const conMod = getModifier(stats.attributes.CON);
        acBonus += conMod;
    }

    // Monk Unarmored Defense (WIS to AC) if no armor (Future proofing)
    // if (stats.class === 'MONK' && !hasArmor) acBonus += getModifier(stats.attributes.WIS);

    return {
        ...stats,
        ac: stats.ac + acBonus
    };
};

const EffectModifier: StatModifier = (stats, entity) => {
    // Corruption Penalties
    const { acPenalty, maxHpPenalty } = getCorruptionPenalty(stats.corruption || 0);
    
    // Status Effects
    let acBonus = 0;
    if (stats.statusEffects?.['SHIELD']) acBonus += 5;
    if (stats.statusEffects?.['STONE_SKIN']) acBonus += 2;

    return {
        ...stats,
        ac: Math.max(0, stats.ac + acBonus - acPenalty),
        maxHp: Math.max(1, stats.maxHp - maxHpPenalty)
    };
};

// Pipeline runner
const runStatsPipeline = (entity: Entity & { stats: CombatStatsComponent }): CombatStatsComponent => {
    // Reset attributes to base before recalculating to avoid infinite stacking
    const initialStats = { ...entity.stats, attributes: { ...entity.stats.baseAttributes } };
    
    const modifiers = [
        BaseStatsModifier,
        RaceModifier,
        EquipmentModifier,
        ClassModifier,
        EffectModifier
    ];

    return modifiers.reduce((currentStats, modifier) => modifier(currentStats, entity), initialStats);
};


// Helper to get features unlocked up to a certain level
const getUnlockedFeatures = (cls: CharacterClass, race: CharacterRace, level: number) => {
    const tree = CLASS_TREES[cls] || [];
    const skills: string[] = [];
    const spells: string[] = [];
    let maxActions = 1;

    // Class Features
    tree.forEach(node => {
        if (node.level <= level) {
            if (node.unlocksSkill) skills.push(node.unlocksSkill);
            if (node.unlocksSpell) spells.push(node.unlocksSpell);
            if (node.passiveEffect === 'EXTRA_ATTACK') maxActions = 2;
        }
    });

    // Racial Skills (Always unlocked at level 1 for now)
    const racialSkills = RACE_SKILLS[race] || [];
    racialSkills.forEach(s => skills.push(s));

    return { skills, spells, maxActions };
};

const generateCompanion = (name: string, race: CharacterRace, cls: CharacterClass, level: number): (Entity & { stats: CombatStatsComponent, visual: VisualComponent }) => {
    const contentState = useContentStore.getState();
    const items = contentState.items;

    const baseStats = { ...BASE_STATS[cls] };
    const bonus = RACE_BONUS[race];
    (Object.keys(baseStats) as Ability[]).forEach(k => { if (bonus[k]) baseStats[k] += bonus[k]!; });
    const maxHp = calculateHp(level, baseStats.CON, getHitDie(cls), race);
    const maxStamina = calculateMaxStamina(baseStats.CON, level);
    
    const equipment: Partial<Record<EquipmentSlot, Item>> = {};
    
    // Dynamic Item Lookup
    if (cls === CharacterClass.FIGHTER || cls === CharacterClass.PALADIN) { 
        equipment[EquipmentSlot.MAIN_HAND] = items['longsword']; 
        equipment[EquipmentSlot.BODY] = items['chain_mail']; 
        equipment[EquipmentSlot.OFF_HAND] = items['shield']; 
    } 
    else if (cls === CharacterClass.BARBARIAN) { equipment[EquipmentSlot.MAIN_HAND] = items['greataxe']; } 
    else if (cls === CharacterClass.ROGUE) { equipment[EquipmentSlot.MAIN_HAND] = items['dagger']; equipment[EquipmentSlot.BODY] = items['leather_armor']; } 
    else if (cls === CharacterClass.CLERIC) { equipment[EquipmentSlot.MAIN_HAND] = items['mace']; equipment[EquipmentSlot.BODY] = items['chain_shirt']; equipment[EquipmentSlot.OFF_HAND] = items['shield']; } 
    else if (cls === CharacterClass.RANGER) { equipment[EquipmentSlot.MAIN_HAND] = items['shortsword']; equipment[EquipmentSlot.OFF_HAND] = items['dagger']; equipment[EquipmentSlot.BODY] = items['leather_armor']; }
    else { equipment[EquipmentSlot.MAIN_HAND] = items['quarterstaff']; }

    const { skills, spells, maxActions } = getUnlockedFeatures(cls, race, level);

    return {
        id: `comp_${generateId()}`, name, type: 'PLAYER' as const, equipment,
        stats: { 
            level, class: cls, race, creatureType: CreatureType.HUMANOID, 
            xp: 0, xpToNextLevel: XP_TABLE[level] || 999999, 
            hp: maxHp, maxHp, stamina: maxStamina, maxStamina, ac: 10, initiativeBonus: getModifier(baseStats.DEX), speed: 30, attributes: baseStats, baseAttributes: { ...baseStats }, spellSlots: getCasterSlots(cls, level), corruption: 0, activeCooldowns: {},
            resistances: [], vulnerabilities: [], immunities: [],
            knownSkills: skills, knownSpells: spells, maxActions
        },
        visual: { color: '#3b82f6', modelType: 'billboard' as const, spriteUrl: getSprite(race, cls) }
    };
};

export const createPlayerSlice: StateCreator<any, [], [], PlayerSlice> = (set, get) => ({
  party: [],
  characterPool: [],

  createCharacter: (name, race, cls, stats, difficulty) => {
    sfx.playVictory();
    const contentState = useContentStore.getState();
    const items = contentState.items;

    const maxHp = calculateHp(1, stats.CON, getHitDie(cls), race);
    const maxStamina = calculateMaxStamina(stats.CON, 1);
    const startSlots = getCasterSlots(cls, 1);
    let spriteUrl = getSprite(race, cls);
    const equipment: Partial<Record<EquipmentSlot, Item>> = {};
    const inventory = [{ item: items['potion_healing'], quantity: 3 }, { item: items['ration'], quantity: 5 }];

    switch (cls) {
        case CharacterClass.FIGHTER: case CharacterClass.PALADIN: equipment[EquipmentSlot.MAIN_HAND] = items['longsword']; equipment[EquipmentSlot.BODY] = items['chain_mail']; equipment[EquipmentSlot.OFF_HAND] = items['shield']; break;
        case CharacterClass.BARBARIAN: equipment[EquipmentSlot.MAIN_HAND] = items['greataxe']; break;
        case CharacterClass.RANGER: equipment[EquipmentSlot.MAIN_HAND] = items['shortsword']; equipment[EquipmentSlot.OFF_HAND] = items['dagger']; equipment[EquipmentSlot.BODY] = items['leather_armor']; break;
        case CharacterClass.ROGUE: equipment[EquipmentSlot.MAIN_HAND] = items['dagger']; equipment[EquipmentSlot.BODY] = items['leather_armor']; break;
        case CharacterClass.CLERIC: equipment[EquipmentSlot.MAIN_HAND] = items['mace']; equipment[EquipmentSlot.BODY] = items['chain_shirt']; equipment[EquipmentSlot.OFF_HAND] = items['shield']; inventory.push({ item: items['potion_mana'], quantity: 1 }); break;
        default: equipment[EquipmentSlot.MAIN_HAND] = items['quarterstaff']; inventory.push({ item: items['potion_mana'], quantity: 2 });
    }

    const { skills, spells, maxActions } = getUnlockedFeatures(cls, race, 1);

    const leader = { 
        id: 'player_leader', name, type: 'PLAYER' as const, equipment, 
        stats: { 
            level: 1, class: cls, race, creatureType: CreatureType.HUMANOID, 
            xp: 0, xpToNextLevel: XP_TABLE[1] || 300, hp: maxHp, maxHp, stamina: maxStamina, maxStamina, ac: 10, initiativeBonus: Math.floor((stats.DEX - 10) / 2), speed: 30, attributes: stats, baseAttributes: { ...stats }, spellSlots: startSlots, corruption: 0, activeCooldowns: {},
            resistances: [], vulnerabilities: [], immunities: [],
            knownSkills: skills, knownSpells: spells, maxActions
        }, 
        visual: { color: '#3b82f6', modelType: 'billboard' as const, spriteUrl } 
    };
    
    // Default Companions
    const companions = [
        generateCompanion("Vex", CharacterRace.HALFLING, CharacterClass.ROGUE, 1),
        generateCompanion("Zan", CharacterRace.HUMAN, CharacterClass.CLERIC, 1)
    ];

    const party = [leader, ...companions].map(p => ({ ...p, stats: get().recalculateStats(p) }));
    
    const exploredNormal = new Set<string>();
    const startX = 0; 
    const startY = 0;
    const visionRadius = Math.max(1, calculateVisionRange(stats.WIS));
    
    for (let q = startX - visionRadius; q <= startX + visionRadius; q++) {
        for (let r = startY - visionRadius; r <= startY + visionRadius; r++) {
            const dist = (Math.abs(q - startX) + Math.abs(q + r - startX - startY) + Math.abs(r - startY)) / 2;
            if (dist <= visionRadius) {
                exploredNormal.add(`${q},${r}`);
            }
        }
    }
    exploredNormal.add(`${startX},${startY}`);

    const startQuests = [
        { 
            id: 'vecna_1', 
            title: 'The Thinning Veil', 
            description: 'Travel to the ruins at [0,0] where reality is fracturing.', 
            completed: false, 
            type: 'MAIN' as const 
        }
    ];

    set({ 
        party, 
        difficulty, 
        inventory, 
        playerPos: { x: startX, y: startY }, 
        activeInventoryCharacterId: leader.id, 
        exploredTiles: { ...get().exploredTiles, [Dimension.NORMAL]: exploredNormal },
        quests: startQuests,
        gameState: GameState.OVERWORLD,
        characterPool: [] // Init empty pool
    });
    
    get().addLog(`The party assembles! ${name} leads ${companions[0].name} and ${companions[1].name}.`, 'narrative');
  },

  summonCharacter: (seed, method) => {
      const contentState = useContentStore.getState();
      const items = contentState.items;

      // 1. Generate Metadata using the new Service
      const summonData = SummoningService.generateFromSeed(seed);
      
      const level = Math.max(1, (get().party[0]?.stats.level || 1) - 1); // New recruits start 1 level lower
      
      // 2. Create Base Entity
      const newChar = generateCompanion(summonData.name, summonData.race, summonData.class, level);
      
      // 3. Override Stats with Summon Data
      newChar.stats.baseAttributes = summonData.baseAttributes;
      newChar.stats.rarity = summonData.rarity;
      newChar.stats.affinity = summonData.affinity;
      newChar.stats.traits = summonData.traits;
      
      // Add elemental resistance based on affinity
      if (summonData.affinity) {
          newChar.stats.resistances = [summonData.affinity];
      }

      // Add Magical Gear for High Rarity
      if (summonData.rarity === ItemRarity.LEGENDARY || summonData.rarity === ItemRarity.VERY_RARE) {
          if (newChar.stats.class === CharacterClass.FIGHTER || newChar.stats.class === CharacterClass.PALADIN) {
              newChar.equipment[EquipmentSlot.MAIN_HAND] = items['flame_tongue'];
          }
          if (summonData.rarity === ItemRarity.LEGENDARY) {
              // Very strong start
              newChar.equipment[EquipmentSlot.MAIN_HAND] = items['vorpal_sword'];
          }
      }

      // 4. Apply Method Effects (Force vs Stabilize)
      if (method === 'FORCE') {
          // Force is risky: might corrupt or might enhance wildly
          if (Math.random() > 0.5) {
              newChar.stats.corruption = 20;
              get().addLog(`${summonData.name} emerges from the unstable rift with corruption.`, 'combat');
          }
      } else {
          // Stabilize ensures no corruption and slight stat boost
          // Already handled by base generation in service, but we ensure full HP here
      }

      const finalChar = { ...newChar, stats: get().recalculateStats(newChar) };
      finalChar.stats.hp = finalChar.stats.maxHp;

      // Add to CHARACTER POOL
      const newPool = [...get().characterPool, finalChar];
      set({ characterPool: newPool });
      
      sfx.playVictory();
      
      // Log based on rarity
      const logType = summonData.rarity === ItemRarity.LEGENDARY ? 'levelup' : 'narrative';
      get().addLog(`Summoned [${summonData.rarity}] ${summonData.name} to the Pool!`, logType);
  },

  addToParty: (poolIndex) => {
      const { party, characterPool } = get();
      if (party.length >= 4) {
          get().addLog("Party is full (max 4).", "info");
          return;
      }
      const char = characterPool[poolIndex];
      const newPool = [...characterPool];
      newPool.splice(poolIndex, 1);
      set({ party: [...party, char], characterPool: newPool });
      sfx.playUiClick();
  },

  removeFromParty: (partyIndex) => {
      const { party, characterPool } = get();
      if (partyIndex === 0) {
          get().addLog("Cannot remove the party leader.", "info");
          return;
      }
      const char = party[partyIndex];
      const newParty = [...party];
      newParty.splice(partyIndex, 1);
      set({ party: newParty, characterPool: [...characterPool, char] });
      sfx.playUiClick();
  },

  swapPartyMember: (partyIndex, poolIndex) => {
      const { party, characterPool } = get();
      if (partyIndex === 0) {
          get().addLog("Cannot swap the party leader.", "info");
          return;
      }
      const partyChar = party[partyIndex];
      const poolChar = characterPool[poolIndex];

      const newParty = [...party];
      newParty[partyIndex] = poolChar;

      const newPool = [...characterPool];
      newPool[poolIndex] = partyChar;

      set({ party: newParty, characterPool: newPool });
      sfx.playUiClick();
  },

  recalculateStats: (entity) => {
      const result = runStatsPipeline(entity);
      // Ensure current stamina doesn't exceed new max
      if (result.stamina > result.maxStamina) result.stamina = result.maxStamina;
      return result;
  },

  applyLevelUp: (characterId, bonusAttributes) => {
    // ... existing implementation ...
    const { party } = get();
    const updatedParty = party.map(member => {
        if (member.id !== characterId) return member;

        const nextLevel = member.stats.level + 1;
        const newBaseAttributes = { ...member.stats.baseAttributes };
        
        // Apply chosen bonuses
        Object.entries(bonusAttributes).forEach(([key, val]) => {
            if (val) newBaseAttributes[key as keyof Attributes] += val;
        });

        // Auto-heal on level up
        const conMod = getModifier(newBaseAttributes.CON);
        const hitDie = getHitDie(member.stats.class);
        const newMaxHp = member.stats.maxHp + Math.max(1, Math.floor(hitDie / 2) + 1 + conMod);
        const newSpellSlots = getCasterSlots(member.stats.class, nextLevel);

        // Unlock new features from Tree
        const { skills, spells, maxActions } = getUnlockedFeatures(member.stats.class, member.stats.race!, nextLevel);
        
        // Merge with existing
        const updatedSkills = Array.from(new Set([...(member.stats.knownSkills || []), ...skills]));
        const updatedSpells = Array.from(new Set([...(member.stats.knownSpells || []), ...spells]));

        const tempEntity = { 
            ...member, 
            stats: { 
                ...member.stats, 
                level: nextLevel, 
                maxHp: newMaxHp, 
                hp: newMaxHp, 
                spellSlots: newSpellSlots, 
                baseAttributes: newBaseAttributes, 
                xpToNextLevel: XP_TABLE[nextLevel] || 999999,
                knownSkills: updatedSkills,
                knownSpells: updatedSpells,
                maxActions: Math.max(member.stats.maxActions || 1, maxActions)
            } 
        };
        return { ...member, stats: get().recalculateStats(tempEntity) };
    });

    set({ party: updatedParty }); 
    sfx.playVictory(); 
    get().addLog(`${party.find(p => p.id === characterId)?.name} is now level ${updatedParty.find(p => p.id === characterId)?.stats.level}!`, "levelup");
  }
});
