"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import dynamic from "next/dynamic";

const CascadeGlobe = dynamic(() => import("./CascadeGlobe"), { ssr: false });

interface SpaceObject {
  object_id: number;
  norad_id: number;
  name: string;
  object_type: string;
  owner_name: string;
  shell_name: string;
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

interface SimulationSummary {
  total_affected: number;
  total_frags: number;
}

interface SimulationResponse {
  sim_id: number;
  chain: CascadeNode[];
  summary: SimulationSummary;
}

// Custom Searchable Dropdown for Space Objects
function ObjectSearchSelect({
  label,
  onSelect,
  selectedObject,
  excludeId,
}: {
  label: string;
  onSelect: (obj: SpaceObject | null) => void;
  selectedObject: SpaceObject | null;
  excludeId?: number;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch objects based on search query
  const { data: results = [], isLoading } = useQuery<SpaceObject[]>({
    queryKey: ["search-objects", query],
    queryFn: async () => {
      if (query.trim().length < 2) return [];
      const res = await fetch(`http://localhost:8000/api/objects/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return data.filter((obj: SpaceObject) => obj.object_id !== excludeId);
    },
    enabled: query.trim().length >= 2,
  });

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="flex flex-col gap-1.5 relative w-full font-telemetry select-none">
      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
        {label}
      </label>
      
      {selectedObject ? (
        <div className="flex items-center justify-between border border-cyan-400/50 bg-cyan-950/10 px-3 py-2 text-xs">
          <div>
            <span className="text-cyan-400 font-bold">[{selectedObject.name}]</span>
            <span className="text-slate-500 ml-2">NORAD: {selectedObject.norad_id}</span>
            <span className="text-slate-500 ml-2">({selectedObject.object_type})</span>
          </div>
          <button
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
            className="text-red-400 hover:text-red-300 text-xs px-1 font-bold font-sans"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="TYPE OBJECT NAME OR NORAD ID..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="w-full bg-black/40 border border-cyan-500/20 text-cyan-400 text-xs px-3 py-2 outline-none focus:border-cyan-400 focus:box-shadow-[0_0_8px_rgba(0,212,255,0.2)]"
          />
          {isOpen && query.trim().length >= 2 && (
            <div className="absolute top-full left-0 w-full glass-panel-heavy border border-cyan-500/40 z-30 max-h-56 overflow-y-auto mt-1">
              {isLoading ? (
                <div className="px-3 py-2 text-slate-500 text-xs animate-pulse">
                  SEARCHING RADAR CHANNELS...
                </div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-slate-600 text-xs">
                  NO CORRELATIONS FOUND
                </div>
              ) : (
                results.map((obj) => (
                  <div
                    key={obj.object_id}
                    onClick={() => {
                      onSelect(obj);
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 hover:bg-cyan-950/40 border-b border-cyan-500/5 cursor-pointer text-xs flex justify-between items-center text-slate-300 hover:text-cyan-300"
                  >
                    <span>{obj.name}</span>
                    <span className="text-[10px] text-slate-500">
                      NORAD: {obj.norad_id} | {obj.object_type}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CascadePage() {
  const [obj1, setObj1] = useState<SpaceObject | null>(null);
  const [obj2, setObj2] = useState<SpaceObject | null>(null);
  
  const [simResults, setSimResults] = useState<SimulationResponse | null>(null);
  const [visibleCount, setVisibleCount] = useState(0);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // POST Request to trigger cascade simulation
  const mutation = useMutation<SimulationResponse, Error, { o1: number; o2: number }>({
    mutationFn: async ({ o1, o2 }) => {
      const res = await fetch(`http://localhost:8000/api/cascade/${o1}/${o2}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Cascade simulation failed");
      return res.json();
    },
    onSuccess: (data) => {
      setSimResults(data);
      setVisibleCount(0);
      setLogMessages([]);
    },
  });

  // Stagger nodes reveal one-by-one (300ms intervals)
  useEffect(() => {
    if (!simResults) return;
    if (visibleCount >= simResults.chain.length) return;

    const timer = setTimeout(() => {
      const nextCount = visibleCount + 1;
      setVisibleCount(nextCount);
      
      // Append real-time simulation logs
      const newNode = simResults.chain[visibleCount];
      const isRoot = newNode.parent_node_id === null;
      let msg = "";
      if (isRoot) {
        msg = `[EPOCH T+0.0s] IMPACT DETECTED: ${newNode.node_name} (NORAD: ${newNode.norad_id}) collided. Kinetic energy release generates ${newNode.fragments_generated} high-velocity debris fragments.`;
      } else {
        const timeOffset = newNode.depth_level === 1 ? "5.0m" : "15.0m";
        msg = `[EPOCH T+${timeOffset}] SECONDARY HIT: High-velocity fragment collides with ${newNode.node_name} (NORAD: ${newNode.norad_id}) in LEO orbit. Secondary collision generates ${newNode.fragments_generated} new trackable particles.`;
      }
      setLogMessages((prev) => [...prev, msg]);
    }, 300);

    return () => clearTimeout(timer);
  }, [simResults, visibleCount]);

  // Scroll simulation log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logMessages]);

  const handleSimulate = () => {
    if (!obj1 || !obj2) return;
    mutation.mutate({ o1: obj1.object_id, o2: obj2.object_id });
  };

  const isSimulating = mutation.isPending;

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-fade-in font-telemetry select-none">
      
      {/* Title Header */}
      <div className="glass-panel border border-cyan-500/20 p-5 flex items-center justify-between">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
        <div className="flex flex-col">
          <h2 className="text-md font-bold text-cyan-400 glow-text-primary tracking-wider uppercase">
            ⚡ KESSLER SYNDROME CASCADE SIMULATOR
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
            RECURSIVE COLLISION CHAIN ANALYSIS MODEL
          </p>
        </div>
        <div className="text-right border border-cyan-500/10 px-3 py-1.5 bg-cyan-950/5 text-xs text-cyan-500">
          STATUS: <span className="text-emerald-400 font-bold">READY_TO_SIM</span>
        </div>
      </div>

      {/* Grid: Search Inputs & Results */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Left Side Settings Form Panel */}
        <div className="glass-panel border border-cyan-500/20 p-5 flex flex-col gap-6">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/50" />
          
          <div className="border-b border-cyan-500/10 pb-3">
            <span className="text-xs font-bold text-cyan-400 tracking-wider">
              🛰️ CONFIG TARGETS
            </span>
          </div>

          <div className="flex flex-col gap-4">
            <ObjectSearchSelect
              label="PRIMARY COLLIDER (OBJ_A)"
              onSelect={setObj1}
              selectedObject={obj1}
            />
            <ObjectSearchSelect
              label="SECONDARY COLLIDER (OBJ_B)"
              onSelect={setObj2}
              selectedObject={obj2}
              excludeId={obj1?.object_id}
            />
          </div>

          <button
            disabled={!obj1 || !obj2 || isSimulating}
            onClick={handleSimulate}
            className={`w-full mt-2 font-telemetry border font-bold text-xs py-3.5 transition-all outline-none ${
              !obj1 || !obj2 || isSimulating
                ? "border-slate-500/20 text-slate-600 bg-slate-950/10 cursor-not-allowed"
                : "border-red-500 text-red-500 hover:bg-red-950/20 border-glow-danger shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
            }`}
          >
            {isSimulating ? "COMPUTING CASCADE..." : "▶ LAUNCH COLLISION CASCADE"}
          </button>

          {/* Simulation Summary Box */}
          {simResults && (
            <div className="border border-cyan-500/20 bg-cyan-950/5 p-4 flex flex-col gap-3 mt-4 text-xs">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest border-b border-cyan-500/10 pb-1.5 font-bold">
                📈 SIMULATION SUMMARY DATA
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>SIMULATION ID:</span>
                <span className="text-cyan-400 font-bold">#SIM-{simResults.sim_id}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>AFFECTED SATELLITES:</span>
                <span className="text-cyan-400 font-bold">{simResults.summary.total_affected}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>GENERATED DEBRIS FRAGS:</span>
                <span className="text-red-400 font-bold glow-text-danger font-bold">
                  {simResults.summary.total_frags.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>CASCADE DEPTH TIER:</span>
                <span className="text-orange-400 font-bold">LEVEL 2</span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side Node Canvas & Interactive Visualizer */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="glass-panel border border-cyan-500/20 p-6 min-h-[460px] relative flex flex-col">
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />
            
            <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 mb-6">
              <span className="text-xs font-bold text-cyan-400 tracking-wider">
                🌌 MULTI-DEPTH COLLISION CASCADE VISUALIZER
              </span>
              <span className="text-[9px] text-slate-500">
                CESIUM 3D GLOBE // TIER_LINK
              </span>
            </div>

            {/* Visualizer Canvas Area */}
            <div className="flex-1 min-h-[460px] relative w-full flex items-center justify-around z-10 overflow-hidden rounded">
              {!simResults && !isSimulating ? (
                <div className="flex flex-col items-center gap-3 text-slate-600 text-xs py-20 text-center">
                  <span>🛰️💥🪨</span>
                  <span>SELECT TARGETS AND TRIGGER COLLISION SIMULATION</span>
                  <span className="text-[9px] text-slate-700">3D GLOBE KESSLER CHAIN REACTION MAP WILL COMPUTE HERE</span>
                </div>
              ) : isSimulating ? (
                <div className="flex flex-col items-center gap-3 text-cyan-400 text-xs py-20 animate-pulse">
                  <span>🛰️</span>
                  <span>RUNNING RECURSIVE CTE MATRIX SIMULATION...</span>
                </div>
              ) : (
                simResults && <CascadeGlobe nodes={simResults.chain} obj1={obj1} obj2={obj2} />
              )}
            </div>
          </div>

          {/* Real-time terminal collision logs */}
          <div className="glass-panel border border-cyan-500/20 p-5 bg-black/80 font-telemetry text-xs min-h-[160px] flex flex-col">
            <div className="border-b border-cyan-500/10 pb-2 mb-3 text-[10px] font-bold text-cyan-400 flex items-center justify-between">
              <span>🖥️ CASCADE TELEMETRY TERMINAL OUTPUT</span>
              <span className="text-slate-500">SYS_STREAM // RUNNING</span>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[100px] flex flex-col gap-1 text-[10px] text-slate-400 pr-1">
              {logMessages.length === 0 ? (
                <div className="text-slate-600">TERMINAL IDLE. WAITING FOR COLLISION TELEMETRY DATA...</div>
              ) : (
                logMessages.map((msg, i) => (
                  <div key={i} className="leading-relaxed border-l-2 border-cyan-500/30 pl-2 animate-fade-in">
                    {msg}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
