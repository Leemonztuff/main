
import React, { Suspense, useMemo, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, SpotLight, Preload, OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Entity, Dimension, WeatherType, BattleAction } from '../types';
import { useGameStore } from '../store/gameStore';
import { WeatherOverlay } from './OverworldMap';
import { BATTLE_MAP_SIZE } from '../constants';
import { getAttackRange } from '../services/dndRules';

// Modular Components
import { FogController } from './battle/FogController';
import { CinematicCamera } from './battle/CinematicCamera';
import { VoidParticles } from './battle/VoidParticles';
import { TerrainLayer } from './battle/TerrainLayer';
import { DecorationLayer } from './battle/DecorationLayer';
import { InteractionLayer } from './battle/InteractionLayer';
import { EntityRenderer } from './battle/EntityRenderer';
import { SpellEffectsRenderer } from './battle/SpellEffectsRenderer';
import { LootDropVisual } from './battle/LootDropVisual';
import { TextureErrorBoundary, FallbackTerrainLayer } from './battle/Shared';
import { BattleAssetsLoader } from './battle/BattleAssetsLoader';

const DamagePopupManager = () => {
    const { damagePopups, removeDamagePopup } = useGameStore();
    
    useFrame(() => {
        const now = Date.now();
        damagePopups.forEach(p => {
            if (now - p.timestamp > 1000) {
                removeDamagePopup(p.id);
            }
        });
    });

    return (
        <group>
            {damagePopups.map((popup) => (
                <Html key={popup.id} position={[popup.position[0], 2.5, popup.position[2]]} center zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
                    <div className="flex flex-col items-center pointer-events-none select-none" style={{ animation: 'float-damage 1s ease-out forwards', width: 'max-content' }}>
                        <span 
                            className={`
                                font-black font-sans drop-shadow-[0_2px_0_rgba(0,0,0,1)]
                                ${popup.isCrit ? 'text-5xl text-yellow-400 scale-125' : 'text-3xl'}
                                stroke-black stroke-2 whitespace-nowrap
                            `} 
                            style={{ 
                                color: popup.color,
                                textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'
                            }}
                        >
                            {popup.amount}
                        </span>
                        {popup.isCrit && <span className="text-sm text-yellow-100 font-bold uppercase tracking-widest mt-[-5px] bg-red-600 px-2 rounded border border-white whitespace-nowrap">Critical!</span>}
                    </div>
                </Html>
            ))}
        </group>
    );
};

