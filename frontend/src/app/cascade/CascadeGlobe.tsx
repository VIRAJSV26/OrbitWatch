"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Viewer, Entity, PointGraphics, PolylineGraphics, EllipsoidGraphics, BoxGraphics, CylinderGraphics } from "resium";
import { Cartesian3, Color, PolylineGlowMaterialProperty, CallbackProperty, ColorMaterialProperty, Math as CesiumMath, Quaternion, HeadingPitchRoll } from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium";
}

interface CascadeNode {
  node_id: number;
  parent_node_id: number | null;
  node_name: string;
  norad_id: number;
  depth_level: number;
  collision_at: string;
  fragments_generated: number;
}

interface SpaceObject {
  object_id: number;
  norad_id: number;
  name: string;
  object_type: string;
}

interface CascadeGlobeProps {
  nodes: CascadeNode[];
  obj1: SpaceObject | null;
  obj2: SpaceObject | null;
}

const ANIMATION_CONSTANTS = {
  CONVERGE_DURATION: 1500, // ms
  EXPLOSION_DURATION: 800, // ms
  SHATTER_DURATION: 6000, // ms - increased to give them time to fall to Earth
};

// Generate a random tumbling rotation rate for an object
function getRandomTumbleRate() {
  return {
    h: (Math.random() - 0.5) * 5.0,
    p: (Math.random() - 0.5) * 5.0,
    r: (Math.random() - 0.5) * 5.0,
  };
}

