import React, { useState, useEffect } from "react";
import { 
  Shield, 
  LayoutDashboard, 
  AlertOctagon, 
  User, 
  TrendingUp, 
  Settings as SettingsIcon, 
  Database, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Bell,
  Cpu,
  RefreshCw
} from "lucide-react";

// Page imports
import DashboardOverview from "./pages/DashboardOverview.tsx";
import AlertQueue from "./pages/AlertQueue.tsx";
import EntityProfile from "./pages/EntityProfile.tsx";
import ExplainabilityPage from "./pages/ExplainabilityPage.tsx";
import DataGeneratorPage from "./pages/DataGeneratorPage.tsx";
import Analytics from "./pages/Analytics.tsx";
import Settings from "./pages/Settings.tsx";

// API Base configuration
export const API_BASE = "http://localhost:8000/api";

export interface SystemSettings {
  anomaly_threshold: number;
  risk_threshold: number;
  retraining_interval: number;
  concept_drift_window: number;
  synthetic_attack_ratio: number;
  weights: {
    geo_anomaly: number;
    device_anomaly: number;
    behavior_anomaly: number;
    command_anomaly: number;
    auth_anomaly: number;
  };
}

export interface SystemStatus {
  status: string;
  progress: number;
  message: string;
}

function App() {
  const [currentView, setCurrentView] = useState<string>("dashboard");
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [recentAlertCount, setRecentAlertCount] = useState<number>(0);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: "Idle",
    progress: 0,
    message: ""
  });
  
  const [settings, setSettings] = useState<SystemSettings>({
    anomaly_threshold: 0.15,
    risk_threshold: 50.0,
    retraining_interval: 1000,
    concept_drift_window: 30,
    synthetic_attack_ratio: 0.03,
    weights: {
      geo_anomaly: 0.25,
      device_anomaly: 0.20,
      behavior_anomaly: 0.25,
      command_anomaly: 0.20,
      auth_anomaly: 0.10
    }
  });

  const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "info" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Check backend connection and fetch settings
  const checkStatusAndSettings = async () => {
    try {
      // 1. Connection check
      const setRes = await fetch(`${API_BASE}/settings`);
      if (setRes.ok) {
        const data = await setRes.json();
        setSettings(data);
        setApiOnline(true);
      }
      
      // 2. Background task status check
      const statRes = await fetch(`${API_BASE}/status`);
      if (statRes.ok) {
        const data = await statRes.json();
        setSystemStatus(data);
      }

      // 3. Current active alerts check to notify
      const alertRes = await fetch(`${API_BASE}/alerts?status=Pending&limit=5`);
      if (alertRes.ok) {
        const data = await alertRes.json();
        if (data.total > recentAlertCount) {
          if (recentAlertCount > 0) {
            showToast(`CRITICAL WARNING: ${data.total - recentAlertCount} new anomalous behavioral pattern(s) identified!`, "error");
          }
          setRecentAlertCount(data.total);
        } else if (data.total < recentAlertCount) {
          setRecentAlertCount(data.total);
        }
      }
    } catch (e) {
      setApiOnline(false);
    }
  };

  // Initial load
  useEffect(() => {
    checkStatusAndSettings();
    const interval = setInterval(checkStatusAndSettings, 5000);
    return () => clearInterval(interval);
  }, [recentAlertCount]);

  // Handle navigate to specific alert details
  const navigateToAlert = (alertId: number) => {
    setSelectedAlertId(alertId);
    setCurrentView("explainability");
  };

  // Handle navigate to specific user profile
  const navigateToEntity = (entityId: string) => {
    setSelectedEntityId(entityId);
    setCurrentView("entities");
  };

  // Trigger simulated live traffic
  const handleSimulateLiveTraffic = async () => {
    if (!apiOnline) {
      showToast("Backend offline. Cannot trigger simulation.", "error");
      return;
    }
    showToast("Injecting simulated enterprise network traffic...", "info");
    try {
      const res = await fetch(`${API_BASE}/simulate-live-logs`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        const alertTriggered = data.details.filter((d: any) => d.alert_id).length;
        if (alertTriggered > 0) {
          showToast(`Ingested ${data.simulated_logs} logs. Detected ${alertTriggered} threat vectors!`, "error");
        } else {
          showToast(`Ingested ${data.simulated_logs} logs. All patterns verified safe against baseline.`, "success");
        }
        checkStatusAndSettings();
      }
    } catch (e) {
      showToast("Failed to run real-time log simulation.", "error");
    }
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard Overview", icon: LayoutDashboard },
    { id: "alerts", label: "Alert Queue", icon: AlertOctagon, badge: recentAlertCount },
    { id: "entities", label: "Entity Profile Search", icon: User },
    { id: "explainability", label: "Explainable Risk (XAI)", icon: Cpu, disabled: selectedAlertId === null },
    { id: "generator", label: "Synthetic Log Generator", icon: Database },
    { id: "analytics", label: "AI Analytics Metrics", icon: TrendingUp },
    { id: "settings", label: "Admin Configuration", icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen bg-honeywell-dark text-honeywell-text font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-honeywell-card border-r border-honeywell-border flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Section */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-honeywell-border">
            <div className="p-1.5 bg-honeywell-red rounded">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-wider text-white">SentinelAI</h1>
              <p className="text-[10px] text-honeywell-red font-semibold uppercase tracking-widest -mt-1">Honeywell SOC</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setCurrentView(item.id)}
                  disabled={item.disabled}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-all duration-200 ${
                    item.disabled 
                      ? "opacity-30 cursor-not-allowed text-honeywell-textMuted"
                      : isActive
                        ? "bg-honeywell-red text-white font-medium shadow-md shadow-honeywell-red/10"
                        : "text-honeywell-textMuted hover:bg-honeywell-highlight hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className={`px-1.5 py-0.5 text-xs font-semibold rounded ${
                      isActive ? "bg-white text-honeywell-red" : "bg-honeywell-red text-white animate-pulse"
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Task Progress & Connection Indicator */}
        <div className="p-4 border-t border-honeywell-border bg-honeywell-dark/30 space-y-3">
          
          {systemStatus.status !== "Idle" && systemStatus.status !== "Completed" && (
            <div className="p-2.5 bg-honeywell-highlight/50 border border-honeywell-border rounded-lg text-xs space-y-1.5 animate-pulse">
              <div className="flex justify-between font-semibold">
                <span className="text-honeywell-red">{systemStatus.status}...</span>
                <span>{systemStatus.progress}%</span>
              </div>
              <div className="w-full bg-honeywell-border h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-honeywell-red h-full transition-all duration-300"
                  style={{ width: `${systemStatus.progress}%` }}
                ></div>
              </div>
              <p className="text-[10px] text-honeywell-textMuted line-clamp-1">{systemStatus.message}</p>
            </div>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-honeywell-textMuted">API Server:</span>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${apiOnline ? "bg-emerald-500 shadow-sm shadow-emerald-500/50" : "bg-red-500 shadow-sm shadow-red-500/50"}`}></span>
              <span className={apiOnline ? "text-emerald-500 font-semibold" : "text-red-500 font-semibold"}>
                {apiOnline ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP NAVBAR HEADER */}
        <header className="h-16 bg-honeywell-card border-b border-honeywell-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-honeywell-red animate-pulse" />
            <h2 className="text-sm font-semibold tracking-wider uppercase text-white">Real-Time Threat Detection Stream</h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleSimulateLiveTraffic}
              className="flex items-center gap-2 px-3 py-1.5 bg-honeywell-highlight hover:bg-honeywell-border border border-honeywell-border text-xs rounded-md text-white font-medium transition-all"
            >
              <RefreshCw className="h-3.5 w-3.5 text-honeywell-red" />
              <span>Simulate Live Event stream</span>
            </button>
            
            <div className="relative">
              <button className="p-1.5 text-honeywell-textMuted hover:text-white rounded-lg hover:bg-honeywell-highlight transition-all">
                <Bell className="h-5 w-5" />
                {recentAlertCount > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-honeywell-red rounded-full ring-2 ring-honeywell-card animate-ping"></span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* TOAST SYSTEM BANNER */}
        {toast && (
          <div className={`mx-8 mt-4 p-3 rounded-lg border flex items-center gap-3 animate-bounce shrink-0 z-50 shadow-lg ${
            toast.type === "error" 
              ? "bg-red-950/80 border-red-500/50 text-red-200" 
              : toast.type === "success"
                ? "bg-emerald-950/80 border-emerald-500/50 text-emerald-200"
                : "bg-honeywell-highlight border-honeywell-border text-white"
          }`}>
            {toast.type === "error" ? (
              <AlertTriangle className="h-5 w-5 text-honeywell-red" />
            ) : toast.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <Activity className="h-5 w-5 text-honeywell-red" />
            )}
            <div className="text-xs font-semibold flex-1">{toast.message}</div>
          </div>
        )}

        {/* MAIN BODY CONTENT AREA */}
        <section className="flex-1 overflow-y-auto p-8 min-h-0 bg-[#080B13]">
          {currentView === "dashboard" && (
            <DashboardOverview 
              navigateToAlert={navigateToAlert} 
              navigateToEntity={navigateToEntity} 
            />
          )}
          {currentView === "alerts" && (
            <AlertQueue 
              navigateToAlert={navigateToAlert} 
              navigateToEntity={navigateToEntity} 
            />
          )}
          {currentView === "entities" && (
            <EntityProfile 
              entityId={selectedEntityId} 
              navigateToAlert={navigateToAlert} 
            />
          )}
          {currentView === "explainability" && selectedAlertId !== null && (
            <ExplainabilityPage 
              alertId={selectedAlertId} 
              navigateToEntity={navigateToEntity} 
            />
          )}
          {currentView === "generator" && (
            <DataGeneratorPage 
              triggerStatusUpdate={checkStatusAndSettings} 
            />
          )}
          {currentView === "analytics" && (
            <Analytics />
          )}
          {currentView === "settings" && (
            <Settings 
              settings={settings} 
              onSettingsUpdate={checkStatusAndSettings} 
            />
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
