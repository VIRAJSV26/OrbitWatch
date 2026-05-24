"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface HealthResponse {
  status: string;
  database: string;
}

export default function NavigationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [time, setTime] = useState<Date | null>(null);

  // Live-updating clock
  useEffect(() => {
    setTime(new Date());
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // API connection health query
  const { data: health } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await fetch("http://localhost:8000/api/health");
      if (!res.ok) throw new Error("Offline");
      return res.json();
    },
    refetchInterval: 5000,
    retry: true,
  });

  const isConnected = health?.status === "healthy";

  // Formatted times
  const utcString = time ? time.toUTCString().slice(17, 25) + " UTC" : "00:00:00 UTC";
  const localString = time ? time.toLocaleTimeString() + " LCL" : "00:00:00 LCL";

  // Navigation Items
  const navItems = [
    {
      href: "/dashboard",
      name: "Dashboard",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
        </svg>
      )
    },
    {
      href: "/conjunctions",
      name: "Conjunctions",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    {
      href: "/cascade",
      name: "Cascade",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
      )
    },
    {
      href: "/leaderboard",
      name: "Leaderboard",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      )
    },
    {
      href: "/admin",
      name: "Admin",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    }
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Fixed Left Sidebar (60px) */}
      <aside className="w-[60px] h-full glass-panel flex flex-col items-center justify-between py-6 border-r border-cyan-500/20 z-20 select-none">
        <div className="flex flex-col items-center gap-6">
          <div className="text-cyan-400 font-bold text-xl cursor-default tracking-widest leading-none text-center">
            O<span className="text-cyan-600">W</span>
          </div>
          <hr className="w-8 border-cyan-500/20" />
          
          <nav className="flex flex-col items-center gap-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (pathname === "/" && item.href === "/dashboard");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.name}
                  className={`p-2.5 transition-all border ${
                    isActive
                      ? "border-cyan-400 text-cyan-400 border-glow-primary bg-cyan-950/20"
                      : "border-transparent text-slate-400 hover:text-cyan-300 hover:border-cyan-500/30"
                  }`}
                >
                  {item.icon}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="text-slate-600 text-xs font-telemetry font-bold cursor-default tracking-tighter">
          V1.0
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#050d1a]/85 backdrop-blur-sm">
        {/* Top Header Bar */}
        <header className="h-14 w-full glass-panel border-b border-cyan-500/20 flex items-center justify-between px-6 z-10 select-none">
          <div className="flex items-center gap-3">
            <span className="text-2xl animate-pulse">🛰️</span>
            <h1 className="text-lg font-bold uppercase tracking-wider text-cyan-400 glow-text-primary">
              OrbitWatch <span className="text-xs font-normal text-slate-400 tracking-widest font-telemetry">[DEBRIS INTELLIGENCE]</span>
            </h1>
          </div>

          <div className="flex items-center gap-6 font-telemetry">
            {/* Live Dual Clock */}
            <div className="flex items-center gap-4 text-xs font-bold text-cyan-500/90 tracking-widest border border-cyan-500/20 px-3 py-1 bg-cyan-950/10">
              <span className="tech-brackets">{utcString}</span>
              <span className="text-cyan-800">|</span>
              <span>{localString}</span>
            </div>

            {/* Connection Pip */}
            <div className="flex items-center gap-2 border border-cyan-500/20 px-3 py-1 bg-cyan-950/10">
              <div 
                className={`w-2 h-2 rounded-full ${
                  isConnected 
                    ? "bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse" 
                    : "bg-red-500 shadow-[0_0_10px_#ef4444]"
                }`}
              />
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isConnected ? "text-emerald-400" : "text-red-500"}`}>
                {isConnected ? "SYS_OK" : "SYS_ERR"}
              </span>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto relative p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
