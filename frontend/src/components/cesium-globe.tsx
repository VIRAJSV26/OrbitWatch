"use client";

import React, { useEffect, useState, useRef } from "react";
import { Viewer, Entity } from "resium";
import * as Cesium from "cesium";

// Import Cesium widgets stylesheet
import "cesium/Source/Widgets/widgets.css";

// Configure Cesium Base URL
if (typeof window !== "undefined") {
  (window as any).CESIUM_BASE_URL = "/cesium/";
}

interface SpaceObject {
  object_id: number;
  norad_id: number;
  name: string;
  object_type: string;
  status: string;
  owner_name: string;
  shell_name: string;
  inclination?: number;
  eccentricity?: number;
  apogee_km?: number;
  perigee_km?: number;
  raan?: number;
}

interface CesiumGlobeProps {
  objects: SpaceObject[];
}

export default function CesiumGlobe({ objects }: CesiumGlobeProps) {
  const viewerRef = useRef<{ cesiumElement: Cesium.Viewer } | null>(null);
  const [timeAngle, setTimeAngle] = useState(0);
  const [hoveredObject, setHoveredObject] = useState<SpaceObject | null>(null);

  // Slow orbital motion update
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeAngle((prev) => (prev + 0.005) % (2 * Math.PI));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Configure viewer options on load
  useEffect(() => {
    if (viewerRef.current?.cesiumElement) {
      const viewer = viewerRef.current.cesiumElement;
      viewer.scene.globe.enableLighting = true;
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 2000000; // 2000km min zoom
      viewer.scene.screenSpaceCameraController.maximumZoomDistance = 150000000; // 150,000km max zoom
    }
  }, [viewerRef.current]);

  // Convert Keplerian elements to 3D Cartesian position
  const getPosition = (obj: SpaceObject) => {
    const Re = 6371.0; // Earth radius in km
    
    // Altitudes
    const apogee = obj.apogee_km ?? 800;
    const perigee = obj.perigee_km ?? 600;
    const alt = perigee + (apogee - perigee) * 0.5;
    
    const r = (Re + alt) * 1000.0; // Radius in meters
    
    const incl = ((obj.inclination ?? 51.6) * Math.PI) / 180.0;
    const raan = ((obj.raan ?? (obj.object_id * 17) % 360) * Math.PI) / 180.0;
    
    // Orbital period based on object_id to give varying speeds
    const speedMultiplier = 1.0 + (obj.object_id % 5) * 0.25;
    const theta = timeAngle * speedMultiplier + (obj.object_id * 2.3);

    // Coordinate transformations
    const x = r * (Math.cos(theta) * Math.cos(raan) - Math.sin(theta) * Math.sin(raan) * Math.cos(incl));
    const y = r * (Math.cos(theta) * Math.sin(raan) + Math.sin(theta) * Math.cos(raan) * Math.cos(incl));
    const z = r * (Math.sin(theta) * Math.sin(incl));

    return Cesium.Cartesian3.fromElements(x, y, z);
  };

  // Get color per object type
  const getPointColor = (type: string) => {
    if (type === "DEBRIS") return Cesium.Color.fromCssColorString("#f87171"); // red
    if (type === "SATELLITE") return Cesium.Color.fromCssColorString("#00d4ff"); // blue/cyan
    if (type === "ROCKET_BODY") return Cesium.Color.fromCssColorString("#64748b"); // gray
    return Cesium.Color.fromCssColorString("#fbbf24"); // yellow/unknown
  };

  return (
    <div className="relative w-full h-full glass-panel border border-cyan-500/20 bg-black overflow-hidden select-none">
      {/* HUD Observation Deck overlay header */}
      <div className="absolute top-4 left-4 z-10 font-telemetry text-[11px] font-bold tracking-widest text-cyan-400 bg-cyan-950/70 border border-cyan-500/30 px-3 py-1.5 backdrop-blur-md">
        HUD // 3D OBSERVATION DECK [ROTATING...]
      </div>

      {/* Target Lock Tooltip overlay */}
      {hoveredObject && (
        <div className="absolute bottom-4 left-4 z-10 glass-panel-heavy border-glow-primary border border-cyan-500/50 p-4 font-telemetry text-xs min-w-[280px] bg-black/80 shadow-[0_0_15px_rgba(0,212,255,0.2)]">
          <div className="absolute top-0 right-0 p-1 text-[9px] text-cyan-400 font-bold border-l border-b border-cyan-500/30 bg-cyan-950/35">
            LOCK_SYS
          </div>
          <div className="text-[10px] text-cyan-500 font-bold mb-2 uppercase tracking-widest">
            🎯 TARGET DATA SPEC
          </div>
          <div className="flex flex-col gap-1.5 text-slate-300">
            <div><span className="text-slate-500">NAME:</span> {hoveredObject.name}</div>
            <div><span className="text-slate-500">TYPE:</span> <span className="text-cyan-400">{hoveredObject.object_type}</span></div>
            <div><span className="text-slate-500">NORAD:</span> {hoveredObject.norad_id}</div>
            <div><span className="text-slate-500">OWNER:</span> {hoveredObject.owner_name}</div>
            <div><span className="text-slate-500">SHELL:</span> {hoveredObject.shell_name}</div>
            <div>
              <span className="text-slate-500">ALTITUDE:</span>{" "}
              {Math.round(hoveredObject.perigee_km ?? 0)}km - {Math.round(hoveredObject.apogee_km ?? 0)}km
            </div>
            <div><span className="text-slate-500">INCLINATION:</span> {hoveredObject.inclination ?? 0}°</div>
          </div>
        </div>
      )}

      {/* Cesium Viewer */}
      <Viewer
        ref={viewerRef}
        full
        timeline={false}
        animation={false}
        navigationHelpButton={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        baseLayerPicker={false}
        fullscreenButton={false}
        className="w-full h-full"
      >
        {objects.map((obj) => (
          <Entity
            key={obj.object_id}
            name={obj.name}
            position={getPosition(obj)}
            point={{
              pixelSize: obj.object_type === "DEBRIS" ? 5 : 7,
              color: getPointColor(obj.object_type),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1.5,
            }}
            description={`${obj.object_type} owned by ${obj.owner_name}`}
            // Trigger hover callback
            onClick={() => setHoveredObject(obj)}
          />
        ))}
      </Viewer>
    </div>
  );
}
