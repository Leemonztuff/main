
import React, { useRef, useState, useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, useTexture, Sparkles, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS, CLASS_CONFIG } from '../../constants';
import { CharacterClass } from '../../types';

// Simplified Sprite that assumes texture is preloaded by parent/manager
const SpriteComponent = React.memo(({ url, isMoving, facingRight, actionType, isActing, opacity = 1, colorTint = 'white' }: { url: string, isMoving: boolean, facingRight: boolean, actionType?: string, isActing?: boolean, opacity?: number, colorTint?: string }) => {
    let safeUrl = ASSETS.UNITS.PLAYER; 
    
    if (url && typeof url === 'string' && url.length > 5 && !url.includes('undefined') && !url.includes('null')) {
        if (url.toLowerCase().endsWith('.svg')) {
             safeUrl = ASSETS.UNITS.PLAYER; 
        } else {
             safeUrl = url;
        }
    }
    
    // Attempt to load texture; if fails, error boundary will catch higher up, OR we use a fallback geometry in parent
    const texture = useTexture(safeUrl);
    
    useLayoutEffect(() => {
        if(texture) {
            if (texture instanceof THREE.Texture) {
                texture.magFilter = THREE.NearestFilter;
                texture.minFilter = THREE.NearestFilter;
                texture.colorSpace = THREE.SRGBColorSpace;
            }
        }
    }, [texture]);

    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            if (isActing && actionType === 'ATTACK') {
                meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 30) * 0.2;
            } else if (isMoving) {
                meshRef.current.position.y = Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.1;
                meshRef.current.scale.y = 1 + Math.sin(state.clock.elapsedTime * 15) * 0.05;
                meshRef.current.rotation.z = 0;
            } else {
                meshRef.current.position.y = 0;
                meshRef.current.scale.y = 1;
                meshRef.current.rotation.z = 0;
            }
        }
    });

    return (
        <group position={[0, 1.15, 0]}>
             <mesh ref={meshRef} position={[0, 0, -0.01]} scale={[facingRight ? 1.05 : -1.05, 1.05, 1]}>
                <planeGeometry args={[2, 2]} />
                <meshBasicMaterial map={texture} transparent alphaTest={0.5} opacity={opacity} color="black" side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0, 0]} scale={[facingRight ? 1 : -1, 1, 1]}>
                <planeGeometry args={[2, 2]} />
                <meshStandardMaterial map={texture} transparent alphaTest={0.5} opacity={opacity} color={colorTint} side={THREE.DoubleSide} roughness={0.8} />
            </mesh>
        </group>
    )
});

// Fallback Geometry Component in case Sprite fails
const FallbackGeometry = ({ color, isMoving }: { color: string, isMoving: boolean }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    useFrame((state) => {
        if (meshRef.current && isMoving) {
            meshRef.current.position.y = 0.75 + Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.1;
        }
    });
    
    return (
        <mesh ref={meshRef} position={[0, 0.75, 0]} castShadow receiveShadow>
            <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.3} metalness={0.1} />
        </mesh>
    );
};