export default function CascadeGlobe({ nodes, obj1, obj2 }: CascadeGlobeProps) {
  const [mounted, setMounted] = useState(false);
  
  const animationStartTimeRef = useRef<number>(Date.now());
  const [startKey, setStartKey] = useState(Date.now());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (nodes.length > 0) {
      animationStartTimeRef.current = Date.now();
      setStartKey(Date.now());
    }
  }, [nodes]);

  // Deterministic properties for nodes
  const nodeData = useMemo(() => {
    const posMap: Record<number, Cartesian3> = {};
    const tumbleMap: Record<number, { h: number; p: number; r: number }> = {};
    const sizeMap: Record<number, Cartesian3> = {};
    const typeMap: Record<number, "box" | "cylinder" | "debris"> = {};
    
    const baseLat = 35.0;
    const baseLon = -100.0;
    const baseAlt = 800000;

    nodes.forEach((n, i) => {
      // Assign random tumbling rates
      tumbleMap[n.node_id] = getRandomTumbleRate();
      
      // Assign physical shape
      if (n.depth_level === 0) {
        // Primary satellites
        typeMap[n.node_id] = i % 2 === 0 ? "box" : "cylinder";
        sizeMap[n.node_id] = new Cartesian3(20000, 40000, 10000); // Exaggerated size for visibility
        posMap[n.node_id] = Cartesian3.fromDegrees(baseLon + (i * 5), baseLat + (i * 2), baseAlt);
      } else {
        // Debris / Fragments
        typeMap[n.node_id] = "debris";
        const dSize = Math.random() * 15000 + 5000; // Random jagged sizes
        sizeMap[n.node_id] = new Cartesian3(dSize, dSize * Math.random(), dSize * Math.random());
        
        const parentPos = posMap[n.parent_node_id || 0];
        if (parentPos) {
          // Spread out, but FALL towards Earth (Altitude drops to 0 or negative)
          const latJitter = (Math.random() - 0.5) * 60;
          const lonJitter = (Math.random() - 0.5) * 60;
          const finalAlt = Math.random() * 50000; // Plunge into the atmosphere
          
          posMap[n.node_id] = Cartesian3.fromDegrees(
            baseLon + lonJitter, 
            baseLat + latJitter, 
            finalAlt
          );
        } else {
          posMap[n.node_id] = Cartesian3.fromDegrees(baseLon, baseLat, 0);
        }
      }
    });
    return { posMap, tumbleMap, sizeMap, typeMap };
  }, [nodes]);

  if (!mounted) return <div className="text-cyan-500 animate-pulse">Initializing 3D Space...</div>;

  const epicenters = nodes.filter(n => n.depth_level === 0);
  const fragments = nodes.filter(n => n.depth_level > 0);
  
  const mainEpicenterNode = epicenters[0];
  const mainEpicenterPos = mainEpicenterNode ? nodeData.posMap[mainEpicenterNode.node_id] : Cartesian3.fromDegrees(0,0,0);

  const incomingAStart = mainEpicenterNode ? Cartesian3.fromDegrees(-110.0, 40.0, 1000000) : Cartesian3.fromDegrees(0,0,0);
  const incomingBStart = mainEpicenterNode ? Cartesian3.fromDegrees(-90.0, 30.0, 600000) : Cartesian3.fromDegrees(0,0,0);

  // --- ANIMATION CALLBACK PROPERTIES ---
  
  const posAProp = new CallbackProperty((time, result) => {
    const elapsed = Date.now() - animationStartTimeRef.current;
    if (elapsed > ANIMATION_CONSTANTS.CONVERGE_DURATION) return mainEpicenterPos;
    const t = elapsed / ANIMATION_CONSTANTS.CONVERGE_DURATION;
    return Cartesian3.lerp(incomingAStart, mainEpicenterPos, t, result as Cartesian3 || new Cartesian3());
  }, false);

  const posBProp = new CallbackProperty((time, result) => {
    const elapsed = Date.now() - animationStartTimeRef.current;
    if (elapsed > ANIMATION_CONSTANTS.CONVERGE_DURATION) return mainEpicenterPos;
    const t = elapsed / ANIMATION_CONSTANTS.CONVERGE_DURATION;
    return Cartesian3.lerp(incomingBStart, mainEpicenterPos, t, result as Cartesian3 || new Cartesian3());
  }, false);

  // Tumbling Orientations for Primary Satellites
  const orientAProp = new CallbackProperty((time, result) => {
    const elapsed = (Date.now() - animationStartTimeRef.current) / 1000; // in seconds
    const rate = nodeData.tumbleMap[epicenters[0]?.node_id || 0] || {h:1, p:1, r:1};
    return Quaternion.fromHeadingPitchRoll(new HeadingPitchRoll(elapsed * rate.h, elapsed * rate.p, elapsed * rate.r), result as Quaternion);
  }, false);
  
  const orientBProp = new CallbackProperty((time, result) => {
    const elapsed = (Date.now() - animationStartTimeRef.current) / 1000;
    const rate = nodeData.tumbleMap[epicenters[1]?.node_id || 0] || {h:1, p:1, r:1};
    return Quaternion.fromHeadingPitchRoll(new HeadingPitchRoll(elapsed * rate.h, elapsed * rate.p, elapsed * rate.r), result as Quaternion);
  }, false);

  const explosionRadiiProp = new CallbackProperty((time, result) => {
    const elapsed = Date.now() - animationStartTimeRef.current;
    if (elapsed < ANIMATION_CONSTANTS.CONVERGE_DURATION) return new Cartesian3(0.1, 0.1, 0.1);
    const explosionTime = elapsed - ANIMATION_CONSTANTS.CONVERGE_DURATION;
    if (explosionTime > ANIMATION_CONSTANTS.EXPLOSION_DURATION) return new Cartesian3(0.1, 0.1, 0.1);
    
    const r = 50000 + (explosionTime / ANIMATION_CONSTANTS.EXPLOSION_DURATION) * 400000;
    return new Cartesian3(r, r, r);
  }, false);

  const explosionColorMaterial = new ColorMaterialProperty(
    new CallbackProperty((time, result) => {
      const elapsed = Date.now() - animationStartTimeRef.current;
      if (elapsed < ANIMATION_CONSTANTS.CONVERGE_DURATION) return Color.TRANSPARENT;
      const explosionTime = elapsed - ANIMATION_CONSTANTS.CONVERGE_DURATION;
      if (explosionTime > ANIMATION_CONSTANTS.EXPLOSION_DURATION) return Color.TRANSPARENT;
      
      const alpha = 1.0 - (explosionTime / ANIMATION_CONSTANTS.EXPLOSION_DURATION);
      return Color.fromCssColorString(`rgba(255, 100, 20, ${Math.max(0, alpha)})`);
    }, false)
  );

  return (
    <div key={startKey} className="w-full h-full relative border border-cyan-500/20 shadow-[0_0_15px_rgba(0,212,255,0.1)] bg-black">
      <Viewer
        full
        timeline={false}
        animation={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        navigationHelpButton={false}
        navigationInstructionsInitiallyVisible={false}
        scene3DOnly={true}
        className="w-full h-full"
      >
        {mainEpicenterNode && (
          <>
            {/* Primary Satellite A */}
            <Entity position={posAProp as any} orientation={orientAProp as any}>
              {obj1?.object_type === 'ROCKET_BODY' ? (
                <CylinderGraphics length={40000} topRadius={10000} bottomRadius={10000} material={Color.CYAN} />
              ) : (
                <BoxGraphics dimensions={nodeData.sizeMap[epicenters[0]?.node_id || 0] || new Cartesian3(20000,20000,20000)} material={Color.CYAN} />
              )}
            </Entity>
            
            {/* Primary Satellite B */}
            <Entity position={posBProp as any} orientation={orientBProp as any}>
              {obj2?.object_type === 'ROCKET_BODY' ? (
                <CylinderGraphics length={40000} topRadius={10000} bottomRadius={10000} material={Color.ORANGE} />
              ) : (
                <BoxGraphics dimensions={nodeData.sizeMap[epicenters[1]?.node_id || 0] || new Cartesian3(20000,20000,20000)} material={Color.ORANGE} />
              )}
            </Entity>
            
            {/* The Explosion Flash */}
            <Entity position={mainEpicenterPos}>
              <EllipsoidGraphics radii={explosionRadiiProp as any} material={explosionColorMaterial} outline={false} />
            </Entity>
          </>
        )}

        {/* The Tumbling Debris Fragments Raining Down */}
        {fragments.map((n) => {
          const finalPos = nodeData.posMap[n.node_id];
          const size = nodeData.sizeMap[n.node_id];
          const isCritical = n.depth_level >= 2;
          const color = isCritical ? Color.ORANGE : Color.fromCssColorString('#a8a8a8');

          const particlePosProp = new CallbackProperty((time, result) => {
            const elapsed = Date.now() - animationStartTimeRef.current;
            if (elapsed < ANIMATION_CONSTANTS.CONVERGE_DURATION) return mainEpicenterPos;
            
            const shatterTime = elapsed - ANIMATION_CONSTANTS.CONVERGE_DURATION;
            if (shatterTime > ANIMATION_CONSTANTS.SHATTER_DURATION) return finalPos;
            
            const t = shatterTime / ANIMATION_CONSTANTS.SHATTER_DURATION;
            const easeOutQuart = 1 - Math.pow(1 - t, 4);
            return Cartesian3.lerp(mainEpicenterPos, finalPos, easeOutQuart, result as Cartesian3 || new Cartesian3());
          }, false);
          
          const particleOrientProp = new CallbackProperty((time, result) => {
            const elapsed = (Date.now() - animationStartTimeRef.current) / 1000;
            const rate = nodeData.tumbleMap[n.node_id];
            return Quaternion.fromHeadingPitchRoll(new HeadingPitchRoll(elapsed * rate.h, elapsed * rate.p, elapsed * rate.r), result as Quaternion);
          }, false);

          const lineProp = new CallbackProperty((time, result) => {
            const elapsed = Date.now() - animationStartTimeRef.current;
            if (elapsed < ANIMATION_CONSTANTS.CONVERGE_DURATION) return [];
            const currentPos = particlePosProp.getValue(time, new Cartesian3());
            return [mainEpicenterPos, currentPos];
          }, false);

          return (
            <React.Fragment key={n.node_id}>
              {/* Tumbling Wreckage */}
              <Entity position={particlePosProp as any} orientation={particleOrientProp as any}>
                <BoxGraphics
                  dimensions={size}
                  material={color}
                  outline={true}
                  outlineColor={isCritical ? Color.RED : Color.DARKGRAY}
                />
              </Entity>

              {/* Glowing Decay Trail */}
              <Entity>
                <PolylineGraphics
                  positions={lineProp as any}
                  width={isCritical ? 3 : 1}
                  material={new PolylineGlowMaterialProperty({
                    glowPower: 0.3,
                    taperPower: 1,
                    color: isCritical ? Color.RED : Color.YELLOW,
                  })}
                />
              </Entity>
            </React.Fragment>
          );
        })}
      </Viewer>
    </div>
  );
}
