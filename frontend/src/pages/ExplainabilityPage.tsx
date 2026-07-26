import React, { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { 
  AlertTriangle, ShieldAlert, ShieldCheck, Clock, MapPin, 
  Laptop, HardDrive, Key, User, FileText, ChevronRight, RefreshCw, Send
} from "lucide-react";
import { API_BASE } from "../App";

interface AlertDetail {
  id: number;
  timestamp: string;
  entity_id: string;
  entity_type: string;
  risk_score: number;
  predicted_attack_type: string;
  confidence: number;
  reasons: string[];
  status: string;
  analyst_notes: string | null;
  analyst_feedback: string | null;
  feature_contributions: Record<string, number>;
  suggested_actions: string[];
  log: {
    source_ip: string;
    geo_location: string;
    resource_accessed: string;
    auth_method: string;
    session_duration: number;
    command_sequence: string;
    device_fingerprint: string;
    login_status: boolean;
  };
  baseline_comparison: {
    avg_session_duration: number;
    typical_hours: number[];
    known_ips: string[];
    known_locations: string[];
  };
}

interface ExplainabilityPageProps {
  alertId: number;
  navigateToEntity: (id: string) => void;
}

export default function ExplainabilityPage({ alertId, navigateToEntity }: ExplainabilityPageProps) {
  const [alert, setAlert] = useState<AlertDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>("");
  const [actionDone, setActionDone] = useState<string | null>(null);

  const fetchAlertDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/alerts/${alertId}`);
      if (res.ok) {
        const json = await res.json();
        setAlert(json);
        setNotes(json.analyst_notes || "");
        setActionDone(json.analyst_feedback);
      }
    } catch (e) {
      console.error("Error fetching alert details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlertDetail();
  }, [alertId]);

  const handleAction = async (feedbackType: string) => {
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alert_id: alertId,
          feedback: feedbackType,
          notes: notes
        })
      });
      if (res.ok) {
        setActionDone(feedbackType);
        fetchAlertDetail();
      }
    } catch (e) {
      console.error("Error sending analyst feedback", e);
    }
  };

  if (loading || !alert) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-honeywell-card w-64 rounded-lg"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-honeywell-card rounded-xl"></div>
          <div className="h-96 bg-honeywell-card rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Convert feature contributions dictionary to Recharts format
  const chartData = Object.entries(alert.feature_contributions)
    .map(([key, val]) => ({ name: key, contribution: val }))
    .sort((a, b) => b.contribution - a.contribution);

  const isCritical = alert.risk_score >= 80;

  return (
    <div className="space-y-6">
      {/* Header title */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">AI Explainability & Diagnostics</h1>
            <span className="px-2 py-0.5 bg-honeywell-highlight text-[10px] font-mono rounded text-honeywell-textMuted uppercase border border-honeywell-border">
              Alert ID: #ALT-{alert.id}
            </span>
          </div>
          <p className="text-xs text-honeywell-textMuted mt-0.5">SHAP-based neural features diagnostics and forensic reconstruction.</p>
        </div>
        <button
          onClick={() => navigateToEntity(alert.entity_id)}
          className="px-3 py-1.5 bg-honeywell-highlight hover:bg-honeywell-border text-white text-xs font-semibold rounded-lg border border-honeywell-border transition-all flex items-center gap-1.5"
        >
          <User className="h-4 w-4 text-honeywell-red" />
          <span>Investigate Entity Baseline</span>
        </button>
      </div>

      {/* CORE DETAILS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Score card */}
        <div className="glass-card p-5 rounded-xl flex items-center gap-5">
          <div className={`p-4 rounded-xl text-center shrink-0 border ${
            isCritical ? "bg-red-950/40 border-red-500/20 text-honeywell-red" : "bg-amber-950/40 border-amber-500/20 text-amber-500"
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block">Risk Index</span>
            <span className="text-3xl font-extrabold font-mono">{alert.risk_score}%</span>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white leading-tight">{alert.predicted_attack_type}</h3>
            <p className="text-[10px] text-honeywell-textMuted leading-relaxed">
              Neural model confidence: <span className="text-white font-semibold">{(alert.confidence * 100).toFixed(0)}%</span>. 
              {isCritical ? " Security Operations Center action highly recommended." : " Behavioral anomaly requires observation."}
            </p>
          </div>
        </div>

        {/* Indicators card */}
        <div className="glass-card p-5 rounded-xl lg:col-span-2 flex items-center justify-between">
          <div className="space-y-1.5 w-full">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Identified Anomaly Indicators</h4>
            <div className="flex flex-wrap gap-2">
              {alert.reasons.map((r, i) => (
                <div key={i} className="px-2.5 py-1 bg-honeywell-highlight/50 border border-honeywell-border text-[10px] rounded-lg text-white font-medium flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-honeywell-red rounded-full"></span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DIAGNOSTICS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SHAP Feature Contribution chart */}
        <div className="lg:col-span-2 glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Local Feature Attribution (SHAP weights)</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">Shows how much each behavioral metric deviated and increased the risk score.</p>
          </div>
          
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#232E45" horizontal={false} />
                <XAxis type="number" stroke="#94A3B8" fontSize={10} tickLine={false} />
                <YAxis dataKey="name" type="category" stroke="#94A3B8" fontSize={10} width={120} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: "rgba(35, 46, 69, 0.2)" }}
                  contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "11px" }}
                />
                <Bar dataKey="contribution" fill="#EE3124" radius={[0, 4, 4, 0]} name="Score Contribution">
                  {chartData.map((entry, index) => {
                    // Highlight highest contributor in Honeywell Red
                    const fill = index === 0 ? "#EE3124" : index === 1 ? "#F59E0B" : "#3B82F6";
                    return <Cell key={`cell-${index}`} fill={fill} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Remediations checklist */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">Recommended Response</h3>
            <div className="space-y-3.5">
              {alert.suggested_actions.map((act, i) => (
                <div key={i} className="flex gap-2.5 text-xs text-honeywell-textMuted">
                  <div className="h-5 w-5 rounded bg-honeywell-highlight flex items-center justify-center shrink-0 border border-honeywell-border font-bold text-[10px] text-white">
                    {i + 1}
                  </div>
                  <p className="leading-normal">{act}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[10px] text-honeywell-textMuted border-t border-honeywell-border pt-4 mt-4">
            * Retrain settings will incorporate resolution feedback to adjust models.
          </div>
        </div>
      </div>

      {/* FORENSICS CONTRAST SIDE-BY-SIDE */}
      <div className="glass-card p-6 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Forensic Comparison: Session vs. Baseline Profile</h3>
          <p className="text-[10px] text-honeywell-textMuted mt-0.5">Contrast session characteristics directly with the user's historical baseline.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {/* Geo location */}
          <div className="p-4 bg-honeywell-highlight/40 border border-honeywell-border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <MapPin className="h-4 w-4 text-honeywell-red" />
              <span>Location Context</span>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Access Log:</span>
                <span className="font-semibold text-white">{alert.log.geo_location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Baseline:</span>
                <span className="text-honeywell-textMuted truncate font-medium max-w-[120px]" title={alert.baseline_comparison.known_locations.join(", ")}>
                  {alert.baseline_comparison.known_locations.join(", ") || "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Access Timing */}
          <div className="p-4 bg-honeywell-highlight/40 border border-honeywell-border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Clock className="h-4 w-4 text-honeywell-red" />
              <span>Timing (Local Hour)</span>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Access Log:</span>
                <span className="font-semibold text-white">{new Date(alert.timestamp).getHours()}:00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Baseline hours:</span>
                <span className="text-honeywell-textMuted font-medium truncate max-w-[120px]">
                  {alert.baseline_comparison.typical_hours.length === 0 
                    ? "None" 
                    : `${Math.min(...alert.baseline_comparison.typical_hours)}-${Math.max(...alert.baseline_comparison.typical_hours)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Device Fingerprint */}
          <div className="p-4 bg-honeywell-highlight/40 border border-honeywell-border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Laptop className="h-4 w-4 text-honeywell-red" />
              <span>Device Fingerprint</span>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex flex-col">
                <span className="text-honeywell-textMuted">Access Log:</span>
                <span className="font-semibold text-white truncate text-[10px] mt-0.5" title={alert.log.device_fingerprint}>
                  {alert.log.device_fingerprint}
                </span>
              </div>
              <div className="flex flex-col border-t border-honeywell-border/30 pt-1.5">
                <span className="text-honeywell-textMuted">Baseline Devices:</span>
                <span className="text-honeywell-textMuted text-[10px] truncate mt-0.5" title={alert.baseline_comparison.known_ips.join(", ")}>
                  {alert.baseline_comparison.known_ips.join(", ") || "None"}
                </span>
              </div>
            </div>
          </div>

          {/* Session Duration */}
          <div className="p-4 bg-honeywell-highlight/40 border border-honeywell-border rounded-lg space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <HardDrive className="h-4 w-4 text-honeywell-red" />
              <span>Duration Context</span>
            </div>
            <div className="text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Access Log:</span>
                <span className="font-semibold text-white">{alert.log.session_duration} mins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-honeywell-textMuted">Baseline Average:</span>
                <span className="text-honeywell-textMuted font-medium">{alert.baseline_comparison.avg_session_duration.toFixed(1)} mins</span>
              </div>
            </div>
          </div>
        </div>

        {/* Command sequence block */}
        <div className="p-4 bg-honeywell-highlight/20 border border-honeywell-border rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <FileText className="h-4.5 w-4.5 text-honeywell-red" />
            <span>Command History Details</span>
          </div>
          <div className="font-mono text-[11px] bg-honeywell-dark border border-honeywell-border p-2.5 rounded text-white overflow-x-auto whitespace-pre-wrap max-h-24">
            {alert.log.command_sequence || "[No commands executed during auth]"}
          </div>
        </div>
      </div>

      {/* ANALYST REMEDIATION WORKBENCH */}
      <div className="glass-card p-6 rounded-xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Resolution Notes form */}
        <div className="lg:col-span-2 space-y-3">
          <label className="text-xs font-bold text-white uppercase tracking-wider block">Analyst Resolution Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={actionDone !== null && actionDone !== ""}
            placeholder="Write logs investigation notes, evidence found, and reason for resolution actions..."
            className="w-full h-28 bg-honeywell-dark border border-honeywell-border focus:border-honeywell-red rounded-lg p-3 text-xs text-white focus:outline-none resize-none disabled:opacity-50"
          ></textarea>
        </div>

        {/* Resolution buttons */}
        <div className="flex flex-col justify-center space-y-3 p-2 bg-honeywell-highlight/30 rounded-lg border border-honeywell-border">
          <h4 className="text-[10px] font-bold text-white uppercase tracking-wider px-2">Remediation Resolution</h4>
          
          {actionDone ? (
            <div className="p-3 text-center space-y-2 animate-fadeIn">
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-block ${
                actionDone === "Accepted" || actionDone === "Resolved Threat"
                  ? "bg-red-950 text-honeywell-red border-red-500/20"
                  : "bg-emerald-950 text-emerald-400 border-emerald-500/20"
              }`}>
                {actionDone === "Accepted" ? "CONFIRMED THREAT" : actionDone === "False Positive" ? "FALSE ALARM (SAFE)" : actionDone}
              </span>
              <p className="text-[10px] text-honeywell-textMuted">Resolution stored. Feedback has been loaded into models cache.</p>
            </div>
          ) : (
            <div className="space-y-2 px-2 pb-2">
              <button
                onClick={() => handleAction("False Positive")}
                className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition-all"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Mark Safe (False Positive)</span>
              </button>
              
              <button
                onClick={() => handleAction("Accepted")}
                className="w-full flex items-center justify-center gap-2 py-2 bg-honeywell-red hover:bg-honeywell-red/90 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-honeywell-red/10"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Confirm Security Threat</span>
              </button>

              <button
                onClick={() => handleAction("Rejected")}
                className="w-full py-1.5 bg-honeywell-highlight hover:bg-honeywell-border text-honeywell-textMuted hover:text-white text-[10px] font-medium rounded-md transition-all border border-honeywell-border"
              >
                Dismiss / Ignore Notification
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
