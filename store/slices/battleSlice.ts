
import { StateCreator } from 'zustand';
import { 
    GameState, TerrainType, WeatherType, BattleCell, BattleAction, Spell, Entity, 
    CombatStatsComponent, PositionComponent, DamagePopup, SpellEffectData, SpellType, 
    CharacterClass, VisualComponent, AIBehavior, LootDrop, ItemRarity, Item, 
    EquipmentSlot, Dimension, InventorySlot, CharacterRace, DamageType, Ability, Skill, CreatureType
} from '../../types';
import { findBattlePath, getReachableTiles } from '../../services/pathfinding';
import { rollD20, rollDice, checkLineOfSight, calculateAttackRoll, calculateDamage, calculateFinalDamage, calculateEnemyStats, getAttackRange, calculateSpellAttackRoll, calculateSpellDC, getModifier, isFlanking, calculateHitChance, getAoETiles, calculateAC } from '../../services/dndRules';
import { sfx } from '../../services/SoundSystem';
import { ASSETS, BATTLE_MAP_SIZE, TERRAIN_COLORS, TERRAIN_MOVEMENT_COST, SPELLS, SKILLS } from '../../constants';
import { useContentStore } from '../contentStore';

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- HELPERS ---

const generateBattleGrid = (terrainType: TerrainType): BattleCell[] => {
    const size = BATTLE_MAP_SIZE;
    const grid: BattleCell[] = [];
    const safeTerrain = terrainType || TerrainType.GRASS;
    
    let floorTex = ASSETS.BLOCK_TEXTURES[safeTerrain] || ASSETS.BLOCK_TEXTURES[TerrainType.GRASS]!;
    let wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.MOUNTAIN]!; 
    
    if (safeTerrain === TerrainType.DESERT) wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.DESERT]!;
    if (safeTerrain === TerrainType.CASTLE || safeTerrain === TerrainType.RUINS) { 
        floorTex = ASSETS.BLOCK_TEXTURES[TerrainType.STONE_FLOOR]!; 
        wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.CASTLE]!; 
    }
    if (safeTerrain === TerrainType.SWAMP) wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.SWAMP]!;
    if (safeTerrain === TerrainType.VILLAGE) { 
        floorTex = ASSETS.BLOCK_TEXTURES[TerrainType.GRASS]!; 
        wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.VILLAGE]!; 
    }
    if (safeTerrain === TerrainType.COBBLESTONE) floorTex = ASSETS.BLOCK_TEXTURES[TerrainType.COBBLESTONE]!;
    if (safeTerrain === TerrainType.CAVE_FLOOR) {
        floorTex = ASSETS.BLOCK_TEXTURES[TerrainType.CAVE_FLOOR]!;
        wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.DUNGEON_WALL]!;
    }

    const noise = (x: number, z: number, freq: number = 0.5) => Math.sin(x * freq) + Math.cos(z * freq) + Math.sin((x + z) * freq * 0.5);
    const baseTerrainCost = TERRAIN_MOVEMENT_COST[safeTerrain] || 1;

    for(let x = 0; x < size; x++) {
        for(let z = 0; z < size; z++) {
            let height = 1; 
            let offsetY = 0; 
            let textureUrl = floorTex; 
            let isObstacle = false;
            let blocksSight = false;
            let movementCost = baseTerrainCost; 
            let color = TERRAIN_COLORS[safeTerrain] || '#4ade80';

            if ([TerrainType.MOUNTAIN, TerrainType.DESERT, TerrainType.TAIGA, TerrainType.TUNDRA].includes(safeTerrain)) {
                const n = noise(x, z, 0.35);
                if (n > 0.2) { height = 1.3; movementCost = Math.max(movementCost, 2); }
                if (n > 0.8) { height = 1.7; movementCost = Math.max(movementCost, 3); }
                if (n > 1.2) { height = 2.5; isObstacle = true; blocksSight = true; textureUrl = wallTex; }
            } else if ([TerrainType.FOREST, TerrainType.JUNGLE, TerrainType.SWAMP].includes(safeTerrain)) {
                 if (Math.random() > 0.85) { height = 2.0; isObstacle = true; blocksSight = true; textureUrl = ASSETS.BLOCK_TEXTURES[TerrainType.FOREST]!; }
            } else if ([TerrainType.CASTLE, TerrainType.RUINS].includes(safeTerrain)) {
                 if (x % 4 === 0 && z % 4 === 0) { height = 3; isObstacle = true; blocksSight = true; textureUrl = wallTex; }
            } else if (safeTerrain === TerrainType.CAVE_FLOOR) {
                 // Simple cave walls logic
                 if (x === 0 || z === 0 || x === size - 1 || z === size - 1 || (Math.random() > 0.9)) { 
                     height = 2.5; 
                     isObstacle = true; 
                     blocksSight = true; 
                     textureUrl = wallTex; 
                 }
            }

            if (x > 4 && x < size - 5 && z > 4 && z < size - 5) {
                isObstacle = false; height = 1; textureUrl = floorTex; blocksSight = false;
                movementCost = Math.min(baseTerrainCost, 1.5); 
            }

            grid.push({ x, z, height, offsetY, color, textureUrl, isObstacle, blocksSight, movementCost });
        }
    }
    return grid;
};