export const BattleScene = ({ entities, weather, terrainType, currentTurnEntityId, onTileClick, validMoves, validTargets }: any) => {
    const { battleMap, handleTileHover, dimension, hasActed, hasMoved, activeSpellEffect, lootDrops, isActionAnimating, selectedAction, selectedSpell, inspectUnit } = useGameStore();
    const isShadowRealm = dimension === Dimension.UPSIDE_DOWN;
    const activeEntity = entities?.find((e: Entity) => e.id === currentTurnEntityId);
    const center = BATTLE_MAP_SIZE / 2;

    // SpotLight Target Reference
    const spotLightTarget = useRef<THREE.Object3D>(new THREE.Object3D());

    // Determine visual range for indicator (Attack/Ability)
    const currentAttackRange = useMemo(() => {
        if (!activeEntity || hasActed) return 0;
        if (!activeEntity.stats) return 0; 
        
        if (selectedAction === BattleAction.MOVE) return activeEntity.stats.speed / 5;
        if (selectedAction === BattleAction.ATTACK) return getAttackRange(activeEntity);
        if (selectedAction === BattleAction.MAGIC && selectedSpell) return selectedSpell.range;
        
        return 0;
    }, [activeEntity, selectedAction, selectedSpell, hasActed]);

    // Calculate movement range for overlay
    const movementRange = useMemo(() => {
        if (!activeEntity || hasMoved) return 0;
        return activeEntity.stats.speed / 5;
    }, [activeEntity, hasMoved]);

    useEffect(() => {
        if (activeEntity) {
            spotLightTarget.current.position.set(activeEntity.position.x, 0, activeEntity.position.y);
            spotLightTarget.current.updateMatrixWorld();
        }
    }, [activeEntity]);

    return (
        <div className="w-full h-full relative bg-slate-950">
            {/* DOM Overlay for Weather - Must be outside Canvas to avoid R3F crashes */}
            <WeatherOverlay type={weather} />

            <Canvas
                shadows
                dpr={[1, 2]}
                gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
            >
                <fog attach="fog" args={[isShadowRealm ? '#1e1b4b' : '#0f172a', 5, 25]} />
                <FogController isShadowRealm={isShadowRealm} />

                {/* Camera & Controls */}
                <OrthographicCamera makeDefault position={[10, 10, 10]} zoom={45} near={-50} far={200} />
                <OrbitControls 
                    enableZoom={true} 
                    zoomSpeed={0.5}
                    minZoom={20}
                    maxZoom={80}
                    enablePan={true} 
                    panSpeed={1}
                    minPolarAngle={0} 
                    maxPolarAngle={Math.PI / 2.2}
                    target={[center, 0, center]} 
                />
                <CinematicCamera />

                {/* Lighting */}
                <ambientLight intensity={isShadowRealm ? 0.3 : 0.6} color={isShadowRealm ? '#4c1d95' : '#ffffff'} />
                <directionalLight 
                    position={[10, 20, 5]} 
                    intensity={isShadowRealm ? 0.5 : 1.2} 
                    castShadow 
                    shadow-mapSize={[2048, 2048]}
                    color={isShadowRealm ? '#a855f7' : '#fff7ed'}
                >
                    <orthographicCamera attach="shadow-camera" args={[-20, 20, 20, -20]} />
                </directionalLight>
                
                {/* Dynamic Spotlight on Active Unit */}
                <primitive object={spotLightTarget.current} />
                <SpotLight
                    position={[center, 15, center]}
                    target={spotLightTarget.current}
                    angle={0.6}
                    penumbra={0.5}
                    intensity={1.5}
                    castShadow
                    color={isShadowRealm ? '#d8b4fe' : '#fbbf24'}
                />

                {/* ASSET LOADING SUSPENSE WRAPPER */}
                <Suspense fallback={null}>
                    {/* Wrap loader in ErrorBoundary so one bad asset doesn't crash the whole view */}
                    <TextureErrorBoundary fallback={null}>
                        <BattleAssetsLoader terrain={terrainType} entities={entities} />
                    </TextureErrorBoundary>
                    
                    <TextureErrorBoundary fallback={<FallbackTerrainLayer mapData={battleMap} onTileClick={onTileClick} onTileHover={(x: number, z: number) => handleTileHover(x, z)} />}>
                        <TerrainLayer 
                            mapData={battleMap} 
                            isShadowRealm={isShadowRealm} 
                            onTileClick={onTileClick}
                            onTileHover={(x: number, z: number) => handleTileHover(x, z)}
                        />
                    </TextureErrorBoundary>

                    <TextureErrorBoundary fallback={null}>
                        <DecorationLayer mapData={battleMap} />
                    </TextureErrorBoundary>

                    <InteractionLayer 
                        mapData={battleMap} 
                        validMoves={validMoves} 
                        validTargets={validTargets} 
                        currentRange={currentAttackRange}
                        movementRange={movementRange}
                    />

                    {/* Entities */}
                    {entities?.map((ent: Entity) => (
                        <EntityRenderer 
                            key={ent.id} 
                            entity={ent} 
                            isCurrentTurn={ent.id === currentTurnEntityId} 
                            isActivePlayer={ent.type === 'PLAYER'}
                            onTileClick={onTileClick}
                            onInspect={inspectUnit}
                            hasActed={hasActed}
                            hasMoved={hasMoved}
                            isActing={isActionAnimating && ent.id === currentTurnEntityId}
                            actionType={selectedAction === BattleAction.ATTACK ? 'ATTACK' : selectedAction === BattleAction.MAGIC ? 'MAGIC' : 'IDLE'}
                        />
                    ))}

                    {/* Effects */}
                    <SpellEffectsRenderer activeSpellEffect={activeSpellEffect} />
                    
                    {/* Loot */}
                    {lootDrops.map((drop) => <LootDropVisual key={drop.id} drop={drop} />)}

                    {/* Atmosphere - Use ternary to prevent boolean false in R3F */}
                    {isShadowRealm ? <VoidParticles color="#a855f7" floatUp={true} /> : null}
                    {weather === WeatherType.ASH ? <VoidParticles color="#ea580c" floatUp={false} /> : null}
                    {weather === WeatherType.SNOW ? <VoidParticles color="white" floatUp={false} /> : null}
                    
                    {/* UI In-Scene */}
                    <DamagePopupManager />
                </Suspense>

                <Preload all />
            </Canvas>
        </div>
    );
};
