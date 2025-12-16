
import { StateCreator } from 'zustand';
import { GameState, Dimension, Difficulty, HexCell, PositionComponent, WeatherType, OverworldEntity, Quest, GameStateData, TerrainType, SaveMetadata } from '../../types';
import { WorldGenerator } from '../../services/WorldGenerator';
import { findPath } from '../../services/pathfinding';
import { calculateVisionRange } from '../../services/dndRules';
import { sfx } from '../../services/SoundSystem';
import { useContentStore } from '../contentStore';
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, TERRAIN_MOVEMENT_COST, CORRUPTION_THRESHOLDS, ITEMS } from '../../constants';
import { getSupabase } from '../../services/supabaseClient';

// CONSTANTS FOR SAVE SYSTEM
const SAVE_KEY_PREFIX = 'epic_earth_eternum_save_v1_slot'; 
const CURRENT_SAVE_VERSION = 3; 

interface SaveFile {
    version: number;
    timestamp: number;
    data: any;
    summary?: SaveMetadata['summary'];
}

// MIGRATION LOGIC
const MIGRATIONS: Record<number, (data: any) => any> = {
    2: (data) => ({ ...data, characterPool: [] }), 
    3: (data) => ({ ...data, worldTime: 480 }) 
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- QUEST STRATEGY PATTERN ---

interface QuestContext {
    state: OverworldSlice & any; // Access full state
    quest: Quest;
    triggerChange: (msg: string, type: any) => void;
}

const QuestEvaluators: Record<string, (ctx: QuestContext) => Quest | null> = {
    'vecna_1': ({ state, quest, triggerChange }) => {
        // Condition: Visit [0,0] in Normal World
        if (state.playerPos.x === 0 && state.playerPos.y === 0 && state.dimension === Dimension.NORMAL) {
            triggerChange("Quest Completed: The Thinning Veil", "narrative");
            triggerChange("You feel a cold breeze. A rift to the Shadow Realm must be nearby.", "narrative");
            state.addGold(100);
            sfx.playVictory();
            return { ...quest, completed: true };
        }
        return null;
    },
    'vecna_2': ({ state, quest, triggerChange }) => {
        // Condition: Enter Upside Down
        if (state.dimension === Dimension.UPSIDE_DOWN) {
            triggerChange("Quest Completed: Into the Abyss", "narrative");
            triggerChange("The air tastes of ash. Vecna's influence is strong here.", "combat");
            sfx.playVictory();
            return { ...quest, completed: true };
        }
        return null;
    },
    'vecna_3': ({ state, quest }) => {
        // Condition: Handled by Boss Kill Event usually, but we keep this stub for consistency
        return null; 
    }
};

const QuestChainLogic = (quests: Quest[], spawnBoss: () => void): Quest[] => {
    const newQuests = [...quests];
    const vecna1Done = quests.find(q => q.id === 'vecna_1')?.completed;
    const vecna2Done = quests.find(q => q.id === 'vecna_2')?.completed;
    
    if (vecna1Done && !quests.find(q => q.id === 'vecna_2')) {
        newQuests.push({
            id: 'vecna_2',
            title: 'Into the Abyss',
            description: 'Find a Portal and enter the Shadow Realm (Upside Down).',
            type: 'MAIN',
            completed: false
        });
    }

    if (vecna2Done && !quests.find(q => q.id === 'vecna_3')) {
        newQuests.push({
            id: 'vecna_3',
            title: 'The Lich Lord',
            description: 'Travel to the Shadow Keep at [0,0] in the Upside Down and defeat the Avatar of Vecna.',
            type: 'MAIN',
            completed: false
        });
        spawnBoss();
    }
    return newQuests;
};

export interface OverworldSlice {
  gameState: GameState;
  dimension: Dimension;
  difficulty: Difficulty;
  exploredTiles: Record<Dimension, Set<string>>;
  visitedTowns: Record<string, boolean>;
  clearedEncounters: Set<string>;
  townMapData: HexCell[] | null;
  activeOverworldEnemies: OverworldEntity[];
  playerPos: PositionComponent;
  isPlayerMoving: boolean;
  lastOverworldPos: PositionComponent | null;
  mapDimensions: { width: number; height: number };
  quests: Quest[];
  standingOnPortal: boolean;
  standingOnSettlement: boolean;
  standingOnTemple: boolean;
  isMapOpen: boolean;
  gracePeriodEndTime: number;
  fatigue: number; 
  worldTime: number; 
  userSession: any | null; 
  currentRegionName: string | null;

  setGameState: (state: GameState) => void;
  initializeWorld: () => void;
  movePlayerOverworld: (q: number, r: number) => Promise<void>;
  usePortal: () => void;
  enterSettlement: () => void;
  exitSettlement: () => void;
  enterTemple: () => void;
  toggleMap: () => void;
  
  saveGame: (slotIndex?: number) => Promise<void>;
  loadGame: (slotIndex?: number) => Promise<void>;
  getSaveSlots: () => Promise<SaveMetadata[]>;
  
  quitToMenu: () => void;
  camp: () => void;
  setUserSession: (session: any) => void;
  logout: () => Promise<void>;
  
  checkQuestProgress: () => void;
  spawnBoss: () => void;
}

const generateTownMap = (): HexCell[] => {
    const width = 12;
    const height = 12;
    const cells: HexCell[] = [];
    
    for (let r = 0; r < height; r++) {
        for (let q = 0; q < width; q++) {
            let terrain = TerrainType.GRASS;
            let poiType: HexCell['poiType'] = undefined;
            if (q >= 4 && q <= 7 && r >= 4 && r <= 7) {
                terrain = TerrainType.COBBLESTONE;
                if (q === 5 && r === 5) poiType = 'PLAZA';
            } else if (q === 5 || q === 6 || r === 5 || r === 6) {
                terrain = TerrainType.DIRT_ROAD;
            } else if (Math.random() > 0.4) {
                 terrain = TerrainType.COBBLESTONE; 
                 if (Math.random() > 0.8) poiType = 'SHOP';
                 else if (Math.random() > 0.9) poiType = 'INN';
            }
            if (q === 0 || q === width-1 || r === 0 || r === height-1) {
                poiType = 'EXIT';
                terrain = TerrainType.DIRT_ROAD;
            }
            cells.push({ q, r, terrain, isExplored: true, isVisible: true, weather: WeatherType.NONE, poiType });
        }
    }
    return cells;
};

const updateExploration = (center: PositionComponent, dimension: Dimension, radius: number, currentSet: Set<string>): Set<string> => {
    const safeSet = currentSet || new Set<string>();
    const newSet = new Set(safeSet);
    
    for (let q = center.x - radius; q <= center.x + radius; q++) {
        for (let r = center.y - radius; r <= center.y + radius; r++) {
            const dist = (Math.abs(q - center.x) + Math.abs(q + r - center.x - center.y) + Math.abs(r - center.y)) / 2;
            if (dist <= radius) {
                newSet.add(`${q},${r}`);
            }
        }
    }
    return newSet;
};

export const createOverworldSlice: StateCreator<any, [], [], OverworldSlice> = (set, get) => ({
  gameState: GameState.TITLE,
  dimension: Dimension.NORMAL,
  difficulty: Difficulty.NORMAL,
  exploredTiles: { [Dimension.NORMAL]: new Set(), [Dimension.UPSIDE_DOWN]: new Set() },
  visitedTowns: {},
  clearedEncounters: new Set(),
  townMapData: null,
  activeOverworldEnemies: [],
  playerPos: { x: 0, y: 0 },
  isPlayerMoving: false,
  lastOverworldPos: null,
  mapDimensions: { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT },
  quests: [],
  standingOnPortal: false,
  standingOnSettlement: false,
  standingOnTemple: false,
  isMapOpen: false,
  gracePeriodEndTime: 0,
  fatigue: 0,
  worldTime: 480, 
  userSession: null,
  currentRegionName: "Terra Aeterna",

  setGameState: (state) => set({ gameState: state }),
  
  initializeWorld: () => {
       WorldGenerator.init(12345);
  },

  setUserSession: (session) => set({ userSession: session }),

  logout: async () => {
      const supabase = getSupabase();
      if (supabase) {
          await supabase.auth.signOut();
      }
      set({ userSession: null });
      sfx.playUiClick();
      get().addLog("Logged out.", "info");
  },

  toggleMap: () => { 
      sfx.playUiClick(); 
      set(state => ({ isMapOpen: !state.isMapOpen, isInventoryOpen: false })); 
  },

  checkQuestProgress: () => {
      const { quests } = get();
      let updatedQuests = [...quests];
      let changed = false;

      updatedQuests = updatedQuests.map(q => {
          if (q.completed) return q;
          
          const evaluator = QuestEvaluators[q.id];
          if (evaluator) {
              const result = evaluator({
                  state: get(),
                  quest: q,
                  triggerChange: get().addLog
              });
              if (result) {
                  changed = true;
                  return result;
              }
          }
          return q;
      });

      if (changed) {
          // Process Quest Chain Logic
          const chainedQuests = QuestChainLogic(updatedQuests, get().spawnBoss);
          set({ quests: chainedQuests });
      }
  },

  spawnBoss: () => {
      const { activeOverworldEnemies } = get();
      const existingBoss = activeOverworldEnemies.find(e => e.defId === 'lich_lord');
      if (existingBoss) return;

      const boss: OverworldEntity = {
          id: 'boss_vecna_avatar',
          defId: 'lich_lord',
          name: 'Avatar of Vecna',
          sprite: ITEMS.SHARD_OF_VECNA.icon, 
          dimension: Dimension.UPSIDE_DOWN,
          q: 0,
          r: 0,
          visionRange: 10
      };
      
      set({ activeOverworldEnemies: [...activeOverworldEnemies, boss] });
      get().addLog("A dark presence has manifested in the Shadow Realm...", "combat");
  },

  movePlayerOverworld: async (q, r) => {
        const { isPlayerMoving, playerPos, dimension, gameState, townMapData, activeOverworldEnemies, party, clearedEncounters, exploredTiles, gracePeriodEndTime, fatigue, worldTime, currentRegionName, quests } = get();
        
        const currentKey = `${q},${r}`;
        const isAlreadyThere = playerPos.x === q && playerPos.y === r;
        const currentExploredSet = exploredTiles[dimension] || new Set();
        const isTileExplored = currentExploredSet.has(currentKey);
        const isGracePeriod = Date.now() < gracePeriodEndTime;

        if (isPlayerMoving) return;
        if (isAlreadyThere && isTileExplored) return;

        let path: any[] | null = [];
        
        if (gameState === GameState.TOWN_EXPLORATION && townMapData) {
            path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, townMapData);
        } else {
            path = findPath({q: playerPos.x, r: playerPos.y}, {q, r}, undefined, (q, r) => WorldGenerator.getTile(q, r, dimension));
        }

        if (!path || path.length === 0) {
             if (isAlreadyThere) path = [{ q, r, terrain: WorldGenerator.getTile(q, r, dimension).terrain }];
             else return;
        }
        
        if (!isGracePeriod) {
            const isChaseMode = activeOverworldEnemies.some((e: any) => {
                if (e.dimension !== dimension) return false;
                const dist = (Math.abs(e.q - playerPos.x) + Math.abs(e.q + e.r - playerPos.x - playerPos.y) + Math.abs(e.r - playerPos.y)) / 2;
                return dist <= e.visionRange;
            });

            if (isChaseMode && path.length > 1) {
                path = [path[0]]; 
            }
        }

        set({ isPlayerMoving: true }); 
        if (!isAlreadyThere) sfx.playUiClick();
        
        let currentFatigue = fatigue;
        let currentTime = worldTime;
        let isExhausted = false;

        for (const stepCell of path) {
            if (get().gameState !== GameState.OVERWORLD && get().gameState !== GameState.TOWN_EXPLORATION) break;
            
            const terrainCost = TERRAIN_MOVEMENT_COST[stepCell.terrain] || 1;
            const dimensionMultiplier = dimension === Dimension.UPSIDE_DOWN ? 3 : 1;
            
            currentFatigue += terrainCost * dimensionMultiplier;
            
            const timeCost = get().gameState === GameState.TOWN_EXPLORATION ? 5 : (60 * terrainCost);
            currentTime = (currentTime + timeCost) % 1440;

            if (currentFatigue >= 100) {
                isExhausted = true;
                currentFatigue = 100;
            }
            
            if (stepCell.regionName && stepCell.regionName !== currentRegionName && get().gameState === GameState.OVERWORLD) {
                set({ currentRegionName: stepCell.regionName });
                get().addLog(`Entered ${stepCell.regionName}`, "narrative");
                sfx.playMagic(); 
            }

            set({ fatigue: currentFatigue, worldTime: currentTime });

            if (isExhausted && Math.random() > 0.5) {
                const exhaustedParty = get().party.map((p: any) => ({
                    ...p,
                    stats: { ...p.stats, hp: Math.max(1, p.stats.hp - 1) }
                }));
                set({ party: exhaustedParty });
                if (Math.random() > 0.8) sfx.playHit();
            }

            // CHECK BOSS ENCOUNTER (SCRIPTED)
            const quest3Active = quests.find(qu => qu.id === 'vecna_3' && !qu.completed);
            if (dimension === Dimension.UPSIDE_DOWN && stepCell.q === 0 && stepCell.r === 0 && quest3Active) {
                // Ensure boss is spawned just in case
                get().spawnBoss();
                // Force start battle with Lich Lord
                get().addLog("You confront the Avatar of Vecna!", "combat");
                // Find the boss entity created by spawnBoss
                const bossEnt = get().activeOverworldEnemies.find(e => e.defId === 'lich_lord');
                get().startBattle(TerrainType.LAVA, WeatherType.ASH, bossEnt?.id); // Lava arena
                break;
            }

            if (!isGracePeriod) {
                const enemyOnTile = get().activeOverworldEnemies.find((e: any) => e.q === stepCell.q && e.r === stepCell.r && e.dimension === dimension);
                if (enemyOnTile) {
                    get().startBattle(stepCell.terrain, stepCell.weather, enemyOnTile.id);
                    break;
                }
            }

            if (!isAlreadyThere) sfx.playStep();
            
            const { dimension: currentDim, exploredTiles: currentExplored } = get();
            
            if (get().gameState === GameState.TOWN_EXPLORATION && stepCell.poiType === 'EXIT') {
                 get().exitSettlement();
                 break;
            }

            let newExploredSet = new Set(currentExplored[currentDim] || []);
            let newEnemies = [...get().activeOverworldEnemies];

            if (get().gameState === GameState.OVERWORLD) {
                const leader = party[0];
                const wis = leader?.stats?.attributes?.WIS || 10;
                const corr = leader?.stats?.corruption || 0;
                const isNight = currentTime > 1320 || currentTime < 240;
                let visionRadius = currentDim === Dimension.UPSIDE_DOWN ? 2 : calculateVisionRange(wis, corr);
                if (isNight) visionRadius = Math.max(1, visionRadius - 1);

                for (let vq = stepCell.q - visionRadius; vq <= stepCell.q + visionRadius; vq++) {
                    for (let vr = stepCell.r - visionRadius; vr <= stepCell.r + visionRadius; vr++) {
                        const dist = (Math.abs(vq - stepCell.q) + Math.abs(vq + vr - stepCell.q - stepCell.r) + Math.abs(vr - stepCell.r)) / 2;
                        if (dist <= visionRadius) {
                            const key = `${vq},${vr}`;
                            if (!newExploredSet.has(key)) {
                                newExploredSet.add(key);
                            }
                        }
                    }
                }

                set({ 
                    playerPos: { x: stepCell.q, y: stepCell.r },
                    exploredTiles: { ...currentExplored, [currentDim]: newExploredSet },
                    activeOverworldEnemies: newEnemies,
                    standingOnPortal: !!stepCell.hasPortal,
                    standingOnSettlement: (stepCell.terrain === TerrainType.VILLAGE || stepCell.terrain === TerrainType.CASTLE),
                    standingOnTemple: stepCell.poiType === 'TEMPLE'
                });

            } else {
                set({ 
                    playerPos: { x: stepCell.q, y: stepCell.r },
                    standingOnPortal: false,
                    standingOnSettlement: false,
                    standingOnTemple: false
                });
            }

            // TRIGGER QUEST CHECK
            if (get().gameState === GameState.OVERWORLD) {
                get().checkQuestProgress();
            }

            if (stepCell.hasPortal && get().gameState === GameState.OVERWORLD) { sfx.playMagic(); break; }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        set({ isPlayerMoving: false });
  },

  camp: () => {
      const { gameState, removeItems, party, playerPos, dimension, saveGame, worldTime } = get();
      if (gameState !== GameState.OVERWORLD) return;

      if (!removeItems(ITEMS.RATION.id, 1)) {
          get().addLog("You need Rations to set up camp!", "info");
          return;
      }

      sfx.playUiClick();
      
      const newTime = (worldTime + 480) % 1440;

      const restedParty = party.map((p: any) => {
          const healAmount = Math.floor(p.stats.maxHp * 0.3) + 2;
          const recoveredStamina = Math.floor(p.stats.maxStamina * 0.5) + 5;
          const currentSlots = p.stats.spellSlots.current;
          const maxSlots = p.stats.spellSlots.max;
          
          return {
              ...p,
              stats: {
                  ...p.stats,
                  hp: Math.min(p.stats.maxHp, p.stats.hp + healAmount),
                  stamina: Math.min(p.stats.maxStamina, p.stats.stamina + recoveredStamina),
                  spellSlots: { ...p.stats.spellSlots, current: Math.min(maxSlots, currentSlots + 1) }
              }
          };
      });

      set({ party: restedParty, fatigue: 0, worldTime: newTime });
      get().addLog("The party rests for 8 hours. HP and Fatigue restored.", "narrative");

      const tile = WorldGenerator.getTile(playerPos.x, playerPos.y, dimension);
      const ambushChance = dimension === Dimension.UPSIDE_DOWN ? 0.35 : 0.15;
      
      if (Math.random() < ambushChance) {
          get().addLog("AMBUSH! Enemies attack your camp!", "combat");
          setTimeout(() => {
              get().startBattle(tile.terrain, tile.weather);
          }, 1000);
      } else {
          saveGame(0);
      }
  },

  enterSettlement: () => {
        const { playerPos, party } = get();
        sfx.playUiClick();
        
        const cleansedParty = party.map((p: any) => {
            const cleansedP = { ...p, stats: { ...p.stats, corruption: 0 } };
            const newStats = get().recalculateStats(cleansedP);
            newStats.hp = newStats.maxHp;
            return { ...p, stats: newStats };
        });
        
        get().addLog("The sanctuary purges the shadow from your soul.", "narrative");

        const townMap = generateTownMap();
        set({ 
            gameState: GameState.TOWN_EXPLORATION, 
            lastOverworldPos: playerPos,
            townMapData: townMap,
            playerPos: { x: 0, y: 6 }, 
            standingOnSettlement: false,
            mapDimensions: { width: 12, height: 12 },
            party: cleansedParty,
            fatigue: 0
        });
        sfx.playVictory(); 
  },

  exitSettlement: () => {
        const { lastOverworldPos } = get();
        if (!lastOverworldPos) return;
        sfx.playUiClick();
        set({ 
            gameState: GameState.OVERWORLD,
            townMapData: null,
            playerPos: lastOverworldPos,
            lastOverworldPos: null,
            mapDimensions: { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT }
        });
        get().addLog("Returned to the wild.", "narrative");
  },

  enterTemple: () => {
      sfx.playMagic();
      set({ gameState: GameState.TEMPLE_HUB });
  },

  usePortal: () => {
        const { dimension, playerPos, exploredTiles, party } = get();
        
        if (!party || party.length === 0) {
            console.warn("Cannot use portal: Party not initialized.");
            return;
        }

        const targetDimension = dimension === Dimension.NORMAL ? Dimension.UPSIDE_DOWN : Dimension.NORMAL;
        sfx.playMagic(); 
        
        if (targetDimension === Dimension.UPSIDE_DOWN) {
            get().addLog("Entering the Shadow Realm...", "combat");
        } else {
            get().addLog("Escaping to Reality...", "narrative");
        }
        
        const leader = party[0];
        const vision = calculateVisionRange(leader.stats.attributes.WIS, leader.stats.corruption);
        
        const currentTargetSet = exploredTiles[targetDimension] || new Set();
        const newExploredSet = updateExploration(playerPos, targetDimension, vision, currentTargetSet);
        
        set({ 
            dimension: targetDimension, 
            exploredTiles: { ...exploredTiles, [targetDimension]: newExploredSet }
        });
        // Check quest immediately upon warp
        get().checkQuestProgress();
  },

  getSaveSlots: async () => {
        const { userSession } = get();
        const slots: SaveMetadata[] = [];
        const supabase = getSupabase();

        for (let i = 0; i < 3; i++) {
            const localKey = `${SAVE_KEY_PREFIX}_${i}`;
            const str = localStorage.getItem(localKey);
            if (str) {
                try {
                    const parsed = JSON.parse(str);
                    if (parsed.summary) {
                        slots.push({ slotIndex: i, timestamp: parsed.timestamp, summary: parsed.summary });
                    }
                } catch (e) {}
            }
        }

        if (userSession && supabase) {
            const { data } = await supabase
                .from('save_slots')
                .select('slot_index, updated_at, data')
                .eq('user_id', userSession.user.id);
            
            if (data) {
                data.forEach((row: any) => {
                    const summary = row.data?.summary;
                    if (summary) {
                        const existingIdx = slots.findIndex(s => s.slotIndex === row.slot_index);
                        const cloudMeta = {
                            slotIndex: row.slot_index,
                            timestamp: new Date(row.updated_at).getTime(),
                            summary
                        };
                        if (existingIdx !== -1) {
                            slots[existingIdx] = cloudMeta;
                        } else {
                            slots.push(cloudMeta);
                        }
                    }
                });
            }
        }
        return slots.sort((a, b) => a.slotIndex - b.slotIndex);
  },

  saveGame: async (slotIndex = 0) => { 
        const state = get();
        const leader = state.party[0];
        
        const summary = {
            charName: leader?.name || "Unknown",
            level: leader?.stats.level || 1,
            class: leader?.stats.class,
            location: `${state.dimension} - ${state.currentRegionName || 'Wilds'}`
        };

        const serializedExplored = {
            [Dimension.NORMAL]: Array.from(state.exploredTiles[Dimension.NORMAL] || []),
            [Dimension.UPSIDE_DOWN]: Array.from(state.exploredTiles[Dimension.UPSIDE_DOWN] || [])
        };
        
        const serializedClearedEncounters = Array.from(state.clearedEncounters || []);

        const persistentData = {
            party: state.party,
            characterPool: state.characterPool,
            inventory: state.inventory,
            gold: state.gold,
            fatigue: state.fatigue,
            worldTime: state.worldTime, 
            gameState: state.gameState === GameState.BATTLE_TACTICAL ? GameState.OVERWORLD : state.gameState,
            dimension: state.dimension,
            difficulty: state.difficulty,
            exploredTiles: serializedExplored,
            visitedTowns: state.visitedTowns,
            clearedEncounters: serializedClearedEncounters,
            activeOverworldEnemies: state.activeOverworldEnemies,
            playerPos: state.playerPos,
            lastOverworldPos: state.lastOverworldPos,
            mapDimensions: state.mapDimensions,
            quests: state.quests,
            currentRegionName: state.currentRegionName
        };

        const saveFile: SaveFile = {
            version: CURRENT_SAVE_VERSION,
            timestamp: Date.now(),
            data: persistentData,
            summary
        };

        const localKey = `${SAVE_KEY_PREFIX}_${slotIndex}`;
        try {
            localStorage.setItem(localKey, JSON.stringify(saveFile));
            
            const supabase = getSupabase();
            const session = state.userSession;
            if (supabase && session) {
                get().addLog("Syncing to cloud...", "info");
                const { error } = await supabase
                    .from('save_slots')
                    .upsert({ 
                        user_id: session.user.id,
                        slot_index: slotIndex,
                        data: saveFile,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id, slot_index' });
                
                if (error) {
                    console.error("Supabase Save Error:", error);
                    get().addLog("Cloud sync failed (Local OK).", "combat");
                } else {
                    get().addLog(`Saved to Slot ${slotIndex + 1} (Cloud).`, "info");
                }
            } else {
                get().addLog(`Saved to Slot ${slotIndex + 1} (Local).`, "info");
            }
        } catch (e) {
            console.error("Save Failed:", e);
            get().addLog("Failed to save game.", "combat");
        } 
  },

  loadGame: async (slotIndex = 0) => { 
        const state = get();
        const supabase = getSupabase();
        const session = state.userSession;
        
        let loadedData: SaveFile | null = null;
        let source = "Local";

        if (supabase && session) {
            const { data, error } = await supabase
                .from('save_slots')
                .select('data')
                .eq('user_id', session.user.id)
                .eq('slot_index', slotIndex)
                .single();
            
            if (!error && data) {
                loadedData = data.data;
                source = "Cloud";
            }
        }

        if (!loadedData) {
            const localKey = `${SAVE_KEY_PREFIX}_${slotIndex}`;
            const str = localStorage.getItem(localKey);
            
            if (str && str !== "undefined") {
                try { loadedData = JSON.parse(str); } catch(e) {}
            } 
        }

        if (!loadedData) {
            get().addLog("No save game found in this slot.", "info");
            return;
        }

        try { 
            let parsed = loadedData;
            if (!parsed.version && parsed.data) { 
                 parsed = { version: 0, timestamp: 0, data: parsed.data }; 
            } else if (!parsed.version && (parsed as any).party) {
                 parsed = { version: 0, timestamp: 0, data: parsed };
            }

            let data = parsed.data;
            let version = parsed.version || 0;

            console.log(`Loading Save (${source}): v${version} -> Target v${CURRENT_SAVE_VERSION}`);

            while (version < CURRENT_SAVE_VERSION) {
                version++;
                if (MIGRATIONS[version]) {
                    try {
                        data = MIGRATIONS[version](data);
                    } catch (err) {
                        console.error(`Migration to v${version} failed:`, err);
                        return;
                    }
                }
            }

            const exploredTiles = {
                [Dimension.NORMAL]: new Set<string>(data.exploredTiles?.[Dimension.NORMAL] || []),
                [Dimension.UPSIDE_DOWN]: new Set<string>(data.exploredTiles?.[Dimension.UPSIDE_DOWN] || [])
            };
            const clearedEncounters = new Set<string>(data.clearedEncounters || []);

            set({
                party: data.party || [],
                characterPool: data.characterPool || [],
                inventory: data.inventory || [],
                gold: data.gold,
                fatigue: data.fatigue,
                worldTime: data.worldTime || 480, 
                gameState: data.gameState || GameState.OVERWORLD, 
                dimension: data.dimension || Dimension.NORMAL,
                difficulty: data.difficulty || Difficulty.NORMAL,
                exploredTiles: exploredTiles,
                visitedTowns: data.visitedTowns || {},
                clearedEncounters: clearedEncounters,
                activeOverworldEnemies: data.activeOverworldEnemies || [],
                playerPos: data.playerPos || { x: 0, y: 0 },
                lastOverworldPos: data.lastOverworldPos || null,
                mapDimensions: data.mapDimensions || { width: DEFAULT_MAP_WIDTH, height: DEFAULT_MAP_HEIGHT },
                quests: data.quests || [],
                currentRegionName: data.currentRegionName || "Unknown Region",
                logs: [],
                townMapData: null,
                isPlayerMoving: false,
                isInventoryOpen: false,
                isMapOpen: false,
                battleEntities: [],
                turnOrder: [],
                currentTurnIndex: 0
            });

            sfx.playVictory();
            get().addLog(`Game Loaded (${source}).`, "info");

        } catch(e) {
            console.error("Load Failed:", e);
            get().addLog("Critical error loading game.", "combat");
        } 
  },

  quitToMenu: () => { sfx.playUiClick(); set({ gameState: GameState.TITLE, logs: [], party: [] }); }
});
