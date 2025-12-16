
import React, { useEffect, useState } from 'react';
import { GameState, BattleAction, EquipmentSlot, Dimension } from '../types';
import { useGameStore } from '../store/gameStore';
import { useContentStore } from '../store/contentStore';
import { InventoryScreen } from './InventoryScreen';
import { WorldMapScreen } from './WorldMapScreen';
import { SaveLoadModal } from './SaveLoadModal';
import { CLASS_CONFIG, ClassArchetype, RACE_SKILLS as RACE_SKILLS_DB, ITEMS } from '../constants';
import { sfx } from '../services/SoundSystem';

interface UIOverlayProps {
    onOpenTownService?: (type: 'SHOP' | 'INN') => void;
}

// Helper for consistent Hexagon Clipping (Flat-topped for grid alignment)
const HEX_CLIP = "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";

const QuestTracker = () => {
    const { quests, exploredTiles } = useGameStore();
    const [isExpanded, setIsExpanded] = useState(true);
    const activeQuests = quests.filter(q => !q.completed);

    if (activeQuests.length === 0) return null;

    // Helper to calculate progress text
    const getProgress = (id: string) => {
        if (id === 'q2') { // Explore quest
            const total = (exploredTiles[Dimension.NORMAL]?.size || 0) + (exploredTiles[Dimension.UPSIDE_DOWN]?.size || 0);
            return `${Math.min(50, total)}/50 Tiles`;
        }
        if (id === 'q1') {
            return `Go to [0,0]`;
        }
        return '';
    };

    return (
        <div className="absolute right-0 top-32 z-10 flex flex-col items-end pointer-events-auto transition-all duration-300">
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-slate-900/80 text-amber-500 font-bold uppercase text-[10px] tracking-widest px-3 py-1 rounded-l-lg border-y border-l border-amber-600/30 hover:bg-slate-800 transition-colors shadow-lg"
            >
                {isExpanded ? 'Active Quests »' : '« Quests'}
            </button>
            
            {isExpanded && (
                <div className="bg-slate-900/90 border-l-2 border-amber-500/50 p-4 rounded-bl-xl shadow-xl w-56 backdrop-blur-sm animate-in slide-in-from-right-10 duration-300">
                    <div className="space-y-3">
                        {activeQuests.map(q => (
                            <div key={q.id} className="group">
                                <h4 className={`text-xs font-bold font-serif ${q.type === 'MAIN' ? 'text-amber-400' : 'text-slate-300'}`}>
                                    {q.type === 'MAIN' && '★ '}{q.title}
                                </h4>
                                <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{q.description}</p>
                                <div className="text-[9px] text-slate-500 font-mono mt-1 text-right">
                                    {getProgress(q.id)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export const UIOverlay: React.FC<UIOverlayProps> = ({ onOpenTownService }) => {
  const [showSystemMenu, setShowSystemMenu] = useState(false);
  const [showSkillDrawer, setShowSkillDrawer] = useState<'SPELL' | 'SKILL' | null>(null);
  const [hoveredSkill, setHoveredSkill] = useState<any | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showBattleStart, setShowBattleStart] = useState(false);
  const [regionBanner, setRegionBanner] = useState<string | null>(null);
  
  const { 
      logs, gameState, party, turnOrder, currentTurnEntityIndex: currentTurnIndex, 
      isInventoryOpen, isMapOpen, toggleInventory, toggleMap, dimension,
      usePortal, enterSettlement, enterDungeon, quitToMenu, enterTemple,
      battleEntities, selectAction, selectedAction, selectSpell, selectSkill, hasMoved, hasActed,
      gold, fatigue, worldTime, getItemCount, camp, nextTurn, attemptRun, currentRegionName
  } = useGameStore();

  // Access Dynamic Content
  const { spells: spellDB, skills: skillDB } = useContentStore();

  useEffect(() => {
      setShowSkillDrawer(null);
      setHoveredSkill(null);
  }, [currentTurnIndex]);

  // Trigger Region Banner
  useEffect(() => {
      if (currentRegionName && gameState === GameState.OVERWORLD) {
          setRegionBanner(currentRegionName);
          const timer = setTimeout(() => setRegionBanner(null), 3500);
          return () => clearTimeout(timer);
      }
  }, [currentRegionName, gameState]);

  // Trigger Battle Start Animation
  useEffect(() => {
      if (gameState === GameState.BATTLE_TACTICAL && turnOrder.length > 0) {
          setShowBattleStart(true);
          const timer = setTimeout(() => setShowBattleStart(false), 2500);
          return () => clearTimeout(timer);
      }
  }, [gameState]);

  // --- PROXIMITY LOGIC ---
  const nearbyWorldFeatures = useGameStore(state => ({ 
      portal: state.standingOnPortal, 
      settlement: state.standingOnSettlement,
      temple: state.standingOnTemple,
      dungeon: state.standingOnDungeon 
  }));

  const activeEntityId = turnOrder[currentTurnIndex];
  const activeEntity = battleEntities.find(e => e.id === activeEntityId);
  const isPlayerTurn = activeEntity?.type === 'PLAYER';

  // --- CONTEXTUAL CLASS INFO ---
  const activeClass = activeEntity?.stats.class;
  const classConfig = activeClass ? CLASS_CONFIG[activeClass] : null;
  const archetype = classConfig?.archetype || ClassArchetype.MARTIAL;

  // Determine Weapon Type for Contextual Button
  const mainHand = activeEntity?.equipment?.[EquipmentSlot.MAIN_HAND];
  const isRangedWeapon = mainHand?.equipmentStats?.properties?.includes('Range');
  const attackLabel = isRangedWeapon ? "Shoot" : "Strike";
  const attackIcon = isRangedWeapon ? "🏹" : "⚔️";

  // DYNAMIC SPELLS based on Progression & Dynamic Store
  const availableSpells = (isPlayerTurn && activeEntity?.stats.knownSpells) 
    ? activeEntity.stats.knownSpells.map(id => spellDB[id]).filter(Boolean) 
    : [];

  // DYNAMIC SKILLS based on Progression + Race & Dynamic Store
  const availableSkills = (isPlayerTurn && activeEntity?.stats)
    ? [
        ...(activeEntity.stats.knownSkills || []),
        ...(RACE_SKILLS_DB[activeEntity.stats.race!] || [])
      ].map(id => skillDB[id]).filter(Boolean)
    : [];

  const handleAction = (action: BattleAction) => {
      if (hasActed && action !== BattleAction.MOVE) {
          sfx.playUiHover(); // Error sound if trying to act twice
          return; 
      }
      sfx.playUiClick();
      if (action === BattleAction.MAGIC) setShowSkillDrawer('SPELL');
      else if (action === BattleAction.SKILL) setShowSkillDrawer('SKILL');
      else selectAction(action);
  };

  // Keyboard Navigation for Battle
  useEffect(() => {
      if (gameState !== GameState.BATTLE_TACTICAL || !isPlayerTurn) return;

      const handleKeyDown = (e: KeyboardEvent) => {
          if (e.repeat) return;
          const key = e.key.toLowerCase();

          switch(key) {
              case '1': 
                  if (!hasMoved) handleAction(BattleAction.MOVE); 
                  break;
              case '2': 
                  handleAction(BattleAction.ATTACK); 
                  break;
              case '3': 
                  if (archetype === ClassArchetype.CASTER || archetype === ClassArchetype.HYBRID) {
                      handleAction(BattleAction.MAGIC);
                  }
                  break;
              case '4': 
                  handleAction(BattleAction.SKILL); 
                  break;
              case ' ': 
              case 'space':
              case 'enter':
                  e.preventDefault(); // Prevent scroll on space
                  nextTurn();
                  sfx.playUiClick();
                  break;
              case 'r':
                  if (!hasActed) attemptRun();
                  break;
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, isPlayerTurn, hasMoved, hasActed, archetype]);


  const handleSpellClick = (spellId: string) => {
      selectSpell(spellId);
      selectAction(BattleAction.MAGIC); 
      setShowSkillDrawer(null);
  };

  const handleSkillClick = (skillId: string) => {
      selectSkill(skillId);
      selectAction(BattleAction.SKILL);
      setShowSkillDrawer(null);
  };

  const checkCooldown = (skillId: string) => {
      return (activeEntity?.stats.activeCooldowns?.[skillId] || 0) > 0;
  };

  const recentLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const leaderCorruption = party[0]?.stats.corruption || 0;
  const vignetteOpacity = Math.min(0.8, leaderCorruption / 120); 
  const rationCount = getItemCount(ITEMS.RATION.id);

  // Time Formatting
  const hours = Math.floor(worldTime / 60);
  const minutes = worldTime % 60;
  const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  const isNight = hours >= 20 || hours < 5;

  if (gameState === GameState.TITLE || gameState === GameState.CHARACTER_CREATION) return null;

  return (
    <>
        {/* CORRUPTION VIGNETTE OVERLAY */}
        {leaderCorruption > 0 && (
            <div className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000" style={{ opacity: vignetteOpacity, backgroundImage: 'radial-gradient(circle, transparent 40%, #2e1065 90%, #000000 100%)' }} />
        )}

        {/* REGION DISCOVERY BANNER */}
        {regionBanner && (
            <div className="fixed top-20 left-0 right-0 flex justify-center z-[50] pointer-events-none">
                <div className="bg-gradient-to-r from-transparent via-black/80 to-transparent px-16 py-4 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="text-amber-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.4em] text-center mb-1">Entering Region</div>
                    <h2 className="text-3xl md:text-4xl font-serif text-white tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] text-center">
                        {regionBanner}
                    </h2>
                    <div className="h-px w-32 bg-amber-500/50 mx-auto mt-2" />
                </div>
            </div>
        )}

        {/* DRAMATIC BATTLE START BANNER */}
        {showBattleStart && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
                <div className="w-full bg-gradient-to-r from-transparent via-black/90 to-transparent py-8 flex flex-col items-center justify-center animate-in zoom-in-50 duration-500 fade-out-0 slide-out-to-left-10 fill-mode-forwards delay-2000">
                    <div className="text-amber-50 font-serif font-bold tracking-[0.5em] text-sm md:text-base animate-pulse mb-2">ENCOUNTER STARTED</div>
                    <h1 className="text-5xl md:text-7xl font-black text-white font-serif tracking-widest drop-shadow-[0_5px_5px_rgba(0,0,0,1)] uppercase scale-y-110">
                        BATTLE
                    </h1>
                    <div className="h-1 w-48 bg-amber-500 mt-2 rounded-full shadow-[0_0_15px_#f59e0b]" />
                </div>
            </div>
        )}

        {isInventoryOpen && <InventoryScreen />}
        {isMapOpen && <WorldMapScreen />}
        {showSaveModal && <SaveLoadModal mode="save" onClose={() => setShowSaveModal(false)} />}

        {/* --- MAIN UI CONTAINER --- */}
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between overflow-hidden font-sans">
            
            {/* TOP BAR: TURN ORDER (BATTLE) or STATUS (OVERWORLD) */}
            <div className="w-full pt-2 px-2 md:px-4 pointer-events-auto">
                {gameState === GameState.BATTLE_TACTICAL ? (
                    <div className="flex items-start justify-between">
                        {/* Turn Order Strip - Slightly Transparent background for readability */}
                        <div className="flex-1 max-w-3xl flex gap-3 items-center bg-gradient-to-r from-slate-900/80 to-transparent p-2 rounded-xl backdrop-blur-sm border-l-4 border-amber-500/50 pl-4" role="region" aria-label="Turn Order">
                            {turnOrder.map((id, index) => {
                                const entity = battleEntities.find(e => e.id === id);
                                if (!entity || entity.stats.hp <= 0) return null;
                                
                                const isCurrent = index === currentTurnIndex;
                                const isPlayer = entity.type === 'PLAYER';
                                
                                return (
                                    <div 
                                        key={id} 
                                        className={`
                                            relative flex flex-col items-center shrink-0 transition-all duration-300
                                            ${isCurrent ? 'scale-110 z-10 mx-2 brightness-110' : 'scale-90 opacity-60 grayscale-[0.5]'}
                                        `}
                                        aria-label={`${entity.name} ${isCurrent ? '(Active)' : ''}`}
                                    >
                                        <div className={`
                                            w-10 h-10 md:w-12 md:h-12 rounded-full border-2 overflow-hidden bg-slate-900 shadow-md relative
                                            ${isCurrent ? (isPlayer ? 'border-amber-400 ring-2 ring-amber-500/30' : 'border-red-500 ring-2 ring-red-500/30') : 'border-slate-600'}
                                        `}>
                                            <img src={entity.visual.spriteUrl} className="w-full h-full object-cover pixelated scale-125 translate-y-1" alt="" />
                                        </div>
                                        {/* Turn Indicator Arrow */}
                                        {isCurrent && (
                                            <div className="absolute -top-3 text-amber-400 text-lg animate-bounce" aria-hidden="true">▼</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Top Right Controls */}
                        <div className="flex flex-col gap-2 items-end">
                            <MenuHexBtn onClick={() => setShowSystemMenu(!showSystemMenu)} icon="⚙️" label="System Menu" />
                            {showSystemMenu && (
                                <div className="bg-slate-900/95 backdrop-blur border border-amber-600/30 rounded-lg shadow-xl p-2 flex flex-col gap-1 w-32 pointer-events-auto" role="menu">
                                    <button onClick={() => { setShowSaveModal(true); setShowSystemMenu(false); }} className="text-slate-300 hover:text-white text-xs font-bold py-2 hover:bg-slate-800 rounded text-left px-2 focus:ring-2 focus:ring-amber-500 outline-none">Save Game</button>
                                    <button onClick={quitToMenu} className="text-red-400 text-xs font-bold py-2 hover:bg-red-900/20 rounded text-left px-2 border-t border-slate-700 focus:ring-2 focus:ring-red-500 outline-none">Quit to Title</button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // OVERWORLD HUD
                    <div className="flex justify-between items-center bg-slate-900/90 backdrop-blur border-b border-amber-600/30 p-2 rounded-b-xl shadow-xl max-w-4xl mx-auto" role="banner">
                        <div className="flex gap-4 items-center">
                            
                            {/* Region Name (Mini) */}
                            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700">
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">LOC</span>
                                <span className="text-xs font-serif text-slate-200">{currentRegionName || "Wilderness"}</span>
                            </div>

                            {/* Time Display */}
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${isNight ? 'bg-indigo-950 border-indigo-700' : 'bg-sky-900 border-sky-700'}`} aria-label={`Time: ${timeString}`}>
                                <span className="text-sm" aria-hidden="true">{isNight ? '🌙' : '☀️'}</span>
                                <span className={`text-xs font-bold font-mono ${isNight ? 'text-indigo-200' : 'text-sky-100'}`}>{timeString}</span>
                            </div>

                            {/* Gold */}
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-600" aria-label={`Gold: ${gold}`}>
                                <span className="text-yellow-400 text-sm" aria-hidden="true">🪙</span>
                                <span className="text-amber-100 font-bold font-mono text-sm">{gold}</span>
                            </div>
                            
                            {/* Rations */}
                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-600" title="Rations (Camp Supply)" aria-label={`Rations: ${rationCount}`}>
                                <span className="text-sm" aria-hidden="true">🍖</span>
                                <span className={`text-xs font-bold ${rationCount === 0 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>{rationCount}</span>
                            </div>

                            {/* Fatigue Bar */}
                            <div className="flex flex-col w-32" title="Fatigue Level. Acamp to rest." role="progressbar" aria-valuenow={Math.floor(fatigue)} aria-valuemin={0} aria-valuemax={100} aria-label="Fatigue">
                                <div className="flex justify-between text-[9px] uppercase font-bold text-slate-400 mb-0.5">
                                    <span>Fatigue</span>
                                    <span className={fatigue >= 80 ? 'text-red-500 animate-pulse' : ''}>{Math.floor(fatigue)}%</span>
                                </div>
                                <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-700 relative">
                                    <div 
                                        className={`h-full transition-all duration-500 ${fatigue >= 80 ? 'bg-red-600 animate-pulse' : fatigue >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${Math.min(100, fatigue)}%` }}
                                    />
                                    {/* Danger Line */}
                                    <div className="absolute top-0 bottom-0 w-px bg-white/20 left-[80%]" />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <MenuHexBtn onClick={toggleMap} icon="📜" label="Toggle Map [M]" />
                            <MenuHexBtn onClick={toggleInventory} icon="🎒" label="Toggle Inventory [I]" />
                            
                            <div className="relative">
                                <MenuHexBtn onClick={() => setShowSystemMenu(!showSystemMenu)} icon="⚙️" label="System Menu [Esc]" />
                                {showSystemMenu && (
                                    <div className="absolute top-14 right-0 bg-slate-900 border border-amber-600/50 rounded-lg shadow-xl p-2 w-40 z-50 flex flex-col gap-1" role="menu">
                                        <button onClick={() => { setShowSaveModal(true); setShowSystemMenu(false); }} className="text-slate-300 text-xs font-bold py-2 hover:bg-slate-800 rounded text-left px-3 focus:ring-2 focus:ring-amber-500 outline-none">Save Game</button>
                                        <button onClick={quitToMenu} className="text-red-400 text-xs font-bold py-2 hover:bg-slate-800 rounded text-left px-3 border-t border-slate-700 focus:ring-2 focus:ring-red-500 outline-none">Quit to Title</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* QUEST TRACKER - OVERWORLD ONLY */}
            {gameState === GameState.OVERWORLD && <QuestTracker />}

            {/* NOTIFICATIONS & INTERACTION STACK */}
            {/* Moved to top-center (below nav) and bottom-center (above controls) to clear center view */}
            
            {/* 1. Notifications (Top Toast) */}
            <div className="absolute top-16 left-0 right-0 flex flex-col items-center pointer-events-none space-y-2 px-4 z-10" role="status" aria-live="polite">
                {recentLog && !showBattleStart && !regionBanner && (
                    <div key={recentLog.timestamp} className="animate-in fade-in slide-in-from-top-2 duration-300 px-4 py-1.5 rounded-full border border-amber-500/30 bg-black/60 text-amber-100 text-[10px] md:text-xs font-bold font-serif shadow-lg backdrop-blur-sm">
                        {recentLog.message}
                    </div>
                )}
            </div>

            {/* 2. Interaction Buttons (Bottom Center - Above Tactical UI) */}
            <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center gap-2 pointer-events-auto z-10">
                {gameState === GameState.OVERWORLD && nearbyWorldFeatures.temple && (
                    <InteractionBtn onClick={enterTemple} icon="⛩️" label="Enter Temple" color="purple" />
                )}
                {gameState === GameState.OVERWORLD && nearbyWorldFeatures.portal && (
                    <InteractionBtn onClick={usePortal} icon="🌀" label={dimension === Dimension.NORMAL ? "Enter Shadow" : "Return Light"} color="purple" />
                )}
                {gameState === GameState.OVERWORLD && nearbyWorldFeatures.settlement && (
                    <InteractionBtn onClick={enterSettlement} icon="🏰" label="Enter City" color="amber" />
                )}
                {gameState === GameState.OVERWORLD && nearbyWorldFeatures.dungeon && (
                    <InteractionBtn onClick={enterDungeon} icon="☠️" label="Enter Dungeon" color="red" />
                )}
                {gameState === GameState.OVERWORLD && !nearbyWorldFeatures.settlement && !nearbyWorldFeatures.temple && !nearbyWorldFeatures.dungeon && (
                    <InteractionBtn onClick={camp} icon="🏕️" label="Make Camp" color="slate" disabled={fatigue < 10} />
                )}
            </div>

            {/* --- BOTTOM TACTICAL CLUSTER (HEXAGONAL CONTROL PAD) --- */}
            {gameState === GameState.BATTLE_TACTICAL && isPlayerTurn && (
                <div className="w-full flex justify-center pb-6 pointer-events-auto animate-in slide-in-from-bottom-10 duration-500">
                    <div className="relative w-full max-w-md h-40 flex items-end justify-center" role="menubar" aria-label="Battle Actions">
                        
                        {/* Decorative Base Plate */}
                        <div className="absolute bottom-2 w-[90%] h-20 bg-slate-950/90 border-t-2 border-amber-600/50 rounded-t-3xl shadow-2xl flex items-center justify-between px-8 z-0 backdrop-blur-md">
                            <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent absolute top-1 left-0" />
                        </div>

                        {/* CENTER BUTTON: WAIT / CONFIRM (LARGE HEXAGON) */}
                        <div className="absolute bottom-2 z-20 w-28 h-28 filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transition-transform active:scale-95 group">
                            <button 
                                onClick={() => nextTurn()} 
                                className="w-full h-full bg-amber-500 p-[4px] flex items-center justify-center hover:bg-amber-400 transition-colors focus:ring-4 focus:ring-white outline-none rounded-full"
                                style={{ clipPath: HEX_CLIP }}
                                aria-label="Wait (End Turn) [Space]"
                            >
                                <div className="w-full h-full bg-gradient-to-b from-amber-700 to-amber-900 flex flex-col items-center justify-center relative overflow-hidden" style={{ clipPath: HEX_CLIP }}>
                                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-20 transition-opacity" />
                                    <span className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform">⏳</span>
                                    <span className="text-[10px] font-bold text-amber-100 uppercase tracking-widest mt-1">Wait</span>
                                    <span className="text-[8px] text-amber-300 font-mono absolute bottom-2 opacity-70">[Space]</span>
                                </div>
                            </button>
                        </div>

                        {/* LEFT WING: MOVE & RUN */}
                        <div className="absolute bottom-4 left-4 md:left-12 flex gap-2 z-10 items-end">
                            <HexButton 
                                icon="🦶" 
                                label="Move" 
                                shortcut="1"
                                active={selectedAction === BattleAction.MOVE}
                                disabled={hasMoved}
                                onClick={() => handleAction(BattleAction.MOVE)}
                                color="blue"
                            />
                            <SmallHexButton 
                                icon="🏃" 
                                shortcut="R"
                                onClick={() => attemptRun()}
                                disabled={hasActed} 
                                label="Run"
                            />
                        </div>

                        {/* RIGHT WING: CONTEXTUAL ATTACK & SKILL */}
                        <div className="absolute bottom-4 right-4 md:right-12 flex gap-2 z-10 flex-row-reverse items-end">
                            {/* DYNAMIC ATTACK BUTTON */}
                            <HexButton 
                                icon={attackIcon} 
                                label={attackLabel}
                                shortcut="2" 
                                active={selectedAction === BattleAction.ATTACK}
                                disabled={hasActed}
                                onClick={() => handleAction(BattleAction.ATTACK)}
                                color="red"
                                big
                            />
                            
                            <div className="flex flex-col gap-1 justify-end">
                                {/* Contextual Magic Button for Casters/Hybrids */}
                                {(archetype === ClassArchetype.CASTER || archetype === ClassArchetype.HYBRID) && (
                                    <SmallHexButton 
                                        icon="🔮" 
                                        shortcut="3"
                                        active={selectedAction === BattleAction.MAGIC}
                                        onClick={() => handleAction(BattleAction.MAGIC)} 
                                        disabled={hasActed}
                                        pulse={activeEntity.stats.spellSlots.current > 0} // Pulse if mana available
                                        label="Magic"
                                    />
                                )}
                                <SmallHexButton 
                                    icon="⚡" 
                                    shortcut="4"
                                    active={selectedAction === BattleAction.SKILL}
                                    onClick={() => handleAction(BattleAction.SKILL)} 
                                    disabled={hasActed}
                                    label="Skill"
                                />
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ENEMY TURN BANNER */}
            {gameState === GameState.BATTLE_TACTICAL && !isPlayerTurn && (
                <div className="absolute bottom-10 w-full flex justify-center pointer-events-none">
                    <div className="bg-gradient-to-r from-red-900/90 via-red-800 to-red-900/90 text-white px-10 py-3 rounded-xl border-2 border-red-500 shadow-[0_0_50px_rgba(220,38,38,0.5)] font-serif font-bold text-xl tracking-[0.3em] animate-pulse backdrop-blur-md" role="alert">
                        ENEMY PHASE
                    </div>
                </div>
            )}

            {/* SKILL DRAWER (Slide Up) */}
            {showSkillDrawer && (
                <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm pointer-events-auto flex items-end justify-center" onClick={() => setShowSkillDrawer(null)}>
                    <div className="bg-slate-900 w-full max-w-lg rounded-t-2xl border-t-2 border-amber-600/50 p-6 animate-in slide-in-from-bottom-full duration-300 shadow-2xl relative" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Skill Selection">
                        
                        {/* TOOLTIP COMPONENT */}
                        {hoveredSkill && (
                            <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-slate-900/95 border border-amber-500/30 p-3 rounded-lg shadow-2xl text-center backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 pointer-events-none z-50">
                                <h4 className="text-amber-100 font-serif font-bold text-sm">{hoveredSkill.name}</h4>
                                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{hoveredSkill.description}</p>
                                <div className="flex justify-center gap-3 mt-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider border-t border-slate-800 pt-1">
                                    {hoveredSkill.range !== undefined && <span>Rng: {hoveredSkill.range}</span>}
                                    {hoveredSkill.cooldown > 0 && <span>CD: {hoveredSkill.cooldown}</span>}
                                    {checkCooldown(hoveredSkill.id) && <span className="text-red-400">ON COOLDOWN</span>}
                                </div>
                            </div>
                        )}

                        <h3 className="text-amber-100 font-serif font-bold text-center text-lg mb-4 uppercase tracking-widest border-b border-slate-700 pb-2">
                            {showSkillDrawer === 'SPELL' ? 'Grimoire' : 'Techniques'}
                        </h3>
                        <div className="grid grid-cols-4 gap-4 justify-items-center">
                            {(showSkillDrawer === 'SPELL' ? availableSpells : availableSkills).map((item: any) => {
                                const onCooldown = checkCooldown(item.id);
                                return (
                                    <button 
                                        key={item.id}
                                        onClick={() => showSkillDrawer === 'SPELL' ? handleSpellClick(item.id) : handleSkillClick(item.id)}
                                        onMouseEnter={() => setHoveredSkill(item)}
                                        onMouseLeave={() => setHoveredSkill(null)}
                                        onFocus={() => setHoveredSkill(item)}
                                        disabled={onCooldown}
                                        className={`flex flex-col items-center gap-1 group w-16 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded ${onCooldown ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                                        aria-label={item.name}
                                    >
                                        <div className="w-16 h-16 filter drop-shadow-lg transition-transform group-hover:-translate-y-1">
                                            <div className="w-full h-full bg-slate-600 p-[2px]" style={{ clipPath: HEX_CLIP }}>
                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center text-2xl group-hover:bg-slate-700 p-2" style={{ clipPath: HEX_CLIP }}>
                                                    {item.icon ? (
                                                        <img 
                                                            src={item.icon} 
                                                            alt="" 
                                                            className="w-full h-full object-contain filter invert opacity-90 group-hover:opacity-100" 
                                                        />
                                                    ) : (
                                                        <span>{showSkillDrawer === 'SPELL' ? '📜' : '⚔️'}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-[9px] text-slate-400 font-bold text-center leading-tight group-hover:text-amber-400">{item.name}</span>
                                    </button>
                                );
                            })}
                            {((showSkillDrawer === 'SPELL' && availableSpells.length === 0) || (showSkillDrawer === 'SKILL' && availableSkills.length === 0)) && <div className="col-span-4 text-center text-slate-500 text-sm italic">Nothing available.</div>}
                        </div>
                    </div>
                </div>
            )}

        </div>
    </>
  );
};

// ... (Rest of Styled Components updated for accessibility)
const MenuHexBtn = ({ onClick, icon, label }: any) => (
    <div className="w-12 h-12 filter drop-shadow-md transition-transform active:scale-95">
        <button onClick={onClick} className="w-full h-full bg-slate-400 p-[2px] hover:bg-white focus:ring-2 focus:ring-amber-400 outline-none rounded-full" style={{ clipPath: HEX_CLIP }} aria-label={label} title={label}>
            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xl text-slate-800" style={{ clipPath: HEX_CLIP }}>
                {icon}
            </div>
        </button>
    </div>
);

const HexButton = ({ icon, label, onClick, disabled, active, color, big, shortcut }: any) => {
    const colors: Record<string, { border: string, bg: string }> = {
        red: { border: 'bg-rose-400', bg: 'bg-gradient-to-br from-rose-700 to-rose-900' },
        blue: { border: 'bg-sky-400', bg: 'bg-gradient-to-br from-sky-700 to-sky-900' },
        amber: { border: 'bg-amber-400', bg: 'bg-gradient-to-br from-amber-700 to-amber-900' },
        slate: { border: 'bg-slate-400', bg: 'bg-gradient-to-br from-slate-700 to-slate-900' }
    };
    
    const theme = colors[color || 'slate'];
    const sizeClass = big ? 'w-24 h-24' : 'w-20 h-20';

    return (
        <div className={`${sizeClass} filter drop-shadow-lg transition-all duration-150 ${active ? 'scale-110 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10' : 'hover:scale-105'} ${disabled ? 'opacity-50 grayscale' : ''}`}>
            <button 
                onClick={onClick}
                disabled={disabled}
                className={`w-full h-full p-[3px] ${disabled ? 'bg-gray-600' : theme.border} focus:ring-4 focus:ring-white outline-none rounded-full`}
                style={{ clipPath: HEX_CLIP }}
                aria-label={`${label} [${shortcut}]`}
            >
                <div className={`w-full h-full flex flex-col items-center justify-center ${disabled ? 'bg-gray-800' : theme.bg} relative`} style={{ clipPath: HEX_CLIP }}>
                    <span className={`${big ? 'text-3xl' : 'text-2xl'} drop-shadow-md`}>{icon}</span>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider mt-1 drop-shadow-sm">{label}</span>
                    {shortcut && <span className="absolute bottom-1 right-2 text-[8px] text-white/50 font-mono font-bold">[{shortcut}]</span>}
                </div>
            </button>
        </div>
    );
};

const SmallHexButton = ({ icon, onClick, disabled, active, pulse, shortcut, label }: any) => (
    <div className={`w-14 h-14 filter drop-shadow-md transition-all ${active ? 'scale-110 z-10' : 'hover:scale-105'} ${disabled ? 'opacity-50 grayscale' : ''}`}>
        <button 
            onClick={onClick} 
            disabled={disabled}
            className={`w-full h-full p-[2px] ${active ? 'bg-amber-400' : (pulse ? 'bg-purple-400 animate-pulse' : 'bg-slate-500')} focus:ring-2 focus:ring-white outline-none rounded-full`}
            style={{ clipPath: HEX_CLIP }}
            aria-label={`${label} [${shortcut}]`}
            title={`${label} [${shortcut}]`}
        >
            <div className={`w-full h-full flex items-center justify-center text-xl text-white ${active ? 'bg-slate-700' : 'bg-slate-800'} relative`} style={{ clipPath: HEX_CLIP }}>
                {icon}
                {shortcut && <span className="absolute bottom-1 text-[8px] text-white/50 font-mono font-bold">{shortcut}</span>}
            </div>
        </button>
    </div>
);

const InteractionBtn = ({ onClick, icon, label, color, disabled }: any) => {
    // Dynamic color handling for new button types
    let borderColor = 'border-white/20';
    let textColor = 'text-slate-200';
    
    if (color === 'red') {
        borderColor = 'border-red-500/50 bg-red-900/40 hover:bg-red-800/60';
        textColor = 'text-red-100';
    } else if (color === 'purple') {
        borderColor = 'border-purple-500/50';
    } else if (color === 'amber') {
        borderColor = 'border-amber-500/50';
    }

    return (
        <button onClick={onClick} disabled={disabled} className={`
            bg-slate-900/80 backdrop-blur-md border ${borderColor} text-white px-4 py-2 rounded-full font-bold shadow-lg 
            transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2
            disabled:opacity-50 disabled:grayscale focus:ring-2 focus:ring-white outline-none
        `}>
            <span className="text-lg">{icon}</span>
            <span className={`uppercase tracking-wider text-[10px] ${textColor}`}>{label}</span>
        </button>
    );
};
