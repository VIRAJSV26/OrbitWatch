"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "http://localhost:8000/api";

type Toast = { id: number; message: string; type: "success" | "error" | "warning" };

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"OBJECTS" | "CONJUNCTIONS" | "ALERTS" | "OWNERS">("OBJECTS");
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "warning" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Toast Container */}
      <div className="fixed top-20 right-6 z-50 flex flex-col space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded shadow-lg border text-sm font-bold animate-fade-in ${
              toast.type === "success"
                ? "bg-emerald-950/80 border-emerald-500 text-emerald-400"
                : toast.type === "error"
                ? "bg-red-950/80 border-red-500 text-red-400"
                : "bg-orange-950/80 border-orange-500 text-orange-400"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-cyan-400 glow-text-primary uppercase tracking-widest">
          System Administration
        </h1>
        <p className="text-slate-400 mt-2">Manage space objects, conjunctions, alerts, and owners.</p>
      </div>

      {/* Live Demo Panel */}
      <DemoPanel showToast={showToast} queryClient={queryClient} />

      {/* Tabs */}
      <div className="glass-panel p-4 flex-1 flex flex-col min-h-0 border border-cyan-500/20">
        <div className="flex border-b border-cyan-500/20 mb-4 space-x-6">
          {(["OBJECTS", "CONJUNCTIONS", "ALERTS", "OWNERS"] as const).map((tab) => (
            <button
              key={tab}
              className={`pb-2 px-2 text-sm font-bold tracking-wider transition-colors ${
                activeTab === tab
                  ? "text-cyan-400 border-b-2 border-cyan-400"
                  : "text-slate-500 hover:text-cyan-300"
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === "OBJECTS" && <ObjectsTab showToast={showToast} queryClient={queryClient} />}
          {activeTab === "CONJUNCTIONS" && <ConjunctionsTab showToast={showToast} queryClient={queryClient} />}
          {activeTab === "ALERTS" && <AlertsTab showToast={showToast} queryClient={queryClient} />}
          {activeTab === "OWNERS" && <OwnersTab showToast={showToast} queryClient={queryClient} />}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// DEMO PANEL
// ----------------------------------------------------------------------
function DemoPanel({ showToast, queryClient }: { showToast: any; queryClient: any }) {
  const insertDebris = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          norad_id: 99001 + Math.floor(Math.random() * 1000), // randomize slightly to avoid duplicates on multiple clicks
          name: "COSMOS 2251 FRAGMENT #47",
          object_type: "DEBRIS",
          shell_id: "LEO_HIGH",
          status: "ACTIVE",
          mass_kg: 0.8,
          radar_cross_section: 0.12,
        }),
      });
      if (!res.ok) throw new Error("Failed to insert demo debris");
      return res.json();
    },
    onSuccess: () => {
      showToast("Inserted demo debris object successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: () => showToast("Error inserting demo debris", "error"),
  });

  const logCritical = useMutation({
    mutationFn: async () => {
      // First, get top 2 objects
      const objectsRes = await fetch(`${API_BASE}/objects`);
      const objects = await objectsRes.json();
      if (objects.length < 2) throw new Error("Need at least 2 objects in DB");
      
      const tca = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const res = await fetch(`${API_BASE}/conjunctions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object1_id: objects[0].object_id,
          object2_id: objects[1].object_id,
          tca,
          miss_distance_km: 0.182,
          collision_probability: 0.087,
          relative_velocity_kms: 14.3,
          risk_level: "CRITICAL",
        }),
      });
      if (!res.ok) throw new Error("Failed to log critical conjunction");
      return res.json();
    },
    onSuccess: () => {
      showToast("TRIGGER FIRED — Alert auto-created in DB", "warning");
      queryClient.invalidateQueries({ queryKey: ["conjunctions"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (e: any) => showToast(e.message, "error"),
  });

  const cascadeDelete = async () => {
    // Show what will be deleted
    if (window.confirm("This will delete the first object in the database and cascade delete related alerts, parameters, and nodes. Proceed?")) {
      try {
        const objectsRes = await fetch(`${API_BASE}/objects`);
        const objects = await objectsRes.json();
        if (objects.length === 0) {
           showToast("No objects to delete", "error");
           return;
        }
        
        const res = await fetch(`${API_BASE}/objects/${objects[0].object_id}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete");
        
        showToast(`Deleted Object ID ${objects[0].object_id} and cascaded deletions.`, "success");
        queryClient.invalidateQueries();
      } catch (e: any) {
        showToast(e.message, "error");
      }
    }
  };

  return (
    <div className="glass-panel p-4 border border-cyan-500/20">
      <h2 className="text-sm font-bold text-cyan-300 uppercase mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
        Live Demo Panel
      </h2>
      <div className="flex flex-wrap gap-4">
        <button 
          onClick={() => insertDebris.mutate()}
          className="px-4 py-2 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-100 text-xs font-bold uppercase tracking-wider transition-all"
        >
          Insert Demo Debris Object
        </button>
        <button 
          onClick={() => logCritical.mutate()}
          className="px-4 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-100 text-xs font-bold uppercase tracking-wider transition-all"
        >
          Log Critical Conjunction
        </button>
        <button 
          onClick={cascadeDelete}
          className="px-4 py-2 bg-orange-950/40 hover:bg-orange-900/60 border border-orange-500/40 text-orange-100 text-xs font-bold uppercase tracking-wider transition-all"
        >
          Demonstrate Cascade Delete
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// OBJECTS TAB
// ----------------------------------------------------------------------
function ObjectsTab({ showToast, queryClient }: { showToast: any; queryClient: any }) {
  const { data: objects = [] } = useQuery({
    queryKey: ["objects"],
    queryFn: async () => (await fetch(`${API_BASE}/objects`)).json(),
  });
  
  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await fetch(`${API_BASE}/owners`)).json(),
  });

  const { data: shells = [] } = useQuery({
    queryKey: ["shells"],
    queryFn: async () => (await fetch(`${API_BASE}/shells`)).json(),
  });

  const [form, setForm] = useState({
    norad_id: "", name: "", object_type: "SATELLITE", owner_id: "", shell_id: "", 
    launch_date: "", status: "ACTIVE", mass_kg: "", radar_cross_section: ""
  });
  const [editId, setEditId] = useState<number | null>(null);

  const addObj = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/objects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Duplicate NORAD ID or invalid data");
      return res.json();
    },
    onSuccess: (data) => {
      showToast(`Object created with ID ${data.object_id}`, "success");
      setForm({ norad_id: "", name: "", object_type: "SATELLITE", owner_id: "", shell_id: "", launch_date: "", status: "ACTIVE", mass_kg: "", radar_cross_section: "" });
      queryClient.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const editObj = useMutation({
    mutationFn: async ({ id, payload }: { id: number, payload: any }) => {
      const res = await fetch(`${API_BASE}/objects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update object");
      return res.json();
    },
    onSuccess: (data) => {
      showToast(`Object updated successfully`, "success");
      setEditId(null);
      setForm({ norad_id: "", name: "", object_type: "SATELLITE", owner_id: "", shell_id: "", launch_date: "", status: "ACTIVE", mass_kg: "", radar_cross_section: "" });
      queryClient.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`${API_BASE}/objects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["objects"] }),
    onError: (err: any) => showToast(err.message, "error"),
  });

  const deleteObj = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/objects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete object");
    },
    onSuccess: () => {
      showToast("Object deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["objects"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      norad_id: parseInt(form.norad_id),
      owner_id: form.owner_id ? parseInt(form.owner_id) : null,
      shell_id: form.shell_id || null,
      launch_date: form.launch_date ? form.launch_date.split('T')[0] : null,
      mass_kg: form.mass_kg ? parseFloat(form.mass_kg) : null,
      radar_cross_section: form.radar_cross_section ? parseFloat(form.radar_cross_section) : null,
    };
    
    if (editId) {
      editObj.mutate({ id: editId, payload });
    } else {
      addObj.mutate(payload);
    }
  };

  const handleEditClick = (o: any) => {
    setEditId(o.object_id);
    setForm({
      norad_id: o.norad_id.toString(),
      name: o.name,
      object_type: o.object_type,
      owner_id: o.owner_id ? o.owner_id.toString() : "",
      shell_id: o.shell_id || "",
      launch_date: o.launch_date ? o.launch_date.split('T')[0] : "",
      status: o.status,
      mass_kg: o.mass_kg ? o.mass_kg.toString() : "",
      radar_cross_section: o.radar_cross_section ? o.radar_cross_section.toString() : ""
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-cyan-500/20 bg-cyan-950/10">
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">NORAD ID *</label>
          <input required type="number" disabled={!!editId} value={form.norad_id} onChange={e => setForm({...form, norad_id: e.target.value})} className={`w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400 ${editId ? 'opacity-50 cursor-not-allowed' : ''}`} />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Name *</label>
          <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Type *</label>
          <select value={form.object_type} onChange={e => setForm({...form, object_type: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400">
            <option value="SATELLITE">SATELLITE</option>
            <option value="DEBRIS">DEBRIS</option>
            <option value="ROCKET_BODY">ROCKET_BODY</option>
            <option value="UNKNOWN">UNKNOWN</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Owner</label>
          <select value={form.owner_id} onChange={e => setForm({...form, owner_id: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400">
            <option value="">None</option>
            {owners.map((o: any) => <option key={o.owner_id} value={o.owner_id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Orbital Shell</label>
          <select value={form.shell_id} onChange={e => setForm({...form, shell_id: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400">
            <option value="">None</option>
            {shells.map((s: any) => <option key={s.shell_id} value={s.shell_id}>{s.shell_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Launch Date</label>
          <input type="date" value={form.launch_date} onChange={e => setForm({...form, launch_date: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Status *</label>
          <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400">
            <option value="ACTIVE">ACTIVE</option>
            <option value="DEAD">DEAD</option>
            <option value="DECAYED">DECAYED</option>
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-bold text-cyan-400 mb-1">Mass (kg)</label>
            <input type="number" step="0.1" value={form.mass_kg} onChange={e => setForm({...form, mass_kg: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-bold text-cyan-400 mb-1">RCS</label>
            <input type="number" step="0.01" value={form.radar_cross_section} onChange={e => setForm({...form, radar_cross_section: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none focus:border-cyan-400" />
          </div>
        </div>
        <div className="col-span-full mt-2 flex gap-4">
          <button type="submit" className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm tracking-wider">
            {editId ? "UPDATE OBJECT" : "ADD OBJECT"}
          </button>
          {editId && (
            <button 
              type="button" 
              onClick={() => { setEditId(null); setForm({ norad_id: "", name: "", object_type: "SATELLITE", owner_id: "", shell_id: "", launch_date: "", status: "ACTIVE", mass_kg: "", radar_cross_section: "" }); }}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm tracking-wider border border-slate-600"
            >
              CANCEL
            </button>
          )}
        </div>
      </form>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-cyan-500/30 text-cyan-500">
            <th className="p-2">NORAD</th>
            <th className="p-2">Name</th>
            <th className="p-2">Type</th>
            <th className="p-2">Owner</th>
            <th className="p-2">Shell</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {objects.slice(0, 20).map((o: any) => (
            <tr key={o.object_id} className="border-b border-cyan-500/10 hover:bg-cyan-950/20">
              <td className="p-2 text-cyan-200">{o.norad_id}</td>
              <td className="p-2 text-slate-300">{o.name}</td>
              <td className="p-2"><span className="px-2 py-0.5 bg-slate-800 text-xs border border-slate-600 rounded">{o.object_type}</span></td>
              <td className="p-2 text-slate-400">{o.owner_name || "-"}</td>
              <td className="p-2 text-slate-400">{o.shell_name || "-"}</td>
              <td className="p-2">
                <select 
                  value={o.status} 
                  onChange={(e) => updateStatus.mutate({ id: o.object_id, status: e.target.value })}
                  className="bg-transparent border border-cyan-500/30 text-xs p-1 focus:outline-none text-slate-300"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DEAD">DEAD</option>
                  <option value="DECAYED">DECAYED</option>
                </select>
              </td>
              <td className="p-2 space-x-3">
                <button 
                  onClick={() => handleEditClick(o)}
                  className="text-cyan-400 hover:text-cyan-300 text-xs font-bold"
                >
                  EDIT
                </button>
                <button 
                  onClick={() => { if(window.confirm("Delete this object?")) deleteObj.mutate(o.object_id) }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold"
                >
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------
// CONJUNCTIONS TAB
// ----------------------------------------------------------------------
function ConjunctionsTab({ showToast, queryClient }: { showToast: any; queryClient: any }) {
  const { data: objects = [] } = useQuery({
    queryKey: ["objects"],
    queryFn: async () => (await fetch(`${API_BASE}/objects`)).json(),
  });

  const { data: conjunctions = [] } = useQuery({
    queryKey: ["conjunctions"],
    queryFn: async () => (await fetch(`${API_BASE}/conjunctions`)).json(),
  });

  const [form, setForm] = useState({
    object1_id: "", object2_id: "", tca: "", miss_distance_km: "", 
    collision_probability: "", relative_velocity_kms: "", risk_level: "MEDIUM"
  });

  const addConj = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/conjunctions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to log conjunction");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.alert_fired) {
        showToast("⚠️ ALERT AUTO-TRIGGERED — Check Alerts tab", "warning");
      } else {
        showToast("Conjunction logged successfully", "success");
      }
      queryClient.invalidateQueries({ queryKey: ["conjunctions"] });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const deleteConj = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/conjunctions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conjunction");
    },
    onSuccess: () => {
      showToast("Conjunction deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["conjunctions"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.object1_id === form.object2_id) {
      showToast("Objects must be different", "error");
      return;
    }
    addConj.mutate({
      object1_id: parseInt(form.object1_id),
      object2_id: parseInt(form.object2_id),
      tca: form.tca ? new Date(form.tca).toISOString() : new Date().toISOString(),
      miss_distance_km: parseFloat(form.miss_distance_km),
      collision_probability: parseFloat(form.collision_probability),
      relative_velocity_kms: parseFloat(form.relative_velocity_kms),
      risk_level: form.risk_level,
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border border-cyan-500/20 bg-cyan-950/10">
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Object 1 *</label>
          <select required value={form.object1_id} onChange={e => setForm({...form, object1_id: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none">
            <option value="">Select Object</option>
            {objects.map((o: any) => <option key={o.object_id} value={o.object_id}>{o.name} ({o.norad_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Object 2 *</label>
          <select required value={form.object2_id} onChange={e => setForm({...form, object2_id: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none">
            <option value="">Select Object</option>
            {objects.map((o: any) => <option key={o.object_id} value={o.object_id}>{o.name} ({o.norad_id})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">TCA (Local) *</label>
          <input required type="datetime-local" value={form.tca} onChange={e => setForm({...form, tca: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Risk Level *</label>
          <select value={form.risk_level} onChange={e => setForm({...form, risk_level: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none">
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Miss Dist (km) *</label>
          <input required type="number" step="0.001" value={form.miss_distance_km} onChange={e => setForm({...form, miss_distance_km: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Prob (0-1) *</label>
          <input required type="number" step="0.001" min="0" max="1" value={form.collision_probability} onChange={e => setForm({...form, collision_probability: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Rel Vel (km/s) *</label>
          <input required type="number" step="0.1" value={form.relative_velocity_kms} onChange={e => setForm({...form, relative_velocity_kms: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm tracking-wider">
            LOG CONJUNCTION EVENT
          </button>
        </div>
      </form>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-cyan-500/30 text-cyan-500">
            <th className="p-2">Object 1</th>
            <th className="p-2">Object 2</th>
            <th className="p-2">Miss (km)</th>
            <th className="p-2">Prob</th>
            <th className="p-2">Risk</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {conjunctions.slice(0, 20).map((c: any) => (
            <tr key={c.event_id} className="border-b border-cyan-500/10 hover:bg-cyan-950/20">
              <td className="p-2 text-slate-300">{c.object1_norad}</td>
              <td className="p-2 text-slate-300">{c.object2_norad}</td>
              <td className="p-2 text-slate-400">{c.miss_distance_km}</td>
              <td className="p-2 text-slate-400">{(c.collision_probability * 100).toFixed(2)}%</td>
              <td className="p-2">
                <span className={`px-2 py-0.5 text-xs font-bold border rounded ${
                  c.risk_level === 'CRITICAL' ? 'bg-red-900/50 border-red-500 text-red-400' :
                  c.risk_level === 'HIGH' ? 'bg-orange-900/50 border-orange-500 text-orange-400' :
                  'bg-yellow-900/50 border-yellow-500 text-yellow-400'
                }`}>
                  {c.risk_level}
                </span>
              </td>
              <td className="p-2 text-slate-400">{c.status}</td>
              <td className="p-2">
                <button 
                  onClick={() => { if(window.confirm("Delete this event?")) deleteConj.mutate(c.event_id) }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold"
                >
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------
// ALERTS TAB
// ----------------------------------------------------------------------
function AlertsTab({ showToast, queryClient }: { showToast: any; queryClient: any }) {
  const { data: alerts = [] } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await fetch(`${API_BASE}/alerts`)).json(),
  });

  const ackAlert = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/alerts/${id}/acknowledge`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to acknowledge");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    onError: (err: any) => showToast(err.message, "error"),
  });

  const deleteAlert = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/alerts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete alert");
    },
    onSuccess: () => {
      showToast("Alert deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  return (
    <div className="space-y-4">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-cyan-500/30 text-cyan-500">
            <th className="p-2">Triggered At</th>
            <th className="p-2">Type</th>
            <th className="p-2">Message</th>
            <th className="p-2">Ack'd</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((a: any) => (
            <tr key={a.alert_id} className="border-b border-cyan-500/10 hover:bg-cyan-950/20">
              <td className="p-2 text-slate-400 whitespace-nowrap">{new Date(a.triggered_at).toLocaleString()}</td>
              <td className="p-2">
                <span className={`px-2 py-0.5 text-xs font-bold border rounded ${
                  a.alert_type === 'CRITICAL' ? 'bg-red-900/50 border-red-500 text-red-400' :
                  'bg-orange-900/50 border-orange-500 text-orange-400'
                }`}>
                  {a.alert_type}
                </span>
              </td>
              <td className="p-2 text-slate-300">{a.message}</td>
              <td className="p-2">
                {a.acknowledged ? 
                  <span className="text-emerald-400 text-xs font-bold px-2 py-0.5 bg-emerald-950/30 border border-emerald-500 rounded">YES</span> : 
                  <span className="text-red-400 text-xs font-bold px-2 py-0.5 bg-red-950/30 border border-red-500 rounded">NO</span>
                }
              </td>
              <td className="p-2 text-right space-x-3">
                {!a.acknowledged && (
                  <button 
                    onClick={() => ackAlert.mutate(a.alert_id)}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-bold"
                  >
                    ACKNOWLEDGE
                  </button>
                )}
                <button 
                  onClick={() => deleteAlert.mutate(a.alert_id)}
                  className="text-red-400 hover:text-red-300 text-xs font-bold"
                >
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------
// OWNERS TAB
// ----------------------------------------------------------------------
function OwnersTab({ showToast, queryClient }: { showToast: any; queryClient: any }) {
  const { data: owners = [] } = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await fetch(`${API_BASE}/owners`)).json(),
  });

  const [form, setForm] = useState({ name: "", type: "AGENCY", country_code: "", founded_year: "" });

  const addOwner = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_BASE}/owners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to add owner");
      return res.json();
    },
    onSuccess: () => {
      showToast("Owner added", "success");
      queryClient.invalidateQueries({ queryKey: ["owners"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const deleteOwner = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/owners/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete owner");
    },
    onSuccess: () => {
      showToast("Owner deleted", "success");
      queryClient.invalidateQueries({ queryKey: ["owners"] });
    },
    onError: (err: any) => showToast(err.message, "error"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addOwner.mutate({
      ...form,
      country_code: form.country_code.toUpperCase(),
      founded_year: form.founded_year ? parseInt(form.founded_year) : null,
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border border-cyan-500/20 bg-cyan-950/10">
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Name *</label>
          <input required type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Type *</label>
          <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none">
            <option value="COUNTRY">COUNTRY</option>
            <option value="COMPANY">COMPANY</option>
            <option value="AGENCY">AGENCY</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Country Code</label>
          <input type="text" maxLength={3} value={form.country_code} onChange={e => setForm({...form, country_code: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none uppercase" />
        </div>
        <div>
          <label className="block text-xs font-bold text-cyan-400 mb-1">Founded Year</label>
          <input type="number" value={form.founded_year} onChange={e => setForm({...form, founded_year: e.target.value})} className="w-full bg-slate-900 border border-cyan-500/30 p-2 text-sm text-cyan-100 focus:outline-none" />
        </div>
        <div className="col-span-full mt-2">
          <button type="submit" className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm tracking-wider">
            ADD OWNER
          </button>
        </div>
      </form>

      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-cyan-500/30 text-cyan-500">
            <th className="p-2">Name</th>
            <th className="p-2">Type</th>
            <th className="p-2">Country Code</th>
            <th className="p-2">Founded</th>
            <th className="p-2">Debris Score</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((o: any) => (
            <tr key={o.owner_id} className="border-b border-cyan-500/10 hover:bg-cyan-950/20">
              <td className="p-2 text-slate-300 font-bold">{o.name}</td>
              <td className="p-2"><span className="px-2 py-0.5 bg-slate-800 text-xs border border-slate-600 rounded">{o.type}</span></td>
              <td className="p-2 text-slate-400">{o.country_code || "-"}</td>
              <td className="p-2 text-slate-400">{o.founded_year || "-"}</td>
              <td className="p-2 text-cyan-300 font-telemetry">{Number(o.debris_score).toFixed(3)}</td>
              <td className="p-2">
                <button 
                  onClick={() => { if(window.confirm("Delete this owner?")) deleteOwner.mutate(o.owner_id) }}
                  className="text-red-400 hover:text-red-300 text-xs font-bold"
                >
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