const applyDamageToEntity = (entity: any, damage: number, popups: DamagePopup[]): any => {
    let newEntity = { ...entity };
    let newStats = { ...newEntity.stats };
    
    if (newStats.originalStats && newStats.hp - damage <= 0) {
        const excessDamage = Math.abs(newStats.hp - damage);
        const original = newStats.originalStats;
        const originalSprite = newStats.originalSprite;
        newStats = { ...newStats, ...original };
        delete newStats.originalStats;
        delete newStats.originalSprite;
        newStats.hp = Math.max(0, (newStats.hp || 1) - excessDamage);
        if (originalSprite) {
            newEntity.visual = { ...newEntity.visual, spriteUrl: originalSprite };
        }
    } else {
        newStats.hp = Math.max(0, newStats.hp - damage);
    }
    newEntity.stats = newStats;
    return newEntity;
};

// --- AI STRATEGY PATTERN ---

interface AIContext {
    entity: Entity;
    allEntities: Entity[];
    map: BattleCell[];
    actions: {
        move: (path: any[]) => Promise<void>;
        attack: (targetId: string) => Promise<void>;
        cast: (spellId: string, targetPos: PositionComponent) => Promise<void>;
        pass: () => void;
    };
    log: (msg: string, type: any) => void;
}

const findClosestTarget = (actor: Entity, targets: Entity[]) => {
    let closest: Entity | null = null;
    let minDist = 999;
    
    targets.forEach(t => {
        if (t.stats.hp <= 0) return;
        const dist = Math.abs(actor.position.x - t.position.x) + Math.abs(actor.position.y - t.position.y);
        if (dist < minDist) {
            minDist = dist;
            closest = t;
        }
    });
    return { target: closest, dist: minDist };
};

const AIStrategies: Record<string, (ctx: AIContext) => Promise<void>> = {
    [AIBehavior.BASIC_MELEE]: async ({ entity, allEntities, map, actions }) => {
        const players = allEntities.filter(e => e.type === 'PLAYER' && e.stats.hp > 0);
        if (players.length === 0) return actions.pass();

        const { target, dist } = findClosestTarget(entity, players);
        if (!target) return actions.pass();

        const attackRange = getAttackRange(entity);

        if (dist <= attackRange) {
            await actions.attack(target.id);
            return;
        }

        const path = findBattlePath(entity.position, target.position, map);
        if (path && path.length > 0) {
            const speed = Math.floor(entity.stats.speed / 5);
            const movePath = path.slice(0, speed);
            const endPos = movePath[movePath.length - 1] || entity.position;
            const endZ = (endPos as any).z !== undefined ? (endPos as any).z : (endPos as any).y;
            const newDist = Math.abs(endPos.x - target.position.x) + Math.abs(endZ - target.position.y);
            
            await actions.move(movePath);
            
            if (newDist <= attackRange) {
                await actions.attack(target.id);
            } else {
                actions.pass();
            }
        } else {
            actions.pass();
        }
    },
    [AIBehavior.DEFENSIVE]: async ({ entity, allEntities, map, actions }) => {
        const players = allEntities.filter(e => e.type === 'PLAYER' && e.stats.hp > 0);
        if (players.length === 0) return actions.pass();

        const { target, dist } = findClosestTarget(entity, players);
        if (!target) return actions.pass();

        const maxRange = getAttackRange(entity);
        const idealRange = maxRange - 1;

        if (dist <= 2) {
            await actions.attack(target.id); 
        } else if (dist <= maxRange && checkLineOfSight(entity.position, target.position, map)) {
            await actions.attack(target.id);
        } else {
            const path = findBattlePath(entity.position, target.position, map);
            if (path) {
                const speed = Math.floor(entity.stats.speed / 5);
                const stopIndex = Math.max(0, path.length - idealRange); 
                const movePath = path.slice(0, Math.min(speed, stopIndex));
                
                if (movePath.length > 0) await actions.move(movePath);
                
                const newDist = Math.abs((movePath[movePath.length-1]?.x || entity.position.x) - target.position.x) + 
                                Math.abs((movePath[movePath.length-1]?.z || entity.position.y) - target.position.y);
                
                if (newDist <= maxRange) await actions.attack(target.id);
                else actions.pass();
            } else {
                actions.pass();
            }
        }
    },
    [AIBehavior.HEALER]: async ({ entity, allEntities, map, actions, log }) => {
        const allies = allEntities.filter(e => e.type === 'ENEMY' && e.id !== entity.id && e.stats.hp > 0);
        const injured = allies.filter(a => (a.stats.hp / a.stats.maxHp) < 0.6).sort((a,b) => a.stats.hp - b.stats.hp);
        
        if (injured.length > 0) {
            const target = injured[0];
            const dist = Math.abs(entity.position.x - target.position.x) + Math.abs(entity.position.y - target.position.y);
            const healRange = 6;

            if (dist <= healRange) {
                log(`${entity.name} chants a healing prayer!`, "combat");
                const spellId = 'cure_wounds'; 
                await actions.cast(spellId, target.position);
                return;
            } else {
                const path = findBattlePath(entity.position, target.position, map);
                if (path) {
                    const speed = Math.floor(entity.stats.speed / 5);
                    const movePath = path.slice(0, Math.min(speed, path.length - 1));
                    if (movePath.length > 0) await actions.move(movePath);
                    const newDist = Math.abs((movePath[movePath.length-1]?.x || entity.position.x) - target.position.x) + 
                                    Math.abs((movePath[movePath.length-1]?.z || entity.position.y) - target.position.y);
                    if (newDist <= healRange) {
                        await actions.cast('cure_wounds', target.position);
                        return;
                    }
                }
            }
        }
        return AIStrategies[AIBehavior.SPELLCASTER]({ entity, allEntities, map, actions, log });
    },
    [AIBehavior.SPELLCASTER]: async ({ entity, allEntities, map, actions, log }) => {
        const players = allEntities.filter(e => e.type === 'PLAYER' && e.stats.hp > 0);
        const { target, dist } = findClosestTarget(entity, players);
        if (!target) return actions.pass();

        const spells = ['fireball', 'magic_missile', 'guiding_bolt']; 
        const spellId = spells[0]; 
        const spellRange = 8;

        if (dist <= spellRange && checkLineOfSight(entity.position, target.position, map)) {
            await actions.cast(spellId, target.position);
        } else {
            const path = findBattlePath(entity.position, target.position, map);
            if (path) {
                const speed = Math.floor(entity.stats.speed / 5);
                const stopIndex = Math.max(0, path.length - (spellRange - 1)); 
                const movePath = path.slice(0, Math.min(speed, stopIndex));
                if (movePath.length > 0) await actions.move(movePath);
                
                const newDist = Math.abs((movePath[movePath.length-1]?.x || entity.position.x) - target.position.x) + 
                                Math.abs((movePath[movePath.length-1]?.z || entity.position.y) - target.position.y);
                
                if (newDist <= spellRange) {
                    await actions.cast(spellId, target.position);
                } else {
                    actions.pass();
                }
            } else {
                actions.pass();
            }
        }
    }
};

