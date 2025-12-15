
import { useTexture } from '@react-three/drei';
import { useEffect } from 'react';
import * as THREE from 'three';
import { AssetManager } from '../../services/AssetManager';
import { TerrainType, Entity } from '../../types';

interface Props {
    terrain: TerrainType;
    entities: Entity[];
}

const TexturePreloader = ({ urls }: { urls: string[] }) => {
    // Only call useTexture if urls is a valid non-empty array
    const textures = useTexture(urls);

    useEffect(() => {
        const texArray = Array.isArray(textures) ? textures : [textures];
        texArray.forEach(t => {
            if (t) {
                t.magFilter = THREE.NearestFilter;
                t.minFilter = THREE.NearestFilter;
                t.colorSpace = THREE.SRGBColorSpace;
            }
        });
    }, [textures]);

    return null;
};

/**
 * Invisible component that suspends until all required textures for the battle are loaded.
 * It configures texture encoding globally for consistency.
 */
export const BattleAssetsLoader = ({ terrain, entities }: Props) => {
    // 1. Calculate all assets needed for this scene
    const rawUrls = AssetManager.getAllBattleAssets(terrain, entities);
    
    // CRITICAL FIX: Filter out bad URLs that crash Three.js loader
    const allUrls = rawUrls.filter(url => 
        url && 
        typeof url === 'string' && 
        url.length > 5 && 
        !url.includes('undefined') &&
        !url.includes('null')
    );

    // 2. Only render the preloader if there are URLs. 
    // Passing an empty array to useTexture can cause issues or is wasteful.
    if (!allUrls || allUrls.length === 0) return null;

    return <TexturePreloader urls={allUrls} />;
};
