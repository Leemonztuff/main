
import React, { useRef, useLayoutEffect, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ThreeElements, useFrame } from '@react-three/fiber';
import { Line, Ring, Html, Billboard, Text } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore';
import { BattleCell, BattleAction, CharacterClass } from '../../types';
import { BATTLE_MAP_SIZE } from '../../constants';
import { findBattlePath } from '../../services/pathfinding';
import { getAttackRange, calculateHitChance, getAoETiles, isFlanking, getDamageRange } from '../../services/dndRules';
import { ASSETS } from '../../constants';

const _tempObj = new THREE.Object3D();

// SHARED GEOMETRIES (Memory Optimization)
const PLANE_GEO = new THREE.PlaneGeometry(1, 1);
const RING_GEO = new THREE.RingGeometry(0.3, 0.45, 4);
const RANGE_GEO_CACHE = new Map<number, THREE.RingGeometry>();

const getRangeGeometry = (range: number) => {
    if (!RANGE_GEO_CACHE.has(range)) {
        const radius = range + 0.5;
        RANGE_GEO_CACHE.set(range, new THREE.RingGeometry(radius - 0.05, radius, 64));
    }
    return RANGE_GEO_CACHE.get(range)!;
};

// --- 3D ICONS FOR CURSOR ---
const CursorIcon = ({ type, position }: { type: 'SWORD' | 'FEET' | 'MAGIC' | 'STOP', position: THREE.Vector3 }) => {
    const ref = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (ref.current) {
            // Bobbing effect
            ref.current.position.y = position.y + 0.8 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
            ref.current.rotation.y += 0.02;
        }
    });

    let iconChar = '';
    let color = '';
    let scale = 1;

    switch(type) {
        case 'SWORD': iconChar = '⚔️'; color = '#ef4444'; scale=1.5; break;
        case 'FEET': iconChar = '🦶'; color = '#3b82f6'; scale=1.2; break;
        case 'MAGIC': iconChar = '✨'; color = '#a855f7'; scale=1.5; break;
        case 'STOP': iconChar = '🚫'; color = '#94a3b8'; scale=1.0; break;
    }

    return (
        // Disable raycast to prevent blocking terrain hover
        <group ref={ref} position={[position.x, position.y, position.z]} raycast={() => null}>
            <Billboard>
                <Text 
                    position={[0,0,0]} 
                    fontSize={scale} 
                    color={color} 
                    anchorX="center" 
                    anchorY="middle"
                    outlineWidth={0.05}
                    outlineColor="black"
                >
                    {iconChar}
                </Text>
            </Billboard>
        </group>
    );
};

// --- GHOST UNIT PREVIEW ---
const GhostUnit = ({ position, spriteUrl }: { position: THREE.Vector3, spriteUrl?: string }) => {
    if (!spriteUrl) return null;
    return (
        <group position={[position.x, position.y + 0.5, position.z]} raycast={() => null}>
            <Billboard>
                <mesh position={[0, 0.5, 0]}>
                    <planeGeometry args={[2, 2]} />
                    <meshBasicMaterial 
                        map={new THREE.TextureLoader().load(spriteUrl)} 
                        transparent 
                        opacity={0.5} 
                        color="#3b82f6" 
                        depthWrite={false}
                    />
                </mesh>
            </Billboard>
            <mesh geometry={new THREE.RingGeometry(0.3, 0.4, 16)} rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]}>
                <meshBasicMaterial color="#3b82f6" opacity={0.6} transparent />
            </mesh>
        </group>
    );
};

