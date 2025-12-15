
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
    texture: THREE.Texture, 
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
            // Alternate tint based on X+Z parity
            _tempColor.set(block.color);
            if ((block.x + block.z) % 2 === 0) {
                // Lighten slightly
                _tempColor.offsetHSL(0, 0, 0.05); 
            } else {
                // Darken slightly
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
            mat.emissiveIntensity = pulse;
            mat.emissive.setHSL(0.75, 1, 0.2 + pulse * 0.2); 
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
                map={texture} 
                color="white" 
                roughness={0.7} 
                metalness={0.1} 
                emissive={isShadowRealm ? '#4c1d95' : 'black'} // Deep purple base
                emissiveIntensity={isShadowRealm ? 0.2 : 0} 
            />
        </instancedMesh> 
    );
});

// Inner component to handle hook logic safely
const TerrainRenderer = ({ uniqueUrls, mapData, isShadowRealm, onTileClick, onTileHover }: any) => {
    const textures = useTexture(uniqueUrls);

    // Create a map of URL -> Texture Object
    const textureMap = useMemo(() => {
        const map: Record<string, THREE.Texture> = {};
        if (Array.isArray(textures)) {
            uniqueUrls.forEach((url: string, i: number) => {
                map[url] = textures[i];
            });
        } else {
            map[uniqueUrls[0]] = textures as unknown as THREE.Texture;
        }
        return map;
    }, [textures, uniqueUrls]);

    // Group data by texture URL
    const grouped = useMemo(() => {
        const g: Record<string, BattleCellType[]> = {};
        mapData.forEach((b: BattleCellType) => { 
            const k = b.textureUrl && b.textureUrl.length > 5 ? b.textureUrl : 'skip'; 
            if (k === 'skip') return; 
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
                    texture={textureMap[url]} 
                    data={blocks} 
                    isShadowRealm={isShadowRealm} 
                    onTileClick={onTileClick}
                    onTileHover={onTileHover}
                />
            ))}
             {/* Floor plane also needs to match the brightness */}
             <mesh rotation={[-Math.PI/2, 0, 0]} position={[center, -0.5, center]} receiveShadow={!isShadowRealm}>
                 <planeGeometry args={[100, 100]} />
                 <meshStandardMaterial color={isShadowRealm ? "#0f0518" : "#1e293b"} roughness={1} />
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

    if (uniqueUrls.length === 0) return null;

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