// --- ACTION RESOLUTION STRATEGY PATTERN ---

interface ActionContext {
    caster: Entity;
    target: Entity;
    source: Spell | Skill; // The thing being used
    popupList: DamagePopup[];
}

interface ActionResult {
    newEntity: Entity;
    popup: Partial<DamagePopup>;
    logMsg: string;
}

const EffectStrategies: Record<string, (ctx: ActionContext) => ActionResult> = {
    // DAMAGE STRATEGY: Handles rolls, crits, resistance, and application
    'DAMAGE': ({ caster, target, source }) => {
        // Logic assumes magic attack roll for Spells, physical for Skills generally
        // For simplicity, we use magic attack roll if it's a spell or magic skill
        const isSpell = (source as any).level !== undefined; // Duck typing check
        
        let total = 0;
        let isCrit = false;
        
        if (isSpell) {
            const roll = calculateSpellAttackRoll(caster);
            total = roll.total;
            isCrit = roll.isCrit;
        } else {
            const roll = calculateAttackRoll(caster);
            total = roll.total;
            isCrit = roll.isCrit;
        }

        const ac = target.stats.ac;
        
        // Auto-hit for AoE usually (simplified), or check AC for targeted
        const hit = source.aoeRadius ? true : (total >= ac);
        
        if (hit) {
            const rawDmg = rollDice(source.diceSides || 6, source.diceCount || 1) * (isCrit ? 2 : 1);
            const dmgMult = (source as Skill).damageMultiplier || 1; // Skills might have multipliers
            const { finalDamage } = calculateFinalDamage(Math.floor(rawDmg * dmgMult), source.damageType || DamageType.MAGIC, target, true);
            
            const newEntity = applyDamageToEntity(target, finalDamage, []);
            const color = source.damageType === DamageType.FIRE ? '#ef4444' : (source.damageType === DamageType.RADIANT ? '#fbbf24' : '#a855f7');
            
            return {
                newEntity,
                popup: { amount: finalDamage, color, isCrit },
                logMsg: `hits ${target.name} for ${finalDamage} (${source.damageType})`
            };
        } else {
            return {
                newEntity: target,
                popup: { amount: "MISS", color: '#94a3b8', isCrit: false },
                logMsg: `missed ${target.name}`
            };
        }
    },

    // HEAL STRATEGY: Handles positive HP restoration
    'HEAL': ({ caster, target, source }) => {
        const heal = rollDice(source.diceSides || 4, source.diceCount || 1);
        const newHp = Math.min(target.stats.maxHp, target.stats.hp + heal);
        
        const newEntity = { ...target, stats: { ...target.stats, hp: newHp } };
        
        return {
            newEntity,
            popup: { amount: `+${heal}`, color: '#22c55e', isCrit: false },
            logMsg: `heals ${target.name} for ${heal}`
        };
    },

    // STATUS/UTILITY STRATEGY: Handles buffs or non-damage effects
    'APPLY_EFFECT': ({ caster, target, source }) => {
        const skill = source as Skill;
        const effectName = skill.statusEffect || 'EFFECT';
        
        const newStatus = { ...(target.stats.statusEffects || {}) };
        newStatus[effectName] = 3; // Default 3 turns
        
        const newEntity = { ...target, stats: { ...target.stats, statusEffects: newStatus } };
        
        return {
            newEntity,
            popup: { amount: effectName, color: '#3b82f6', isCrit: false },
            logMsg: `applied ${effectName} to ${target.name}`
        };
    },
    
    // HEAL_SELF strategy for skills like Second Wind
    'HEAL_SELF': ({ caster, target, source }) => {
        // Force target to be caster just in case, though interaction layer handles this
        const heal = rollDice(10, 1) + caster.stats.level; // Standard Second Wind logic
        const newHp = Math.min(caster.stats.maxHp, caster.stats.hp + heal);
        
        const newEntity = { ...caster, stats: { ...caster.stats, hp: newHp } };
        
        return {
            newEntity,
            popup: { amount: `+${heal}`, color: '#22c55e', isCrit: false },
            logMsg: `regains ${heal} HP`
        };
    }
};

