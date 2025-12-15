
import React, { useRef, useMemo } from 'react';
import { useFrame, ThreeElements } from '@react-three/fiber';
import * as THREE from 'three';
import '../../types';

export const VoidParticles = React.memo(({ color = '#a855f7', floatUp = false }: { color?: string, floatUp?: boolean }) => {
  const isMobile = window.innerWidth < 768;
  const count = isMobile ? 50 : 150; 
  const mesh = useRef<THREE.Points>(null);
  const particles = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = Math.random() * 10;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;
      speeds[i] = Math.random() * 0.02 + 0.005;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { pos, speeds, phases };
  }, []);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const yIdx = i * 3 + 1;
      if (floatUp) {
          pos[yIdx] += particles.speeds[i];
          if (pos[yIdx] > 10) pos[yIdx] = 0;
      } else {
          pos[yIdx] -= particles.speeds[i];
          if (pos[yIdx] < 0) pos[yIdx] = 10;
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={particles.pos} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.2} color={color} transparent opacity={0.6} sizeAttenuation depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
});
