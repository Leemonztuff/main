
import { StateCreator } from 'zustand';
import { 
    GameState, TerrainType, WeatherType, BattleCell, BattleAction, Spell, Entity, 
    CombatStatsComponent, PositionComponent, DamagePopup, SpellEffectData, SpellType, 
    CharacterClass, VisualComponent, AIBehavior, LootDrop, ItemRarity, Item, 
    EquipmentSlot, Dimension, InventorySlot, CharacterRace, DamageType, Ability, Skill, CreatureType
} from '../../types';
import { findBattlePath, getReachableTiles } from '../../services/pathfinding';
import { rollD20, rollDice, checkLineOfSight, calculateAttackRoll, calculateDamage, calculateFinalDamage, calculateEnemyStats, getAttackRange, calculateSpellAttackRoll, calculateSpellDC, getModifier, isFlanking, calculateHitChance, getAoETiles } from '../../services/dndRules';
import { sfx } from '../../services/SoundSystem';
import { ASSETS, BASE_STATS, BATTLE_MAP_SIZE, TERRAIN_COLORS, DIFFICULTY_SETTINGS, ITEMS, SPELLS, CORRUPTION_THRESHOLDS, SKILLS, TERRAIN_MOVEMENT_COST, getSprite } from '../../constants';
import { useContentStore } from '../contentStore';

const generateId = () => Math.random().toString(36).substr(2, 9);

export interface BattleSlice {
  battleEntities: (Entity & { stats: CombatStatsComponent, position: PositionComponent, visual: VisualComponent })[];
  inspectedEntityId: string | null;
  turnOrder: string[];
  currentTurnIndex: number;
  battleTerrain: TerrainType;
  battleWeather: WeatherType;
  battleRewards: { xp: number, gold: number, items: any[] };
  battleMap: BattleCell[];
  lootDrops: LootDrop[];
  selectedAction: BattleAction | null;
  selectedSpell: Spell | null;
  selectedSkill: Skill | null;
  hasMoved: boolean;
  hasActed: boolean;
  selectedTile: { x: number, z: number } | null;
  hoveredEntity: Entity | null;
  runAvailable: boolean;
  damagePopups: DamagePopup[];
  activeSpellEffect: SpellEffectData | null;
  isActionAnimating: boolean;
  isSkillSelectionMode: boolean;

  startBattle: (terrain: TerrainType, weather: WeatherType, enemyId?: string) => void;
  selectAction: (action: BattleAction | null) => void;
  selectSpell: (spellId: string) => void;
  selectSkill: (skillId: string) => void;
  inspectUnit: (entityId: string) => void;
  closeInspection: () => void;
  setSkillSelectionMode: (enabled: boolean) => void;
  handleTileHover: (x: number, z: number) => void;
  handleTileInteraction: (x: number, z: number) => void;
  collectLoot: (dropId: string) => void;
  nextTurn: () => void;
  processStartOfTurn: (entityId: string) => Promise<boolean>;
  attemptRun: () => void;
  restartBattle: () => void;
  continueAfterVictory: () => void;
  hasLineOfSight: (source: PositionComponent, target: PositionComponent) => boolean;
  getAttackPrediction: () => any | null;
  checkBattleEnd: () => void;
  performEnemyTurn: () => void;
  performSkill: (x: number, z: number) => void;
  removeDamagePopup: (id: string) => void;
}

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
    if (safeTerrain === TerrainType.CAVE_FLOOR) wallTex = ASSETS.BLOCK_TEXTURES[TerrainType.MOUNTAIN]!;

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

