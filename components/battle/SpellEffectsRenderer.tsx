
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, QuadraticBezierLine, useTexture, Trail, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { SpellEffectData } from '../../types';
import { ASSETS } from '../../constants';
import { TextureErrorBoundary } from './Shared';

// --- SUB-COMPONENTS FOR SAFE TEXTURE LOADING ---

const AnimatedSprite = ({ frames, duration, opacity = 1, color = 'white' }: { frames: string[], duration: number, opacity?: number, color?: string }) => {
    // Ensure hooks are called unconditionally, handle empty arrays gracefully
    const safeFrames = (frames && frames.length > 0) ? frames : [ASSETS.UNITS.PLAYER]; // Fallback to avoid empty loader
    const textures = useTexture(safeFrames);
    const meshRef = useRef<THREE.Mesh>(null);

    useLayoutEffect(() => {
        // @ts-ignore
        const texArray = Array.isArray(textures) ? textures : [textures];
        texArray.forEach(t => {
            if (t) {
                t.magFilter = THREE.NearestFilter;
                t.minFilter = THREE.NearestFilter;
                t.colorSpace = THREE.SRGBColorSpace;
            }
        });
    }, [textures]);

    useFrame((state) => {
        if (meshRef.current && Array.isArray(textures) && textures.length > 0 && frames && frames.length > 0) {
             const timePerFrame = (duration / 1000) / frames.length;
             const idx = Math.floor((state.clock.elapsedTime / timePerFrame) % frames.length);
             if (textures[idx]) {
                 (meshRef.current.material as THREE.MeshBasicMaterial).map = textures[idx];
                 (meshRef.current.material as THREE.MeshBasicMaterial).needsUpdate = true;
             }
        }
    });

    if (!frames || frames.length === 0) return null;

    return (
        <Billboard follow={true}>
            <mesh ref={meshRef}>
                <planeGeometry args={[2, 2]} />
                <meshBasicMaterial 
                    // @ts-ignore
                    map={textures[0]} 
                    transparent 
                    opacity={opacity} 
                    color={color} 
                    depthWrite={false} 
                    blending={THREE.AdditiveBlending} 
                />
            </mesh>
        </Billboard>
    );
};

const HaloEffect = ({ url, color }: { url: string, color: string }) => {
    const texture = useTexture(url);
    const meshRef = useRef<THREE.Mesh>(null);

    useFrame((state) => {
        if (meshRef.current) {
            meshRef.current.rotation.z -= 0.05; 
            const scale = 1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
            meshRef.current.scale.set(scale, scale, 1);
        }
    });

    return (
        <Billboard follow={true}>
            <mesh ref={meshRef}>
                <planeGeometry args={[2, 2]} />
                <meshBasicMaterial map={texture} transparent opacity={0.8} color={color} depthWrite={false} blending={THREE.AdditiveBlending} />
            </mesh>
        </Billboard>
    );
};

// Separated component to isolate useTexture hook
const ProjectileSprite = ({ url }: { url: string }) => {
    const texture = useTexture(url);
    
    useLayoutEffect(() => {
        if (texture) {
            texture.magFilter = THREE.NearestFilter;
            texture.minFilter = THREE.NearestFilter;
            texture.colorSpace = THREE.SRGBColorSpace;
        }
    }, [texture]);

    return (
        <group rotation={[0, 0, Math.PI / 2]}>
            <Billboard follow={true}>
                <mesh>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial map={texture} transparent />
                </mesh>
            </Billboard>
        </group>
    );
};

// --- MAIN RENDERER ---

