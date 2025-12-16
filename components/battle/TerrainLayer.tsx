
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BATTLE_MAP_SIZE } from '../../constants'; 
import { BattleCell as BattleCellType } from '../../types';

const _tempObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

// Pure InstancedMesh component that receives the texture as a prop
const InstancedVoxelCluster = React.memo(({ data, texture, isShadowRealm, onTileClick, onTileHover }: { 
    data: BattleCellType[], 
    texture: THREE.Texture | null, 
    isShadowRealm: boolean, 
    onTileClick?: (x: number, z: number) => void,
    onTileHover?: (x: number, z: number) => void
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = data.length;

    useLayoutEffect(() => {
        if (!meshRef.current || count === 0) return;
        for (let i = 0; i < count; i++) {
            const block = data[i];
            const y = block.offsetY + block.height / 2;
            _tempObj.position.set(block.x, y, block.z);
            _tempObj.scale.set(1, block.height, 1);
            _tempObj.updateMatrix();
            meshRef.current.setMatrixAt(i, _tempObj.matrix);
            
            // CHECKERBOARD LOGIC
            _tempColor.set(block.color);
            if ((block.x + block.z) % 2 === 0) {
                _tempColor.offsetHSL(0, 0, 0.05); 
            } else {
                _tempColor.offsetHSL(0, 0, -0.05); 
            }
            
            meshRef.current.setColorAt(i, _tempColor);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [data, count]);

    // ANIMATION: Living Breath Pulse for Upside Down
    useFrame((state) => {
        if (isShadowRealm && meshRef.current) {
            const mat = meshRef.current.material as THREE.MeshStandardMaterial;
            const pulse = 0.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.15 + Math.sin(state.clock.elapsedTime * 5) * 0.05;
            
            // Set emission intensity but keep the vertex color (white/tinted) as base for emission
            // This ensures Lava blocks (Red) glow Red, and Shadow blocks (Purple) glow Purple.
            mat.emissiveIntensity = pulse;
            mat.emissive.setScalar(1); // Use white emission multiplied by vertex color (handled by three.js standard material logic usually)
            
            // Actually, StandardMaterial doesn't use vertex color for emission automatically unless configured.
            // Let's use a simpler approach: tint the emissive color slightly towards the shadow realm vibe OR keep it neutral to respect the block color
            // For now, let's just pulse intensity and let the base color carry the load, or use a neutral purple tint for all *except* high energy blocks
            
            // NOTE: Since we can't easily set per-instance emission color without a custom shader, 
            // we will rely on the global lighting changes in BattleScene to carry the mood,
            // and here we just provide a subtle pulse.
            
            mat.emissive.set('#ffffff'); // Emissive multiplies with color map. 
            // If texture is dark, emission is low. If lava texture is bright, it glows.
        }
    });

    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && data[instanceId]) {
            const { x, z } = data[instanceId];
            if (onTileHover) onTileHover(x, z);
        }
    };

    const handleClick = (e: any) => {
        e.stopPropagation();
        const instanceId = e.instanceId;
        if (instanceId !== undefined && data[instanceId]) {
            const { x, z } = data[instanceId];
            if (onTileClick) onTileClick(x, z);
        }
    };

    if (count === 0) return null;

    return ( 
        <instancedMesh 
            ref={meshRef} 
            args={[undefined, undefined, count]} 
            castShadow={!isShadowRealm} 
            receiveShadow={!isShadowRealm} 
            frustumCulled={false}
            onClick={handleClick}
            onPointerMove={handlePointerMove}
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
                map={texture || undefined} 
                color="white" 
                roughness={0.7} 
                metalness={0.1} 
                // We let the useFrame hook handle the emissive properties for ShadowRealm
                emissive="black"
                emissiveIntensity={0}
            />
        </instancedMesh> 
    );
});

// Inner component to handle hook logic safely
const TerrainRenderer = ({ uniqueUrls, mapData, isShadowRealm, onTileClick, onTileHover }: any) => {
    // Only call useTexture if we have URLs, otherwise we pass nulls
    const hasUrls = uniqueUrls.length > 0;
    const textures = hasUrls ? useTexture(uniqueUrls) : [];

    const textureMap = useMemo(() => {
        const map: Record<string, THREE.Texture> = {};
        if (hasUrls) {
            // @ts-ignore
            const texArray = Array.isArray(textures) ? textures : [textures];
            uniqueUrls.forEach((url: string, i: number) => {
                if (texArray[i]) {
                    map[url] = texArray[i];
                    map[url].magFilter = THREE.NearestFilter;
                    map[url].minFilter = THREE.NearestFilter;
                    map[url].colorSpace = THREE.SRGBColorSpace;
                }
            });
        }
        return map;
    }, [textures, uniqueUrls, hasUrls]);

    const grouped = useMemo(() => {
        const g: Record<string, BattleCellType[]> = {};
        const fallbackKey = 'fallback';
        
        mapData.forEach((b: BattleCellType) => { 
            let k = b.textureUrl && b.textureUrl.length > 5 ? b.textureUrl : fallbackKey;
            
            // If texture failed to load or key not in map, group by URL but it will render without texture
            if (!g[k]) g[k] = []; 
            g[k].push(b); 
        });
        return g;
    }, [mapData]);

    const center = BATTLE_MAP_SIZE / 2;

    return (
        <group>
            {Object.entries(grouped).map(([url, blocks]) => ( 
                <InstancedVoxelCluster 
                    key={url}
                    texture={textureMap[url] || null} 
                    data={blocks} 
                    isShadowRealm={isShadowRealm} 
                    onTileClick={onTileClick}
                    onTileHover={onTileHover}
                />
            ))}
             {/* Floor plane also needs to match the brightness */}
             <mesh rotation={[-Math.PI/2, 0, 0]} position={[center, -0.5, center]} receiveShadow={!isShadowRealm}>
                 <planeGeometry args={[100, 100]} />
                 <meshStandardMaterial color={isShadowRealm ? "#000000" : "#1e293b"} roughness={1} />
             </mesh>
        </group>
    );
};

export const TerrainLayer = React.memo(({ mapData, isShadowRealm, onTileClick, onTileHover }: any) => {
    if (!mapData || mapData.length === 0) return null;

    const uniqueUrls = useMemo(() => {
        const urls = new Set<string>();
        mapData.forEach((b: BattleCellType) => {
            if (b.textureUrl && b.textureUrl.length > 5) urls.add(b.textureUrl);
        });
        return Array.from(urls);
    }, [mapData]);

    return (
        <TerrainRenderer 
            uniqueUrls={uniqueUrls} 
            mapData={mapData} 
            isShadowRealm={isShadowRealm} 
            onTileClick={onTileClick}
            onTileHover={onTileHover} 
        />
    );
});
