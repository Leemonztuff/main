
import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import { BATTLE_MAP_SIZE } from '../../constants';
import { BattleAction } from '../../types';

export const CinematicCamera = () => {
    const { 
        isActionAnimating, 
        battleEntities, 
        turnOrder, 
        currentTurnIndex, 
        selectedTile, 
        selectedAction,
        hoveredEntity
    } = useGameStore();
    
    const { camera, controls } = useThree();
    const center = BATTLE_MAP_SIZE / 2;

    const currentFocus = useRef(new THREE.Vector3(center, 0, center));
    const [isIntro, setIsIntro] = useState(true);
    const introProgress = useRef(0);

    // Initial Setup
    useEffect(() => {
        setIsIntro(true);
        introProgress.current = 0;
        
        // Start camera at a dramatic angle
        if (camera instanceof THREE.OrthographicCamera) {
            camera.zoom = 20; // Start zoomed out
            camera.position.set(-20, 30, -20); // Dramatic corner
            camera.lookAt(center, 0, center);
            camera.updateProjectionMatrix();
        }
    }, []);

    useFrame((state, delta) => {
        if (!controls) return;
        const orbit = controls as any; 
        
        // --- INTRO ANIMATION ---
        if (isIntro) {
            introProgress.current += delta * 0.8; // Speed of intro
            if (introProgress.current >= 1) {
                setIsIntro(false);
                orbit.enabled = true;
            } else {
                orbit.enabled = false; // Lock controls during intro
                
                // Swoop Target: Center
                const targetPos = new THREE.Vector3(10, 10, 10); // Tactical view pos
                const startPos = new THREE.Vector3(-10, 20, -10); // Dramatic start
                
                const t = Math.min(1, introProgress.current);
                const smoothT = t * t * (3 - 2 * t); // Ease in-out

                // Interpolate Position
                camera.position.lerpVectors(startPos, targetPos, smoothT);
                
                // Interpolate Zoom
                if (camera instanceof THREE.OrthographicCamera) {
                    camera.zoom = THREE.MathUtils.lerp(20, 45, smoothT);
                    camera.updateProjectionMatrix();
                }
                
                orbit.target.set(center, 0, center);
                orbit.update();
                return;
            }
        }

        // --- NORMAL GAMEPLAY CAMERA ---
        
        // 1. IDENTIFY DESIRED TARGET
        const activeId = turnOrder[currentTurnIndex];
        const activeEntity = battleEntities.find(e => e.id === activeId) as any;
        
        const idealTarget = new THREE.Vector3();

        if (activeEntity) {
            // Base target is the active unit
            idealTarget.set(activeEntity.position.x, 0, activeEntity.position.y);

            if (isActionAnimating) {
                // Keep focus on actor
            } 
            else if (selectedTile && (selectedAction === BattleAction.ATTACK || selectedAction === BattleAction.MAGIC || selectedAction === BattleAction.SKILL)) {
                // Midpoint focusing
                const tx = selectedTile.x;
                const tz = selectedTile.z;
                idealTarget.x = (activeEntity.position.x + tx) / 2;
                idealTarget.z = (activeEntity.position.y + tz) / 2;
            }
            else if (hoveredEntity && hoveredEntity.id !== activeEntity.id) {
                // Bias towards hovered
                const he = hoveredEntity as any;
                if (he.position) {
                    idealTarget.lerp(new THREE.Vector3(he.position.x, 0, he.position.y), 0.3);
                }
            }
        } else {
            idealTarget.set(center, 0, center);
        }

        // 2. SMOOTHLY INTERPOLATE FOCUS POINT
        const trackingSpeed = isActionAnimating ? 4.0 : 2.5;
        currentFocus.current.lerp(idealTarget, delta * trackingSpeed);
        orbit.target.copy(currentFocus.current);

        // 3. CALCULATE IDEAL ZOOM (Orthographic)
        let targetZoom = 45; // Default "Tactical View"

        if (isActionAnimating) {
            targetZoom = 60; // Zoom in for hits
        } else if (selectedAction === BattleAction.ATTACK || selectedAction === BattleAction.MAGIC) {
            targetZoom = 50; // Slight zoom for aiming
        } else {
            targetZoom = 45; // Wide view
        }

        // Smoothly transition zoom
        if (camera instanceof THREE.OrthographicCamera) {
            camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetZoom, delta * 2.0);
            camera.updateProjectionMatrix();
        }

        // 5. UPDATE CONTROLS
        orbit.update();
    });

    return null;
};
