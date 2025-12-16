
import React, { useEffect, useMemo, Suspense, useState } from 'react';
import { GameState, BattleAction } from './types';
import { OverworldMap } from './components/OverworldMap';
import { BattleScene } from './components/BattleScene';
import { TitleScreen } from './components/CharacterCreation';
import { UIOverlay } from './components/UIOverlay';
import { BattleResultModal } from './components/BattleResultModal';
import { EndingScreen } from './components/EndingScreen';
import { useGameStore } from './store/gameStore';
import { useContentStore } from './store/contentStore'; 
import { AdminDashboard } from './components/admin/AdminDashboard';
import { TownServicesManager } from './components/TownServices';
import { InspectionPanel } from './components/InspectionPanel';
import { LevelUpScreen } from './components/LevelUpScreen';
import { SummoningScreen } from './components/SummoningScreen';
import { TempleScreen } from './components/TempleScreen';
import { PartyManager } from './components/PartyManager';
import { getReachableTiles } from './services/pathfinding';
import { getAttackRange } from './services/dndRules';
import { sfx } from './services/SoundSystem';
import { getSupabase } from './services/supabaseClient';

// Atomic Selector to prevent re-renders
const useGameState = () => useGameStore(state => state.gameState);
const useGameLogic = () => useGameStore(state => ({
    playerPos: state.playerPos,
    battleEntities: state.battleEntities,
    turnOrder: state.turnOrder,
    currentTurnIndex: state.currentTurnIndex,
    battleTerrain: state.battleTerrain,
    battleWeather: state.battleWeather,
    battleRewards: state.battleRewards,
    selectedAction: state.selectedAction,
    selectedSpell: state.selectedSpell,
    hasMoved: state.hasMoved,
    hasActed: state.hasActed,
    dimension: state.dimension,
    townMapData: state.townMapData,
    mapDimensions: state.mapDimensions,
    battleMap: state.battleMap,
    inspectedEntityId: state.inspectedEntityId,
    isInventoryOpen: state.isInventoryOpen,
    isMapOpen: state.isMapOpen
}));
const useGameActions = () => useGameStore(state => ({
    initializeWorld: state.initializeWorld,
    createCharacter: state.createCharacter,
    movePlayerOverworld: state.movePlayerOverworld,
    handleTileInteraction: state.handleTileInteraction,
    continueAfterVictory: state.continueAfterVictory,
    restartBattle: state.restartBattle,
    quitToMenu: state.quitToMenu,
    hasLineOfSight: state.hasLineOfSight,
    toggleInventory: state.toggleInventory,
    toggleMap: state.toggleMap,
    setUserSession: state.setUserSession
}));