export const createBattleSlice: StateCreator<any, [], [], BattleSlice> = (set, get) => ({
  battleEntities: [],
  inspectedEntityId: null,
  turnOrder: [],
  currentTurnIndex: 0,
  battleTerrain: TerrainType.GRASS,
  battleWeather: WeatherType.NONE,
  battleRewards: { xp: 0, gold: 0, items: [] },
  battleMap: [],
  lootDrops: [],
  selectedAction: null,
  selectedSpell: null,
  selectedSkill: null,
  hasMoved: false,
  hasActed: false,
  selectedTile: null,
  hoveredEntity: null,
  runAvailable: true,
  damagePopups: [],
  activeSpellEffect: null,
  isActionAnimating: false,
  isSkillSelectionMode: false,

  startBattle: (terrain, weather, enemyId) => {
      // sfx.playAttack(); // Moved to Cinematic Logic in UIOverlay 
      const state = get();
      const party = state.party || [];
      const activeOverworldEnemies = state.activeOverworldEnemies || [];
      const difficulty = state.difficulty || 'NORMAL';
      
      if (party.length === 0) {
          get().addLog("Cannot start battle: No party members!", "info");
          return;
      }
      
      const map = generateBattleGrid(terrain);
      const entities: any[] = [];
      const usedPositions = new Set<string>();

      // 1. Place Players
      party.forEach((p: any) => {
          if (!p) return;
          let placed = false;
          let attempt = 0;
          while (!placed && attempt < 50) {
              const ox = Math.floor(BATTLE_MAP_SIZE / 2) + Math.floor((Math.random() - 0.5) * 4);
              const oy = Math.floor(BATTLE_MAP_SIZE / 2) + Math.floor((Math.random() - 0.5) * 4);
              const key = `${ox},${oy}`;
              const cell = map.find(c => c.x === ox && c.z === oy);
              if (cell && !cell.isObstacle && !usedPositions.has(key)) {
                  entities.push({ ...p, position: { x: ox, y: oy }, stats: { ...p.stats, activeCooldowns: {} } }); 
                  usedPositions.add(key);
                  placed = true;
              }
              attempt++;
          }
      });

      // 2. Generate Enemies
      const enemyCount = Math.floor(Math.random() * 2) + 2; 
      const contentState = useContentStore.getState();
      const enemyDefs = contentState ? contentState.enemies : {};
      
      const triggerEnemy = activeOverworldEnemies.find((e: any) => e.id === enemyId);
      const enemyDefKeys = Object.keys(enemyDefs);
      let mainEnemyDefId = triggerEnemy ? triggerEnemy.defId : (enemyDefKeys.length > 0 ? enemyDefKeys[0] : 'goblin_spearman');
      let mainEnemyDef = enemyDefs[mainEnemyDefId] || enemyDefs['goblin_spearman'];
      const playerLevel = (party[0] && party[0].stats) ? party[0].stats.level : 1;

      for(let i = 0; i < enemyCount; i++) {
           let placed = false;
           let attempt = 0;
           while(!placed && attempt < 50) {
               const edge = Math.floor(Math.random() * 4);
               let ex = 0, ey = 0;
               if (edge === 0) { ex = Math.floor(Math.random() * BATTLE_MAP_SIZE); ey = 0; } 
               else if (edge === 1) { ex = Math.floor(Math.random() * BATTLE_MAP_SIZE); ey = BATTLE_MAP_SIZE - 1; }
               else if (edge === 2) { ex = 0; ey = Math.floor(Math.random() * BATTLE_MAP_SIZE); } 
               else { ex = BATTLE_MAP_SIZE - 1; ey = Math.floor(Math.random() * BATTLE_MAP_SIZE); }

               if (ex === 0) ex += 1; if (ex === BATTLE_MAP_SIZE - 1) ex -= 1;
               if (ey === 0) ey += 1; if (ey === BATTLE_MAP_SIZE - 1) ey -= 1;

               const key = `${ex},${ey}`;
               const cell = map.find(c => c.x === ex && c.z === ey);
               
               if (cell && !cell.isObstacle && !usedPositions.has(key)) {
                    let def = mainEnemyDef;
                    let defId = mainEnemyDefId;
                    if (i > 0 && Math.random() > 0.7 && enemyDefKeys.length > 1) {
                        const rndKey = enemyDefKeys[Math.floor(Math.random() * enemyDefKeys.length)];
                        if (enemyDefs[rndKey]) { def = enemyDefs[rndKey]; defId = rndKey; }
                    }

                    const stats = calculateEnemyStats(def, playerLevel, difficulty);
                    
                    let ai = AIBehavior.BASIC_MELEE;
                    if (def.type === CreatureType.UNDEAD && def.id.includes('archer')) ai = AIBehavior.DEFENSIVE; 
                    if (def.type === CreatureType.HUMANOID && (def.id.includes('sorcerer') || def.id.includes('necromancer'))) ai = AIBehavior.SPELLCASTER;
                    if (def.type === CreatureType.BEAST) ai = AIBehavior.AGRESSIVE_BEAST;
                    if (def.name.includes("Priest") || def.name.includes("Shaman")) ai = AIBehavior.HEALER;

                    entities.push({
                        id: `enemy_${generateId()}`,
                        defId: defId,
                        name: def.name,
                        type: 'ENEMY',
                        position: { x: ex, y: ey },
                        stats,
                        visual: { color: '#ef4444', modelType: 'billboard', spriteUrl: def.sprite },
                        aiBehavior: ai
                    });
                    usedPositions.add(key);
                    placed = true;
               }
               attempt++;
           }
      }

      const turnOrder = entities
        .map(e => ({ id: e.id, init: rollD20().result + (e.stats.initiativeBonus || 0) }))
        .sort((a, b) => b.init - a.init)
        .map(e => e.id);

      set({ 
          gameState: GameState.BATTLE_TACTICAL,
          battleEntities: entities,
          battleMap: map,
          turnOrder,
          currentTurnIndex: 0,
          battleTerrain: terrain,
          battleWeather: weather,
          selectedAction: null,
          hasMoved: false,
          hasActed: false,
          lootDrops: [],
          damagePopups: [],
          inspectedEntityId: null,
          battleRewards: { xp: 0, gold: 0, items: [] } 
      });
      
      // Removed generic log, rely on Banner
      
      // Process first turn
      const firstId = turnOrder[0];
      const canAct = get().processStartOfTurn(firstId);
      // Wait a microtask to ensure state is settled before enemy acts
      setTimeout(() => {
          const freshEnt = get().battleEntities.find((e: any) => e.id === firstId);
          if (canAct && freshEnt && freshEnt.type === 'ENEMY') {
              get().performEnemyTurn();
          }
      }, 100);
  },

  selectAction: (action) => set({ selectedAction: action, selectedSpell: null, selectedSkill: null, selectedTile: null, isSkillSelectionMode: false }),
  selectSpell: (spellId) => set({ selectedSpell: SPELLS[spellId] }),
  selectSkill: (skillId) => set({ selectedSkill: SKILLS[skillId], isSkillSelectionMode: true }),
  
  inspectUnit: (entityId) => { sfx.playUiClick(); set({ inspectedEntityId: entityId }); },
  closeInspection: () => { sfx.playUiClick(); set({ inspectedEntityId: null }); },
  setSkillSelectionMode: (enabled) => set({ isSkillSelectionMode: enabled }),

  handleTileHover: (x, z) => {
      const { battleEntities } = get();
      const entity = battleEntities.find(e => e.position.x === x && e.position.y === z);
      set({ selectedTile: { x, z }, hoveredEntity: entity || null });
  },

  handleTileInteraction: async (x, z) => {
      const state = get();
      const { selectedAction, battleEntities, turnOrder, currentTurnIndex, hasMoved, hasActed, battleMap } = state;
      const activeEntityId = turnOrder[currentTurnIndex];
      const activeEntity = battleEntities.find(e => e.id === activeEntityId);

      if (!activeEntity || activeEntity.type !== 'PLAYER') return;

      const targetEntity = battleEntities.find(e => e.position.x === x && e.position.y === z && e.stats.hp > 0);

      // --- MOVEMENT ---
      if (selectedAction === BattleAction.MOVE) {
          if (hasMoved) { get().addLog("Already moved this turn.", "info"); return; }
          if (targetEntity) { get().addLog("Tile blocked.", "info"); return; }

          if (activeEntity.stats.statusEffects && activeEntity.stats.statusEffects['ROOTED']) {
              get().addLog("You are Rooted!", "info");
              return;
          }

          const speedInTiles = Math.floor(activeEntity.stats.speed / 5);
          const path = findBattlePath({ x: activeEntity.position.x, y: activeEntity.position.y }, { x, y: z }, battleMap);

          if (path && path.length - 1 <= speedInTiles) {
              set({ isActionAnimating: true });
              const newEntities = battleEntities.map(e => e.id === activeEntity.id ? { ...e, position: { x, y: z } } : e);
              set({ battleEntities: newEntities, hasMoved: true, isActionAnimating: false, selectedAction: null });
              sfx.playStep();
          } else {
              get().addLog("Too far!", "info");
          }
      }

      // --- MELEE ATTACK ---
      else if (selectedAction === BattleAction.ATTACK) {
          if (hasActed) { get().addLog("Already acted this turn.", "info"); return; }
          
          if (!targetEntity || targetEntity.type !== 'ENEMY') {
              get().addLog("Select a valid target.", "info");
              return;
          }

          const dist = Math.max(Math.abs(activeEntity.position.x - x), Math.abs(activeEntity.position.y - z));
          const range = getAttackRange(activeEntity);
          
          if (dist <= range) {
              if (range > 1.5 && !checkLineOfSight(activeEntity.position, targetEntity.position, battleMap)) {
                  get().addLog("Line of sight blocked!", "info");
                  return;
              }

              set({ isActionAnimating: true });
              sfx.playAttack();
              await new Promise(r => setTimeout(r, 400));

              const isSneak = activeEntity.stats.class === CharacterClass.ROGUE && isFlanking(activeEntity, targetEntity, battleEntities);
              const attackRoll = calculateAttackRoll(activeEntity, EquipmentSlot.MAIN_HAND, isSneak);
              
              if (attackRoll.total >= targetEntity.stats.ac) {
                  sfx.playHit();
                  if (attackRoll.isCrit) sfx.playCrit();
                  
                  const dmgInfo = calculateDamage(activeEntity, EquipmentSlot.MAIN_HAND, attackRoll.isCrit, targetEntity, isSneak);
                  const { finalDamage, isResistant, isVulnerable, isImmune } = calculateFinalDamage(dmgInfo.amount, dmgInfo.type, targetEntity, dmgInfo.isMagical);
                  const newHp = Math.max(0, targetEntity.stats.hp - finalDamage);
                  
                  // Cleanup Stealth/Bardic/Guiding Bolt
                  const newAttackerStats = { ...activeEntity.stats };
                  let attackerUpdated = false;
                  if (newAttackerStats.statusEffects) {
                      if (newAttackerStats.statusEffects['STEALTH']) { delete newAttackerStats.statusEffects['STEALTH']; attackerUpdated = true; }
                      if (attackRoll.inspirationUsed) { delete newAttackerStats.statusEffects['BARDIC']; attackerUpdated = true; }
                      if (attackRoll.guidingBoltUsed) { delete newAttackerStats.statusEffects['GUIDING_BOLT_ADV']; attackerUpdated = true; }
                      if (newAttackerStats.statusEffects['POISON_WEAPON']) { delete newAttackerStats.statusEffects['POISON_WEAPON']; attackerUpdated = true; }
                  }

                  const newEntities = battleEntities.map(e => {
                      if (e.id === targetEntity.id) {
                          // Apply Poison on Hit if weapon poisoned
                          let targetStats = { ...e.stats, hp: newHp };
                          if (activeEntity.stats.statusEffects?.['POISON_WEAPON']) {
                              targetStats.statusEffects = { ...targetStats.statusEffects, 'POISON': 2 };
                          }
                          return { ...e, stats: targetStats };
                      }
                      if (e.id === activeEntity.id && attackerUpdated) return { ...e, stats: newAttackerStats }; 
                      return e;
                  });
                  
                  let amountDisplay: string | number = finalDamage;
                  let color = attackRoll.isCrit ? '#fbbf24' : (dmgInfo.isSneakAttack ? '#a855f7' : 'white');
                  if (isImmune) { amountDisplay = 'IMMUNE'; color = '#94a3b8'; }
                  else if (isVulnerable) color = '#ef4444'; 
                  else if (isResistant) color = '#d97706'; 

                  const popups = [...state.damagePopups, { id: generateId(), position: [targetEntity.position.x, 0, targetEntity.position.y], amount: amountDisplay, color, isCrit: attackRoll.isCrit, timestamp: Date.now() }];

                  get().addLog(`${activeEntity.name} hits ${targetEntity.name} for ${finalDamage} damage!${attackRoll.isCrit ? ' (CRIT!)' : ''}`, "combat");
                  set({ battleEntities: newEntities, hasActed: true, damagePopups: popups, isActionAnimating: false, selectedAction: null });
                  get().checkBattleEnd();
              } else {
                  const popups = [...state.damagePopups, { id: generateId(), position: [targetEntity.position.x, 0, targetEntity.position.y], amount: 'MISS', color: '#94a3b8', isCrit: false, timestamp: Date.now() }];
                  get().addLog(`${activeEntity.name} attacks ${targetEntity.name} but misses.`, "combat");
                  set({ damagePopups: popups, hasActed: true, isActionAnimating: false, selectedAction: null });
              }
          } else {
              get().addLog("Out of range!", "info");
          }
      }

      // --- SKILL/MAGIC ---
      else if ((selectedAction === BattleAction.MAGIC || selectedAction === BattleAction.SKILL)) {
          if (hasActed) { get().addLog("Already acted this turn.", "info"); return; }
          get().performSkill(x, z);
      }
  },

  performSkill: async (x, z) => {
      const state = get();
      const { selectedSpell, selectedSkill, battleEntities, turnOrder, currentTurnIndex, battleMap } = state;
      const activeEntityId = turnOrder[currentTurnIndex];
      const activeEntity = battleEntities.find(e => e.id === activeEntityId);
      if (!activeEntity) return;

      const skill = selectedSpell || selectedSkill;
      if (!skill) return;

      // Cooldown Check
      if ((skill as Skill).cooldown) {
          const currentCD = activeEntity.stats.activeCooldowns[(skill as Skill).id] || 0;
          if (currentCD > 0) {
              get().addLog(`${skill.name} is on cooldown (${currentCD} turns).`, "info");
              return;
          }
      }

      // Stamina/Mana Check (Simplified for MVP, assuming mana always handled via slots in playerSlice)
      
      // Validate Action Surge
      if ((skill as Skill).effect === 'ACTION_RESET') {
          get().addLog(`${activeEntity.name} uses ${skill.name}!`, "combat");
          const newCooldowns = { ...activeEntity.stats.activeCooldowns, [(skill as Skill).id]: (skill as Skill).cooldown };
          const newEntities = battleEntities.map(e => e.id === activeEntity.id ? { ...e, stats: { ...e.stats, activeCooldowns: newCooldowns } } : e);
          set({ battleEntities: newEntities, hasActed: false, hasMoved: false, selectedSkill: null, selectedAction: null });
          sfx.playMagic();
          return;
      }

      const dist = Math.max(Math.abs(activeEntity.position.x - x), Math.abs(activeEntity.position.y - z));
      if (dist > skill.range) { get().addLog("Target out of range.", "info"); return; }
      if (skill.range > 1 && !checkLineOfSight(activeEntity.position, {x, y: z}, battleMap)) { get().addLog("Line of sight blocked.", "info"); return; }

      // TELEPORT Logic (Misty Step)
      if ((skill as Skill).effect === 'TELEPORT' || skill.name === 'Misty Step') {
          const occupied = battleEntities.some(e => e.position.x === x && e.position.y === z && e.stats.hp > 0);
          const cell = battleMap.find(c => c.x === x && c.z === z);
          if (occupied || cell?.isObstacle) {
              get().addLog("Cannot teleport there!", "info");
              return;
          }
          
          set({ isActionAnimating: true });
          sfx.playMagic();
          set({ activeSpellEffect: { id: generateId(), type: 'BURST', startPos: [x,0,z], endPos: [x, 0.5, z], color: '#a855f7', duration: 400, timestamp: Date.now(), animationKey: 'HEAL' } });
          
          const newEntities = battleEntities.map(e => e.id === activeEntity.id ? { ...e, position: { x, y: z } } : e);
          
          // Cooldown
          const newCooldowns = { ...activeEntity.stats.activeCooldowns, [(skill as Skill).id]: (skill as Skill).cooldown || 0 };
          const slots = activeEntity.stats.spellSlots;
          const finalEntities = newEntities.map(e => e.id === activeEntity.id ? { ...e, stats: { ...e.stats, activeCooldowns: newCooldowns, spellSlots: { ...slots, current: Math.max(0, slots.current - 1) } } } : e);

          // Teleport usually uses "Bonus Action", so we don't set hasActed to true for Misty Step specifically in D&D, 
          // but for game balance here we might. Let's say Misty Step is Bonus Action.
          // Skill definition says isBonusAction: true?
          const isBonus = (skill as Skill).isBonusAction;
          
          set({ battleEntities: finalEntities, hasMoved: true, isActionAnimating: false, selectedSpell: null, selectedAction: null });
          if (!isBonus) set({ hasActed: true });
          
          return;
      }

      set({ isActionAnimating: true });
      sfx.playMagic();

      // Visuals
      if (skill.animation) {
          const effectType = skill.aoeRadius ? 'BURST' : (skill.range > 1 ? 'PROJECTILE' : 'BURST');
          const color = skill.damageType === DamageType.FIRE ? '#ef4444' : '#a855f7';
          set({ activeSpellEffect: { id: generateId(), type: effectType, startPos: [activeEntity.position.x, 1.5, activeEntity.position.y], endPos: [x, 0.5, z], color: color, duration: 600, timestamp: Date.now(), animationKey: skill.animation } });
          await new Promise(r => setTimeout(r, 600));
          set({ activeSpellEffect: null });
      }

      // Determine Targets
      let targets: any[] = [];
      const isBuff = skill.type === SpellType.BUFF || skill.type === SpellType.HEAL || (skill as Skill).effect === 'HEAL_SELF' || (skill as Skill).effect === 'BUFF_STR' || (skill as Skill).effect === 'APPLY_EFFECT';
      
      if (skill.aoeRadius && skill.aoeRadius > 0) {
          const tiles = getAoETiles(activeEntity.position, { x, y: z }, skill.aoeType || 'CIRCLE', skill.aoeRadius);
          targets = battleEntities.filter(e => e.stats.hp > 0 && (isBuff ? true : e.type === 'ENEMY') && tiles.some(t => t.x === e.position.x && t.y === e.position.y));
      } else {
          // Single Target Logic
          // If self-cast effect, prioritize self
          if ((skill as Skill).effect === 'HEAL_SELF' || (skill as Skill).statusEffect === 'RAGE' || (skill as Skill).statusEffect === 'STONE_SKIN') {
              targets.push(activeEntity);
          } else {
              // Check for clicked entity
              const clickedEntity = battleEntities.find(e => e.position.x === x && e.position.y === z && e.stats.hp > 0);
              if (clickedEntity) {
                  if (isBuff) targets.push(clickedEntity);
                  else if (clickedEntity.type === 'ENEMY') targets.push(clickedEntity);
              }
          }
      }

      if (targets.length === 0 && !skill.aoeRadius) {
          get().addLog("No valid target.", "info");
          set({ isActionAnimating: false });
          return;
      }

      // Apply
      let newEntities = [...battleEntities];
      const newPopups = [...state.damagePopups];
      let cooldownApplied = false;

      const applyCooldown = () => {
          if (cooldownApplied) return;
          const idx = newEntities.findIndex(e => e.id === activeEntity.id);
          if (idx !== -1) {
              if (skill.id === 'smite' || skill.id === 'SMITE') {
                  const slots = newEntities[idx].stats.spellSlots;
                  newEntities[idx] = { ...newEntities[idx], stats: { ...newEntities[idx].stats, spellSlots: { ...slots, current: slots.current - 1 } } };
              }
              if ((skill as Skill).cooldown) {
                  const cd = { ...newEntities[idx].stats.activeCooldowns, [(skill as Skill).id]: (skill as Skill).cooldown };
                  newEntities[idx] = { ...newEntities[idx], stats: { ...newEntities[idx].stats, activeCooldowns: cd } };
              }
          }
          cooldownApplied = true;
      };

      // Damage Logic
      if (skill.diceCount || (skill as Skill).damageMultiplier) {
          targets.forEach(target => {
              if (target.type !== 'ENEMY') return;
              let damage = 0;
              if ((skill as Spell).diceCount) damage = rollDice((skill as Spell).diceSides, (skill as Spell).diceCount);
              else if ((skill as Skill).damageMultiplier) damage = Math.floor(calculateDamage(activeEntity).amount * (skill as Skill).damageMultiplier);
              
              const { finalDamage, isVulnerable, isResistant, isImmune } = calculateFinalDamage(damage, skill.damageType || DamageType.FORCE, target, true);
              const newHp = Math.max(0, target.stats.hp - finalDamage);
              const tIndex = newEntities.findIndex(e => e.id === target.id);
              if (tIndex !== -1) {
                  let targetStats = { ...newEntities[tIndex].stats, hp: newHp };
                  
                  // Guiding Bolt Effect: Advantage on next hit
                  if (skill.id === 'guiding_bolt') {
                      targetStats.statusEffects = { ...targetStats.statusEffects, 'GUIDING_BOLT_ADV': 2 };
                  }
                  // Trip Attack
                  if ((skill as Skill).effect === 'APPLY_EFFECT' && (skill as Skill).statusEffect === 'ROOTED') {
                      targetStats.statusEffects = { ...targetStats.statusEffects, 'ROOTED': 2 };
                  }

                  newEntities[tIndex] = { ...newEntities[tIndex], stats: targetStats };
              }

              let color = '#a855f7';
              if (isVulnerable) color = '#ef4444';
              else if (isResistant) color = '#d97706';
              if (isImmune) color = '#94a3b8';

              newPopups.push({ id: generateId(), position: [target.position.x, 0, target.position.y], amount: isImmune ? 'IMMUNE' : finalDamage, color, isCrit: false, timestamp: Date.now() });
          });
          applyCooldown();
      }

      // Buffs/Effects
      if ((skill as Skill).effect === 'APPLY_EFFECT' || (skill as Skill).effect === 'BUFF_STR') {
          targets.forEach(target => {
              const status = (skill as Skill).statusEffect || 'BUFF';
              const tIndex = newEntities.findIndex(e => e.id === target.id);
              if (tIndex !== -1) {
                  const currentEffects = { ...(newEntities[tIndex].stats.statusEffects || {}) };
                  currentEffects[status] = 3; 
                  newEntities[tIndex] = { ...newEntities[tIndex], stats: { ...newEntities[tIndex].stats, statusEffects: currentEffects } };
                  newPopups.push({ id: generateId(), position: [target.position.x, 0, target.position.y], amount: status, color: '#3b82f6', isCrit: false, timestamp: Date.now() });
              }
          });
          applyCooldown();
      }

      // Heals
      if (skill.type === SpellType.HEAL || (skill as Skill).effect === 'HEAL_SELF') {
           const actualTargets = (skill as Skill).effect === 'HEAL_SELF' ? [activeEntity] : targets;
           actualTargets.forEach(target => {
                let amount = rollDice(8, 1) + getModifier(activeEntity.stats.attributes.WIS);
                if (skill.id === 'lay_on_hands') amount = 15;
                if (skill.id === 'mass_heal') amount = rollDice(4, 2) + getModifier(activeEntity.stats.attributes.WIS);

                const newHp = Math.min(target.stats.maxHp, target.stats.hp + amount);
                const tIndex = newEntities.findIndex(e => e.id === target.id);
                if (tIndex !== -1) newEntities[tIndex] = { ...newEntities[tIndex], stats: { ...newEntities[tIndex].stats, hp: newHp } };
                newPopups.push({ id: generateId(), position: [target.position.x, 0, target.position.y], amount: `+${amount}`, color: '#22c55e', isCrit: false, timestamp: Date.now() });
           });
           applyCooldown();
      }

      get().addLog(`${activeEntity.name} uses ${skill.name}.`, "combat");
      
      const isBonus = (skill as Skill).isBonusAction;
      set({ battleEntities: newEntities, hasActed: !isBonus, damagePopups: newPopups, isActionAnimating: false, selectedAction: null, selectedSpell: null, selectedSkill: null });
      get().checkBattleEnd();
  },

  performEnemyTurn: async () => {
      const state = get();
      const { battleEntities, turnOrder, currentTurnIndex, battleMap } = state;
      const activeEntityId = turnOrder[currentTurnIndex];
      const activeEntity = battleEntities.find(e => e.id === activeEntityId);

      // AI should only run if it's actually their turn and they are alive
      if (!activeEntity || activeEntity.type !== 'ENEMY' || activeEntity.stats.hp <= 0) {
          get().nextTurn();
          return;
      }

      await new Promise(r => setTimeout(r, 600)); 

      // --- AI BRAIN ---
      const players = battleEntities.filter(e => e.type === 'PLAYER' && e.stats.hp > 0);
      const allies = battleEntities.filter(e => e.type === 'ENEMY' && e.id !== activeEntity.id && e.stats.hp > 0);
      
      if (players.length === 0) { get().nextTurn(); return; }

      const behavior = activeEntity.aiBehavior || AIBehavior.BASIC_MELEE;
      
      let target = players[0];
      let bestScore = -9999;

      // 1. Target Selection
      players.forEach(p => {
          const dist = Math.abs(p.position.x - activeEntity.position.x) + Math.abs(p.position.y - activeEntity.position.y);
          let score = 100 - dist; 
          if (p.stats.hp < p.stats.maxHp * 0.3) score += 50; 
          if (score > bestScore) { bestScore = score; target = p; }
      });

      const distToTarget = Math.max(Math.abs(activeEntity.position.x - target.position.x), Math.abs(activeEntity.position.y - target.position.y));
      let enemyHasActed = false;

      // 2. Specialized Behaviors
      
      // --- HEALER AI ---
      if (behavior === AIBehavior.HEALER) {
          const woundedAlly = allies.find(a => a.stats.hp < a.stats.maxHp * 0.5);
          if (woundedAlly) {
              const distToAlly = Math.max(Math.abs(activeEntity.position.x - woundedAlly.position.x), Math.abs(activeEntity.position.y - woundedAlly.position.y));
              if (distToAlly <= 4 && checkLineOfSight(activeEntity.position, woundedAlly.position, battleMap)) {
                  set({ isActionAnimating: true });
                  sfx.playMagic();
                  await new Promise(r => setTimeout(r, 400));
                  const healAmt = 10;
                  const newHp = Math.min(woundedAlly.stats.maxHp, woundedAlly.stats.hp + healAmt);
                  const newEntities = get().battleEntities.map(e => e.id === woundedAlly.id ? { ...e, stats: { ...e.stats, hp: newHp } } : e);
                  const popups = [...get().damagePopups, { id: generateId(), position: [woundedAlly.position.x, 0, woundedAlly.position.y], amount: `+${healAmt}`, color: '#22c55e', isCrit: false, timestamp: Date.now() }];
                  set({ battleEntities: newEntities, damagePopups: popups, isActionAnimating: false });
                  get().addLog(`${activeEntity.name} heals ${woundedAlly.name}.`, "combat");
                  enemyHasActed = true;
              }
          }
      }

      // --- SPELLCASTER / ARCHER AI ---
      if (!enemyHasActed && (behavior === AIBehavior.SPELLCASTER || behavior === AIBehavior.DEFENSIVE)) {
          // Range check (5 for spells, 6 for bows)
          const range = behavior === AIBehavior.SPELLCASTER ? 5 : 6;
          
          if (distToTarget <= range && checkLineOfSight(activeEntity.position, target.position, battleMap)) {
               // Ranged Attack
               set({ isActionAnimating: true });
               sfx.playMagic(); // Reuse magic sound for ranged attacks for simplicity or add bow sound
               await new Promise(r => setTimeout(r, 400));
               
               const dmg = calculateDamage(activeEntity); 
               // Spellcaster = Fire damage usually, Archer = Piercing
               const dmgType = behavior === AIBehavior.SPELLCASTER ? DamageType.FIRE : DamageType.PIERCING;
               const { finalDamage } = calculateFinalDamage(dmg.amount, dmgType, target); 
               
               const newHp = Math.max(0, target.stats.hp - finalDamage);
               const newEntities = get().battleEntities.map(e => e.id === target.id ? { ...e, stats: { ...e.stats, hp: newHp } } : e);
               const popups = [...get().damagePopups, { id: generateId(), position: [target.position.x, 0, target.position.y], amount: finalDamage, color: '#ef4444', isCrit: false, timestamp: Date.now() }];
               
               set({ battleEntities: newEntities, damagePopups: popups, isActionAnimating: false });
               get().addLog(`${activeEntity.name} attacks ${target.name} from range!`, "combat");
               enemyHasActed = true;
          } 
          else if (behavior === AIBehavior.DEFENSIVE && distToTarget < 2) {
              // Too close! Flee logic: Pick a tile away from target
              // Simple implementation: Just don't advance, maybe wait
              enemyHasActed = true; // Skip turn effectively or implement flee move
          }
      } 
      
      // --- BASIC MELEE / FALLBACK ---
      if (!enemyHasActed) {
          if (distToTarget <= 1.5) {
              // Melee Attack
              set({ isActionAnimating: true });
              sfx.playAttack();
              await new Promise(r => setTimeout(r, 400));
              
              const roll = calculateAttackRoll(activeEntity);
              if (roll.total >= target.stats.ac) {
                  sfx.playHit();
                  const dmg = calculateDamage(activeEntity, EquipmentSlot.MAIN_HAND, roll.isCrit);
                  const { finalDamage, isImmune, isResistant, isVulnerable } = calculateFinalDamage(dmg.amount, dmg.type, target);
                  
                  const newHp = Math.max(0, target.stats.hp - finalDamage);
                  const newEntities = get().battleEntities.map(e => e.id === target.id ? { ...e, stats: { ...e.stats, hp: newHp } } : e);
                  
                  let color = '#ef4444';
                  if (isImmune) color = '#94a3b8';
                  else if (isResistant) color = '#d97706';
                  
                  const popups = [...get().damagePopups, { id: generateId(), position: [target.position.x, 0, target.position.y], amount: isImmune ? 'IMMUNE' : finalDamage, color, isCrit: roll.isCrit, timestamp: Date.now() }];
                  set({ battleEntities: newEntities, damagePopups: popups });
                  get().addLog(`${activeEntity.name} attacks ${target.name} for ${finalDamage}!`, "combat");
              } else {
                  const popups = [...get().damagePopups, { id: generateId(), position: [target.position.x, 0, target.position.y], amount: 'MISS', color: '#94a3b8', isCrit: false, timestamp: Date.now() }];
                  set({ damagePopups: popups });
                  get().addLog(`${activeEntity.name} misses.`, "combat");
              }
              set({ isActionAnimating: false });
          } else {
              // Move towards
              // CHECK ROOT
              if (activeEntity.stats.statusEffects && activeEntity.stats.statusEffects['ROOTED']) {
                  get().addLog(`${activeEntity.name} is rooted!`, "combat");
              } else {
                  const path = findBattlePath(activeEntity.position, target.position, battleMap);
                  if (path && path.length > 1) {
                      const speed = 4;
                      const moveNode = path[Math.min(path.length - 2, speed)];
                      const isOccupied = battleEntities.some(e => e.position.x === moveNode.x && e.position.y === moveNode.z && e.stats.hp > 0);
                      if (!isOccupied) {
                          const newEntities = battleEntities.map(e => e.id === activeEntity.id ? { ...e, position: { x: moveNode.x, y: moveNode.z } } : e);
                          set({ battleEntities: newEntities });
                          sfx.playStep();
                      }
                  }
              }
          }
      }

      get().checkBattleEnd();
      
      // Safety: Ensure we don't dispatch state updates if the battle ended in the previous step
      if (get().gameState === GameState.BATTLE_TACTICAL) {
          get().nextTurn();
      }
  },

  nextTurn: async () => {
      const state = get();
      let nextIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
      let loopCount = 0;
      let found = false;
      let nextId = "";

      // Find next valid living entity
      while(loopCount < state.turnOrder.length) {
          nextId = state.turnOrder[nextIndex];
          const ent = state.battleEntities.find(e => e.id === nextId);
          if (ent && ent.stats.hp > 0) {
              found = true;
              break;
          }
          nextIndex = (nextIndex + 1) % state.turnOrder.length;
          loopCount++;
      }

      if (!found) return;

      // Force Reset Action State
      set({ 
          currentTurnIndex: nextIndex, 
          hasMoved: false, 
          hasActed: false, 
          selectedAction: null, 
          selectedTile: null, 
          selectedSpell: null, 
          selectedSkill: null,
          isSkillSelectionMode: false,
          isActionAnimating: false
      });

      // START OF TURN PROCESSING (DoTs, Cooldowns, Stuns)
      const canAct = await get().processStartOfTurn(nextId);
      
      if (!canAct) {
          // If stunned, recurse nextTurn but break stack with timeout to prevent infinite loop
          setTimeout(() => get().nextTurn(), 100); 
          return;
      }

      // If Enemy, trigger AI
      // Wait a microtask to ensure state is committed
      setTimeout(() => {
          const freshEnt = get().battleEntities.find((e: any) => e.id === nextId);
          if (freshEnt && freshEnt.type === 'ENEMY') {
              get().performEnemyTurn();
          }
      }, 50);
  },

  processStartOfTurn: async (entityId: string) => {
      const state = get();
      const entity = state.battleEntities.find(e => e.id === entityId);
      if (!entity) return false;

      let newStats = { ...entity.stats };
      let updated = false;
      const popups: DamagePopup[] = [];

      // 1. Cooldowns
      if (newStats.activeCooldowns) {
          const nextCD: Record<string, number> = {};
          Object.entries(newStats.activeCooldowns).forEach(([key, val]) => {
              const v = val as number;
              if (v > 1) nextCD[key] = v - 1;
          });
          newStats.activeCooldowns = nextCD;
          updated = true;
      }

      // 2. Status Effects (Duration)
      let stunned = false;
      if (newStats.statusEffects) {
          const nextEffects: Record<string, number> = {};
          
          for (const [effect, durationVal] of Object.entries(newStats.statusEffects)) {
              const duration = durationVal as number;

              // Apply DoTs
              if (effect === 'POISON' || effect === 'BLEED') {
                  const dmg = 3;
                  newStats.hp = Math.max(0, newStats.hp - dmg);
                  popups.push({ id: generateId(), position: [entity.position.x, 0, entity.position.y], amount: dmg, color: '#10b981', isCrit: false, timestamp: Date.now() });
                  get().addLog(`${entity.name} takes ${dmg} ${effect.toLowerCase()} damage.`, "combat");
                  updated = true;
              }
              
              // Check CC
              if (effect === 'STUN' || effect === 'FREEZE') {
                  stunned = true;
                  popups.push({ id: generateId(), position: [entity.position.x, 0, entity.position.y], amount: 'STUNNED', color: '#fbbf24', isCrit: false, timestamp: Date.now() });
                  get().addLog(`${entity.name} is stunned!`, "combat");
              }

              if (duration > 1) nextEffects[effect] = duration - 1;
              else get().addLog(`${entity.name}'s ${effect} wore off.`, "info");
          }
          newStats.statusEffects = nextEffects;
          updated = true;
      }

      if (updated) {
          const newEntities = state.battleEntities.map(e => e.id === entityId ? { ...e, stats: newStats } : e);
          set({ battleEntities: newEntities, damagePopups: [...state.damagePopups, ...popups] });
          
          if (newStats.hp <= 0) {
              get().checkBattleEnd();
              return false;
          }
      }

      if (stunned) {
          await new Promise(r => setTimeout(r, 1000)); // Pause to show stun
          return false; // Skip turn
      }

      return true; // Can act
  },

  checkBattleEnd: () => {
      const { battleEntities, party } = get();
      const playersAlive = battleEntities.filter(e => e.type === 'PLAYER' && e.stats.hp > 0);
      const enemiesAlive = battleEntities.filter(e => e.type === 'ENEMY' && e.stats.hp > 0);

      if (playersAlive.length === 0) {
          set({ gameState: GameState.BATTLE_DEFEAT });
          sfx.playHit();
      } else if (enemiesAlive.length === 0) {
          let totalXp = 0;
          let totalGold = 0;
          let items: any[] = [];
          
          const contentStore = useContentStore.getState();
          const enemyDefs = contentStore.enemies;
          const allItems = contentStore.items;

          battleEntities.forEach(e => {
              if (e.type === 'ENEMY') {
                  const defId = e.defId; 
                  const def = defId ? enemyDefs[defId] : null;

                  if (def) {
                      totalXp += def.xpReward || 10;
                      totalGold += Math.floor(Math.random() * 5) + 1; 
                      if (def.lootTable) {
                          def.lootTable.forEach(entry => {
                              if (Math.random() < entry.chance) {
                                  const itemDef = allItems[entry.itemId];
                                  if (itemDef) items.push(itemDef);
                              }
                          });
                      }
                  } else {
                      totalXp += 20; totalGold += 5;
                  }
              }
          });

          const updatedParty = party.map(p => {
              const battleVersion = battleEntities.find(b => b.id === p.id);
              if (battleVersion) return { ...p, stats: battleVersion.stats };
              return p;
          });
          
          set({ 
              gameState: GameState.BATTLE_VICTORY, 
              battleRewards: { xp: totalXp, gold: totalGold, items },
              party: updatedParty
          });
          sfx.playVictory();
      }
  },

  continueAfterVictory: () => {
      const { battleRewards, party } = get();
      const { addGold, addItem } = get(); 
      addGold(battleRewards.gold);
      battleRewards.items.forEach(i => addItem(i));
      
      const xpPerMember = Math.floor(battleRewards.xp / party.length);
      
      const newParty = party.map(p => {
          const newXp = p.stats.xp + xpPerMember;
          return { ...p, stats: { ...p.stats, xp: newXp } };
      });
      
      set({ party: newParty });

      const anyoneLeveling = newParty.some(p => p.stats.xp >= p.stats.xpToNextLevel);

      if (anyoneLeveling) {
          set({ gameState: GameState.LEVEL_UP });
          sfx.playVictory(); 
      } else {
          set({ gameState: GameState.OVERWORLD });
      }
  },

  restartBattle: () => { get().loadGame(); },

  collectLoot: (dropId) => {
      const { lootDrops, addItem } = get();
      const dropIndex = lootDrops.findIndex(d => d.id === dropId);
      if (dropIndex !== -1) {
          const drop = lootDrops[dropIndex];
          drop.items.forEach(i => addItem(i));
          get().addGold(drop.gold);
          const newDrops = [...lootDrops];
          newDrops.splice(dropIndex, 1);
          set({ lootDrops: newDrops });
          sfx.playUiClick();
          get().addLog("Loot collected!", "info");
      }
  },

  attemptRun: () => {
      if (Math.random() > 0.4) {
          get().addLog("Escaped successfully!", "narrative");
          set({ gameState: GameState.OVERWORLD });
      } else {
          get().addLog("Failed to run!", "combat");
          set({ hasActed: true, hasMoved: true });
      }
  },

  hasLineOfSight: (source, target) => { return checkLineOfSight(source, target, get().battleMap); },
  getAttackPrediction: () => null, 
  removeDamagePopup: (id) => { set(state => ({ damagePopups: state.damagePopups.filter(p => p.id !== id) })); }
});
