"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

interface StatsResponse {
  total_objects: number;
  total_debris: number;
  active_satellites: number;
  critical_events: number;
}

// Custom Counter Component for Count-up animation
function CountUp({ value, color }: { value: number; color: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }

    const duration = 1200; // ms
    const increment = end / (duration / 16); // ~60fps
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value]);

  return <span className={`text-2xl font-bold font-telemetry tracking-wide ${color}`}>{count.toLocaleString()}</span>;
}

export default function StatsBar() {
  const { data: stats, isLoading, error } = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/stats");
      if (!res.ok) throw new Error("Stats fetch failed");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const displayStats = stats || {
    total_objects: 0,
    total_debris: 0,
    active_satellites: 0,
    critical_events: 0,
  };

  const cards = [
    {
      title: "TOTAL OBSERVED OBJECTS",
      value: displayStats.total_objects,
      color: "text-cyan-400",
      borderColor: "border-cyan-500/30",
      glowClass: "border-glow-primary",
      bgClass: "bg-cyan-950/5",
      icon: "🛰️"
    },
    {
      title: "TRACKED SPACE DEBRIS",
      value: displayStats.total_debris,
      color: "text-slate-300",
      borderColor: "border-slate-500/20",
      glowClass: "border-slate-500/30",
      bgClass: "bg-slate-900/5",
      icon: "🪨"
    },
    {
      title: "ACTIVE OPERATIONAL SATELLITES",
      value: displayStats.active_satellites,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/20",
      glowClass: "border-emerald-500/30",
      bgClass: "bg-emerald-950/5",
      icon: "📡"
    },
    {
      title: "CRITICAL CONJUNCTIONS (ACTIVE)",
      value: displayStats.critical_events,
      color: "text-red-400",
      borderColor: "border-red-500/30",
      glowClass: "border-glow-danger",
      bgClass: "bg-red-950/5 animate-pulse-cyan",
      icon: "⚠️"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full select-none mb-6">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`glass-panel border ${card.borderColor} ${card.glowClass} ${card.bgClass} px-5 py-3 transition-all hover:scale-[1.01]`}
        >
          {/* Top bracket markers */}
          <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-cyan-400/50" />
          <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-cyan-400/50" />
          
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-telemetry">
                {card.title}
              </span>
              {isLoading ? (
                <span className="text-xl font-bold font-telemetry text-slate-600 animate-pulse">
                  LOADING...
                </span>
              ) : (
                <CountUp value={card.value} color={card.color} />
              )}
            </div>
            
            <div className="text-2xl p-1.5 filter brightness-90 bg-black/10">
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
