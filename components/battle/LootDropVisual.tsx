
import React, { useRef } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import { Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { LootDrop } from '../../types';
import { RARITY_COLORS } from '../../constants';

export const LootDropVisual = React.memo(({ drop }: { drop: LootDrop }) => {
    const meshRef = useRef<THREE.Group>(null);
    const glowColor = RARITY_COLORS[drop.rarity];

    useFrame((state) => {
        if (meshRef.current) {
            // Bobbing animation - base Y increased to 0.85
            meshRef.current.position.y = 0.85 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
            meshRef.current.rotation.y += 0.01;
        }
    });

    return (
        <group ref={meshRef} position={[drop.position.x, 0.85, drop.position.y]}>
            {/* Bag Model */}
            <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshStandardMaterial color="#854d0e" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
                <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
                <meshStandardMaterial color="#a16207" />
            </mesh>
            {/* Rarity Glow */}
            <pointLight color={glowColor} intensity={1} distance={3} />
            <Sparkles count={10} scale={1} size={2} speed={0.4} opacity={0.5} color={glowColor} position={[0,0.2,0]} />
            
            {/* Icon Overlay using Html */}
            <Html position={[0, 0.8, 0]} center>
                <div className="bg-black/50 border border-white/20 rounded p-1 backdrop-blur-sm select-none pointer-events-none">
                    <span className="text-xl">💰</span>
                </div>
            </Html>
        </group>
    );
});