// --- SLICE DEFINITION ---

export interface BattleSlice {
  battleEntities: Entity[];
  turnOrder: string[];
  currentTurnIndex: number;
  battleMap: BattleCell[] | null;
  battleTerrain: TerrainType;
  battleWeather: WeatherType;
  battleRewards: { xp: number, gold: number, items: Item[] };
  
  selectedTile: { x: number, z: number } | null;
  hoveredEntity: Entity | null;
  selectedAction: BattleAction | null;
  selectedSpell: Spell | null;
  selectedSkill: Skill | null;
  hasMoved: boolean;
  hasActed: boolean;
  
  damagePopups: DamagePopup[];
  activeSpellEffect: SpellEffectData | null;
  lootDrops: LootDrop[];
  
  isActionAnimating: boolean;
  
  inspectedEntityId: string | null;

  startBattle: (terrain: TerrainType, weather: WeatherType, enemyId?: string) => void;
  initializeBattle: (entities: Entity[], terrain: TerrainType, weather: WeatherType) => void;
  handleTileInteraction: (x: number, z: number) => void;
  selectAction: (action: BattleAction) => void;
  selectSpell: (spellId: string) => void;
  selectSkill: (skillId: string) => void;
  moveEntity: (path: any[]) => Promise<void>;
  performAttack: (targetId: string) => Promise<void>;
  performMagic: (targetPos: { x: number, y: number }) => Promise<void>;
  performSkill: (targetPos: { x: number, y: number }) => Promise<void>;
  endTurn: () => void;
  nextTurn: () => void;
  attemptRun: () => void;
  
  performEnemyTurn: () => Promise<void>;
  
  handleTileHover: (x: number, z: number) => void;
  inspectUnit: (id: string) => void;
  closeInspection: () => void;
  
  removeDamagePopup: (id: string) => void;
  continueAfterVictory: () => void;
  restartBattle: () => void;
  hasLineOfSight: (targetId: string) => boolean;
}

