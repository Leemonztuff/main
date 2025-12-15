
import React, { useRef, useMemo, useLayoutEffect } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { ASSETS } from '../../constants';
import { BattleCell } from '../../types';

// Render a single type of decoration in batch, receiving Texture object prop
const InstancedDecoration = React.memo(({ texture, positions, scaleRange = [0.8, 1.2] }: { texture: THREE.Texture, positions: THREE.Vector3[], scaleRange?: [number, number] }) => {
    // CRITICAL FIX: Ensure texture is valid before rendering
    if (!texture || !positions || positions.length === 0) return null;
    
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useLayoutEffect(() => {
        if (!meshRef.current || positions.length === 0) return;

        positions.forEach((pos, i) => {
            dummy.position.copy(pos);
            const s = scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [positions, scaleRange]);

    return (
        <group>
            <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
                <planeGeometry args={[0.8, 0.8]} />
                <meshStandardMaterial map={texture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
            </instancedMesh>
            <instancedMesh args={[undefined, undefined, positions.length]} 
                           instanceMatrix={meshRef.current?.instanceMatrix} 
                           rotation={[0, Math.PI/2, 0]}>
                <planeGeometry args={[0.8, 0.8]} />
                <meshStandardMaterial map={texture} transparent alphaTest={0.5} side={THREE.DoubleSide} />
            </instancedMesh>
        </group>
    );
});

export const DecorationLayer = React.memo(({ mapData }: { mapData: BattleCell[] }) => {
    // 1. Load textures unconditionally
    const textureUrls = [
        ASSETS.DECORATIONS.GRASS_1,
        ASSETS.DECORATIONS.FLOWER_1,
        ASSETS.DECORATIONS.ROCK_1,
        ASSETS.DECORATIONS.MUSHROOM
    ];
    
    const textures = useTexture(textureUrls);

    // 2. Map loaded textures to keys
    // CRITICAL FIX: Handle case where textures might be missing in array
    const textureMap = useMemo(() => ({
        GRASS: Array.isArray(textures) ? textures[0] : null,
        FLOWER: Array.isArray(textures) ? textures[1] : null,
        ROCK: Array.isArray(textures) ? textures[2] : null,
        MUSHROOM: Array.isArray(textures) ? textures[3] : null
    }), [textures]);

    // 3. Calculate positions (Pseudo-random logic)
    const decorationGroups = useMemo(() => {
        const groups: Record<string, THREE.Vector3[]> = {
            GRASS: [], FLOWER: [], ROCK: [], MUSHROOM: []
        };
        if (!mapData) return groups;

        const pseudoRandom = (seed: number) => {
            let value = seed;
            return () => { value = (value * 9301 + 49297) % 233280; return value / 233280; };
        };

        mapData.forEach(cell => {
            if (!cell.textureUrl) return;
            const rng = pseudoRandom(cell.x * 73856093 ^ cell.z * 19349663);
            const y = cell.offsetY + cell.height;

            if (cell.textureUrl.includes('water') || cell.textureUrl.includes('lava')) return;

            if (cell.textureUrl.includes('grass')) {
                if (rng() > 0.6) {
                    const type = rng() > 0.9 ? 'FLOWER' : 'GRASS';
                    const ox = (rng() - 0.5) * 0.6;
                    const oz = (rng() - 0.5) * 0.6;
                    groups[type].push(new THREE.Vector3(cell.x + ox, y + 0.4, cell.z + oz));
                }
            }
            if (cell.textureUrl.includes('stone') || cell.textureUrl.includes('cobble')) {
                 if (rng() > 0.9) groups.ROCK.push(new THREE.Vector3(cell.x, y + 0.4, cell.z));
            }
            if (cell.textureUrl.includes('mycelium') || cell.textureUrl.includes('podzol')) {
                if (rng() > 0.8) groups.MUSHROOM.push(new THREE.Vector3(cell.x, y + 0.4, cell.z));
            }
        });
        return groups;
    }, [mapData]);

    // Ensure we have valid textures before trying to render instances
    if (!textureMap.GRASS && !textureMap.ROCK) return null;

    return (
        <group>
            {textureMap.GRASS && <InstancedDecoration texture={textureMap.GRASS} positions={decorationGroups.GRASS} />}
            {textureMap.FLOWER && <InstancedDecoration texture={textureMap.FLOWER} positions={decorationGroups.FLOWER} />}
            {textureMap.ROCK && <InstancedDecoration texture={textureMap.ROCK} positions={decorationGroups.ROCK} />}
            {textureMap.MUSHROOM && <InstancedDecoration texture={textureMap.MUSHROOM} positions={decorationGroups.MUSHROOM} />}
        </group>
    );
});
