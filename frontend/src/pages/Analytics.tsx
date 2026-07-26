import React, { useState, useEffect } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line
} from "recharts";
import { 
  TrendingUp, Activity, CheckCircle, ShieldAlert, Cpu, BarChart2, RefreshCw
} from "lucide-react";
import { API_BASE } from "../App";

interface ModelMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  accuracy: number;
  confusion_matrix: {
    labels: string[];
    matrix: number[][];
  };
  roc_curve: {
    fpr: number[];
    tpr: number[];
  };
}

export default function Analytics() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRetraining, setIsRetraining] = useState<boolean>(false);

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      if (res.ok) {
        const json = await res.json();
        setMetrics(json);
      }
    } catch (e) {
      console.error("Error fetching metrics", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRetrain = async () => {
    setIsRetraining(true);
    try {
      const res = await fetch(`${API_BASE}/train`, { method: "POST" });
      if (res.ok) {
        // Poll status in App or alert user. Just let them know training started.
        alert("Training model pipeline in background...");
      }
    } catch (e) {
      console.error("Failed to train", e);
    } finally {
      setIsRetraining(false);
    }
  };

  if (loading || !metrics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-honeywell-card w-48 rounded-lg"></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-80 bg-honeywell-card rounded-xl"></div>
          <div className="h-80 bg-honeywell-card rounded-xl"></div>
        </div>
      </div>
    );
  }

  // Prep ROC Curve data for charting
  const rocData = metrics.roc_curve.fpr.map((fpr, i) => ({
    fpr: fpr.toFixed(2),
    tpr: metrics.roc_curve.tpr[i].toFixed(2),
    baseline: fpr.toFixed(2)
  }));

  // Confusion Matrix rendering details
  const labels = metrics.confusion_matrix.labels;
  const matrix = metrics.confusion_matrix.matrix;
  
  // Find max value in matrix to scale backgrounds
  const maxVal = Math.max(...matrix.map((row) => Math.max(...row))) || 1;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">AI Pipeline Analytics</h1>
          <p className="text-xs text-honeywell-textMuted mt-0.5">Evaluate detection metrics, classification reports, and neural sequence boundaries.</p>
        </div>
        <button
          onClick={handleRetrain}
          disabled={isRetraining}
          className="px-4 py-2 bg-honeywell-red disabled:bg-honeywell-border hover:bg-honeywell-red/90 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-honeywell-red/10"
        >
          <RefreshCw className={`h-4 w-4 ${isRetraining ? "animate-spin" : ""}`} />
          <span>Retrain Pipeline</span>
        </button>
      </div>

      {/* CORE PERFORMANCE SCORES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Accuracy Index", val: metrics.accuracy, desc: "Total predictions matching labels" },
          { label: "Precision Rate", val: metrics.precision, desc: "Ratio of true threats identified" },
          { label: "Recall Rate", val: metrics.recall, desc: "Ratio of total threats captured" },
          { label: "F1 Quality Score", val: metrics.f1_score, desc: "Harmonic balance index" },
        ].map((m) => (
          <div key={m.label} className="glass-card p-5 rounded-xl space-y-2">
            <span className="text-[10px] text-honeywell-textMuted font-bold uppercase tracking-wider block">{m.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white font-mono">{(m.val * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-honeywell-dark border border-honeywell-border h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-honeywell-red h-full rounded-full" 
                style={{ width: `${m.val * 100}%` }}
              ></div>
            </div>
            <p className="text-[9px] text-honeywell-textMuted leading-relaxed">{m.desc}</p>
          </div>
        ))}
      </div>

      {/* DIAGNOSTIC CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ROC Curve Area */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Receiver Operating Characteristic (ROC)</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">True Positive Rate vs. False Positive Rate. Ideal area under curve = 1.0.</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rocData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#232E45" vertical={false} />
                <XAxis dataKey="fpr" label={{ value: "False Positive Rate (FPR)", position: "insideBottom", offset: -5, fill: "#94A3B8", fontSize: "10px" }} stroke="#94A3B8" fontSize={9} tickLine={false} />
                <YAxis label={{ value: "True Positive Rate (TPR)", angle: -90, position: "insideLeft", fill: "#94A3B8", fontSize: "10px" }} stroke="#94A3B8" fontSize={9} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#151C2C", borderColor: "#232E45", borderRadius: "8px", fontSize: "11px" }}
                />
                <Area type="monotone" dataKey="tpr" name="SentinelAI Pipeline" stroke="#EE3124" fill="rgba(238, 49, 36, 0.08)" strokeWidth={2.5} />
                <Line type="monotone" dataKey="baseline" name="Random Guess Baseline" stroke="#6B7280" strokeDasharray="5 5" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Neural Sequence description */}
        <div className="glass-card p-6 rounded-xl flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Neural Pipeline Diagnostics</h3>
            <p className="text-[10px] text-honeywell-textMuted mt-0.5">Architectural layout of active behavioral classification models.</p>
          </div>

          <div className="space-y-4 text-xs">
            <div className="p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30 flex items-start gap-3">
              <Cpu className="h-5 w-5 text-honeywell-red mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Stage 1: Isolation Forest Outlier Profiling</h4>
                <p className="text-honeywell-textMuted text-[11px] leading-relaxed mt-0.5">
                  Unsupervised outlier verification. Isolates deviations across session timing, resource novelty, and IP spaces.
                </p>
              </div>
            </div>

            <div className="p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30 flex items-start gap-3">
              <Activity className="h-5 w-5 text-honeywell-red mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Stage 2: PyTorch LSTM Sequence Scorer</h4>
                <p className="text-honeywell-textMuted text-[11px] leading-relaxed mt-0.5">
                  Recurrent Neural Network evaluating sequential action flows. Pinpoints exfiltration patterns accumulating over rolling user sessions.
                </p>
              </div>
            </div>

            <div className="p-3 border border-honeywell-border rounded-lg bg-honeywell-dark/30 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-honeywell-red mt-0.5 shrink-0" />
              <div>
                <h4 className="font-bold text-white uppercase text-[10px] tracking-wider">Stage 3: XGBoost Multi-Class threat classifier</h4>
                <p className="text-honeywell-textMuted text-[11px] leading-relaxed mt-0.5">
                  Supervised gradient boosted trees mapping metrics to precise categories (Brute Force, lateral movement, travel speeds, etc.).
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* CONFUSION MATRIX CHART */}
      <div className="glass-card p-6 rounded-xl space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wider uppercase">Threat Classification Confusion Matrix</h3>
          <p className="text-[10px] text-honeywell-textMuted mt-0.5">Evaluates precision across attack categories. Diagonal squares indicate correct predictions.</p>
        </div>

        <div className="overflow-x-auto pt-2">
          <div className="min-w-[650px] space-y-2">
            
            {/* Headers row */}
            <div className="flex border-b border-honeywell-border pb-2 text-[9px] font-bold uppercase tracking-wider text-honeywell-textMuted">
              <div className="w-28 shrink-0">True Class \ Pred</div>
              {labels.map((lbl) => (
                <div key={lbl} className="flex-1 text-center truncate px-1" title={lbl}>{lbl}</div>
              ))}
            </div>

            {/* Matrix rows */}
            {matrix.map((row, rIdx) => (
              <div key={rIdx} className="flex items-center text-xs font-semibold h-10">
                {/* Left Label */}
                <div className="w-28 text-[10px] text-honeywell-textMuted font-bold uppercase truncate pr-2" title={labels[rIdx]}>
                  {labels[rIdx]}
                </div>
                
                {/* Columns */}
                {row.map((val, cIdx) => {
                  const isCorrect = rIdx === cIdx;
                  // Scale intensity of background color based on value
                  const opacity = val === 0 ? 0 : Math.max(0.1, val / maxVal);
                  
                  return (
                    <div 
                      key={cIdx} 
                      className={`flex-1 h-full flex items-center justify-center border border-honeywell-dark/35 transition-all text-[11px] font-mono`}
                      style={{ 
                        backgroundColor: isCorrect 
                          ? `rgba(16, 185, 129, ${opacity})`  // Safe green opacity
                          : val > 0 
                            ? `rgba(238, 49, 36, ${opacity})` // Alert red opacity
                            : "transparent",
                        color: val > 0 ? "#FFF" : "#6B7280"
                      }}
                      title={`True: ${labels[rIdx]} | Pred: ${labels[cIdx]} = ${val}`}
                    >
                      {val}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        </div>
      </div>

    </div>
  );
}
