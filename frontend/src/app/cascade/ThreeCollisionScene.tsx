"use client";

import React, { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars, Sphere, Box, Cylinder, Tetrahedron, useTexture } from "@react-three/drei";
import * as THREE from "three";

interface SpaceObject {
  object_id: number;
  norad_id: number;
  name: string;
  object_type: string;
}

interface CascadeNode {
  node_id: number;
  parent_node_id: number | null;
  node_name: string;
  depth_level: number;
}

interface ThreeCollisionSceneProps {
  nodes: CascadeNode[];
  obj1: SpaceObject | null;
  obj2: SpaceObject | null;
}

const ANIMATION = {
  APPROACH_DURATION: 1.5, // seconds
  EXPLOSION_DURATION: 0.8, // seconds
  FALL_DURATION: 4.0, // seconds
  EARTH_RADIUS: 5,
  ORBIT_RADIUS: 8,
};

// --- PRIMARY COLLIDER SHAPE ---
function ColliderShape({ 
  type, 
  startPos, 
  targetPos, 
  startTime, 
  color 
}: { 
  type: string, 
  startPos: THREE.Vector3, 
  targetPos: THREE.Vector3, 
  startTime: number, 
  color: string 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const tempPos = useMemo(() => new THREE.Vector3(), []);
  
  useFrame(() => {
    if (!meshRef.current || startTime === 0) return;
    const currentClock = performance.now() / 1000;
    const elapsed = currentClock - startTime;

    // Rotation
    meshRef.current.rotation.x += 0.02;
    meshRef.current.rotation.y += 0.015;

    // Approach Phase
    if (elapsed < ANIMATION.APPROACH_DURATION) {
      meshRef.current.visible = true;
      const t = elapsed / ANIMATION.APPROACH_DURATION;
      
      // Arc logic using slerp approximation (lerp + normalize)
      tempPos.copy(startPos).lerp(targetPos, t).normalize().multiplyScalar(ANIMATION.ORBIT_RADIUS);
      meshRef.current.position.copy(tempPos);
    } else {
      // Hide after impact
      meshRef.current.visible = false;
    }
  });

  const material = <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />;

  if (type === "ROCKET_BODY") {
    return (
      <Cylinder ref={meshRef as any} args={[0.3, 0.3, 1.5, 16]} position={startPos}>
        {material}
      </Cylinder>
    );
  }
  return (
    <Box ref={meshRef as any} args={[0.8, 0.8, 0.8]} position={startPos}>
      {material}
    </Box>
  );
}

// --- DEBRIS FRAGMENT ---
function DebrisFragment({ 
  startPos, 
  targetPos, 
  startTime, 
  isCritical 
}: { 
  startPos: THREE.Vector3, 
  targetPos: THREE.Vector3, 
  startTime: number, 
  isCritical: boolean 
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [randomRot] = useState(() => new THREE.Vector3((Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10));
  const [scale] = useState(() => Math.random() * 0.2 + 0.05);

  useFrame(() => {
    if (!meshRef.current || startTime === 0) return;
    
    // Use performance.now() to sync exactly with ColliderShape and Explosion
    const currentClock = performance.now() / 1000;
    const elapsed = currentClock - startTime;
    
    // Hide before collision
    if (elapsed < ANIMATION.APPROACH_DURATION) {
      meshRef.current.visible = false;
      return;
    }
    
    const fallTime = elapsed - ANIMATION.APPROACH_DURATION;
    if (fallTime > ANIMATION.FALL_DURATION) {
      // Arrived at Earth
      meshRef.current.position.copy(targetPos);
      meshRef.current.visible = true;
      return;
    }

    meshRef.current.visible = true;
    const t = fallTime / ANIMATION.FALL_DURATION;
    const easeT = 1 - Math.pow(1 - t, 4);

    meshRef.current.position.lerpVectors(startPos, targetPos, easeT);
    
    // Tumble
    meshRef.current.rotation.x += randomRot.x * 0.01;
    meshRef.current.rotation.y += randomRot.y * 0.01;
    meshRef.current.rotation.z += randomRot.z * 0.01;
  });

  return (
    <Tetrahedron ref={meshRef as any} args={[scale]} position={startPos}>
      <meshStandardMaterial 
        color={isCritical ? "#ff4b2b" : "#859398"} 
        metalness={0.9} 
        roughness={0.2}
      />
    </Tetrahedron>
  );
}

// --- SCENE LOGIC ---
function SceneLogic({ nodes, obj1, obj2 }: ThreeCollisionSceneProps) {
  const [startTime, setStartTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const explosionRef = useRef<THREE.Mesh>(null);
  const explosionMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Use the generated earth texture
  const earthTexture = useLoader(THREE.TextureLoader, '/earth.png');

  // Randomize epicenter based on the simulation run
  const epicenter = useMemo(() => {
    // Pick a random point on the sphere for the collision
    const phi = Math.acos(-1 + (2 * Math.random()));
    const theta = Math.PI * 2 * Math.random();
    const r = ANIMATION.ORBIT_RADIUS;
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }, [nodes]);

  // Calculate start positions for the two colliders to approach the epicenter
  const { startA, startB } = useMemo(() => {
    // Find an arbitrary perpendicular axis
    const axis = new THREE.Vector3().crossVectors(epicenter, new THREE.Vector3(0,1,0)).normalize();
    if (axis.lengthSq() < 0.1) axis.set(1, 0, 0); // fallback if epicenter is at poles
    
    // Start them 60 degrees apart from the epicenter
    const sA = epicenter.clone().applyAxisAngle(axis, Math.PI / 3);
    const sB = epicenter.clone().applyAxisAngle(axis, -Math.PI / 3);
    return { startA: sA, startB: sB };
  }, [epicenter]);
  
  // Update animation trigger
  useEffect(() => {
    if (nodes.length > 0) {
      setStartTime(performance.now() / 1000);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
    }
  }, [nodes]);

  useFrame(() => {
    if (!isAnimating || startTime === 0) return;
    
    const currentClock = performance.now() / 1000;
    const elapsed = currentClock - startTime;

    // Explosion Flash
    if (explosionRef.current && explosionMatRef.current) {
      if (elapsed >= ANIMATION.APPROACH_DURATION && elapsed < (ANIMATION.APPROACH_DURATION + ANIMATION.EXPLOSION_DURATION)) {
        explosionRef.current.visible = true;
        const flashTime = elapsed - ANIMATION.APPROACH_DURATION;
        const flashProgress = flashTime / ANIMATION.EXPLOSION_DURATION;
        
        const scale = 1 + flashProgress * 6;
        explosionRef.current.scale.set(scale, scale, scale);
        
        explosionMatRef.current.opacity = 1.0 - flashProgress;
      } else {
        explosionRef.current.visible = false;
      }
    }
  });

  // Calculate fall destinations for fragments
  const fragments = useMemo(() => {
    return nodes.filter(n => n.depth_level > 0).map(n => {
      const phi = Math.acos(-1 + (2 * Math.random()));
      const theta = Math.sqrt(Math.PI * 100) * phi;
      
      const r = ANIMATION.EARTH_RADIUS + 0.1;
      const dest = new THREE.Vector3(
        r * Math.cos(theta) * Math.sin(phi),
        r * Math.sin(theta) * Math.sin(phi),
        r * Math.cos(phi)
      );
      
      return { ...n, targetPos: dest };
    });
  }, [nodes]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={2} color="#ffffff" />
      <pointLight position={[0, ANIMATION.ORBIT_RADIUS, 0]} intensity={isAnimating ? 5 : 0} color="#ff4b2b" distance={20} />

      <Stars radius={100} depth={50} count={2000} factor={4} saturation={0} fade speed={1} />
      
      {/* Real Earth Texture */}
      <Sphere args={[ANIMATION.EARTH_RADIUS, 64, 64]}>
        <meshStandardMaterial map={earthTexture} roughness={0.6} metalness={0.1} />
      </Sphere>

      {/* Subtle blue atmosphere glow layer */}
      <Sphere args={[ANIMATION.EARTH_RADIUS + 0.15, 32, 32]}>
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
      </Sphere>

      <Sphere ref={explosionRef as any} args={[0.5, 32, 32]} position={epicenter} visible={false}>
        <meshBasicMaterial ref={explosionMatRef as any} color="#ff4b2b" transparent opacity={1} />
      </Sphere>

      {isAnimating && (
        <>
          {obj1 && <ColliderShape type={obj1.object_type} startPos={startA} targetPos={epicenter} startTime={startTime} color="#00d4ff" />}
          {obj2 && <ColliderShape type={obj2.object_type} startPos={startB} targetPos={epicenter} startTime={startTime} color="#ff4b2b" />}

          {fragments.map(f => (
            <DebrisFragment 
              key={f.node_id}
              startPos={epicenter}
              targetPos={f.targetPos}
              startTime={startTime}
              isCritical={f.depth_level >= 2}
            />
          ))}
        </>
      )}
    </>
  );
}

export default function ThreeCollisionScene({ nodes, obj1, obj2 }: ThreeCollisionSceneProps) {
  return (
    <div className="w-full h-full relative border border-cyan-500/20 shadow-[0_0_15px_rgba(0,212,255,0.1)] bg-[#060d1a]">
      <Canvas camera={{ position: [0, 5, 20], fov: 50 }}>
        <OrbitControls enablePan={false} maxDistance={40} minDistance={10} autoRotate={!nodes.length} autoRotateSpeed={0.5} />
        <SceneLogic nodes={nodes} obj1={obj1} obj2={obj2} />
      </Canvas>
    </div>
  );
}