export const BillboardUnit = React.memo(({ 
    position, color, spriteUrl, isCurrentTurn, hp, maxHp, 
    onUnitClick, onUnitRightClick, isActing, actionType, 
    characterClass, statusEffects, name, level 
}: any) => {
  
  const hpPercent = Math.max(0, Math.min(1, hp / (maxHp || 1)));
  const groupRef = useRef<THREE.Group>(null);
  const visualPos = useRef(new THREE.Vector3(position[0], position[1], position[2]));
  const [isMoving, setIsMoving] = useState(false);
  const [facingRight, setFacingRight] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [textureError, setTextureError] = useState(false);

  // Derive class theme
  const classConfig = characterClass ? CLASS_CONFIG[characterClass as CharacterClass] : null;
  const themeColor = classConfig?.hex || color;
  
  // Status Effects Logic
  const isStunned = statusEffects?.['STUN'] > 0;
  const isStealthed = statusEffects?.['STEALTH'] > 0;
  const isRaging = statusEffects?.['RAGE'] > 0;
  const hasInspiration = statusEffects?.['BARDIC'] > 0;
  const isHuntersMarked = statusEffects?.['HUNTERS_MARK'] > 0;
  const isStoneSkin = statusEffects?.['STONE_SKIN'] > 0;

  const finalOpacity = isStealthed ? 0.5 : 1;
  const finalTint = isRaging ? '#fca5a5' : (isStoneSkin ? '#9ca3af' : 'white');

  // Should we show the full UI plate?
  const showFullPlate = isCurrentTurn || isHovered || hpPercent < 1;

  useLayoutEffect(() => {
      if (groupRef.current) {
          groupRef.current.position.set(position[0], position[1], position[2]);
          visualPos.current.set(position[0], position[1], position[2]);
      }
  }, []);

  useFrame((state, delta) => {
      if (groupRef.current) {
          const target = new THREE.Vector3(position[0], position[1], position[2]);
          const dist = visualPos.current.distanceTo(target);
          
          if (dist > 0.05) {
              setIsMoving(true);
              if (target.x > visualPos.current.x) setFacingRight(true);
              if (target.x < visualPos.current.x) setFacingRight(false);
              const speed = 8 * delta;
              visualPos.current.lerp(target, speed);
              visualPos.current.y = position[1] + Math.abs(Math.sin(state.clock.elapsedTime * 15)) * 0.2; 
          } else {
              setIsMoving(false);
              visualPos.current.copy(target);
              
              if (isActing) {
                  if (actionType === 'ATTACK') {
                      const t = state.clock.elapsedTime * 20;
                      visualPos.current.y = position[1] + Math.abs(Math.sin(t)) * 0.2;
                      visualPos.current.x += Math.sin(t * 1.5) * 0.1; 
                  } else if (actionType === 'MAGIC') {
                      const t = state.clock.elapsedTime * 10;
                      visualPos.current.y = position[1] + 0.5 + Math.sin(t) * 0.1;
                  }
              } else {
                  const phase = (position[0] + position[2]) * 0.5;
                  const hover = Math.sin(state.clock.elapsedTime * 2 + phase) * 0.05;
                  visualPos.current.y = position[1] + hover;
              }
          }
          groupRef.current.position.copy(visualPos.current);
      }
  });

  const handleClick = (e: any) => {
      e.stopPropagation();
      onUnitClick(position[0], position[2]); 
  };

  const handleContextMenu = (e: any) => {
      e.stopPropagation();
      if (onUnitRightClick) onUnitRightClick();
  };

  return (
    <group 
        ref={groupRef} 
        onContextMenu={handleContextMenu}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
    >
        {/* Selection Ring (Enhanced) */}
        {isCurrentTurn && (
            <group position={[0, 0.05, 0]}>
                 <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.4, 0.45, 32]} />
                    <meshBasicMaterial color={themeColor} transparent opacity={0.8} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.35, 0.5, 32]} />
                    <meshBasicMaterial color={themeColor} transparent opacity={0.2} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>
            </group>
        )}
        
        {/* Shadow Blob */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 0]} scale={[1.2, 0.8, 1]}>
            <circleGeometry args={[0.35, 16]} />
            <meshBasicMaterial color="black" transparent opacity={0.4} depthWrite={false} />
        </mesh>
        
        {isMoving && <Sparkles count={5} scale={1.5} size={2} speed={0.4} opacity={0.5} color="#fbbf24" position={[0, 0.2, 0]} />}
        {isActing && actionType === 'MAGIC' && (
             <Sparkles count={20} scale={2} size={3} speed={1} opacity={0.8} color="#a855f7" position={[0, 1, 0]} />
        )}

        {/* STATUS ICONS ROW (3D) */}
        <group position={[0, 2.2, 0]}>
            <Billboard follow={true}>
                <group>
                    {isStunned && <Text position={[0, 0, 0]} fontSize={0.5} outlineWidth={0.05} outlineColor="black">💫</Text>}
                    {isRaging && <Text position={[0.5, 0, 0]} fontSize={0.4} outlineWidth={0.05} outlineColor="black">😡</Text>}
                    {isStealthed && <Text position={[-0.5, 0, 0]} fontSize={0.4} outlineWidth={0.05} outlineColor="black">👻</Text>}
                    {hasInspiration && <Text position={[0, 0.5, 0]} fontSize={0.4} outlineWidth={0.05} outlineColor="black">🎶</Text>}
                    {isHuntersMarked && <Text position={[0, 0.5, 0]} fontSize={0.4} outlineWidth={0.05} outlineColor="black">🎯</Text>}
                    {isStoneSkin && <Text position={[0.5, 0.5, 0]} fontSize={0.4} outlineWidth={0.05} outlineColor="black">🛡️</Text>}
                </group>
            </Billboard>
        </group>

        {/* SPRITE or FALLBACK */}
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
            <group onClick={handleClick}>
                {!textureError ? (
                    <ErrorBoundary fallback={
                        <FallbackGeometry color={themeColor} isMoving={isMoving} />
                    }>
                        <SpriteComponent 
                            url={spriteUrl} 
                            isMoving={isMoving} 
                            facingRight={facingRight} 
                            isActing={isActing} 
                            actionType={actionType}
                            opacity={finalOpacity}
                            colorTint={finalTint}
                        />
                    </ErrorBoundary>
                ) : (
                    <FallbackGeometry color={themeColor} isMoving={isMoving} />
                )}
            </group>
        </Billboard>
        
        {/* PRO NAMEPLATES (Using HTML for crisp text/UI) */}
        {/* Only rendered if visible to reduce DOM load, zIndexRange handles depth sorting */}
        <Html position={[0, 2.4, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className={`transition-all duration-300 transform ${showFullPlate ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
                {/* Main Plate */}
                <div className="flex flex-col items-center min-w-[120px] drop-shadow-md">
                    {/* Name & Level - Only active or hover */}
                    {(isCurrentTurn || isHovered) && (
                        <div className="flex items-center gap-1 mb-1 animate-in fade-in slide-in-from-bottom-1">
                            <div className="bg-slate-900 border border-slate-600 text-white text-[9px] font-bold px-1.5 rounded">
                                {level || 1}
                            </div>
                            <span className="text-xs font-bold text-white font-serif tracking-wide text-shadow-sm bg-black/40 px-2 rounded">
                                {name || 'Unknown'}
                            </span>
                        </div>
                    )}

                    {/* HP BAR */}
                    <div className="relative w-24 h-2.5 bg-slate-900 border border-slate-600 rounded-sm overflow-hidden">
                        <div 
                            className={`h-full transition-all duration-500 ease-out ${hpPercent > 0.5 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : (hpPercent > 0.2 ? 'bg-gradient-to-r from-amber-600 to-amber-400' : 'bg-gradient-to-r from-red-700 to-red-500 animate-pulse')}`}
                            style={{ width: `${hpPercent * 100}%` }}
                        />
                        {/* Gloss Effect */}
                        <div className="absolute top-0 left-0 right-0 h-[40%] bg-white/20" />
                    </div>
                </div>
            </div>
            
            {/* Minimalist Dot for inactive/full HP units to reduce clutter */}
            {!showFullPlate && (
                <div className="w-2 h-2 bg-slate-500/50 rounded-full mt-8 border border-black/50" />
            )}
        </Html>
    </group>
  );
});

class ErrorBoundary extends React.Component<{ fallback: React.ReactNode, children?: React.ReactNode }, { hasError: boolean }> {
    readonly props: Readonly<{ fallback: React.ReactNode, children?: React.ReactNode }>;
    state = { hasError: false };
    
    constructor(props: { fallback: React.ReactNode, children?: React.ReactNode }) {
        super(props);
        this.props = props;
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() { return { hasError: true }; }
    render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}