export const SpellEffectsRenderer = React.memo(({ activeSpellEffect }: { activeSpellEffect: SpellEffectData | null }) => {
    const meshRef = useRef<THREE.Group>(null);
    const progressRef = useRef(0);
    
    useFrame((state, delta) => {
        if (!activeSpellEffect || !meshRef.current) {
            progressRef.current = 0;
            return;
        }

        const speed = 1.0 / (activeSpellEffect.duration / 1000); 
        progressRef.current = Math.min(1, progressRef.current + delta * speed);

        const start = new THREE.Vector3(...activeSpellEffect.startPos);
        const end = new THREE.Vector3(...activeSpellEffect.endPos);

        if (activeSpellEffect.type === 'PROJECTILE') {
            meshRef.current.position.lerpVectors(start, end, progressRef.current);
            meshRef.current.position.y += Math.sin(progressRef.current * Math.PI) * 2;
            meshRef.current.lookAt(end);
        } else if (activeSpellEffect.type === 'BURST') {
            meshRef.current.position.copy(end);
        } else if (activeSpellEffect.type === 'BREATH') {
            // Breath doesn't move the group, particles handle movement
            meshRef.current.position.copy(start);
            meshRef.current.lookAt(end);
        }
    });

    if (!activeSpellEffect) return null;
    
    // HEAL should use animation key, not textureUrl directly as it's an array
    const animationKey = activeSpellEffect.animationKey || (activeSpellEffect.color === '#4ade80' ? 'HEAL' : null);
    const animationFrames = animationKey ? ASSETS.ANIMATIONS[animationKey as keyof typeof ASSETS.ANIMATIONS] : null;

    // Strict validation for single texture URL
    const projectileUrl = activeSpellEffect?.projectileSprite;
    const isValidProjectileUrl = projectileUrl && typeof projectileUrl === 'string' && !projectileUrl.includes('undefined') && !projectileUrl.includes('null');

    const textureUrl = activeSpellEffect?.textureUrl;
    const isValidTextureUrl = textureUrl && typeof textureUrl === 'string' && !Array.isArray(textureUrl) && !textureUrl.includes('undefined') && !textureUrl.includes('null');

    return (
        <group>
            {activeSpellEffect.type === 'PROJECTILE' && (
                <group ref={meshRef} position={activeSpellEffect.startPos}>
                     {isValidProjectileUrl ? (
                         <TextureErrorBoundary fallback={
                            <mesh>
                                <sphereGeometry args={[0.3, 16, 16]} />
                                <meshStandardMaterial color={activeSpellEffect.color} emissive={activeSpellEffect.color} emissiveIntensity={2} />
                            </mesh>
                         }>
                             <ProjectileSprite url={projectileUrl} />
                         </TextureErrorBoundary>
                     ) : (
                        <mesh>
                            <sphereGeometry args={[0.3, 16, 16]} />
                            <meshStandardMaterial color={activeSpellEffect.color} emissive={activeSpellEffect.color} emissiveIntensity={2} />
                        </mesh>
                     )}
                    
                    <Trail width={0.4} length={4} color={new THREE.Color(activeSpellEffect.color)} attenuation={(t) => t * t}>
                        <mesh visible={false}><sphereGeometry args={[0.1]} /><meshBasicMaterial /></mesh>
                    </Trail>
                    <pointLight color={activeSpellEffect.color} intensity={2} distance={5} />
                    
                    {isValidTextureUrl && (
                         <TextureErrorBoundary fallback={null}>
                             <HaloEffect url={textureUrl} color={activeSpellEffect.color} />
                         </TextureErrorBoundary>
                    )}
                </group>
            )}

            {activeSpellEffect.type === 'BEAM' && (
                <QuadraticBezierLine
                    start={activeSpellEffect.startPos}
                    end={activeSpellEffect.endPos}
                    mid={[
                        (activeSpellEffect.startPos[0] + activeSpellEffect.endPos[0]) / 2,
                        4, 
                        (activeSpellEffect.startPos[2] + activeSpellEffect.endPos[2]) / 2
                    ]}
                    color={activeSpellEffect.color}
                    lineWidth={3}
                    dashed={false}
                />
            )}

            {activeSpellEffect.type === 'BREATH' && (
                <group ref={meshRef} position={activeSpellEffect.startPos}>
                    {/* Breath Particles - A simple expanding cone of particles */}
                    <Sparkles 
                        count={50} 
                        scale={[1, 1, 4]} // Elongated along Z axis (local forward)
                        size={6} 
                        speed={2} 
                        opacity={1 - progressRef.current} 
                        color={activeSpellEffect.color} 
                        position={[0, 0.5, 1.5]} // Offset forward
                        noise={1}
                    />
                    <pointLight color={activeSpellEffect.color} intensity={2} distance={4} position={[0, 0.5, 1]} />
                </group>
            )}

            {/* Thunderwave / Area Burst Effect */}
            {activeSpellEffect.variant === 'BURST' && !animationFrames && (
                 <group position={activeSpellEffect.endPos}>
                    <mesh rotation={[-Math.PI/2, 0, 0]}>
                        <ringGeometry args={[progressRef.current * 1, progressRef.current * 3, 32]} />
                        <meshBasicMaterial color={activeSpellEffect.color} transparent opacity={1 - progressRef.current} side={THREE.DoubleSide} />
                    </mesh>
                    <Sparkles count={30} scale={4} size={4} speed={0.4} opacity={1 - progressRef.current} color={activeSpellEffect.color} />
                 </group>
            )}

            {/* Generic Burst or Cure Wounds */}
            {(activeSpellEffect.type === 'BURST' || progressRef.current > 0.8) && (
                <group position={activeSpellEffect.endPos}>
                    {animationFrames ? (
                        <group position={[0, 0.5, 0]}>
                            <TextureErrorBoundary fallback={<Sparkles count={20} scale={3} size={4} speed={0.4} opacity={1 - progressRef.current} color={activeSpellEffect.color} />}>
                                <AnimatedSprite frames={animationFrames} duration={activeSpellEffect.duration} color={activeSpellEffect.color} />
                            </TextureErrorBoundary>
                        </group>
                    ) : (
                        <Sparkles count={20} scale={3} size={4} speed={0.4} opacity={1 - progressRef.current} color={activeSpellEffect.color} />
                    )}
                    
                    {isValidTextureUrl && !animationFrames && (
                         <group position={[0, 0.5, 0]}>
                             <TextureErrorBoundary fallback={null}>
                                 <HaloEffect url={textureUrl} color={activeSpellEffect.color} />
                             </TextureErrorBoundary>
                         </group>
                    )}
                </group>
            )}
        </group>
    );
});
