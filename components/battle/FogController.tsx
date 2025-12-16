
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { TerrainType } from '../../types';

export const FogController = React.memo(({ isShadowRealm, terrain }: { isShadowRealm: boolean, terrain: TerrainType }) => {
    const { scene } = useThree();
    
    useEffect(() => {
        if (terrain === TerrainType.LAVA) {
            // Boss Arena / Lava: Dark Red/Orange Atmosphere
            // Lower density (0.02) to ensure visibility across the map
            scene.fog = new THREE.FogExp2('#3f0f0f', 0.02); 
            scene.background = new THREE.Color('#1a0505');
        } else if (isShadowRealm) {
            // Standard Shadow Realm: Deep Purple/Blue
            scene.fog = new THREE.FogExp2('#1e1b4b', 0.035); 
            scene.background = new THREE.Color('#020617');
        } else {
            // Normal World: Night/Dark Blue
            scene.fog = new THREE.FogExp2('#0f172a', 0.015);
            scene.background = new THREE.Color('#0f172a');
        }
    }, [isShadowRealm, terrain, scene]);
    
    return null;
});