export const createBattleSlice: StateCreator<any, [], [], BattleSlice> = (set, get) => ({
  battleEntities: [],
  turnOrder: [],
  currentTurnIndex: 0,
  battleMap: null,
  battleTerrain: TerrainType.GRASS,
  battleWeather: WeatherType.NONE,
  battleRewards: { xp: 0, gold: 0, items: [] },
  selectedTile: null,
  hoveredEntity: null,
  selectedAction: null,
  selectedSpell: null,
  selectedSkill: null,
  hasMoved: false,
  hasActed: false,
  damagePopups: [],
  activeSpellEffect: null,
  lootDrops: [],
  isActionAnimating: false,
  inspectedEntityId: null,

  inspectUnit: (id) => set({ inspectedEntityId: id }),
  closeInspection: () => set({ inspectedEntityId: null }),

  handleTileHover: (x, z) => {
      const ent = get().battleEntities.find((e: Entity) => e.position.x === x && e.position.y === z);
      set({ selectedTile: { x, z }, hoveredEntity: ent || null });
  },

  hasLineOfSight: (targetId) => {
      const activeId = get().turnOrder[get().currentTurnIndex];
      const active = get().battleEntities.find((e: Entity) => e.id === activeId);
      const target = get().battleEntities.find((e: Entity) => e.id === targetId);
      if (!active || !target) return false;
      return checkLineOfSight(active.position, target.position, get().battleMap || []);
  },

  startBattle: (terrain, weather, enemyId) => {
      const state = get();
      const party = state.party;
      const contentState = useContentStore.getState();
      
      const grid = generateBattleGrid(terrain);
      
      const entities: Entity[] = party.map((p: any, i: number) => ({
          ...p,
          position: { x: 5 + (i % 2), y: 5 + Math.floor(i / 2) } 
      }));

      const encounterList = contentState.encounters[terrain] || [];
      const enemyIds = encounterList.length > 0 ? encounterList : ['goblin_spearman'];
      
      let finalEnemyList = [...enemyIds];
      if (enemyId) {
          const bossDef = state.activeOverworldEnemies.find((e: any) => e.id === enemyId);
          if (bossDef && bossDef.defId === 'lich_lord') {
              finalEnemyList = ['lich_lord', 'skeleton_archer', 'skeleton_archer'];
          }
      }

      const numEnemies = Math.floor(Math.random() * 2) + 2 + Math.floor(state.party[0].stats.level / 3); 
      
      for(let i = 0; i < numEnemies; i++) {
          const enemyDefId = finalEnemyList[Math.floor(Math.random() * finalEnemyList.length)];
          const def = contentState.enemies[enemyDefId];
          if (!def) continue;

          const stats = calculateEnemyStats(def, state.party[0].stats.level, state.difficulty);
          const x = BATTLE_MAP_SIZE - 4 + (i % 2);
          const y = BATTLE_MAP_SIZE - 4 - Math.floor(i / 2);
          
          let ai = AIBehavior.BASIC_MELEE;
          if (def.id.includes('archer')) ai = AIBehavior.DEFENSIVE;
          if (def.id.includes('sorcerer') || def.id.includes('lich')) ai = AIBehavior.SPELLCASTER;
          if (def.id.includes('shaman')) ai = AIBehavior.HEALER;

          entities.push({
              id: `enemy_${generateId()}`,
              name: def.name,
              defId: def.id,
              type: 'ENEMY',
              position: { x, y },
              stats,
              visual: { color: '#ef4444', modelType: 'billboard', spriteUrl: def.sprite },
              equipment: {},
              aiBehavior: ai
          });
      }

      get().initializeBattle(entities, terrain, weather);
      sfx.playUiClick();
  },

  initializeBattle: (entities, terrain, weather) => {
      const initiatives = entities.map(e => ({
          id: e.id,
          roll: rollD20().result + (e.stats.initiativeBonus || 0)
      })).sort((a, b) => b.roll - a.roll);

      set({
          gameState: GameState.BATTLE_TACTICAL,
          battleEntities: entities,
          turnOrder: initiatives.map(i => i.id),
          currentTurnIndex: 0,
          battleMap: generateBattleGrid(terrain),
          battleTerrain: terrain,
          battleWeather: weather,
          selectedAction: null,
          hasMoved: false,
          hasActed: false,
          damagePopups: [],
          lootDrops: []
      });
      
      const firstId = initiatives[0].id;
      if (entities.find(e => e.id === firstId)?.type === 'ENEMY') {
          setTimeout(() => get().performEnemyTurn(), 1000);
      }
  },

  selectAction: (action) => set({ selectedAction: action, selectedSpell: null, selectedSkill: null }),
  selectSpell: (spellId) => {
      const content = useContentStore.getState();
      const spell = content.spells[spellId] || SPELLS[spellId];
      set({ selectedSpell: spell, selectedAction: BattleAction.MAGIC }); 
  },
  selectSkill: (skillId) => {
      const content = useContentStore.getState();
      const skill = content.skills[skillId] || SKILLS[skillId]; 
      set({ selectedSkill: skill, selectedAction: BattleAction.SKILL });
  },

  handleTileInteraction: async (x, z) => {
      const state = get();
      if (state.isActionAnimating) return;

      const activeId = state.turnOrder[state.currentTurnIndex];
      const entity = state.battleEntities.find(e => e.id === activeId);
      
      if (!entity || entity.type !== 'PLAYER') return;

      const targetEntity = state.battleEntities.find(e => e.position.x === x && e.position.y === z && e.stats.hp > 0);

      // MOVE
      if (state.selectedAction === BattleAction.MOVE && !state.hasMoved && !targetEntity) {
          const path = findBattlePath(entity.position, {x, y: z}, state.battleMap || []);
          if (path) {
              await get().moveEntity(path.map(p => ({ x: p.x, z: p.z })));
          }
      }
      // ATTACK
      else if (state.selectedAction === BattleAction.ATTACK && !state.hasActed && targetEntity) {
          const dist = Math.max(Math.abs(entity.position.x - targetEntity.position.x), Math.abs(entity.position.y - targetEntity.position.y));
          if (dist <= getAttackRange(entity)) {
              await get().performAttack(targetEntity.id);
          } else {
              get().addLog("Target out of range.", "info");
          }
      }
      // MAGIC
      else if (state.selectedAction === BattleAction.MAGIC && !state.hasActed && state.selectedSpell) {
          const dist = Math.max(Math.abs(entity.position.x - x), Math.abs(entity.position.y - z));
          if (dist <= state.selectedSpell.range) {
              await get().performMagic({ x, y: z }); 
          }
      }
      // SKILL
      else if (state.selectedAction === BattleAction.SKILL && !state.hasActed && state.selectedSkill) {
          const dist = Math.max(Math.abs(entity.position.x - x), Math.abs(entity.position.y - z));
          if (dist <= state.selectedSkill.range) {
              await get().performSkill({ x, y: z });
          }
      }
  },

  moveEntity: async (path) => {
      set({ isActionAnimating: true });
      const activeId = get().turnOrder[get().currentTurnIndex];
      
      for (const node of path) {
          set(state => ({
              battleEntities: state.battleEntities.map(e => 
                  e.id === activeId ? { ...e, position: { x: node.x, y: node.z || node.y } } : e
              )
          }));
          sfx.playStep();
          await new Promise(r => setTimeout(r, 200));
      }
      
      set({ hasMoved: true, isActionAnimating: false, selectedAction: null });
  },

  performAttack: async (targetId) => {
      set({ isActionAnimating: true });
      const state = get();
      const attacker = state.battleEntities.find(e => e.id === state.turnOrder[state.currentTurnIndex]);
      const target = state.battleEntities.find(e => e.id === targetId);
      
      if (!attacker || !target) return;

      sfx.playAttack();
      await new Promise(r => setTimeout(r, 500)); 

      const { total, isCrit, isAutoMiss } = calculateAttackRoll(attacker);
      const ac = calculateAC(target.stats.attributes.DEX, target.stats.ac, false); 
      
      const hits = !isAutoMiss && (isCrit || total >= ac);
      
      if (hits) {
          const { amount, type, isMagical } = calculateDamage(attacker, EquipmentSlot.MAIN_HAND, isCrit);
          const { finalDamage, isResistant, isVulnerable } = calculateFinalDamage(amount, type, target, isMagical);
          
          const newTarget = applyDamageToEntity(target, finalDamage, state.damagePopups);
          
          const popups = [...state.damagePopups, { 
              id: generateId(), 
              position: [target.position.x, 0, target.position.y], 
              amount: finalDamage, 
              color: isCrit ? '#fbbf24' : (isVulnerable ? '#ef4444' : (isResistant ? '#9ca3af' : 'white')), 
              isCrit, 
              timestamp: Date.now() 
          }];

          set(s => ({
              battleEntities: s.battleEntities.map(e => e.id === targetId ? newTarget : e),
              damagePopups: popups
          }));
          
          sfx.playHit();
          get().addLog(`${attacker.name} hits ${target.name} for ${finalDamage} damage!`, "combat");

          if (newTarget.stats.hp <= 0) {
              sfx.playVictory(); 
              if (target.type === 'ENEMY') {
                  if (Math.random() > 0.5) {
                      set(s => ({
                          lootDrops: [...s.lootDrops, { id: generateId(), position: target.position, items: [], gold: rollDice(10, 2), rarity: ItemRarity.COMMON }]
                      }));
                  }
              }
          }

      } else {
          const popups = [...state.damagePopups, { 
              id: generateId(), 
              position: [target.position.x, 0, target.position.y], 
              amount: "MISS", 
              color: '#94a3b8', 
              isCrit: false, 
              timestamp: Date.now() 
          }];
          set({ damagePopups: popups });
          get().addLog(`${attacker.name} missed ${target.name}.`, "info");
      }

      set({ hasActed: true, isActionAnimating: false, selectedAction: null });
  },

  performMagic: async (targetPos) => {
      const state = get();
      const caster = state.battleEntities.find(e => e.id === state.turnOrder[state.currentTurnIndex]);
      const spell = state.selectedSpell;
      
      if (!caster || !spell) return;
      if (caster.stats.spellSlots.current <= 0) {
          get().addLog("Not enough Mana!", "info");
          return;
      }

      set({ isActionAnimating: true });
      
      // Mana Cost
      const newCaster = { ...caster, stats: { ...caster.stats, spellSlots: { ...caster.stats.spellSlots, current: caster.stats.spellSlots.current - 1 } } };
      set(s => ({ battleEntities: s.battleEntities.map(e => e.id === caster.id ? newCaster : e) }));

      // VFX
      const effectData: SpellEffectData = {
          id: generateId(),
          type: spell.name === 'Fireball' ? 'BURST' : 'PROJECTILE',
          startPos: [caster.position.x, 1, caster.position.y],
          endPos: [targetPos.x, 0.5, targetPos.y],
          color: spell.damageType === DamageType.FIRE ? '#ef4444' : '#a855f7',
          duration: 800,
          timestamp: Date.now(),
          projectileSprite: spell.icon, 
          textureUrl: spell.animation 
      };
      set({ activeSpellEffect: effectData });
      sfx.playMagic();
      
      await new Promise(r => setTimeout(r, 800));

      // Determine Targets (AoE vs Single)
      let affectedEntities: Entity[] = [];
      if (spell.aoeRadius) {
          const tiles = getAoETiles(caster.position, targetPos, spell.aoeType || 'CIRCLE', spell.aoeRadius);
          affectedEntities = state.battleEntities.filter(e => 
              e.stats.hp > 0 && tiles.some(t => t.x === e.position.x && t.y === e.position.y)
          );
      } else {
          const target = state.battleEntities.find(e => e.position.x === targetPos.x && e.position.y === targetPos.y && e.stats.hp > 0);
          if (target) affectedEntities.push(target);
      }

      // EXECUTE STRATEGIES
      const strategyKey = spell.type === SpellType.HEAL ? 'HEAL' : 'DAMAGE'; // Map spell type to strategy
      const strategy = EffectStrategies[strategyKey] || EffectStrategies['DAMAGE'];

      const updates = affectedEntities.map(target => {
          return strategy({
              caster,
              target,
              source: spell,
              popupList: []
          });
      });

      // Batch Update
      set(s => {
          let newEntities = [...s.battleEntities];
          let newPopups = [...s.damagePopups];
          updates.forEach(u => {
              newEntities = newEntities.map(e => e.id === u.newEntity.id ? u.newEntity : e);
              newPopups.push({ ...u.popup, id: generateId(), position: [u.newEntity.position.x, 0, u.newEntity.position.y], timestamp: Date.now() } as any);
          });
          return { battleEntities: newEntities, damagePopups: newPopups, activeSpellEffect: null };
      });

      get().addLog(`${caster.name} casts ${spell.name}!`, "combat");
      set({ hasActed: true, isActionAnimating: false, selectedAction: null });
  },

  performSkill: async (targetPos) => {
      const state = get();
      const user = state.battleEntities.find(e => e.id === state.turnOrder[state.currentTurnIndex]);
      const skill = state.selectedSkill;
      
      if (!user || !skill) return;
      
      // Cost Check
      if (user.stats.stamina < skill.staminaCost) {
          get().addLog("Not enough Stamina!", "info");
          return;
      }

      set({ isActionAnimating: true });

      // Apply Cost
      const newUser = { ...user, stats: { ...user.stats, stamina: user.stats.stamina - skill.staminaCost } };
      set(s => ({ battleEntities: s.battleEntities.map(e => e.id === user.id ? newUser : e) }));

      sfx.playAttack();
      await new Promise(r => setTimeout(r, 500));

      // Find Target
      let affectedEntities: Entity[] = [];
      if (skill.effect === 'HEAL_SELF') {
          affectedEntities = [user]; // Special case for self-target skills
      } else {
          const target = state.battleEntities.find(e => e.position.x === targetPos.x && e.position.y === targetPos.y && e.stats.hp > 0);
          if (target) affectedEntities.push(target);
      }

      // EXECUTE STRATEGY
      const strategyKey = skill.effect || 'DAMAGE';
      const strategy = EffectStrategies[strategyKey] || EffectStrategies['DAMAGE'];

      const updates = affectedEntities.map(target => {
          return strategy({
              caster: user,
              target,
              source: skill,
              popupList: []
          });
      });

      set(s => {
          let newEntities = [...s.battleEntities];
          let newPopups = [...s.damagePopups];
          updates.forEach(u => {
              newEntities = newEntities.map(e => e.id === u.newEntity.id ? u.newEntity : e);
              newPopups.push({ ...u.popup, id: generateId(), position: [u.newEntity.position.x, 0, u.newEntity.position.y], timestamp: Date.now() } as any);
          });
          return { battleEntities: newEntities, damagePopups: newPopups };
      });

      get().addLog(`${user.name} uses ${skill.name}!`, "combat");
      set({ hasActed: true, isActionAnimating: false, selectedAction: null });
  },

  performEnemyTurn: async () => {
      const state = get();
      const activeId = state.turnOrder[state.currentTurnIndex];
      const entity = state.battleEntities.find(e => e.id === activeId);
      
      if (!entity || entity.type !== 'ENEMY' || entity.stats.hp <= 0) {
          get().nextTurn();
          return;
      }

      set({ isActionAnimating: true });
      await new Promise(r => setTimeout(r, 500)); // Think time

      // CONTEXT FOR STRATEGY
      const context: AIContext = {
          entity,
          allEntities: state.battleEntities,
          map: state.battleMap || [],
          actions: {
              move: (path) => get().moveEntity(path.map(p => ({ x: p.x, z: p.z || p.y }))), // Adapter for path struct
              attack: (targetId) => get().performAttack(targetId),
              cast: (spellId, pos) => {
                  const content = useContentStore.getState();
                  const spell = content.spells[spellId] || SPELLS[spellId];
                  set({ selectedSpell: spell }); // Set context for performMagic
                  return get().performMagic(pos);
              },
              pass: () => {} // Do nothing
          },
          log: get().addLog
      };

      // SELECT STRATEGY
      const behavior = entity.aiBehavior || AIBehavior.BASIC_MELEE;
      const strategy = AIStrategies[behavior] || AIStrategies[AIBehavior.BASIC_MELEE];

      // EXECUTE
      try {
          await strategy(context);
      } catch (e) {
          console.error("AI Error", e);
      }

      set({ isActionAnimating: false });
      get().endTurn();
  },

  endTurn: () => {
      const state = get();
      // Tick Cooldowns & Effects
      const activeId = state.turnOrder[state.currentTurnIndex];
      // ... logic to decrement cooldowns ...

      get().nextTurn();
  },

  nextTurn: () => {
      const state = get();
      
      // Check Victory/Defeat
      const playersAlive = state.battleEntities.some(e => e.type === 'PLAYER' && e.stats.hp > 0);
      const enemiesAlive = state.battleEntities.some(e => e.type === 'ENEMY' && e.stats.hp > 0);
      
      if (!playersAlive) {
          set({ gameState: GameState.BATTLE_DEFEAT });
          return;
      }
      if (!enemiesAlive) {
          // Calc Rewards
          let totalXp = 0;
          let totalGold = 0;
          state.battleEntities.forEach(e => {
              if (e.type === 'ENEMY') {
                  totalXp += e.stats.xpReward || 0; // Stored in XP field or separate
                  totalGold += 10;
              }
          });
          set({ gameState: GameState.BATTLE_VICTORY, battleRewards: { xp: totalXp, gold: totalGold, items: [] } });
          sfx.playVictory();
          return;
      }

      let nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      let nextId = state.turnOrder[nextIndex];
      let nextEntity = state.battleEntities.find(e => e.id === nextId);

      // Skip dead entities
      while (nextEntity?.stats.hp! <= 0) {
          nextIndex = (nextIndex + 1) % state.turnOrder.length;
          nextId = state.turnOrder[nextIndex];
          nextEntity = state.battleEntities.find(e => e.id === nextId);
      }

      set({ 
          currentTurnIndex: nextIndex, 
          hasMoved: false, 
          hasActed: false, 
          selectedAction: null,
          selectedTile: null 
      });

      if (nextEntity?.type === 'ENEMY') {
          setTimeout(() => get().performEnemyTurn(), 500);
      } else {
          get().addLog(`It is ${nextEntity?.name}'s turn.`, "info");
      }
  },

  attemptRun: () => {
      if (Math.random() > 0.4) {
          get().addLog("Escaped successfully!", "narrative");
          set({ gameState: GameState.OVERWORLD });
      } else {
          get().addLog("Failed to escape!", "combat");
          get().endTurn();
      }
  },

  continueAfterVictory: () => {
      const { battleRewards, party, addGold, clearedEncounters, playerPos, dimension, activeOverworldEnemies } = get();
      // Apply Rewards
      addGold(battleRewards.gold);
      const xpPerPerson = Math.floor(battleRewards.xp / party.length);
      
      const newParty = party.map((p: any) => {
          const newXp = p.stats.xp + xpPerPerson;
          return { ...p, stats: { ...p.stats, xp: newXp } };
      });
      
      // Update Overworld State
      const newCleared = new Set(clearedEncounters);
      newCleared.add(`${playerPos.x},${playerPos.y}`); // Mark tile as cleared if fixed encounter

      // Remove killed overworld entities
      const aliveOverworldEnemies = activeOverworldEnemies.filter((e: any) => {
          // If this battle was triggered by an overworld entity, remove it.
          // Simplified: Remove entity at player pos
          return !(e.q === playerPos.x && e.r === playerPos.y && e.dimension === dimension);
      });

      // Special Boss Logic
      const bossDefeated = !aliveOverworldEnemies.find((e: any) => e.defId === 'lich_lord');
      if (bossDefeated && dimension === Dimension.UPSIDE_DOWN && playerPos.x === 0 && playerPos.y === 0) {
           set({ gameState: GameState.GAME_WON });
           return;
      }

      set({ 
          party: newParty, 
          gameState: GameState.OVERWORLD,
          clearedEncounters: newCleared,
          activeOverworldEnemies: aliveOverworldEnemies
      });
  },

  restartBattle: () => {
      // Reload logic handled by save system mostly, but here we can just reset
      const { loadGame } = get();
      loadGame(0); // Quick load slot 0
  },

  removeDamagePopup: (id) => set(s => ({ damagePopups: s.damagePopups.filter(p => p.id !== id) }))
});
