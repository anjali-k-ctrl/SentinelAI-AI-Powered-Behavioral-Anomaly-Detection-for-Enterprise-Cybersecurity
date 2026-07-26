import React, { useState, useEffect } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { 
  Search, User, Cpu, MapPin, Clock, ShieldAlert, CheckCircle, RefreshCw, Key, Laptop, HardDrive
} from "lucide-react";
import { API_BASE } from "../App";

interface ProfileDetails {
  entity_id: string;
  entity_type: string;
  department: string;
  baseline: {
    avg_session_duration: number;
    std_session_duration: number;
    active_hours: number[];
    known_ips: Record<string, number>;
    known_locations: Record<string, number>;
    known_devices: string[];
    known_resources: Record<string, number>;
    known_auth_methods: string[];
  };
  risk_trend: Array<{ time: string; risk_score: number }>;
  history: Array<{
    timestamp: string;
    source_ip: string;
    geo_location: string;
    resource: string;
    duration: number;
    login_status: boolean;
    label: string;
  }>;
  alerts: Array<{
    id: number;
    timestamp: string;
    predicted_attack_type: string;
    risk_score: number;
    status: string;
  }>;
}

interface EntityProfileProps {
  entityId: string | null;
  navigateToAlert: (id: number) => void;
}

export default function EntityProfile({ entityId, navigateToAlert }: EntityProfileProps) {
  const [searchId, setSearchId] = useState<string>("");
  const [profile, setProfile] = useState<ProfileDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // List of sample entities to help analyst explore
  const [suggestedEntities, setSuggestedEntities] = useState<string[]>([
    "USR-1000", "USR-1001", "USR-1002", "USR-1003", "USR-1004", "SVC-1001"
  ]);

  const loadProfile = async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/entity/${id}`);
      if (res.ok) {
        const json = await res.json();
        setProfile(json);
        setSearchId(id);
      } else {
        setError(`Entity ID "${id}" not found in database. Verify spelling.`);
        setProfile(null);
      }
    } catch (e) {
      setError("Failed to fetch profile due to server connection issue.");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (entityId) {
      loadProfile(entityId);
    }
  }, [entityId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      loadProfile(searchId.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Entity Profile Directory</h1>
        <p className="text-xs text-honeywell-textMuted mt-0.5">Explore standard user/device behavioral baselines and active risk records.</p>
      </div>

      {/* SEARCH AND EXPLORER PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Search Bar */}
        <div className="lg:col-span-2 glass-card p-5 rounded-xl space-y-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-honeywell-textMuted" />
              <input
                type="text"
                placeholder="Search by User or Device ID (e.g. USR-1001, SVC-1005)..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                className="w-full bg-honeywell-dark border border-honeywell-border focus:border-honeywell-red rounded-lg pl-10 pr-4 py-2 text-xs text-white focus:outline-none"
              />
            </div>
            <button 
              type="submit"
              className="px-4 py-2 bg-honeywell-red text-white text-xs font-semibold rounded-lg hover:bg-honeywell-red/90 transition-all shadow-md shadow-honeywell-red/10"
            >
              Fetch Profile
            </button>
          </form>

          {/* Suggested Entities Tags */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-honeywell-textMuted font-medium">Quick Directory:</span>
            {suggestedEntities.map((id) => (
              <button
                key={id}
                onClick={() => loadProfile(id)}
                className="px-2.5 py-1 bg-honeywell-highlight hover:bg-honeywell-border border border-honeywell-border hover:border-honeywell-red/30 rounded-md text-white text-[10px] font-semibold transition-all"
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Help Card */}
        <div className="glass-card p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Cold-Start Directory</h4>
            <p className="text-[11px] text-honeywell-textMuted leading-relaxed">
              If an entity has no prior activity, the system generates department-wide reference baselines to evaluate initial behaviors.
            </p>
          </div>
          <Cpu className="h-10 w-10 text-honeywell-red shrink-0" />
        </div>
      </div>

      {/* SEARCH STATE MESSAGES */}
      {loading && (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="h-8 w-8 text-honeywell-red animate-spin" />
          <span className="text-xs text-honeywell-textMuted font-medium">Analyzing user logs database...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/20 text-red-200 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      {/* PROFILE DETAILS GRID */}
      {profile && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          
          {/* BEHAVIORAL BASELINE DETAILS */}
          <div className="glass-card p-6 rounded-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-honeywell-border pb-4">
              <div className="p-2.5 bg-honeywell-highlight rounded-xl border border-honeywell-border text-honeywell-red">
                {profile.entity_type === "Edge Device" ? <Cpu className="h-6 w-6" /> : <User className="h-6 w-6" />}
              </div>
              <div>
                <h3 className="font-bold text-base text-white">{profile.entity_id}</h3>
                <div className="flex items-center gap-2 text-[10px] text-honeywell-textMuted mt-0.5">
                  <span className="uppercase font-semibold text-honeywell-red">{profile.entity_type}</span>
                  <span>•</span>
                  <span>{profile.department} Dept</span>
                </div>
              </div>
            </div>

            {/* Profile Baselines */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Learned Baseline Profile</h4>
              
              <div className="space-y-3 text-xs">
                {/* Active Hours */}
                <div className="flex items-start gap-2.5">
                  <Clock className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Standard Working Hours</span>
                    <p className="text-white font-medium mt-0.5">
                      {profile.baseline.active_hours.length === 0 
                        ? "Not Calculated" 
                        : `${Math.min(...profile.baseline.active_hours)}:00 - ${Math.max(...profile.baseline.active_hours)}:59`}
                    </p>
                  </div>
                </div>

                {/* Session Duration */}
                <div className="flex items-start gap-2.5">
                  <HardDrive className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Average Session Duration</span>
                    <p className="text-white font-medium mt-0.5">
                      {profile.baseline.avg_session_duration.toFixed(1)} mins (±{profile.baseline.std_session_duration.toFixed(1)}m std)
                    </p>
                  </div>
                </div>

                {/* Known Geolocations */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div className="w-full">
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Familiar Geolocations</span>
                    <div className="grid grid-cols-2 gap-1 mt-1 text-[11px]">
                      {Object.entries(profile.baseline.known_locations).map(([loc, cnt]) => (
                        <div key={loc} className="flex justify-between bg-honeywell-highlight/50 px-2 py-0.5 rounded border border-honeywell-border text-white">
                          <span className="truncate pr-1">{loc}</span>
                          <span className="font-bold text-honeywell-textMuted">x{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Known IPs */}
                <div className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div className="w-full">
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Authorized IP Subnets</span>
                    <div className="grid grid-cols-1 gap-1 mt-1 text-[11px] font-mono">
                      {Object.entries(profile.baseline.known_ips).map(([ip, cnt]) => (
                        <div key={ip} className="flex justify-between bg-honeywell-highlight/50 px-2 py-0.5 rounded border border-honeywell-border text-white">
                          <span>{ip}</span>
                          <span className="font-bold text-honeywell-textMuted">x{cnt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Auth Methods */}
                <div className="flex items-start gap-2.5">
                  <Key className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Authentication Methods</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {profile.baseline.known_auth_methods.map((method) => (
                        <span key={method} className="px-1.5 py-0.2 bg-honeywell-highlight text-[9px] rounded text-white border border-honeywell-border">
                          {method}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Known Devices */}
                <div className="flex items-start gap-2.5">
                  <Laptop className="h-4 w-4 text-honeywell-red shrink-0 mt-0.5" />
                  <div className="w-full">
                    <span className="text-[10px] text-honeywell-textMuted uppercase font-semibold">Trusted Devices</span>
                    <div className="space-y-1 mt-1">
                      {profile.baseline.known_devices.map((device) => (
                        <div key={device} className="p-1 bg-honeywell-highlight/30 border border-honeywell-border/60 rounded text-[10px] text-honeywell-textMuted truncate font-mono">
                          {device}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HISTORICAL TRENDS & RECENT ALERTS */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Risk Trend Chart */}
            <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Historical Risk Profile</h3>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={profile.risk_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#232E45" vertical={false} />
                    <XAxis dataKey="time" stroke="#94A3B8" fontSize={9} tickLine={false} />
                    <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "11px" }}
                    />
                    <Line type="monotone" dataKey="risk_score" name="Risk Score (%)" stroke="#EE3124" strokeWidth={2} dot={{ fill: "#EE3124", r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Profile Alert List */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Historical Alerts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-honeywell-border text-honeywell-textMuted uppercase font-semibold text-[10px] tracking-wider pb-2">
                      <th className="pb-2">Alert ID</th>
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Threat Vector</th>
                      <th className="pb-2">Risk</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-right">Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-honeywell-border/30">
                    {profile.alerts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-honeywell-textMuted text-[11px]">
                          No historical threat alerts recorded for this identity.
                        </td>
                      </tr>
                    ) : (
                      profile.alerts.map((a) => {
                        const date = new Date(a.timestamp);
                        return (
                          <tr key={a.id} className="hover:bg-honeywell-highlight/20 transition-all">
                            <td className="py-2.5 font-mono text-[10px] text-white">#ALT-{a.id}</td>
                            <td className="py-2.5 text-honeywell-textMuted text-[10px]">{date.toLocaleDateString()}</td>
                            <td className="py-2.5 font-semibold text-white">{a.predicted_attack_type}</td>
                            <td className="py-2.5 font-mono font-bold text-honeywell-red">{a.risk_score}%</td>
                            <td className="py-2.5">
                              <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold border ${
                                a.status === "Pending" 
                                  ? "bg-amber-950 text-amber-500 border-amber-500/20" 
                                  : a.status === "Resolved Threat"
                                    ? "bg-red-950 text-honeywell-red border-red-500/20"
                                    : "bg-emerald-950 text-emerald-400 border-emerald-500/20"
                              }`}>
                                {a.status}
                              </span>
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => navigateToAlert(a.id)}
                                className="text-[10px] text-honeywell-textMuted hover:text-white font-semibold underline"
                              >
                                View XAI
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

          {/* FULL RECENT ACCESS SESSION LOG */}
          <div className="lg:col-span-3 glass-card p-6 rounded-xl">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Recent Access Logs (Audit History)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-honeywell-border text-honeywell-textMuted uppercase font-semibold text-[10px] tracking-wider pb-2">
                    <th className="pb-2">Timestamp</th>
                    <th className="pb-2">Source IP</th>
                    <th className="pb-2">Location</th>
                    <th className="pb-2">Resource</th>
                    <th className="pb-2">Duration</th>
                    <th className="pb-2">State</th>
                    <th className="pb-2">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-honeywell-border/30">
                  {profile.history.map((log, idx) => {
                    const date = new Date(log.timestamp);
                    const isNormal = log.label === "Normal";
                    
                    return (
                      <tr key={idx} className="hover:bg-honeywell-highlight/20 transition-all">
                        <td className="py-2.5 font-mono text-[10px] text-honeywell-textMuted">{date.toLocaleString()}</td>
                        <td className="py-2.5 font-mono text-white">{log.source_ip}</td>
                        <td className="py-2.5 text-honeywell-textMuted">{log.geo_location}</td>
                        <td className="py-2.5 font-mono text-white text-[11px]">{log.resource}</td>
                        <td className="py-2.5 text-honeywell-textMuted font-mono">{log.duration.toFixed(1)}m</td>
                        <td className="py-2.5">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                            log.login_status ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-honeywell-red"
                          }`}>
                            {log.login_status ? "Success" : "Failed"}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            isNormal ? "bg-honeywell-highlight text-honeywell-textMuted" : "bg-red-950 text-honeywell-red"
                          }`}>
                            {log.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
