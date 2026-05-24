"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";

interface Polluter {
  owner_id: number;
  owner_name: string;
  type: string;
  country_code: string;
  total_objects: number;
  debris_count: number;
  dead_satellites: number;
  debris_percentage: number;
}

export default function LeaderboardPage() {
  // Fetch leaderboard data using React Query
  const { data: polluters = [], isLoading, error } = useQuery<Polluter[]>({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/leaderboard");
      if (!res.ok) throw new Error("Failed to fetch polluters leaderboard");
      return res.json();
    },
    refetchInterval: 15000, // refresh every 15s
  });

  // Calculate max debris for relative bar scaling
  const maxDebris = polluters.length > 0 ? Math.max(...polluters.map((p) => p.debris_count)) : 1;

  // Render pod medals for top 3
  const renderMedal = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="text-xl filter drop-shadow-[0_0_4px_#fbbf24]" title="Gold Medal">
            🥇
          </span>
        );
      case 2:
        return (
          <span className="text-xl filter drop-shadow-[0_0_4px_#94a3b8]" title="Silver Medal">
            🥈
          </span>
        );
      case 3:
        return (
          <span className="text-xl filter drop-shadow-[0_0_4px_#b45309]" title="Bronze Medal">
            🥉
          </span>
        );
      default:
        return <span className="text-slate-500 font-telemetry font-bold">{rank}</span>;
    }
  };

  // Get row styling for top 3
  const getRowStyles = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-950/5 border-l-4 border-l-yellow-500 hover:bg-yellow-950/10";
      case 2:
        return "bg-slate-900/5 border-l-4 border-l-slate-400 hover:bg-slate-900/10";
      case 3:
        return "bg-amber-950/5 border-l-4 border-l-amber-700 hover:bg-amber-950/10";
      default:
        return "hover:bg-cyan-950/5 border-l-4 border-l-transparent";
    }
  };

  // Get progress bar color based on debris count thresholds
  const getProgressBarStyles = (count: number) => {
    if (count > 300) {
      return {
        bg: "bg-red-500/80 shadow-[0_0_8px_rgba(255,75,43,0.3)]",
        border: "border-red-500/40",
        text: "text-red-400 font-bold",
      };
    } else if (count > 100) {
      return {
        bg: "bg-orange-500/80 shadow-[0_0_8px_rgba(255,165,0,0.3)]",
        border: "border-orange-500/30",
        text: "text-orange-400 font-bold",
      };
    } else {
      return {
        bg: "bg-emerald-500/80 shadow-[0_0_8px_rgba(52,211,153,0.3)]",
        border: "border-emerald-500/30",
        text: "text-emerald-400 font-bold",
      };
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-fade-in font-telemetry select-none">
      
      {/* Title Header with Skull Emoji */}
      <div className="glass-panel border border-cyan-500/20 p-5 flex items-center justify-between">
        <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
        <div className="flex items-center gap-3">
          <span className="text-2xl animate-bounce filter drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]">💀</span>
          <div className="flex flex-col">
            <h2 className="text-md font-bold text-cyan-400 glow-text-primary tracking-wider uppercase">
              ORBITAL POLLUTER LEADERBOARD
            </h2>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              GLOBAL RANKINGS OF SPACE DEBRIS CONTRIBUTORS // CONTRIB_MAP
            </p>
          </div>
        </div>
        <div className="text-right border border-cyan-500/10 px-3 py-1.5 bg-cyan-950/5 text-xs text-cyan-500">
          TRACKED_OPERATORS: <span className="text-cyan-400 font-bold">{polluters.length}</span>
        </div>
      </div>

      {/* Dense Leaderboard Table */}
      <div className="glass-panel border border-cyan-500/20 overflow-hidden flex flex-col min-h-[400px]">
        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-cyan-400 font-telemetry animate-pulse text-xs py-20">
            CONNECTING INTEL DATABASE. RANKING ORBITAL POLLUTERS...
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-400 font-telemetry text-xs py-20">
            SYS_ERROR: LEADERSHIP TELEMETRY OFFLINE
          </div>
        ) : polluters.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-xs py-20 gap-2">
            <span>🛡️</span>
            <span>NO POLLUTER DATABASE RECORDS CORRELATED IN CURRENT TIMESTEP</span>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse font-telemetry text-xs min-w-[1000px]">
              
              {/* Header */}
              <thead>
                <tr className="border-b border-cyan-500/20 bg-cyan-950/15 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-center w-[70px]">RANK</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10">OWNER / OPERATOR NAME</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-center w-[120px]">ORGANIZATION TYPE</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-center w-[100px]">COUNTRY CODE</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right w-[140px]">TOTAL OBJECTS TRACKED</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right w-[120px]">DEAD SATELLITES</th>
                  <th className="py-3 px-4 border-r border-cyan-500/10 text-right w-[120px]">DEBRIS COUNT</th>
                  <th className="py-3 px-4">DEBRIS CONTRIBUTION SCORE</th>
                </tr>
              </thead>

              {/* Rows */}
              <tbody className="divide-y divide-cyan-500/5 text-slate-300">
                {polluters.map((p, idx) => {
                  const rank = idx + 1;
                  const relativePercentage = (p.debris_count / maxDebris) * 100;
                  const barStyles = getProgressBarStyles(p.debris_count);

                  return (
                    <tr
                      key={p.owner_id}
                      className={`transition-colors border-b border-cyan-500/5 ${getRowStyles(rank)}`}
                    >
                      {/* Rank Medal */}
                      <td className="py-3 px-4 font-bold border-r border-cyan-500/10 text-center">
                        {renderMedal(rank)}
                      </td>

                      {/* Owner Name */}
                      <td className="py-3 px-4 border-r border-cyan-500/10 font-bold text-slate-200">
                        {p.owner_name}
                      </td>

                      {/* Org Type */}
                      <td className="py-3 px-4 border-r border-cyan-500/10 text-center text-slate-400">
                        <span className="border border-cyan-500/10 px-2 py-0.5 bg-cyan-950/5 text-[9px] font-bold">
                          {p.type}
                        </span>
                      </td>

                      {/* Country Code */}
                      <td className="py-3 px-4 border-r border-cyan-500/10 text-center text-slate-400 font-bold">
                        {p.country_code}
                      </td>

                      {/* Total Objects */}
                      <td className="py-3 px-4 border-r border-cyan-500/10 text-right text-slate-300">
                        {p.total_objects}
                      </td>

                      {/* Dead Satellites */}
                      <td className="py-3 px-4 border-r border-cyan-500/10 text-right text-slate-400">
                        {p.dead_satellites}
                      </td>

                      {/* Debris Count */}
                      <td className={`py-3 px-4 border-r border-cyan-500/10 text-right font-bold ${barStyles.text}`}>
                        {p.debris_count}
                      </td>

                      {/* Progress Bar Contribution */}
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-4 h-full">
                          <div className={`flex-1 h-3 border ${barStyles.border} bg-black/40 p-[1.5px]`}>
                            <div
                              className={`h-full ${barStyles.bg} transition-all duration-500`}
                              style={{ width: `${Math.max(1, relativePercentage)}%` }}
                            />
                          </div>
                          <span className={`w-12 text-right text-[10px] font-bold ${barStyles.text}`}>
                            {p.debris_percentage.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>
        )}
      </div>

    </div>
  );
}
