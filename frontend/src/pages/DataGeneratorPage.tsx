import React, { useState, useEffect } from "react";
import { 
  Database, RefreshCw, CheckCircle, AlertCircle, Download, ShieldAlert, Cpu
} from "lucide-react";
import { API_BASE } from "../App";
import type { SystemStatus } from "../App";

interface DataGeneratorPageProps {
  triggerStatusUpdate: () => void;
}

export default function DataGeneratorPage({ triggerStatusUpdate }: DataGeneratorPageProps) {
  const [recordSize, setRecordSize] = useState<number>(20000);
  const [status, setStatus] = useState<SystemStatus>({
    status: "Idle",
    progress: 0,
    message: ""
  });
  
  const [toast, setToast] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/status`);
      if (res.ok) {
        const json = await res.json();
        setStatus(json);
        triggerStatusUpdate();
      }
    } catch (e) {
      console.error("Error fetching background worker status", e);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Poll status frequently during active generation/training
    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    setToast(null);
    try {
      const res = await fetch(`${API_BASE}/generate-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ num_records: recordSize })
      });
      if (res.ok) {
        setToast("Generation queued successfully. Monitoring progress...");
        fetchStatus();
      } else {
        const err = await res.json();
        setToast(`Error: ${err.detail}`);
      }
    } catch (e) {
      setToast("Failed to communicate with data generation backend.");
    }
  };

  const handleDownload = () => {
    // Navigate window to CSV export route
    window.open(`${API_BASE}/download-logs`, "_blank");
  };

  const sizes = [
    { label: "10,000 logs (Quick Baseline)", value: 10000 },
    { label: "20,000 logs (Development Default)", value: 20000 },
    { label: "50,000 logs (Moderate Ingestion)", value: 50000 },
    { label: "100,000 logs (Enterprise Simulation)", value: 100000 },
    { label: "200,000 logs (Heavy Hackathon Target)", value: 200000 },
  ];

  const isActive = status.status === "Generating" || status.status === "Training";

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Synthetic Data Generator</h1>
        <p className="text-xs text-honeywell-textMuted mt-0.5">Generate large-scale access datasets containing injected enterprise cyber-attack signatures.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Generator Controls */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl space-y-5">
          <div className="flex items-center gap-3 border-b border-honeywell-border pb-4">
            <div className="p-2 bg-honeywell-highlight rounded-lg border border-honeywell-border text-honeywell-red">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Generator Configuration</h3>
              <p className="text-[10px] text-honeywell-textMuted">Simulates users, edge endpoints, and logs matching honeywell network architectures.</p>
            </div>
          </div>

          {/* Toast message inside Card */}
          {toast && (
            <div className="p-3 bg-honeywell-highlight border border-honeywell-border rounded-lg text-xs text-white">
              {toast}
            </div>
          )}

          {/* Selection List */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-honeywell-textMuted block">Select Target Dataset Size</label>
            <div className="grid grid-cols-1 gap-2.5">
              {sizes.map((sz) => (
                <button
                  key={sz.value}
                  disabled={isActive}
                  onClick={() => setRecordSize(sz.value)}
                  className={`w-full text-left px-4 py-3 rounded-lg border flex items-center justify-between text-xs transition-all ${
                    recordSize === sz.value
                      ? "bg-honeywell-highlight border-honeywell-red text-white font-semibold"
                      : "bg-honeywell-dark/30 border-honeywell-border text-honeywell-textMuted hover:border-honeywell-border hover:text-white"
                  } ${isActive ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <span>{sz.label}</span>
                  <span className="font-mono text-honeywell-textMuted">{sz.value.toLocaleString()} rows</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trigger button */}
          <div className="flex gap-3 pt-3">
            <button
              onClick={handleGenerate}
              disabled={isActive}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-honeywell-red disabled:bg-honeywell-border hover:bg-honeywell-red/90 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-honeywell-red/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isActive ? "animate-spin" : ""}`} />
              <span>{isActive ? "Simulation in progress..." : "Generate and Populate Database"}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={isActive || status.status === "Error"}
              className="px-4 py-2.5 bg-honeywell-highlight hover:bg-honeywell-border border border-honeywell-border hover:border-honeywell-red/30 rounded-lg text-white font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            >
              <Download className="h-4 w-4 text-honeywell-red" />
              <span>Download CSV</span>
            </button>
          </div>
        </div>

        {/* Status display panel */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-white uppercase tracking-wider border-b border-honeywell-border pb-3">Background Ingestion Status</h3>
            
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-3">
                {status.status === "Completed" ? (
                  <CheckCircle className="h-8 w-8 text-emerald-400 shrink-0" />
                ) : status.status === "Error" ? (
                  <AlertCircle className="h-8 w-8 text-honeywell-red shrink-0" />
                ) : status.status === "Generating" || status.status === "Training" ? (
                  <RefreshCw className="h-8 w-8 text-amber-500 animate-spin shrink-0" />
                ) : (
                  <Database className="h-8 w-8 text-blue-500 shrink-0" />
                )}
                
                <div className="space-y-0.5">
                  <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Active State</span>
                  <p className="text-sm font-bold text-white tracking-wider">{status.status}</p>
                </div>
              </div>

              {isActive && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-semibold text-white">
                    <span>Task Progress</span>
                    <span>{status.progress}%</span>
                  </div>
                  <div className="w-full bg-honeywell-dark border border-honeywell-border h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-honeywell-red h-full transition-all duration-300"
                      style={{ width: `${status.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-honeywell-textMuted leading-relaxed pt-1">{status.message}</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-3.5 bg-honeywell-highlight/50 border border-honeywell-border rounded-lg text-[11px] text-honeywell-textMuted leading-relaxed">
            <strong>Threat Profiles Injected:</strong> Brute Force, Credential Stuffing, Impossible Travel, Lateral Movement, Device Spoofing, Exfiltration, Insider Privilege Drift.
          </div>
        </div>

      </div>

    </div>
  );
}
