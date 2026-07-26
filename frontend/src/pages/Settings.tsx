import React, { useState, useEffect } from "react";
import { 
  Settings as SettingsIcon, Sliders, Shield, Save, RefreshCw, Info, AlertTriangle
} from "lucide-react";
import { API_BASE } from "../App";
import type { SystemSettings } from "../App";

interface SettingsProps {
  settings: SystemSettings;
  onSettingsUpdate: () => void;
}

export default function Settings({ settings, onSettingsUpdate }: SettingsProps) {
  const [anomalyThreshold, setAnomalyThreshold] = useState<number>(settings.anomaly_threshold);
  const [riskThreshold, setRiskThreshold] = useState<number>(settings.risk_threshold);
  const [retrainingInterval, setRetrainingInterval] = useState<number>(settings.retraining_interval);
  const [conceptDriftWindow, setConceptDriftWindow] = useState<number>(settings.concept_drift_window);
  const [syntheticAttackRatio, setSyntheticAttackRatio] = useState<number>(settings.synthetic_attack_ratio);
  
  // Anomaly Weights
  const [geoWeight, setGeoWeight] = useState<number>(settings.weights.geo_anomaly);
  const [devWeight, setDevWeight] = useState<number>(settings.weights.device_anomaly);
  const [behaviorWeight, setBehaviorWeight] = useState<number>(settings.weights.behavior_anomaly);
  const [cmdWeight, setCmdWeight] = useState<number>(settings.weights.command_anomaly);
  const [authWeight, setAuthWeight] = useState<number>(settings.weights.auth_anomaly);

  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Keep state updated if parent settings load asynchronously
  useEffect(() => {
    setAnomalyThreshold(settings.anomaly_threshold);
    setRiskThreshold(settings.risk_threshold);
    setRetrainingInterval(settings.retraining_interval);
    setConceptDriftWindow(settings.concept_drift_window);
    setSyntheticAttackRatio(settings.synthetic_attack_ratio);
    
    setGeoWeight(settings.weights.geo_anomaly);
    setDevWeight(settings.weights.device_anomaly);
    setBehaviorWeight(settings.weights.behavior_anomaly);
    setCmdWeight(settings.weights.command_anomaly);
    setAuthWeight(settings.weights.auth_anomaly);
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);

    // Calculate sum of weights to warn user if they don't normalize well
    const sum = geoWeight + devWeight + behaviorWeight + cmdWeight + authWeight;
    // Normalize weights
    const factor = sum > 0 ? 1 / sum : 1;
    const normalizedWeights = {
      geo_anomaly: Number((geoWeight * factor).toFixed(3)),
      device_anomaly: Number((devWeight * factor).toFixed(3)),
      behavior_anomaly: Number((behaviorWeight * factor).toFixed(3)),
      command_anomaly: Number((cmdWeight * factor).toFixed(3)),
      auth_anomaly: Number((authWeight * factor).toFixed(3))
    };

    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anomaly_threshold: anomalyThreshold,
          risk_threshold: riskThreshold,
          retraining_interval: retrainingInterval,
          concept_drift_window: conceptDriftWindow,
          synthetic_attack_ratio: syntheticAttackRatio,
          weights: normalizedWeights
        })
      });

      if (res.ok) {
        setSaveMessage({ text: "System settings successfully updated. Changes active on subsequent prediction logs.", type: "success" });
        onSettingsUpdate();
        
        // Sync local inputs to normalized values
        setGeoWeight(normalizedWeights.geo_anomaly);
        setDevWeight(normalizedWeights.device_anomaly);
        setBehaviorWeight(normalizedWeights.behavior_anomaly);
        setCmdWeight(normalizedWeights.command_anomaly);
        setAuthWeight(normalizedWeights.auth_anomaly);
      } else {
        setSaveMessage({ text: "Failed to save settings. Check API server connection.", type: "error" });
      }
    } catch (err) {
      setSaveMessage({ text: "Failed to communicate with configuration backend.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const totalWeights = geoWeight + devWeight + behaviorWeight + cmdWeight + authWeight;
  const isWeightsBalanced = Math.abs(totalWeights - 1.0) < 0.01;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Admin System Configuration</h1>
        <p className="text-xs text-honeywell-textMuted mt-0.5">Customize neural sensitivities, anomaly scores weighting, and drift update speeds.</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* THREAT PIPELINE SENSITIVITY */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="glass-card p-6 rounded-xl space-y-5">
            <div className="flex items-center gap-3 border-b border-honeywell-border pb-4">
              <Sliders className="h-5 w-5 text-honeywell-red shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Detection Sensitivity Parameters</h3>
                <p className="text-[10px] text-honeywell-textMuted">Tweak trigger ratios for outlier and LSTM classification pipelines.</p>
              </div>
            </div>

            {saveMessage && (
              <div className={`p-3.5 rounded-lg text-xs font-medium border ${
                saveMessage.type === "success" 
                  ? "bg-emerald-950/40 border-emerald-500/20 text-emerald-300" 
                  : "bg-red-950/40 border-red-500/20 text-red-300"
              }`}>
                {saveMessage.text}
              </div>
            )}

            <div className="space-y-5 text-xs">
              
              {/* Anomaly Threshold Slider */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Unsupervised Anomaly Threshold (Isolation Forest)</span>
                  <span className="text-honeywell-red font-mono font-bold">{(anomalyThreshold * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.40"
                  step="0.01"
                  value={anomalyThreshold}
                  onChange={(e) => setAnomalyThreshold(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer"
                />
                <p className="text-[9px] text-honeywell-textMuted">Percentage of historical sessions isolated as baseline outliers. Higher values trigger more warnings.</p>
              </div>

              {/* Alert Risk Score Trigger */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Alert Risk Threshold (Risk Trigger Boundary)</span>
                  <span className="text-honeywell-red font-mono font-bold">{riskThreshold}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="90"
                  step="1"
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer"
                />
                <p className="text-[9px] text-honeywell-textMuted">The cumulative weighted risk value required to trigger a warning notification in the queue.</p>
              </div>

              {/* Concept drift slider */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Concept Drift Rolling Window (Temporal Decay)</span>
                  <span className="text-honeywell-red font-mono font-bold">{conceptDriftWindow} Days</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="90"
                  step="1"
                  value={conceptDriftWindow}
                  onChange={(e) => setConceptDriftWindow(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer"
                />
                <p className="text-[9px] text-honeywell-textMuted">How quickly older logs lose influence on the behavioral baseline profiles (EMA window).</p>
              </div>

              {/* Retraining interval */}
              <div className="space-y-2">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Autonomic Retraining Ingestion Interval</span>
                  <span className="text-honeywell-red font-mono font-bold">{retrainingInterval} Logs</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="50"
                  value={retrainingInterval}
                  onChange={(e) => setRetrainingInterval(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer"
                />
                <p className="text-[9px] text-honeywell-textMuted">The count of new user access sessions required to trigger automatic background pipeline updates.</p>
              </div>

            </div>
          </div>
        </div>

        {/* ANOMALY WEIGHTS PANEL */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-honeywell-border pb-3">
              <Shield className="h-5 w-5 text-honeywell-red shrink-0" />
              <div>
                <h3 className="font-semibold text-sm text-white uppercase tracking-wider">Metric Risk Weights</h3>
                <p className="text-[10px] text-honeywell-textMuted">Weigh indicators when building the risk score.</p>
              </div>
            </div>

            {!isWeightsBalanced && (
              <div className="p-2.5 bg-amber-950/30 border border-amber-500/20 text-amber-500 rounded-lg text-[10px] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Weights sum to {(totalWeights * 100).toFixed(0)}%. They will be normalized to 100% upon saving.</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Geo weight */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Geolocation Deviation</span>
                  <span className="text-honeywell-textMuted">{(geoWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={geoWeight}
                  onChange={(e) => setGeoWeight(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer h-1"
                />
              </div>

              {/* Device weight */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Device Fingerprint Match</span>
                  <span className="text-honeywell-textMuted">{(devWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={devWeight}
                  onChange={(e) => setDevWeight(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer h-1"
                />
              </div>

              {/* Behavior weight */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Behavior (Working Hours / Session)</span>
                  <span className="text-honeywell-textMuted">{(behaviorWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={behaviorWeight}
                  onChange={(e) => setBehaviorWeight(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer h-1"
                />
              </div>

              {/* Command weight */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Command Sequence Novelty</span>
                  <span className="text-honeywell-textMuted">{(cmdWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.5"
                  step="0.05"
                  value={cmdWeight}
                  onChange={(e) => setCmdWeight(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer h-1"
                />
              </div>

              {/* Auth weight */}
              <div className="space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-white">Authentication Method</span>
                  <span className="text-honeywell-textMuted">{(authWeight * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="0.3"
                  step="0.05"
                  value={authWeight}
                  onChange={(e) => setAuthWeight(Number(e.target.value))}
                  className="w-full accent-honeywell-red cursor-pointer h-1"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-honeywell-red hover:bg-honeywell-red/90 text-white font-bold text-xs rounded-lg transition-all shadow-md shadow-honeywell-red/10 disabled:opacity-40"
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Settings Changes</span>
          </button>
        </div>

      </form>
    </div>
  );
}
