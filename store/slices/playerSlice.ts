
import { StateCreator } from 'zustand';
import { CharacterRace, CharacterClass, Attributes, Difficulty, EquipmentSlot, Item, Ability, Entity, CombatStatsComponent, VisualComponent, Dimension, GameState, CreatureType, ItemRarity } from '../../types';
import { calculateHp, getModifier, calculateVisionRange, getCorruptionPenalty, rollDice } from '../../services/dndRules';
import { BASE_STATS, RACE_BONUS, XP_TABLE, ITEMS, getSprite, CLASS_TREES, RACE_SKILLS } from '../../constants';
import { sfx } from '../../services/SoundSystem';
import { SummoningService } from '../../services/SummoningService';

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
    if ([CharacterClass.WIZARD, CharacterClass.CLERIC, CharacterClass.DRUID, CharacterClass.SORCERER, CharacterClass.BARD].includes(cls)) return { current: level + 1, max: level + 1 }; // Simple scaling for MVP
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
    const baseStats = { ...BASE_STATS[cls] };
    const bonus = RACE_BONUS[race];
    (Object.keys(baseStats) as Ability[]).forEach(k => { if (bonus[k]) baseStats[k] += bonus[k]!; });
    const maxHp = calculateHp(level, baseStats.CON, getHitDie(cls), race);
    const maxStamina = calculateMaxStamina(baseStats.CON, level);
    
    const equipment: Partial<Record<EquipmentSlot, Item>> = {};
    if (cls === CharacterClass.FIGHTER || cls === CharacterClass.PALADIN) { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.LONGSWORD; equipment[EquipmentSlot.BODY] = ITEMS.CHAIN_MAIL; equipment[EquipmentSlot.OFF_HAND] = ITEMS.SHIELD; } 
    else if (cls === CharacterClass.BARBARIAN) { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.GREATAXE; } 
    else if (cls === CharacterClass.ROGUE) { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.DAGGER; equipment[EquipmentSlot.BODY] = ITEMS.LEATHER_ARMOR; } 
    else if (cls === CharacterClass.CLERIC) { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.MACE; equipment[EquipmentSlot.BODY] = ITEMS.CHAIN_SHIRT; equipment[EquipmentSlot.OFF_HAND] = ITEMS.SHIELD; } 
    else if (cls === CharacterClass.RANGER) { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.SHORTSWORD; equipment[EquipmentSlot.OFF_HAND] = ITEMS.DAGGER; equipment[EquipmentSlot.BODY] = ITEMS.LEATHER_ARMOR; }
    else { equipment[EquipmentSlot.MAIN_HAND] = ITEMS.QUARTERSTAFF; }

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
    const maxHp = calculateHp(1, stats.CON, getHitDie(cls), race);
    const maxStamina = calculateMaxStamina(stats.CON, 1);
    const startSlots = getCasterSlots(cls, 1);
    let spriteUrl = getSprite(race, cls);
    const equipment: Partial<Record<EquipmentSlot, Item>> = {};
    const inventory = [{ item: ITEMS.POTION_HEALING, quantity: 3 }, { item: ITEMS.RATION, quantity: 5 }];

    switch (cls) {
        case CharacterClass.FIGHTER: case CharacterClass.PALADIN: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.LONGSWORD; equipment[EquipmentSlot.BODY] = ITEMS.CHAIN_MAIL; equipment[EquipmentSlot.OFF_HAND] = ITEMS.SHIELD; break;
        case CharacterClass.BARBARIAN: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.GREATAXE; break;
        case CharacterClass.RANGER: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.SHORTSWORD; equipment[EquipmentSlot.OFF_HAND] = ITEMS.DAGGER; equipment[EquipmentSlot.BODY] = ITEMS.LEATHER_ARMOR; break;
        case CharacterClass.ROGUE: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.DAGGER; equipment[EquipmentSlot.BODY] = ITEMS.LEATHER_ARMOR; break;
        case CharacterClass.CLERIC: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.MACE; equipment[EquipmentSlot.BODY] = ITEMS.CHAIN_SHIRT; equipment[EquipmentSlot.OFF_HAND] = ITEMS.SHIELD; inventory.push({ item: ITEMS.POTION_MANA, quantity: 1 }); break;
        default: equipment[EquipmentSlot.MAIN_HAND] = ITEMS.QUARTERSTAFF; inventory.push({ item: ITEMS.POTION_MANA, quantity: 2 });
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
        { id: 'q1', title: 'The Capital', description: 'Find the great castle at coordinates (0, 0).', completed: false, type: 'MAIN' as const },
        { id: 'q2', title: 'Explore the Wilds', description: 'Discover 50 unique locations in Arcadia.', completed: false, type: 'SIDE' as const }
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
              newChar.equipment[EquipmentSlot.MAIN_HAND] = ITEMS.FLAME_TONGUE;
          }
          if (summonData.rarity === ItemRarity.LEGENDARY) {
              // Very strong start
              newChar.equipment[EquipmentSlot.MAIN_HAND] = ITEMS.VORPAL_SWORD;
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
    const effectiveAttributes = { ...entity.stats.baseAttributes };
    let armorBase = 10; 
    let shieldBonus = 0;
    let hasArmor = false;

    Object.values(entity.equipment).forEach((item: any) => {
        if (!item || !item.equipmentStats) return;
        const stats = item.equipmentStats;
        if (stats.modifiers) Object.entries(stats.modifiers).forEach(([key, val]) => { if (val) effectiveAttributes[key as keyof Attributes] += (val as number); });
        
        if (stats.slot === EquipmentSlot.BODY && stats.ac) {
            armorBase = stats.ac;
            hasArmor = true;
        }
        if (stats.slot === EquipmentSlot.OFF_HAND && stats.ac) {
            shieldBonus = stats.ac;
        }
    });

    let dexMod = getModifier(effectiveAttributes.DEX);
    if (armorBase >= 16) dexMod = 0; else if (armorBase >= 13) dexMod = Math.min(2, dexMod);
    
    let classACBonus = 0;
    if (entity.stats.class === CharacterClass.FIGHTER && hasArmor) {
        classACBonus = 1;
    }

    let raceStaminaBonus = 0;
    if (entity.stats.race === CharacterRace.HUMAN) {
        raceStaminaBonus = 3;
    }

    let baseSpeed = 30;
    if (entity.stats.race === CharacterRace.ELF) {
        baseSpeed = 35;
    }
    if (entity.stats.race === CharacterRace.DWARF || entity.stats.race === CharacterRace.HALFLING) {
        baseSpeed = 25;
    }

    let calculatedMaxStamina = calculateMaxStamina(effectiveAttributes.CON, entity.stats.level) + raceStaminaBonus;
    let currentStamina = entity.stats.stamina !== undefined ? entity.stats.stamina : calculatedMaxStamina;
    if (currentStamina > calculatedMaxStamina) currentStamina = calculatedMaxStamina;

    const corruption = entity.stats.corruption || 0;
    const { acPenalty, maxHpPenalty } = getCorruptionPenalty(corruption);

    const baseMaxHp = calculateHp(entity.stats.level, effectiveAttributes.CON, getHitDie(entity.stats.class), entity.stats.race);
    const finalMaxHp = Math.max(1, baseMaxHp - maxHpPenalty);

    return { 
        ...entity.stats, 
        ac: Math.max(0, (armorBase + dexMod + shieldBonus + classACBonus) - acPenalty), 
        attributes: effectiveAttributes, 
        initiativeBonus: getModifier(effectiveAttributes.DEX),
        stamina: currentStamina,
        maxStamina: calculatedMaxStamina,
        maxHp: finalMaxHp,
        speed: baseSpeed,
        corruption: corruption,
        activeCooldowns: entity.stats.activeCooldowns || {},
        creatureType: entity.stats.creatureType || CreatureType.HUMANOID,
        resistances: entity.stats.resistances || [],
        vulnerabilities: entity.stats.vulnerabilities || [],
        immunities: entity.stats.immunities || [],
        // Ensure known skills persist, default to unlocked if not present (migration safe)
        knownSkills: entity.stats.knownSkills || [],
        knownSpells: entity.stats.knownSpells || [],
        maxActions: entity.stats.maxActions || 1,
        // Preserve new stats
        rarity: entity.stats.rarity,
        affinity: entity.stats.affinity,
        traits: entity.stats.traits
    };
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