// Enhanced Grid Overlay using InstancedMesh
const InstancedGridOverlay = React.memo(({ points, color, mapData, type }: any) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = points ? points.length : 0;
    
    useLayoutEffect(() => {
        if (!meshRef.current || count === 0 || !mapData) return;
        
        let validCount = 0;
        for (let i = 0; i < count; i++) {
            const p = points[i];
            if (!p) continue; // Safety check

            const cell = mapData.find((c: BattleCell) => c.x === p.x && c.z === p.y);
            const y = cell ? cell.offsetY + cell.height : 0.5; 
            
            _tempObj.position.set(p.x, y + 0.02, p.y);
            _tempObj.rotation.set(-Math.PI / 2, 0, 0);
            
            // Full tile for AOE, slight shrink for move
            const scale = type === 'aoe' ? 0.95 : (type === 'move' ? 0.85 : 0.8);
            _tempObj.scale.set(scale, scale, 1);
            
            // Apply rotation for 'target' (valid targets) to make it look diamond-like if intended
            if (type === 'target') {
                _tempObj.rotateZ(Math.PI / 4);
            }

            _tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, _tempObj.matrix);
            validCount++;
        }
        meshRef.current.count = validCount; // Update draw count
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    }, [points, mapData, count, type]);

    useFrame((state) => {
        if (meshRef.current) {
            // Distinct pulse based on type
            const time = state.clock.elapsedTime;
            let opacityBase = 0.3;
            let speed = 2;
            
            if (type === 'target') { opacityBase = 0.4; speed = 4; }
            if (type === 'aoe') { opacityBase = 0.5; speed = 3; }

            const opacity = opacityBase + Math.sin(time * speed) * 0.15;
            
            // Safe access check
            if (!Array.isArray(meshRef.current.material)) {
                meshRef.current.material.opacity = opacity;
                meshRef.current.material.needsUpdate = true;
            }
        }
    });

    if (count === 0) return null;

    // Select shared geometry
    const geometry = (type === 'move' || type === 'aoe') ? PLANE_GEO : RING_GEO;

    return (
        // Explicitly disable raycasting for overlay tiles
        <instancedMesh ref={meshRef} args={[geometry, undefined, count]} frustumCulled={false} raycast={() => null}>
            <meshBasicMaterial color={color} transparent depthWrite={false} side={THREE.DoubleSide} />
        </instancedMesh>
    );
});

const RangeIndicator = ({ position, range, color = '#fbbf24', style = 'solid' }: { position: THREE.Vector3, range: number, color?: string, style?: 'solid' | 'dashed' }) => {
    if (range <= 0) return null;
    const geometry = getRangeGeometry(range);
    
    return (
        <group position={[position.x, 0.05, position.z]} raycast={() => null}>
            <group rotation={[-Math.PI/2, 0, 0]}>
                <mesh geometry={geometry}>
                    <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
                </mesh>
            </group>
        </group>
    );
};

const CursorTooltip = ({ position, text, subtext, color, detail }: { position: THREE.Vector3, text: string, subtext?: string, color?: string, detail?: string }) => {
    let bgClass = 'bg-slate-900/95 text-slate-100 border-slate-600';
    if (color === 'red') bgClass = 'bg-red-900/90 text-red-100 border-red-500';
    if (color === 'blue') bgClass = 'bg-blue-900/90 text-blue-100 border-blue-500';
    if (color === 'purple') bgClass = 'bg-purple-900/90 text-purple-100 border-purple-500';
    if (color === 'green') bgClass = 'bg-emerald-900/90 text-emerald-100 border-emerald-500';

    return (
        <Html position={[position.x, position.y + 1.8, position.z]} center style={{ pointerEvents: 'none', zIndex: 10 }}>
            <div className={`flex flex-col items-center gap-1 transition-all duration-200 p-2 rounded-lg shadow-2xl border backdrop-blur-md min-w-[120px] ${bgClass}`}>
                
                {/* Main Action Text */}
                <div className="font-bold text-sm whitespace-nowrap uppercase tracking-wider mb-1">
                    {text}
                </div>
                
                {/* Tactical Details */}
                {detail && (
                    <div className="flex flex-col items-center w-full bg-black/40 rounded p-1 mb-1 space-y-0.5">
                        <span className="text-[10px] text-yellow-300 font-mono">{detail}</span>
                    </div>
                )}

                {/* Subtext (Context) */}
                {subtext && (
                    <div className="px-2 py-0.5 rounded bg-black/60 text-[9px] text-white font-bold font-mono shadow-md backdrop-blur-sm whitespace-nowrap animate-pulse">
                        {subtext}
                    </div>
                )}
            </div>
        </Html>
    );
};

