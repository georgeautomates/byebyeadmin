'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Suspense, useRef, useMemo } from 'react';
import * as THREE from 'three';

// ── Truck model — scroll-driven straight path ─────────────────────────────────
function TruckModel() {
  const { scene } = useGLTF('/models/lorry.glb');
  const ref = useRef<THREE.Group>(null);

  // Normalise scale and position once — scale to 10m longest dimension
  const offset = useMemo<THREE.Vector3>(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = bbox.getSize(new THREE.Vector3());
    scene.scale.setScalar(10 / Math.max(size.x, size.y, size.z));
    scene.updateMatrixWorld(true);
    const nb = new THREE.Box3().setFromObject(scene);
    const nc = nb.getCenter(new THREE.Vector3());
    return new THREE.Vector3(-nc.x, -nb.min.y, -nc.z);
  }, [scene]);

  // Apply offset and orientation — front faces camera
  scene.position.copy(offset);
  scene.rotation.y = Math.PI;

  useFrame(() => {
    if (!ref.current) return;
    // Hero section is 500vh; map scrollY linearly to x position
    const heroHeight = window.innerHeight * 5;
    const progress = Math.min(1, Math.max(0, window.scrollY / heroHeight));
    ref.current.position.x = 25 - progress * 50;
    ref.current.position.y = 0;
    ref.current.position.z = 0;
  });

  return <primitive ref={ref} object={scene} />;
}

useGLTF.preload('/models/lorry.glb');

// ── Canvas component — transparent, overlays the hero section ────────────────
export function TruckCanvas() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <Canvas
        gl={{ alpha: true }}
        camera={{
          position: [0, 5, 20] as [number, number, number],
          fov: 40,
          near: 0.1,
          far: 200,
        }}
        dpr={[1, 1.5]}
        frameloop="always"
      >
        {/* Lighting: ambient fill + directional sun + hemisphere sky/ground */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 15, 10]} intensity={1.2} />
        <hemisphereLight args={['#F5F2EF', '#1F2937', 0.4]} />

        <Suspense fallback={null}>
          <TruckModel />
        </Suspense>
      </Canvas>
    </div>
  );
}
