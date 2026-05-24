"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface Conjunction {
  event_id: number;
  object1_id: number;
  object2_id: number;
  tca: string;
  miss_distance_km: number;
  collision_probability: number;
  relative_velocity_kms: number;
  detected_at: string;
  risk_level: string;
  status: string;
  object1_name: string;
  object1_norad: number;
  object2_name: string;
  object2_norad: number;
}

export default function ConjunctionsPage() {
  const [filter, setFilter] = useState<string>("ALL");

  // Query conjunction events with auto-refresh every 30s
  const { data: events = [], isLoading, error } = useQuery<Conjunction[]>({
    queryKey: ["conjunctions"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/conjunctions");
      if (!res.ok) throw new Error("Failed to fetch conjunctions data");
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Filter events based on active risk level tab
  const filteredEvents = events.filter((e) => {
    if (filter === "ALL") return true;
    return e.risk_level === filter;
  });

  // Get color per risk level
  const getRiskBadgeStyles = (level: string) => {
    switch (level) {
      case "CRITICAL":
        return "border-red-500 text-red-500 bg-red-950/20 glow-text-danger animate-pulse-cyan";
      case "HIGH":
        return "border-orange-500 text-orange-400 bg-orange-950/15";
      case "MEDIUM":
        return "border-yellow-600 text-yellow-400 bg-yellow-950/10";
      case "LOW":
        return "border-emerald-500 text-emerald-400 bg-emerald-950/10";
      default:
        return "border-slate-500 text-slate-400 bg-slate-950/10";
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "text-red-400 border-red-500/30 bg-red-950/10 animate-pulse";
      case "RESOLVED":
        return "text-emerald-400 border-emerald-500/30 bg-emerald-950/10";
      case "PASSED":
        return "text-slate-400 border-slate-500/30 bg-slate-900/10";
      default:
        return "text-slate-500 border-slate-500/20";
    }
  };

  // Helper to format timestamps
  const formatTca = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toISOString().replace("T", " ").substring(0, 19);
    } catch {
      return isoString;
    }
  };

  const riskFilters = ["ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-fade-in font-telemetry select-none">
      
      {/* Title Banner */}
      <div className="glass-panel border border-cyan-500/20 p-5 flex items-center justify-between">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
        <div className="flex flex-col">
          <h2 className="text-md font-bold text-cyan-400 glow-text-primary tracking-wider uppercase">
            ⚡ CLOSE ENCOUNTER & CONJUNCTION TELEMETRY LOGGER
          </h2>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
            HIGH-DENSITY SPACE DEBRIS PROXIMITY DATABASE // LIVE_FEED
          </p>
        </div>
        <div className="text-right border border-cyan-500/10 px-3 py-1.5 bg-cyan-950/5 text-xs text-cyan-500">
          LOGS_COUNT: <span className="text-cyan-400 font-bold">{filteredEvents.length}</span>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between border-b border-cyan-500/10 pb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mr-2">
            FILTER RISK LEVELS:
          </span>
          {riskFilters.map((tab) => {
            const isActive = filter === tab;
            let activeColor = "border-cyan-400 text-cyan-400 bg-cyan-950/20";
            if (isActive) {
              if (tab === "CRITICAL") activeColor = "border-red-500 text-red-500 bg-red-950/30 border-glow-danger";
              if (tab === "HIGH") activeColor = "border-orange-500 text-orange-400 bg-orange-950/30 border-glow-warning";
              if (tab === "MEDIUM") activeColor = "border-yellow-500 text-yellow-400 bg-yellow-950/20";
              if (tab === "LOW") activeColor = "border-emerald-500 text-emerald-400 bg-emerald-950/20";
            }
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`border text-[10px] px-3 py-1.5 font-bold uppercase transition-all hover:bg-cyan-950/10 ${
                  isActive
                    ? activeColor
                    : "border-transparent text-slate-400 hover:text-cyan-300"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
        
        <span className="text-[10px] text-slate-500 font-bold font-telemetry uppercase tracking-wider">
          POLLING INTERVAL: 30S // LIVE_STREAM
        </span>
      </div>

      {/* Dense Data Table */}
      <div className="glass-panel border border-cyan-500/20 overflow-hidden flex flex-col min-h-[400px]">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-cyan-400 font-telemetry animate-pulse text-xs py-20">
            CONNECTING RADAR STREAM. LOADING SPACE-TRACK CONJUNCTIONS...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-400 font-telemetry text-xs py-20">
            SYS_ERROR: CONJUNCTIONS DATABASE UNREACHABLE
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs py-20 gap-2">
            <span>🛡️</span>
            <span>NO ACTIVE CONJUNCTION ENTRIES FOUND FOR THE SELECT FILTER</span>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse font-telemetry text-xs min-w-[1000px]">
              
              {/* Table Header */}
              <thead>
                <tr className="border-b border-cyan-500/20 bg-cyan-950/15 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-4 border-r border-cyan-500/10 w-[70px]">EVENT ID</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10">OBJECT 1 (OPERATOR / NORAD)</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10">OBJECT 2 (COLLIDER / NORAD)</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10">TCA (UTC TIMESTAMP)</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right">MISS DISTANCE</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right">COLLISION PROB</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right">REL VELOCITY</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-center">RISK TIER</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-cyan-500/5 text-slate-300">
                {filteredEvents.map((e) => (
                  <tr
                    key={e.event_id}
                    className="hover:bg-cyan-950/10 transition-colors border-b border-cyan-500/5"
                  >
                    {/* Event ID */}
                    <td className="py-2.5 px-4 font-bold border-r border-cyan-500/10 text-slate-500 text-center">
                      #{e.event_id}
                    </td>

                    {/* Object 1 */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10">
                      <div className="flex flex-col">
                        <span className="font-bold text-cyan-400 truncate max-w-[280px]">
                          {e.object1_name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          NORAD: {e.object1_norad}
                        </span>
                      </div>
                    </td>

                    {/* Object 2 */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10">
                      <div className="flex flex-col">
                        <span className="font-bold text-red-400 truncate max-w-[280px]">
                          {e.object2_name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          NORAD: {e.object2_norad}
                        </span>
                      </div>
                    </td>

                    {/* TCA */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10 text-slate-400">
                      {formatTca(e.tca)}
                    </td>

                    {/* Miss Distance */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10 text-right text-slate-200">
                      {e.miss_distance_km.toFixed(3)} km
                    </td>

                    {/* Probability */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10 text-right font-bold text-cyan-400">
                      {(e.collision_probability * 100).toFixed(4)}%
                    </td>

                    {/* Relative Velocity */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10 text-right text-slate-400">
                      {e.relative_velocity_kms.toFixed(2)} km/s
                    </td>

                    {/* Risk Badge */}
                    <td className="py-2.5 px-4 border-r border-cyan-500/10 text-center align-middle">
                      <div className="inline-flex justify-center items-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 border ${getRiskBadgeStyles(e.risk_level)}`}>
                          {e.risk_level}
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-2.5 px-4 text-center align-middle">
                      <div className="inline-flex justify-center items-center">
                        <span className={`text-[9px] font-bold px-2 py-0.5 border ${getStatusBadgeStyles(e.status)}`}>
                          {e.status}
                        </span>
                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>

            </table>
          </div>
        )}
      </div>

    </div>
  );
}
