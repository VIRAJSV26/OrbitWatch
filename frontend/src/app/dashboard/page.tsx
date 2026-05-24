"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import StatsBar from "../../components/stats-bar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";

// Load CesiumGlobe dynamically on client-side to prevent SSR issues
const CesiumGlobe = dynamic(() => import("../../components/cesium-globe"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-black/40 border border-cyan-500/20 text-cyan-400 font-telemetry animate-pulse">
      INITIALIZING HUD 3D DECK...
    </div>
  ),
});

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

interface Alert {
  alert_id: number;
  event_id: number;
  triggered_at: string;
  alert_type: string;
  message: string;
  acknowledged: boolean;
}

interface ShellReport {
  shell_id: string;
  shell_name: string;
  min_altitude_km: number;
  max_altitude_km: number;
  risk_level: string;
  total_objects: number;
  debris_count: number;
  active_satellites: number;
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Query space objects for 3D globe plotting
  const { data: objects = [], isLoading: isLoadingObjects } = useQuery<SpaceObject[]>({
    queryKey: ["space-objects"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/objects");
      if (!res.ok) throw new Error("Failed to fetch space objects");
      return res.json();
    },
    refetchInterval: 30000, // refresh every 30 seconds
  });

  // Query critical alerts for side panel
  const { data: alerts = [], isLoading: isLoadingAlerts } = useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/alerts");
      if (!res.ok) throw new Error("Failed to fetch alerts");
      return res.json();
    },
    refetchInterval: 10000, // refresh every 10 seconds
  });

  // Query shell reports for histogram
  const { data: shells = [], isLoading: isLoadingShells } = useQuery<ShellReport[]>({
    queryKey: ["shells"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/shells");
      if (!res.ok) throw new Error("Failed to fetch shell reports");
      return res.json();
    },
    refetchInterval: 15000,
  });

  // Helper to format dynamic alert age
  const getAlertAge = (triggeredAt: string) => {
    const elapsedMs = now.getTime() - new Date(triggeredAt).getTime();
    const sec = Math.max(0, Math.floor(elapsedMs / 1000));
    if (sec < 60) return `${sec}s AGO`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m AGO`;
    const hr = Math.floor(min / 60);
    return `${hr}h AGO`;
  };

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center text-cyan-400 font-telemetry">
        CONNECTING TO ORBITWATCH CORE...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-fade-in">
      {/* Top Banner stats bar */}
      <StatsBar />

      {/* Main Grid: Left/Center 3D Observer, Right Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Globe Observation Desk (3/4 width on desktop) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <div className="h-[520px] relative glass-panel border border-cyan-500/20">
            {/* HUD Corner Accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400" />
            
            {isLoadingObjects ? (
              <div className="w-full h-full flex items-center justify-center bg-black/40 text-cyan-400 font-telemetry animate-pulse">
                DOWNLOADING ORBITAL TELEMETRY...
              </div>
            ) : (
              <CesiumGlobe objects={objects} />
            )}
          </div>

          {/* Bottom Panel: Altitude Density Histogram */}
          <div className="glass-panel border border-cyan-500/20 p-5 min-h-[300px]">
            {/* HUD Corner Accents */}
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/50" />
            <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400/50" />
            
            <div className="flex items-center justify-between mb-4 border-b border-cyan-500/10 pb-2">
              <span className="font-telemetry text-xs font-bold text-cyan-400 tracking-wider">
                📊 ORBITAL SHELL DENSITY DISTRIBUTION
              </span>
              <span className="text-[10px] font-telemetry text-slate-500">
                REFRESH_RATE: 15S // AUTO_DENSE
              </span>
            </div>

            {isLoadingShells ? (
              <div className="h-[200px] flex items-center justify-center text-slate-500 font-telemetry animate-pulse">
                FETCHING DENSITY TELEMETRY...
              </div>
            ) : (
              <div className="h-[200px] w-full font-telemetry text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={shells}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.05)" />
                    <XAxis
                      dataKey="shell_id"
                      stroke="#859398"
                      tick={{ fill: "#859398", fontSize: 10 }}
                      tickLine={{ stroke: "rgba(0,212,255,0.2)" }}
                    />
                    <YAxis
                      stroke="#859398"
                      tick={{ fill: "#859398", fontSize: 10 }}
                      tickLine={{ stroke: "rgba(0,212,255,0.2)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(6, 13, 26, 0.95)",
                        borderColor: "rgba(0, 212, 255, 0.3)",
                        color: "#d4e4fa",
                        borderRadius: "0px",
                        fontSize: "11px",
                      }}
                      itemStyle={{ color: "#00d4ff" }}
                    />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      iconType="rect"
                      wrapperStyle={{ fontSize: "10px", fill: "#d4e4fa" }}
                    />
                    <Bar
                      dataKey="active_satellites"
                      name="Active Satellites"
                      stackId="a"
                      fill="#00d4ff"
                    />
                    <Bar
                      dataKey="debris_count"
                      name="Tracked Debris"
                      stackId="a"
                      fill="#ff4b2b"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar Panel: Live Warning Feed (1/4 width on desktop) */}
        <div className="glass-panel border border-cyan-500/20 p-5 flex flex-col min-h-[500px] lg:h-[844px]">
          {/* HUD Corner Accents */}
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400/50" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400/50" />

          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 mb-4">
            <div className="flex flex-col">
              <span className="font-telemetry text-xs font-bold text-red-500 glow-text-danger tracking-wider">
                🚨 LIVE COLLISION WARNINGS
              </span>
              <span className="text-[9px] font-telemetry text-slate-500 uppercase mt-0.5">
                REAL-TIME ALERTS INGESTION FEED
              </span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ff4b2b] animate-ping" />
          </div>

          {/* Feed Content */}
          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
            {isLoadingAlerts ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 font-telemetry animate-pulse text-xs">
                LISTENING ON COLLISION FREQUENCY...
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-600 font-telemetry text-center py-10 gap-2">
                <span>🛰️</span>
                <span className="text-xs">NO ACTIVE CONJUNCTIONS</span>
                <span className="text-[9px] text-slate-700">SHELLS SAFE AT PRESENT EPOCH</span>
              </div>
            ) : (
              alerts.map((alert) => {
                const isCritical = alert.alert_type === "CRITICAL";
                const isHigh = alert.alert_type === "HIGH";

                let cardBorderClass = "border-slate-500/20 bg-slate-950/20";
                let badgeClass = "text-slate-400 border-slate-500/20 bg-slate-900/30";
                
                if (isCritical) {
                  cardBorderClass = "border-glow-danger animate-blink-critical";
                  badgeClass = "text-red-400 border-red-500/30 bg-red-950/20";
                } else if (isHigh) {
                  cardBorderClass = "border-glow-warning bg-orange-950/5";
                  badgeClass = "text-orange-400 border-orange-500/30 bg-orange-950/20";
                }

                return (
                  <div
                    key={alert.alert_id}
                    className={`border p-3 transition-all relative flex flex-col gap-2 ${cardBorderClass}`}
                  >
                    {/* Dog-ear border details */}
                    <div className="absolute top-0 right-0 p-1 text-[8px] font-telemetry text-slate-500 font-bold border-l border-b border-cyan-500/10">
                      {getAlertAge(alert.triggered_at)}
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[9px] font-bold font-telemetry px-1.5 py-0.5 border ${badgeClass}`}>
                        {alert.alert_type}
                      </span>
                      <span className="text-[9px] font-telemetry text-slate-500">
                        EID: #{alert.event_id}
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-300 font-sans">
                      {alert.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