export const InteractionLayer = ({ mapData, validMoves, validTargets, currentRange, movementRange }: any) => {
    const { selectedTile, selectedAction, selectedSpell, selectedSkill, battleEntities, turnOrder, currentTurnIndex } = useGameStore(state => ({
        selectedTile: state.selectedTile,
        selectedAction: state.selectedAction,
        selectedSpell: state.selectedSpell,
        selectedSkill: state.selectedSkill,
        battleEntities: state.battleEntities,
        turnOrder: state.turnOrder,
        currentTurnIndex: state.currentTurnIndex
    }));
    
    const [hoveredPos, setHoveredPos] = useState<THREE.Vector3 | null>(null);
    const [pathPoints, setPathPoints] = useState<THREE.Vector3[]>([]);
    const [aoePoints, setAoePoints] = useState<{x:number, y:number}[]>([]);
    
    const [tooltipData, setTooltipData] = useState<{ text: string, subtext?: string, color: string, detail?: string } | null>(null);
    const [cursorType, setCursorType] = useState<'SWORD' | 'FEET' | 'MAGIC' | 'STOP' | null>(null);

    const activeEntityId = turnOrder[currentTurnIndex];
    const activeEntity = battleEntities?.find((e: any) => e.id === activeEntityId);
    const isPlayerTurn = activeEntity?.type === 'PLAYER';

    // Calculate effective action based on hover + selection
    useEffect(() => {
        if (!selectedTile || !activeEntity || !activeEntity.position || !isPlayerTurn) {
            setPathPoints([]);
            setHoveredPos(null);
            setTooltipData(null);
            setCursorType(null);
            setAoePoints([]);
            return;
        }

        const targetX = selectedTile.x;
        const targetZ = selectedTile.z;
        const startX = activeEntity.position.x;
        const startZ = activeEntity.position.y;

        // Get cell height
        const cell = mapData?.find((c: BattleCell) => c.x === targetX && c.z === targetZ);
        const y = cell ? cell.offsetY + cell.height : 0.5;
        const currentPos = new THREE.Vector3(targetX, y, targetZ);
        setHoveredPos(currentPos);

        // --- INTELLIGENT CONTEXT LOGIC ---
        // 1. Is there an enemy here?
        const enemyAtTarget = battleEntities.find((e: any) => e.position.x === targetX && e.position.y === targetZ && e.type === 'ENEMY');
        
        // 2. Is this a valid move tile?
        const isMoveTile = validMoves?.some((m: any) => m.x === targetX && m.y === targetZ);

        // 3. Determine Effective Action
        let effectiveAction = selectedAction;
        if (!effectiveAction) {
            if (enemyAtTarget) effectiveAction = BattleAction.ATTACK;
            else if (isMoveTile) effectiveAction = BattleAction.MOVE;
        }

        // --- RENDER LOGIC BASED ON EFFECTIVE ACTION ---
        setPathPoints([]);
        setAoePoints([]);

        if (effectiveAction === BattleAction.MOVE) {
            if (isMoveTile && !enemyAtTarget) {
                setCursorType('FEET');
                const path = findBattlePath({ x: startX, y: startZ }, { x: targetX, y: targetZ }, mapData || []);
                if (path) {
                    const points = path.map(p => {
                        const pc = mapData?.find((c: BattleCell) => c.x === p.x && c.z === p.z);
                        return new THREE.Vector3(p.x, (pc ? pc.offsetY + pc.height : 0) + 0.05, p.z);
                    });
                    points.unshift(new THREE.Vector3(startX, activeEntity.position.y + 0.05, startZ));
                    setPathPoints(points);
                    
                    let totalCost = 0;
                    path.forEach(node => {
                        const nodeCell = mapData?.find((c: BattleCell) => c.x === node.x && c.z === node.z);
                        totalCost += (nodeCell?.movementCost || 1) * 5;
                    });
                    setTooltipData({ text: "Move", detail: `${totalCost} ft`, color: 'blue' });
                }
            } else {
                setCursorType('STOP');
                setTooltipData(null);
            }
        } 
        else if (effectiveAction === BattleAction.ATTACK) {
            if (enemyAtTarget) {
                // Check range
                const dist = Math.max(Math.abs(startX - targetX), Math.abs(startZ - targetZ));
                const range = getAttackRange(activeEntity);
                
                if (dist <= range) {
                    setCursorType('SWORD');
                    try {
                        const hitChance = calculateHitChance(activeEntity, enemyAtTarget);
                        const dmgPreview = getDamageRange(activeEntity);
                        
                        let subtext = "";
                        // Check Sneak Attack Context (Rogue + Flanking)
                        if (activeEntity.stats.class === CharacterClass.ROGUE && isFlanking(activeEntity, enemyAtTarget, battleEntities)) {
                            subtext = "Sneak Attack!";
                        }
                        if (activeEntity.stats.statusEffects && activeEntity.stats.statusEffects['STEALTH']) {
                            subtext = subtext ? `${subtext} (Adv)` : "Advantage";
                        }

                        setTooltipData({ 
                            text: "ATTACK", 
                            detail: `${hitChance}% Hit | ${dmgPreview} Dmg`, 
                            subtext, 
                            color: 'red' 
                        });
                    } catch(e) {
                        setTooltipData({ text: "Attack", color: 'red' });
                    }
                } else {
                    setCursorType('STOP');
                    setTooltipData({ text: "Out of Range", color: 'red' });
                }
            } else {
                setCursorType(null);
                setTooltipData(null);
            }
        }
        else if (effectiveAction === BattleAction.MAGIC || effectiveAction === BattleAction.SKILL) {
            const skillOrSpell = selectedSpell || selectedSkill;
            if (!skillOrSpell) return;

            setCursorType('MAGIC');
            const dist = Math.max(Math.abs(startX - targetX), Math.abs(startZ - targetZ));
            
            // Check if within cast range
            if (dist <= skillOrSpell.range) {
                setTooltipData({ text: skillOrSpell.name, color: 'purple' });
                
                // --- AOE VISUALIZATION ---
                if (skillOrSpell.aoeRadius) {
                    const tiles = getAoETiles(
                        { x: startX, y: startZ },
                        { x: targetX, y: targetZ },
                        skillOrSpell.aoeType || 'CIRCLE', // Use property if exists, else default circle
                        skillOrSpell.aoeRadius
                    );
                    setAoePoints(tiles);
                }
            } else {
                setCursorType('STOP');
                setTooltipData({ text: "Too Far", color: 'red' });
            }
        }

    }, [selectedTile, selectedAction, selectedSpell, selectedSkill, activeEntity, mapData, validMoves]);

    return (
        <group>
            {/* RANGE INDICATOR CIRCLE */}
            {activeEntity && isPlayerTurn && !hasPathPreview && (
                <RangeIndicator 
                    position={new THREE.Vector3(activeEntity.position.x, 0, activeEntity.position.y)} 
                    range={selectedAction === BattleAction.MOVE ? movementRange : currentRange} 
                    color={selectedAction === BattleAction.ATTACK ? '#f87171' : (selectedAction === BattleAction.MAGIC ? '#c084fc' : '#60a5fa')}
                />
            )}

            {/* VALID MOVE HIGHLIGHTS (Blue Dots) */}
            {selectedAction === BattleAction.MOVE && validMoves && (
                <InstancedGridOverlay points={validMoves} color="#3b82f6" mapData={mapData} type="move" />
            )}

            {/* VALID TARGET HIGHLIGHTS (Red Diamonds) */}
            {(selectedAction === BattleAction.ATTACK || selectedAction === BattleAction.MAGIC) && validTargets && (
                <InstancedGridOverlay points={validTargets} color="#ef4444" mapData={mapData} type="target" />
            )}

            {/* PATH LINE PREVIEW */}
            {pathPoints.length > 0 && (
                <Line points={pathPoints} color="#60a5fa" lineWidth={3} dashed dashScale={2} />
            )}

            {/* AOE HIGHLIGHTS (Red Area) */}
            {aoePoints.length > 0 && (
                <InstancedGridOverlay points={aoePoints} color="rgba(239, 68, 68, 0.6)" mapData={mapData} type="aoe" />
            )}

            {/* HOVER CURSOR & TOOLTIP */}
            {hoveredPos && cursorType && (
                <>
                    <CursorIcon type={cursorType} position={hoveredPos} />
                    {tooltipData && <CursorTooltip position={hoveredPos} {...tooltipData} />}
                </>
            )}

            {/* GHOST UNIT FOR MOVE PREVIEW */}
            {selectedAction === BattleAction.MOVE && hoveredPos && cursorType === 'FEET' && (
                <GhostUnit position={hoveredPos} spriteUrl={activeEntity?.visual.spriteUrl} />
            )}
        </group>
    );
};

const hasPathPreview = false; 
