
import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const FogController = React.memo(({ isShadowRealm }: { isShadowRealm: boolean }) => {
    const { scene } = useThree();
    useEffect(() => {
        if (isShadowRealm) {
            scene.fog = new THREE.FogExp2('#1e1b4b', 0.04); 
            scene.background = new THREE.Color('#020617');
        } else {
            scene.fog = new THREE.FogExp2('#0f172a', 0.015);
            scene.background = new THREE.Color('#0f172a');
        }
    }, [isShadowRealm, scene]);
    return null;
});
