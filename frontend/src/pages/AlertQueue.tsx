import React, { useState, useEffect } from "react";
import { 
  AlertOctagon, CheckCircle2, ShieldAlert, Search, Filter, ShieldCheck, 
  ChevronRight, RefreshCw, XCircle, FileText
} from "lucide-react";
import { API_BASE } from "../App";

interface AlertItem {
  id: number;
  timestamp: string;
  entity_id: string;
  entity_type: string;
  risk_score: number;
  predicted_attack_type: string;
  confidence: number;
  reasons: string[];
  status: string;
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
}

interface AlertQueueProps {
  navigateToAlert: (id: number) => void;
  navigateToEntity: (id: string) => void;
}

export default function AlertQueue({ navigateToAlert, navigateToEntity }: AlertQueueProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Filtering and Searching
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("Pending");
  const [attackFilter, setAttackFilter] = useState<string>("All");

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE}/alerts?limit=100`;
      if (statusFilter !== "All") {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts);
        setTotal(json.total);
      }
    } catch (e) {
      console.error("Error fetching alerts list", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter]);

  // Handle immediate feedback actions (Mark Safe / Mark Threat)
  const handleFeedback = async (alertId: number, feedback: string, notes: string = "") => {
    try {
      const res = await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_id: alertId, feedback, notes })
      });
      if (res.ok) {
        // Refresh local cache
        fetchAlerts();
      }
    } catch (e) {
      console.error("Failed to submit feedback", e);
    }
  };

  // Filter lists based on search term and category selection
  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch = 
      a.entity_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.log.source_ip.includes(searchTerm) ||
      a.log.resource_accessed.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesAttack = 
      attackFilter === "All" || 
      a.predicted_attack_type === attackFilter;
      
    return matchesSearch && matchesAttack;
  });

  const attackTypes = [
    "All", "Brute Force", "Credential Stuffing", "Impossible Travel", 
    "Lateral Movement", "Device Spoofing", "Low and Slow Exfiltration", "Insider Drift"
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Alert Queue</h1>
          <p className="text-xs text-honeywell-textMuted mt-0.5">Manage and resolve behavioral anomalies classified by SentinelAI.</p>
        </div>
        <button 
          onClick={fetchAlerts}
          className="p-2 bg-honeywell-highlight hover:bg-honeywell-border text-honeywell-textMuted hover:text-white rounded-lg border border-honeywell-border transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-honeywell-card border border-honeywell-border rounded-xl">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-honeywell-textMuted" />
          <input
            type="text"
            placeholder="Search Entity, IP, Resource..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-honeywell-dark border border-honeywell-border focus:border-honeywell-red rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-honeywell-textMuted font-medium whitespace-nowrap">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-honeywell-dark border border-honeywell-border focus:border-honeywell-red rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
          >
            <option value="Pending">Pending Audit</option>
            <option value="Investigating">Under Investigation</option>
            <option value="Resolved Threat">Resolved (Confirmed Threat)</option>
            <option value="Resolved Safe">Resolved (False Alarm)</option>
            <option value="All">Show All Logs</option>
          </select>
        </div>

        {/* Attack Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-honeywell-textMuted font-medium whitespace-nowrap">Threat Class:</span>
          <select
            value={attackFilter}
            onChange={(e) => setAttackFilter(e.target.value)}
            className="w-full bg-honeywell-dark border border-honeywell-border focus:border-honeywell-red rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
          >
            {attackTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Aggregate Info */}
        <div className="flex items-center justify-end text-xs text-honeywell-textMuted pr-2 font-medium">
          Showing {filteredAlerts.length} of {total} alerts
        </div>
      </div>

      {/* ALERTS QUEUE GRID TABLE */}
      <div className="glass-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="h-8 w-8 text-honeywell-red animate-spin" />
            <span className="text-xs text-honeywell-textMuted font-medium">Querying database records...</span>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-honeywell-textMuted">
            <ShieldCheck className="h-12 w-12 text-emerald-500" />
            <div className="text-center">
              <h3 className="font-bold text-white text-sm">Clear Alert Queue</h3>
              <p className="text-xs mt-1">No alerts found matching selected filters.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-honeywell-border text-honeywell-textMuted uppercase font-semibold text-[10px] tracking-wider bg-honeywell-highlight/30">
                  <th className="py-3 px-6">Severity</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Entity User</th>
                  <th className="py-3 px-4">IP & Location</th>
                  <th className="py-3 px-4">Threat Vectors</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Audit Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-honeywell-border/30">
                {filteredAlerts.map((alert) => {
                  const date = new Date(alert.timestamp);
                  const isCritical = alert.risk_score >= 80;
                  
                  return (
                    <tr key={alert.id} className="hover:bg-honeywell-highlight/25 transition-all duration-150">
                      {/* Severity badge */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-7 rounded-full shrink-0 ${
                            isCritical ? "bg-honeywell-red" : alert.risk_score >= 50 ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                          <span className={`text-[11px] font-bold font-mono ${
                            isCritical ? "text-honeywell-red" : alert.risk_score >= 50 ? "text-amber-500" : "text-blue-400"
                          }`}>
                            {alert.risk_score}%
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-4 font-mono text-[10px] text-honeywell-textMuted">
                        <div>{date.toLocaleDateString()}</div>
                        <div className="mt-0.5">{date.toLocaleTimeString()}</div>
                      </td>

                      {/* Entity */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <button
                            onClick={() => navigateToEntity(alert.entity_id)}
                            className="font-bold text-white text-left hover:underline hover:text-honeywell-red focus:outline-none"
                          >
                            {alert.entity_id}
                          </button>
                          <span className="text-[9px] text-honeywell-textMuted uppercase mt-0.5">{alert.entity_type}</span>
                        </div>
                      </td>

                      {/* IP and Geo */}
                      <td className="py-4 px-4 text-honeywell-textMuted">
                        <div className="font-mono text-[11px]">{alert.log.source_ip}</div>
                        <div className="text-[10px] mt-0.5">{alert.log.geo_location}</div>
                      </td>

                      {/* Threat Details */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-white">{alert.predicted_attack_type}</span>
                          <span className="text-[10px] text-honeywell-textMuted line-clamp-1 mt-0.5">
                            {alert.reasons[0] || "Suspicious behavior"}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border ${
                          alert.status === "Pending" 
                            ? "bg-amber-950/20 text-amber-500 border-amber-500/20" 
                            : alert.status === "Investigating"
                              ? "bg-blue-950/20 text-blue-400 border-blue-500/20"
                              : alert.status === "Resolved Threat"
                                ? "bg-red-950/20 text-honeywell-red border-red-500/20"
                                : "bg-emerald-950/20 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {alert.status}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          {alert.status === "Pending" && (
                            <>
                              <button
                                title="Mark Safe (False Positive)"
                                onClick={() => handleFeedback(alert.id, "False Positive", "Reviewed by quick action.")}
                                className="p-1.5 hover:bg-emerald-950/50 text-honeywell-textMuted hover:text-emerald-500 rounded border border-honeywell-border hover:border-emerald-500/20 transition-all"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Confirm Threat"
                                onClick={() => handleFeedback(alert.id, "Accepted", "Confirmed threat vector.")}
                                className="p-1.5 hover:bg-red-950/50 text-honeywell-textMuted hover:text-honeywell-red rounded border border-honeywell-border hover:border-red-500/20 transition-all"
                              >
                                <ShieldAlert className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => navigateToAlert(alert.id)}
                            className="px-2.5 py-1.5 bg-honeywell-highlight hover:bg-honeywell-red hover:text-white rounded text-[10px] font-semibold text-white transition-all flex items-center gap-1 border border-honeywell-border hover:border-honeywell-red"
                          >
                            <span>XAI Audit</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
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