const App = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTownService, setActiveTownService] = useState<'NONE' | 'SHOP' | 'INN'>('NONE');
  
  // Use atomic selectors
  const gameState = useGameState();
  const { 
    playerPos, battleEntities, turnOrder, currentTurnIndex,
    battleTerrain, battleWeather, battleRewards, selectedAction, selectedSpell, hasMoved, hasActed, dimension, townMapData,
    mapDimensions, battleMap, inspectedEntityId, isInventoryOpen, isMapOpen
  } = useGameLogic();

  const {
    initializeWorld, createCharacter, movePlayerOverworld, handleTileInteraction, 
    continueAfterVictory, restartBattle, quitToMenu, hasLineOfSight, toggleInventory, toggleMap, setUserSession
  } = useGameActions();

  // Content Store Actions
  const { fetchContentFromCloud } = useContentStore();

  // Routing Check
  useEffect(() => {
      if (window.location.pathname === '/admin') {
          setIsAdmin(true);
      }
  }, []);

  // Initialize World & Auth & Content
  useEffect(() => {
      if (!isAdmin) {
          initializeWorld();
          // Attempt to load dynamic content from Supabase
          fetchContentFromCloud().catch(err => console.warn("Live Ops: Running in offline mode", err));
      }

      // Supabase Auth Listener
      const supabase = getSupabase();
      if (supabase) {
          // Check initial session
          supabase.auth.getSession().then(({ data: { session } }) => {
              setUserSession(session);
          });

          // Listen for changes (Login, Logout, Auto-refresh)
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
              setUserSession(session);
          });

          return () => subscription.unsubscribe();
      }
  }, [isAdmin, initializeWorld, setUserSession, fetchContentFromCloud]);

  // Global Keyboard Shortcuts
  useEffect(() => {
      const handleGlobalKeys = (e: KeyboardEvent) => {
          // Ignore if typing in an input
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

          const key = e.key.toLowerCase();

          if (key === 'i') {
              toggleInventory();
          } else if (key === 'm') {
              toggleMap();
          } else if (key === 'escape') {
              // Priority: Close Inventory/Map -> Close Service -> Open System Menu
              if (isInventoryOpen) toggleInventory();
              else if (isMapOpen) toggleMap();
              else if (activeTownService !== 'NONE') setActiveTownService('NONE');
              else if (inspectedEntityId) useGameStore.getState().closeInspection();
          }
      };

      window.addEventListener('keydown', handleGlobalKeys);
      return () => window.removeEventListener('keydown', handleGlobalKeys);
  }, [isInventoryOpen, isMapOpen, activeTownService, inspectedEntityId, toggleInventory, toggleMap]);

  // Determine if on POI for UI Overlay Trigger
  useEffect(() => {
      if (gameState === GameState.TOWN_EXPLORATION) {
          const tile = townMapData?.find(c => c.q === playerPos.x && c.r === playerPos.y);
          // Auto-close if moved off
          if (!tile || (tile.poiType !== 'SHOP' && tile.poiType !== 'INN')) {
              if (activeTownService !== 'NONE') setActiveTownService('NONE');
          }
      } else {
          if (activeTownService !== 'NONE') setActiveTownService('NONE');
      }
  }, [playerPos, gameState, townMapData, activeTownService]);

  const handleOpenService = (type: 'SHOP' | 'INN') => {
      setActiveTownService(type);
  };

  // --- Calculation Helpers ---
  const activeEntityId = turnOrder?.[currentTurnIndex];
  const activeEntity = battleEntities?.find(e => e.id === activeEntityId);

  const validMoves = useMemo(() => {
      if (gameState !== GameState.BATTLE_TACTICAL || selectedAction !== BattleAction.MOVE || hasMoved) return [];
      if (!activeEntity || activeEntity.type !== 'PLAYER') return [];

      const speedInTiles = Math.floor(activeEntity.stats.speed / 5);
      const occupied = new Set<string>();
      
      battleEntities.forEach(e => {
          if (e.id !== activeEntity.id) {
              occupied.add(`${e.position.x},${e.position.y}`);
          }
      });

      return getReachableTiles(
          { x: activeEntity.position.x, y: activeEntity.position.y },
          speedInTiles,
          battleMap || [],
          occupied
      );
  }, [gameState, selectedAction, hasMoved, battleEntities, activeEntity, battleMap]);

  const validTargets = useMemo(() => {
      if (gameState !== GameState.BATTLE_TACTICAL) return [];
      if (!activeEntity || activeEntity.type !== 'PLAYER') return [];
      
      const targets: any[] = [];
      const range = selectedAction === BattleAction.MAGIC && selectedSpell 
          ? selectedSpell.range 
          : getAttackRange(activeEntity);

      if ((selectedAction === BattleAction.ATTACK || selectedAction === BattleAction.MAGIC) && !hasActed) {
          battleEntities.forEach(e => {
              if (e.id === activeEntity.id) return;
              // Simple dist check, LoS handled in click
              const dist = Math.max(Math.abs(activeEntity.position.x - e.position.x), Math.abs(activeEntity.position.y - e.position.y));
              if (dist <= range) {
                  targets.push(e.position);
              }
          });
      }
      return targets;
  }, [gameState, selectedAction, selectedSpell, hasActed, battleEntities, activeEntity]);

  // --- RENDER ---
  if (isAdmin) {
      return <AdminDashboard />;
  }

  return (
    <>
      {gameState === GameState.TITLE && <TitleScreen onComplete={createCharacter} />}
      {gameState === GameState.CHARACTER_CREATION && <TitleScreen onComplete={createCharacter} />}
      {gameState === GameState.GAME_WON && <EndingScreen />}
      
      {(gameState === GameState.OVERWORLD || gameState === GameState.TOWN_EXPLORATION) && (
        <OverworldMap 
            mapData={townMapData} 
            playerPos={playerPos} 
            onMove={movePlayerOverworld} 
            dimension={dimension}
            width={mapDimensions.width}
            height={mapDimensions.height}
        />
      )}

      {gameState === GameState.BATTLE_TACTICAL && (
        <BattleScene 
            entities={battleEntities} 
            weather={battleWeather} 
            terrainType={battleTerrain}
            currentTurnEntityId={activeEntityId}
            onTileClick={handleTileInteraction}
            validMoves={validMoves}
            validTargets={validTargets}
        />
      )}

      {/* OVERLAYS & MODALS */}
      <UIOverlay onOpenTownService={handleOpenService} />
      
      {(gameState === GameState.BATTLE_VICTORY || gameState === GameState.BATTLE_DEFEAT) && (
          <BattleResultModal 
              type={gameState === GameState.BATTLE_VICTORY ? 'victory' : 'defeat'} 
              rewards={battleRewards}
              onContinue={continueAfterVictory}
              onRestart={restartBattle}
              onQuit={quitToMenu}
          />
      )}

      {gameState === GameState.TOWN_EXPLORATION && activeTownService !== 'NONE' && (
          <TownServicesManager activeService={activeTownService} onClose={() => setActiveTownService('NONE')} />
      )}

      {gameState === GameState.LEVEL_UP && <LevelUpScreen />}
      
      {gameState === GameState.SUMMONING && <SummoningScreen />}
      
      {gameState === GameState.TEMPLE_HUB && <TempleScreen />}
      
      {gameState === GameState.PARTY_MANAGEMENT && <PartyManager />}

      <InspectionPanel />
    </>
  );
};

export default App;
