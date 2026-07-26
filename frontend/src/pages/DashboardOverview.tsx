import React, { useState, useEffect } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from "recharts";
import { 
  AlertOctagon, ShieldCheck, Activity, Users, AlertTriangle, ShieldAlert, ChevronRight, PlayCircle
} from "lucide-react";
import { API_BASE } from "../App";

interface DashboardData {
  total_sessions: number;
  total_alerts: number;
  critical_alerts: number;
  normal_sessions: number;
  attack_distribution: Array<{ type: string; count: number }>;
  timeline_trends: Array<{ date: string; alerts: number; sessions: number }>;
  risk_distribution: Array<{ range: string; count: number }>;
  heatmap: Array<{ day: string; hour: string; value: number }>;
  top_targets: Array<{ entity_id: string; entity_type: string; risk_score: number; attack_type: string }>;
}

interface DashboardOverviewProps {
  navigateToAlert: (id: number) => void;
  navigateToEntity: (id: string) => void;
}

const COLORS = ["#EE3124", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

export default function DashboardOverview({ navigateToAlert, navigateToEntity }: DashboardOverviewProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [liveLogs, setLiveLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch Dashboard Metrics
  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Error fetching dashboard statistics", e);
    }
  };

  // Fetch Live Event Stream logs
  const fetchLiveLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/alerts?limit=8`);
      if (res.ok) {
        const json = await res.json();
        setLiveLogs(json.alerts);
      }
    } catch (e) {
      console.error("Error fetching live logs", e);
    }
  };

  useEffect(() => {
    fetchDashboardData().then(() => setLoading(false));
    fetchLiveLogs();
    
    // Auto-refresh stats and live feed every 5 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchLiveLogs();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-honeywell-card w-48 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-honeywell-card rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-honeywell-card rounded-xl"></div>
          <div className="h-80 bg-honeywell-card rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Calculate percentages
  const alertRate = data.total_sessions > 0 ? ((data.total_alerts / data.total_sessions) * 100).toFixed(1) : "0.0";
  const criticalRate = data.total_alerts > 0 ? ((data.critical_alerts / data.total_alerts) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-8">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Security Operations Dashboard</h1>
          <p className="text-xs text-honeywell-textMuted mt-0.5">Continuous automated machine learning behavioral verification.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-md flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Detection: Active</span>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Sessions */}
        <div className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-honeywell-textMuted font-medium uppercase tracking-wider">Total Access Sessions</span>
            <h3 className="text-2xl font-bold text-white">{data.total_sessions.toLocaleString()}</h3>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span>99.9% network accessibility</span>
            </p>
          </div>
          <div className="p-3 bg-honeywell-highlight rounded-lg">
            <Users className="h-6 w-6 text-blue-400" />
          </div>
        </div>

        {/* Total Alerts */}
        <div className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-honeywell-textMuted font-medium uppercase tracking-wider">Behavior Anomalies</span>
            <h3 className="text-2xl font-bold text-white">{data.total_alerts.toLocaleString()}</h3>
            <p className="text-[10px] text-honeywell-textMuted">
              Anomaly rate: <span className="text-honeywell-red font-semibold">{alertRate}%</span>
            </p>
          </div>
          <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-lg">
            <AlertOctagon className="h-6 w-6 text-honeywell-red animate-pulse" />
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-honeywell-textMuted font-medium uppercase tracking-wider">Critical Threats</span>
            <h3 className="text-2xl font-bold text-white">{data.critical_alerts.toLocaleString()}</h3>
            <p className="text-[10px] text-honeywell-textMuted">
              High severity rate: <span className="text-amber-500 font-semibold">{criticalRate}%</span>
            </p>
          </div>
          <div className="p-3 bg-amber-950/40 border border-amber-500/20 rounded-lg">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
        </div>

        {/* Normal Sessions */}
        <div className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-honeywell-textMuted font-medium uppercase tracking-wider">Clean Sessions</span>
            <h3 className="text-2xl font-bold text-white">{data.normal_sessions.toLocaleString()}</h3>
            <p className="text-[10px] text-emerald-400 font-semibold">
              ✓ 0 false-positive skips
            </p>
          </div>
          <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 rounded-lg">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Network Timeline Trends */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Threat Activity Timeline</h3>
            <span className="text-[10px] text-honeywell-textMuted">Logs compared against rolling baseline</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline_trends}>
                <defs>
                  <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EE3124" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#EE3124" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#232E45" vertical={false} />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis yAxisId="left" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#EE3124" fontSize={10} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "12px" }}
                  labelStyle={{ color: "#FFF" }}
                />
                <Legend wrapperStyle={{ fontSize: "10px", marginTop: "10px" }} />
                <Area yAxisId="left" type="monotone" dataKey="sessions" name="Standard Sessions" stroke="#3B82F6" fillOpacity={1} fill="url(#colorSessions)" strokeWidth={2} />
                <Area yAxisId="right" type="monotone" dataKey="alerts" name="Risk Anomalies" stroke="#EE3124" fillOpacity={1} fill="url(#colorAlerts)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attack Vector Distribution */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Attack Category Distribution</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">XGBoost threat classification counts</p>
          </div>
          <div className="h-56 relative flex items-center justify-center">
            {data.attack_distribution.length === 0 ? (
              <div className="text-xs text-honeywell-textMuted">No threats flagged yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.attack_distribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                    nameKey="type"
                  >
                    {data.attack_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "11px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Center Label */}
            <div className="absolute text-center">
              <span className="text-[10px] text-honeywell-textMuted uppercase tracking-wider block">Total Alerts</span>
              <span className="text-2xl font-bold text-white">{data.total_alerts}</span>
            </div>
          </div>
          {/* Custom legend */}
          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-2 max-h-24 overflow-y-auto pr-1">
            {data.attack_distribution.map((item, idx) => (
              <div key={item.type} className="flex items-center gap-1.5 text-[10px] text-honeywell-textMuted truncate">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                <span className="truncate">{item.type} ({item.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RISKY USERS AND HEATMAP ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Score Distribution histogram */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Risk Score Distribution</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">Frequencies of risk severity indexes</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.risk_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232E45" vertical={false} />
                <XAxis dataKey="range" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: "rgba(35, 46, 69, 0.2)" }}
                  contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "11px" }}
                />
                <Bar dataKey="count" fill="#EE3124" radius={[4, 4, 0, 0]}>
                  {data.risk_distribution.map((entry, index) => {
                    const highlightColors = ["#10B981", "#3B82F6", "#F59E0B", "#F97316", "#EE3124"];
                    return <Cell key={`cell-${index}`} fill={highlightColors[index % highlightColors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Risky Target Entities */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Top Inspected Entities</h3>
              <span className="text-[10px] text-honeywell-red font-semibold uppercase tracking-wider">Risk Level</span>
            </div>
            {data.top_targets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-honeywell-textMuted text-xs">
                <ShieldCheck className="h-8 w-8 text-emerald-500 mb-2" />
                <span>All entity behaviors validated safe.</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                {data.top_targets.map((target) => (
                  <div 
                    key={target.entity_id}
                    onClick={() => navigateToEntity(target.entity_id)}
                    className="p-3 bg-honeywell-highlight/50 border border-honeywell-border hover:border-honeywell-red/35 rounded-lg flex items-center justify-between cursor-pointer transition-all duration-200"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white">{target.entity_id}</span>
                        <span className="px-1.5 py-0.2 bg-honeywell-border text-[9px] rounded text-honeywell-textMuted uppercase">{target.entity_type}</span>
                      </div>
                      <p className="text-[10px] text-honeywell-textMuted">Class: <span className="text-honeywell-red font-medium">{target.attack_type}</span></p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        target.risk_score >= 80 
                          ? "bg-red-950 text-honeywell-red border border-red-500/20" 
                          : "bg-amber-950 text-amber-500 border border-amber-500/20"
                      }`}>
                        {target.risk_score}%
                      </span>
                      <ChevronRight className="h-4 w-4 text-honeywell-textMuted" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button 
            onClick={() => navigateToEntity("")}
            className="w-full text-center text-xs text-honeywell-textMuted hover:text-white font-medium hover:underline mt-4 flex items-center justify-center gap-1"
          >
            <span>Search all behavioral profiles</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Live System Telemetry stats */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-5">System Capabilities</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4.5 w-4.5 text-honeywell-red" />
                  <span className="text-xs font-medium text-white">Cold-Start Handling</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-500/20 uppercase">Fallback Active</span>
              </div>

              <div className="flex justify-between items-center p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4.5 w-4.5 text-honeywell-red" />
                  <span className="text-xs font-medium text-white">Concept Drift EMA</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-500/20 uppercase">Adaptive</span>
              </div>

              <div className="flex justify-between items-center p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30">
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4.5 w-4.5 text-honeywell-red" />
                  <span className="text-xs font-medium text-white">Analyst Feedback Loop</span>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-semibold border border-emerald-500/20 uppercase">Enabled</span>
              </div>
            </div>
          </div>
          <div className="text-[10px] text-honeywell-textMuted border-t border-honeywell-border pt-4 text-center">
            SentinelAI Agentic Security Verification v1.2.0
          </div>
        </div>
      </div>

      {/* REAL-TIME EVENT STREAM TABLE */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Live Activity Alert Log</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">Logs flagging deviations above threat boundaries</p>
          </div>
          <span className="px-2 py-0.5 text-[9px] bg-honeywell-highlight border border-honeywell-border rounded text-honeywell-textMuted animate-pulse">
            ● Real-Time Listening
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-honeywell-border text-honeywell-textMuted uppercase font-semibold text-[10px] tracking-wider">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Entity</th>
                <th className="pb-3">Target Resource</th>
                <th className="pb-3">Classification</th>
                <th className="pb-3">Risk Score</th>
                <th className="pb-3">Confidence</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-honeywell-border/40">
              {liveLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-honeywell-textMuted text-xs">
                    No anomalies found. Click "Simulate Live Event Stream" to inject events!
                  </td>
                </tr>
              ) : (
                liveLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const isHighRisk = log.risk_score >= 75;
                  
                  return (
                    <tr key={log.id} className="hover:bg-honeywell-highlight/30 transition-all">
                      <td className="py-3.5 text-honeywell-textMuted font-mono text-[11px]">{date.toLocaleTimeString()}</td>
                      <td className="py-3.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{log.entity_id}</span>
                          <span className="text-[9px] text-honeywell-textMuted uppercase">{log.entity_type}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-honeywell-textMuted font-mono text-[11px]">{log.log.resource_accessed}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isHighRisk ? "bg-red-950 text-honeywell-red" : "bg-amber-950 text-amber-500"
                        }`}>
                          {log.predicted_attack_type}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`font-bold font-mono ${isHighRisk ? "text-honeywell-red" : "text-amber-500"}`}>
                          {log.risk_score}%
                        </span>
                      </td>
                      <td className="py-3.5 text-honeywell-textMuted font-mono">{(log.confidence * 100).toFixed(0)}%</td>
                      <td className="py-3.5">
                        <button
                          onClick={() => navigateToAlert(log.id)}
                          className="px-2.5 py-1 bg-honeywell-highlight hover:bg-honeywell-red hover:text-white border border-honeywell-border rounded text-[10px] font-semibold text-white transition-all flex items-center gap-1"
                        >
                          <span>Investigate</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
