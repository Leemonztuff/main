
import React, { useRef, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import '../../types';

interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class TextureErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare props to satisfy strict TypeScript environments if inference fails
  readonly props: Readonly<ErrorBoundaryProps>;

  state: ErrorBoundaryState = { hasError: false };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any): ErrorBoundaryState {
    return { hasError: true };
  }
  
  componentDidCatch(error: any, errorInfo: any) {
    console.warn("Battle Scene Asset Error (Switching to Fallback Mode):", error);
  }

  render() { 
      if (this.state.hasError) {
          return this.props.fallback;
      }
      return this.props.children; 
  }
}

// --- FALLBACK COMPONENTS (Geometry based, no textures) ---

const _tempObj = new THREE.Object3D();
const _tempColor = new THREE.Color();

export const FallbackTerrainLayer = React.memo(({ mapData, onTileClick, onTileHover }: any) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const count = mapData ? mapData.length : 0;

    useLayoutEffect(() => {
        if (!meshRef.current || count === 0) return;
        
        mapData.forEach((block: any, i: number) => {
            const y = block.offsetY + block.height / 2;
            _tempObj.position.set(block.x, y, block.z);
            _tempObj.scale.set(1, block.height, 1);
            _tempObj.updateMatrix();
            meshRef.current!.setMatrixAt(i, _tempObj.matrix);
            
            // Use block color or fallback gray
            _tempColor.set(block.color || '#555');
            meshRef.current!.setColorAt(i, _tempColor);
        });
        
        meshRef.current.instanceMatrix.needsUpdate = true;
        if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    }, [mapData, count]);

    const handleClick = (e: any) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id !== undefined && mapData[id] && onTileClick) {
            onTileClick(mapData[id].x, mapData[id].z);
        }
    };

    const handlePointerMove = (e: any) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id !== undefined && mapData[id] && onTileHover) {
            onTileHover(mapData[id].x, mapData[id].z);
        }
    };

    return (
        <instancedMesh 
            ref={meshRef} 
            args={[undefined, undefined, count]} 
            onClick={handleClick}
            onPointerMove={handlePointerMove}
            receiveShadow
            castShadow
        >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial roughness={0.8} metalness={0.1} />
        </instancedMesh>
    );
});

export const FallbackUnit = React.memo(({ position, color, onClick, isCurrentTurn, hp, maxHp }: any) => {
    const groupRef = useRef<THREE.Group>(null);
    const hpPercent = Math.max(0, Math.min(1, hp / (maxHp || 1)));

    useLayoutEffect(() => {
        if (groupRef.current && position) {
            groupRef.current.position.set(position[0], position[1], position[2]);
        }
    }, [position]);

    const handleClick = (e: any) => {
        e.stopPropagation();
        if (onClick) onClick(position[0], position[2]);
    };

    return (
        <group ref={groupRef} onClick={handleClick}>
            {/* Selection Ring */}
            {isCurrentTurn && (
                <mesh position={[0, 0.1, 0]} rotation={[-Math.PI/2, 0, 0]}>
                    <ringGeometry args={[0.4, 0.5, 32]} />
                    <meshBasicMaterial color="yellow" />
                </mesh>
            )}

            {/* Body */}
            <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
                <capsuleGeometry args={[0.3, 0.8, 4, 8]} />
                <meshStandardMaterial color={color || 'white'} roughness={0.3} metalness={0.1} />
            </mesh>
            
            {/* Eyes / Face */}
            <mesh position={[0, 1.0, 0.25]}>
                <boxGeometry args={[0.25, 0.1, 0.1]} />
                <meshStandardMaterial color="white" emissive="white" emissiveIntensity={0.5} />
            </mesh>

            {/* HP Bar */}
            <group position={[0, 1.6, 0]}>
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.8, 0.1, 0.05]} />
                    <meshBasicMaterial color="#333" />
                </mesh>
                <mesh position={[(-0.8 + (0.8 * hpPercent)) / 2, 0, 0.01]}>
                    <boxGeometry args={[0.8 * hpPercent, 0.08, 0.05]} />
                    <meshBasicMaterial color={hpPercent > 0.5 ? '#22c55e' : '#ef4444'} />
                </mesh>
            </group>
        </group>
    );
});
