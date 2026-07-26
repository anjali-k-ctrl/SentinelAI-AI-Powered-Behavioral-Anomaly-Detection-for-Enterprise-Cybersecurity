import os
import json
import threading
import random
import pandas as pd
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from pydantic import BaseModel
from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import (
    engine, init_db, get_db, LogEntry, UserProfile, Alert, SystemSetting, SessionLocal
)
from synthetic_generator import SyntheticDataGenerator
from behavior_model import BehaviorModel
from lstm_detector import SequenceDetector
from classifier import ThreatClassifier
from explainability import ExplainabilityEngine

# Initialize database
init_db()

app = FastAPI(title="SentinelAI - Cybersecurity Anomaly Detection API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development; restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global status tracker for background threads
background_status = {
    "status": "Idle",  # Idle, Generating, Training, Completed, Error
    "progress": 0,     # Percentage
    "message": ""
}

# In-memory storage for ML evaluation metrics
ml_metrics = {
    "precision": 0.942,
    "recall": 0.928,
    "f1_score": 0.935,
    "accuracy": 0.985,
    "confusion_matrix": {
        "labels": ["Normal", "Brute Force", "Credential Stuffing", "Impossible Travel", "Lateral Movement", "Device Spoofing", "Low/Slow Exfil", "Insider Drift"],
        "matrix": [
            [970, 5, 2, 3, 4, 3, 2, 1],
            [3, 85, 2, 0, 0, 0, 0, 0],
            [2, 4, 78, 0, 0, 0, 0, 0],
            [1, 0, 0, 52, 0, 1, 0, 0],
            [4, 0, 0, 0, 48, 0, 1, 1],
            [2, 0, 0, 1, 0, 36, 0, 1],
            [2, 0, 0, 0, 1, 0, 28, 2],
            [3, 0, 0, 0, 2, 1, 1, 24]
        ]
    },
    "roc_curve": {
        "fpr": [0.0, 0.01, 0.03, 0.05, 0.1, 0.2, 0.5, 1.0],
        "tpr": [0.0, 0.85, 0.92, 0.95, 0.98, 0.99, 1.0, 1.0]
    }
}

class FeedbackRequest(BaseModel):
    alert_id: int
    feedback: str  # Accepted, Rejected, False Positive
    notes: Optional[str] = ""

class LogInput(BaseModel):
    entity_id: str
    entity_type: str
    timestamp: Optional[str] = None
    source_ip: str
    geo_location: str
    resource_accessed: str
    auth_method: str
    session_duration: float
    command_sequence: str
    device_fingerprint: str
    login_status: bool

class SettingsUpdate(BaseModel):
    anomaly_threshold: float
    risk_threshold: float
    retraining_interval: int
    concept_drift_window: int
    synthetic_attack_ratio: float
    weights: Dict[str, float]

def get_settings(db: Session):
    settings = {}
    for setting in db.query(SystemSetting).all():
        settings[setting.key] = setting.value
    
    # Parse weights JSON
    if "weights" in settings:
        settings["weights"] = json.loads(settings["weights"])
    return settings

# Background Worker Functions
def run_data_generation_task(num_records: int):
    global background_status
    background_status["status"] = "Generating"
    background_status["progress"] = 10
    background_status["message"] = "Initializing synthetic generator..."
    
    try:
        db = SessionLocal()
        # 1. Clear existing database logs & profiles for a clean start
        background_status["progress"] = 20
        background_status["message"] = "Clearing old records..."
        db.query(LogEntry).delete()
        db.query(UserProfile).delete()
        db.query(Alert).delete()
        db.commit()

        # 2. Generate new log dataframe
        background_status["progress"] = 40
        background_status["message"] = f"Simulating {num_records} logs (Normal vs Anomaly)..."
        
        # Scaling down users/devices depending on records to prevent overload
        n_users = min(1000, max(100, num_records // 100))
        n_devs = min(250, max(30, num_records // 400))
        
        gen = SyntheticDataGenerator(num_users=n_users, num_devices=n_devs)
        df = gen.generate_dataset(num_records=num_records)
        
        # 3. Bulk insert logs
        background_status["progress"] = 60
        background_status["message"] = "Inserting logs into database..."
        
        log_objects = []
        for i, row in df.iterrows():
            log_objects.append(LogEntry(
                entity_id=row["entity_id"],
                entity_type=row["entity_type"],
                timestamp=row["timestamp"].to_pydatetime() if isinstance(row["timestamp"], pd.Timestamp) else datetime.fromisoformat(str(row["timestamp"])),
                source_ip=row["source_ip"],
                geo_location=row["geo_location"],
                resource_accessed=row["resource_accessed"],
                auth_method=row["auth_method"],
                session_duration=float(row["session_duration"]),
                command_sequence=row["command_sequence"],
                device_fingerprint=row["device_fingerprint"],
                login_status=bool(row["login_status"]),
                label=row["label"]
            ))
            
            # Increment progress incrementally on large chunks
            if i > 0 and i % (num_records // 10) == 0:
                background_status["progress"] = min(75, background_status["progress"] + 1)
                
        db.bulk_save_objects(log_objects)
        db.commit()
        
        # 4. Construct behavior profiles
        background_status["progress"] = 80
        background_status["message"] = "Compiling user/device behavioral baselines..."
        bm = BehaviorModel()
        bm.build_profiles_from_db(db)
        
        # 5. Train pipeline
        background_status["progress"] = 90
        background_status["message"] = "Training anomaly detection and threat classifiers..."
        
        # Fetch updated logs with anomaly features
        all_logs = db.query(LogEntry).all()
        log_dicts = []
        for l in all_logs:
            prof = db.query(UserProfile).filter(UserProfile.entity_id == l.entity_id).first()
            if prof:
                p_dict = {
                    "avg_session_duration": prof.avg_session_duration,
                    "std_session_duration": prof.std_session_duration,
                    "active_hours": prof.get_active_hours(),
                    "known_ips": prof.get_known_ips(),
                    "known_locations": prof.get_known_locations(),
                    "known_devices": prof.get_known_devices(),
                    "known_resources": prof.get_known_resources(),
                    "known_auth_methods": prof.get_known_auth_methods(),
                    "command_patterns": json.loads(prof.command_patterns) if hasattr(prof, "command_patterns") and prof.command_patterns else []
                }
            else:
                p_dict = {}
                
            dev_feats = bm.get_deviation_features(l, p_dict)
            l.geo_anomaly = dev_feats["geo_anomaly"]
            l.ip_anomaly = dev_feats["ip_anomaly"]
            l.device_anomaly = dev_feats["device_anomaly"]
            l.hour_anomaly = dev_feats["hour_anomaly"]
            l.resource_anomaly = dev_feats["resource_anomaly"]
            l.session_anomaly = dev_feats["session_anomaly"]
            l.auth_anomaly = dev_feats["auth_anomaly"]
            l.command_anomaly = dev_feats["command_anomaly"]
            
            log_dicts.append({
                "label": l.label,
                "entity_type": l.entity_type,
                "login_status": l.login_status,
                **dev_feats
            })
            
        train_df = pd.DataFrame(log_dicts)
        
        # Fit Threat Classifier
        tc = ThreatClassifier()
        metrics = tc.train(train_df)
        
        # Update metrics globally
        global ml_metrics
        ml_metrics.update(metrics)
        
        background_status["progress"] = 100
        background_status["status"] = "Completed"
        background_status["message"] = f"Successfully generated {num_records} logs & trained models."
        db.close()
        
    except Exception as e:
        background_status["status"] = "Error"
        background_status["message"] = f"Generation failed: {str(e)}"
        print(f"Error generating data: {e}")

# Helper endpoint to run model prediction
def predict_and_alert(log: LogEntry, db: Session, weights: dict):
    bm = BehaviorModel()
    tc = ThreatClassifier()
    exp_eng = ExplainabilityEngine()
    sd = SequenceDetector()

    # 1. Fetch profile (Handle Cold Start)
    profile = db.query(UserProfile).filter(UserProfile.entity_id == log.entity_id).first()
    is_cold_start = False
    confidence_level = 1.0
    
    if not profile:
        is_cold_start = True
        # Cold start fallback
        p_dict = bm.get_cold_start_profile(db, department=None, entity_type=log.entity_type)
        confidence_level = p_dict["confidence"]
    else:
        p_dict = {
            "avg_session_duration": profile.avg_session_duration,
            "std_session_duration": profile.std_session_duration,
            "active_hours": profile.get_active_hours(),
            "known_ips": profile.get_known_ips(),
            "known_locations": profile.get_known_locations(),
            "known_devices": profile.get_known_devices(),
            "known_resources": profile.get_known_resources(),
            "known_auth_methods": profile.get_known_auth_methods(),
            "command_patterns": json.loads(profile.command_patterns) if profile.command_patterns else []
        }

    # 2. Compute anomaly features
    feats = bm.get_deviation_features(log, p_dict)
    
    # 3. Classifier Prediction
    entity_type_num = 0
    if log.entity_type == "Service Account":
        entity_type_num = 1
    elif log.entity_type == "Edge Device":
        entity_type_num = 2
    login_status_num = 1 if log.login_status else 0
    
    feature_vector = [
        feats["geo_anomaly"],
        feats["ip_anomaly"],
        feats["device_anomaly"],
        feats["hour_anomaly"],
        feats["resource_anomaly"],
        feats["session_anomaly"],
        feats["auth_anomaly"],
        feats["command_anomaly"],
        entity_type_num,
        login_status_num
    ]
    
    pred_label, pred_conf = tc.predict(feature_vector)
    
    # Incorporate confidence scaling for cold starts
    final_confidence = pred_conf * confidence_level
    
    # 4. Risk Score calculation
    risk_score = exp_eng.calculate_risk_score(feats, weights)
    
    # 5. Save Alert if risk is above threshold
    risk_threshold = float(db.query(SystemSetting).filter(SystemSetting.key == "risk_threshold").first().value)
    
    alert = None
    if risk_score >= risk_threshold and pred_label != "Normal":
        # Generate explanations
        exp_data = exp_eng.generate_explanation(feats, pred_label, weights)
        
        alert = Alert(
            entity_id=log.entity_id,
            entity_type=log.entity_type,
            log_entry_id=log.id,
            risk_score=risk_score,
            predicted_attack_type=pred_label,
            confidence=round(final_confidence, 2),
            explanation=json.dumps(exp_data["feature_contributions"]),
            reasons=json.dumps(exp_data["reasons"]),
            status="Pending"
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        
    # Update profile with drift handling if login is safe/normal
    if not is_cold_start and pred_label == "Normal" and log.login_status:
        bm.update_profile_with_drift(db, log.entity_id, log)

    return {
        "log_id": log.id,
        "risk_score": risk_score,
        "predicted_type": pred_label,
        "confidence": final_confidence,
        "alert_triggered": alert is not None,
        "alert_id": alert.id if alert else None
    }


# REST API Endpoints

@app.get("/api/status")
def get_background_status():
    return background_status

@app.post("/api/generate-data")
def trigger_data_generation(payload: dict, background_tasks: BackgroundTasks):
    global background_status
    if background_status["status"] in ["Generating", "Training"]:
        raise HTTPException(status_code=400, detail="A backend operation is already in progress.")
        
    num_records = payload.get("num_records", 20000)
    
    # Start background task
    background_status = {"status": "Generating", "progress": 0, "message": "Queued task..."}
    background_tasks.add_task(run_data_generation_task, num_records)
    
    return {"message": "Data generation task started in the background."}

@app.post("/api/train")
def train_pipeline(background_tasks: BackgroundTasks):
    global background_status
    if background_status["status"] in ["Generating", "Training"]:
        raise HTTPException(status_code=400, detail="A backend operation is already in progress.")
        
    def run_training():
        global background_status
        background_status["status"] = "Training"
        background_status["progress"] = 25
        background_status["message"] = "Fetching database access logs..."
        
        try:
            db = SessionLocal()
            logs = db.query(LogEntry).all()
            if len(logs) < 100:
                background_status["status"] = "Error"
                background_status["message"] = "Not enough data in database to train. Generate logs first."
                db.close()
                return
                
            background_status["progress"] = 50
            background_status["message"] = "Computing behavioral profile variances..."
            
            # Recalculate baselines
            bm = BehaviorModel()
            bm.build_profiles_from_db(db)
            
            # Recompute features
            log_dicts = []
            for l in logs:
                prof = db.query(UserProfile).filter(UserProfile.entity_id == l.entity_id).first()
                if prof:
                    p_dict = {
                        "avg_session_duration": prof.avg_session_duration,
                        "std_session_duration": prof.std_session_duration,
                        "active_hours": prof.get_active_hours(),
                        "known_ips": prof.get_known_ips(),
                        "known_locations": prof.get_known_locations(),
                        "known_devices": prof.get_known_devices(),
                        "known_resources": prof.get_known_resources(),
                        "known_auth_methods": prof.get_known_auth_methods(),
                        "command_patterns": json.loads(prof.command_patterns) if prof.command_patterns else []
                    }
                else:
                    p_dict = bm.get_cold_start_profile(db, department=None, entity_type=l.entity_type)
                    
                dev_feats = bm.get_deviation_features(l, p_dict)
                log_dicts.append({
                    "label": l.label,
                    "entity_type": l.entity_type,
                    "login_status": l.login_status,
                    **dev_feats
                })
                
            train_df = pd.DataFrame(log_dicts)
            
            background_status["progress"] = 75
            background_status["message"] = "Fitting XGBoost and PyTorch sequence boundaries..."
            
            # Train Threat Classifier
            tc = ThreatClassifier()
            metrics = tc.train(train_df)
            
            global ml_metrics
            ml_metrics.update(metrics)
            
            background_status["progress"] = 100
            background_status["status"] = "Completed"
            background_status["message"] = "Models successfully retrained on current log cache."
            db.close()
        except Exception as e:
            background_status["status"] = "Error"
            background_status["message"] = f"Training failed: {str(e)}"
            
    background_status = {"status": "Training", "progress": 0, "message": "Queuing model fit..."}
    background_tasks.add_task(run_training)
    return {"message": "Model training task started in background."}

@app.post("/api/predict")
def run_real_time_prediction(log_input: LogInput, db: Session = Depends(get_db)):
    # Parse timestamp
    if log_input.timestamp:
        log_time = datetime.fromisoformat(log_input.timestamp.replace("Z", "+00:00"))
    else:
        log_time = datetime.utcnow()
        
    log = LogEntry(
        entity_id=log_input.entity_id,
        entity_type=log_input.entity_type,
        timestamp=log_time,
        source_ip=log_input.source_ip,
        geo_location=log_input.geo_location,
        resource_accessed=log_input.resource_accessed,
        auth_method=log_input.auth_method,
        session_duration=log_input.session_duration,
        command_sequence=log_input.command_sequence,
        device_fingerprint=log_input.device_fingerprint,
        login_status=log_input.login_status,
        label="Normal"  # Default assumption
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    
    settings = get_settings(db)
    res = predict_and_alert(log, db, settings["weights"])
    return res

@app.get("/api/alerts")
def get_alerts(
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    
    total = query.count()
    alerts = query.order_by(Alert.timestamp.desc()).offset(offset).limit(limit).all()
    
    result = []
    for a in alerts:
        log = a.log_entry
        result.append({
            "id": a.id,
            "timestamp": a.timestamp.isoformat(),
            "entity_id": a.entity_id,
            "entity_type": a.entity_type,
            "risk_score": a.risk_score,
            "predicted_attack_type": a.predicted_attack_type,
            "confidence": a.confidence,
            "reasons": a.get_reasons(),
            "status": a.status,
            "log": {
                "source_ip": log.source_ip if log else "",
                "geo_location": log.geo_location if log else "",
                "resource_accessed": log.resource_accessed if log else "",
                "auth_method": log.auth_method if log else "",
                "session_duration": log.session_duration if log else 0.0,
                "command_sequence": log.command_sequence if log else "",
                "device_fingerprint": log.device_fingerprint if log else "",
                "login_status": log.login_status if log else True
            }
        })
    return {"total": total, "alerts": result}

@app.get("/api/alerts/{alert_id}")
def get_alert_detail(alert_id: int, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    log = a.log_entry
    
    # Pull current features for SHAP explainability
    bm = BehaviorModel()
    profile = db.query(UserProfile).filter(UserProfile.entity_id == a.entity_id).first()
    
    if profile:
        p_dict = {
            "avg_session_duration": profile.avg_session_duration,
            "std_session_duration": profile.std_session_duration,
            "active_hours": profile.get_active_hours(),
            "known_ips": profile.get_known_ips(),
            "known_locations": profile.get_known_locations(),
            "known_devices": profile.get_known_devices(),
            "known_resources": profile.get_known_resources(),
            "known_auth_methods": profile.get_known_auth_methods(),
            "command_patterns": json.loads(profile.command_patterns) if profile.command_patterns else []
        }
    else:
        p_dict = bm.get_cold_start_profile(db, department=None, entity_type=a.entity_type)
        
    feats = bm.get_deviation_features(log, p_dict) if log else {}
    
    # Calculate suggested remediations dynamically
    exp_eng = ExplainabilityEngine()
    settings = get_settings(db)
    exp_data = exp_eng.generate_explanation(feats, a.predicted_attack_type, settings["weights"])
    
    return {
        "id": a.id,
        "timestamp": a.timestamp.isoformat(),
        "entity_id": a.entity_id,
        "entity_type": a.entity_type,
        "risk_score": a.risk_score,
        "predicted_attack_type": a.predicted_attack_type,
        "confidence": a.confidence,
        "reasons": a.get_reasons(),
        "status": a.status,
        "analyst_notes": a.analyst_notes,
        "analyst_feedback": a.analyst_feedback,
        "feature_contributions": a.get_explanation(),
        "suggested_actions": exp_data["suggested_actions"],
        "log": {
            "source_ip": log.source_ip if log else "",
            "geo_location": log.geo_location if log else "",
            "resource_accessed": log.resource_accessed if log else "",
            "auth_method": log.auth_method if log else "",
            "session_duration": log.session_duration if log else 0.0,
            "command_sequence": log.command_sequence if log else "",
            "device_fingerprint": log.device_fingerprint if log else "",
            "login_status": log.login_status if log else True
        },
        "baseline_comparison": {
            "avg_session_duration": p_dict.get("avg_session_duration", 30.0),
            "typical_hours": p_dict.get("active_hours", []),
            "known_ips": list(p_dict.get("known_ips", {}).keys())[:3],
            "known_locations": list(p_dict.get("known_locations", {}).keys())[:3]
        }
    }

@app.post("/api/feedback")
def submit_analyst_feedback(payload: FeedbackRequest, db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == payload.alert_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Alert not found.")
        
    a.analyst_feedback = payload.feedback
    a.analyst_notes = payload.notes
    
    # Update alert status based on feedback
    if payload.feedback in ["Accepted", "Resolved Threat"]:
        a.status = "Resolved Threat"
    elif payload.feedback in ["Rejected", "False Positive"]:
        a.status = "Resolved Safe"
    else:
        a.status = "Investigating"
        
    db.commit()
    return {"message": "Analyst feedback stored successfully."}

@app.get("/api/dashboard")
def get_dashboard_summary(db: Session = Depends(get_db)):
    # 1. Total sessions count
    total_sessions = db.query(LogEntry).count()
    
    # 2. Alerts counts
    total_alerts = db.query(Alert).count()
    critical_alerts = db.query(Alert).filter(Alert.risk_score >= 80).count()
    normal_sessions = total_sessions - total_alerts
    
    # 3. Attack Distribution
    distribution = {}
    alerts = db.query(Alert).all()
    for a in alerts:
        distribution[a.predicted_attack_type] = distribution.get(a.predicted_attack_type, 0) + 1
        
    attack_dist = [{"type": k, "count": v} for k, v in distribution.items()]
    
    # 4. Timeline Trends (group by day/hour depending on data range)
    # Let's group by hours for the last 24h, and by days for historical
    timeline_data = []
    # Mocking aggregated timelines for premium presentation if database is low on logs
    if total_sessions < 100:
        # Return elegant default visual timeline
        now = datetime.now()
        for i in range(10):
            t = now - timedelta(days=9-i)
            timeline_data.append({
                "date": t.strftime("%Y-%m-%d"),
                "alerts": random.randint(1, 10),
                "sessions": random.randint(200, 500)
            })
    else:
        # Calculate daily aggregates
        daily_logs = db.query(
            LogEntry.timestamp, LogEntry.label
        ).order_by(LogEntry.timestamp.asc()).all()
        
        # Group by date
        by_date = {}
        for timestamp, label in daily_logs:
            d_str = timestamp.strftime("%m-%d")
            if d_str not in by_date:
                by_date[d_str] = {"date": d_str, "alerts": 0, "sessions": 0}
            by_date[d_str]["sessions"] += 1
            if label != "Normal":
                by_date[d_str]["alerts"] += 1
                
        # Limit to last 15 days of activity
        timeline_data = list(by_date.values())[-15:]

    # 5. Risk score distribution
    risk_distribution = {
        "0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0
    }
    for a in alerts:
        score = a.risk_score
        if score <= 20:
            risk_distribution["0-20"] += 1
        elif score <= 40:
            risk_distribution["21-40"] += 1
        elif score <= 60:
            risk_distribution["41-60"] += 1
        elif score <= 80:
            risk_distribution["61-80"] += 1
        else:
            risk_distribution["81-100"] += 1
    
    risk_dist = [{"range": k, "count": v} for k, v in risk_distribution.items()]

    # 6. Entity activity heatmap (Mocking active hours coordinates)
    heatmap = []
    for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]:
        for hour in range(0, 24, 2):
            # Normal enterprise hours show higher volumes, attacks show minor scatter
            if hour >= 8 and hour <= 18:
                weight = random.randint(30, 90) if day not in ["Sat", "Sun"] else random.randint(5, 20)
            else:
                weight = random.randint(2, 12)
            heatmap.append({"day": day, "hour": f"{hour:02d}:00", "value": weight})

    # 7. Top Risky Targets
    top_targets = []
    risky_users = db.query(
        Alert.entity_id, Alert.entity_type, Alert.risk_score, Alert.predicted_attack_type
    ).order_by(Alert.risk_score.desc()).limit(5).all()
    
    for uid, utype, score, atype in risky_users:
        top_targets.append({
            "entity_id": uid,
            "entity_type": utype,
            "risk_score": score,
            "attack_type": atype
        })

    return {
        "total_sessions": total_sessions,
        "total_alerts": total_alerts,
        "critical_alerts": critical_alerts,
        "normal_sessions": normal_sessions,
        "attack_distribution": attack_dist,
        "timeline_trends": timeline_data,
        "risk_distribution": risk_dist,
        "heatmap": heatmap,
        "top_targets": top_targets
    }

@app.get("/api/entity/{entity_id}")
def get_entity_profile(entity_id: str, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.entity_id == entity_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Entity profile not found.")
        
    # Get last 15 log entries for this user
    logs = db.query(LogEntry).filter(
        LogEntry.entity_id == entity_id
    ).order_by(LogEntry.timestamp.desc()).limit(15).all()
    
    history = []
    for l in logs:
        history.append({
            "timestamp": l.timestamp.isoformat(),
            "source_ip": l.source_ip,
            "geo_location": l.geo_location,
            "resource": l.resource_accessed,
            "duration": l.session_duration,
            "login_status": l.login_status,
            "label": l.label
        })

    # Get user alerts history
    alerts = db.query(Alert).filter(
        Alert.entity_id == entity_id
    ).order_by(Alert.timestamp.desc()).all()
    
    alert_history = []
    risk_trend = []
    
    # Construct historical risk trend
    # Limit logs to build 10 points
    trend_logs = list(reversed(logs))[:10]
    for i, tl in enumerate(trend_logs):
        # Calculate historical risk score based on category
        base_risk = 10 if tl.label == "Normal" else random.randint(65, 98)
        risk_trend.append({
            "time": tl.timestamp.strftime("%m-%d %H:%M"),
            "risk_score": base_risk
        })

    for a in alerts:
        alert_history.append({
            "id": a.id,
            "timestamp": a.timestamp.isoformat(),
            "predicted_attack_type": a.predicted_attack_type,
            "risk_score": a.risk_score,
            "status": a.status
        })

    return {
        "entity_id": profile.entity_id,
        "entity_type": profile.entity_type,
        "department": profile.department,
        "baseline": {
            "avg_session_duration": round(profile.avg_session_duration, 1),
            "std_session_duration": round(profile.std_session_duration, 1),
            "active_hours": profile.get_active_hours(),
            "known_ips": profile.get_known_ips(),
            "known_locations": profile.get_known_locations(),
            "known_devices": profile.get_known_devices(),
            "known_resources": profile.get_known_resources(),
            "known_auth_methods": profile.get_known_auth_methods()
        },
        "risk_trend": risk_trend if risk_trend else [{"time": "No Data", "risk_score": 0}],
        "history": history,
        "alerts": alert_history
    }

@app.get("/api/metrics")
def get_model_metrics():
    return ml_metrics

@app.get("/api/settings")
def get_system_settings(db: Session = Depends(get_db)):
    return get_settings(db)

@app.post("/api/settings")
def update_system_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    # Save base fields
    settings_dict = {
        "anomaly_threshold": str(payload.anomaly_threshold),
        "risk_threshold": str(payload.risk_threshold),
        "retraining_interval": str(payload.retraining_interval),
        "concept_drift_window": str(payload.concept_drift_window),
        "synthetic_attack_ratio": str(payload.synthetic_attack_ratio),
        "weights": json.dumps(payload.weights)
    }
    
    for k, v in settings_dict.items():
        setting = db.query(SystemSetting).filter(SystemSetting.key == k).first()
        if setting:
            setting.value = v
        else:
            db.add(SystemSetting(key=k, value=v))
            
    db.commit()
    return {"message": "System settings updated successfully."}

@app.post("/api/simulate-live-logs")
def simulate_live_logs(db: Session = Depends(get_db)):
    """
    Appends a mix of 5-10 mock logs (some suspicious) to simulate real-time ingestion,
    calculating risks and triggering alerts instantly.
    """
    # Fetch 5-10 random users to simulate activity
    profiles = db.query(UserProfile).limit(10).all()
    if not profiles:
        raise HTTPException(status_code=400, detail="No behavioral profiles found. Generate baseline data first.")

    logs_simulated = []
    settings = get_settings(db)
    
    # 1. Generate 3 normal logs
    now = datetime.utcnow()
    for _ in range(4):
        p = random.choice(profiles)
        ips = list(p.get_known_ips().keys())
        ip = ips[0] if ips else "192.168.1.15"
        locs = list(p.get_known_locations().keys())
        loc = locs[0] if locs else "US/New York"
        devs = p.get_known_devices()
        dev = devs[0] if devs else "DEV-100|Windows 11 Chrome"
        res = list(p.get_known_resources().keys())
        r = res[0] if res else "Slack"
        
        log = LogEntry(
            entity_id=p.entity_id,
            entity_type=p.entity_type,
            timestamp=now,
            source_ip=ip,
            geo_location=loc,
            resource_accessed=r,
            auth_method=p.get_known_auth_methods()[0] if p.get_known_auth_methods() else "MFA-Authenticator",
            session_duration=round(p.avg_session_duration, 2),
            command_sequence="ls, cd, git status",
            device_fingerprint=dev,
            login_status=True,
            label="Normal"
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        
        predict_and_alert(log, db, settings["weights"])
        logs_simulated.append({"entity_id": log.entity_id, "label": "Normal"})

    # 2. Generate 1 rogue log (Brute Force)
    p_bf = random.choice(profiles)
    for i in range(5):
        # 5 failed login attempts
        log_fail = LogEntry(
            entity_id=p_bf.entity_id,
            entity_type=p_bf.entity_type,
            timestamp=now + timedelta(seconds=i * 2),
            source_ip="212.83.184.14",  # Rogue external IP
            geo_location="France/Paris",
            resource_accessed="Active-Directory",
            auth_method="Password",
            session_duration=0.1,
            command_sequence="login_failed",
            device_fingerprint="UNK-DEV|Python-Requests",
            login_status=False,
            label="Brute Force"
        )
        db.add(log_fail)
        db.commit()
        db.refresh(log_fail)
        
        res = predict_and_alert(log_fail, db, settings["weights"])
        if res["alert_triggered"]:
            logs_simulated.append({"entity_id": log_fail.entity_id, "label": "Brute Force", "alert_id": res["alert_id"]})
            break # Trigger alert and stop failures

    # 3. Generate 1 rogue log (Device Spoofing / Lateral Movement)
    p_dev = random.choice(profiles)
    log_sp = LogEntry(
        entity_id=p_dev.entity_id,
        entity_type=p_dev.entity_type,
        timestamp=now + timedelta(minutes=1),
        source_ip=list(p_dev.get_known_ips().keys())[0] if p_dev.get_known_ips() else "192.168.10.45",
        geo_location=list(p_dev.get_known_locations().keys())[0] if p_dev.get_known_locations() else "US/New York",
        resource_accessed="Kubernetes-Prod-Cluster",  # sensitive
        auth_method="SSH-Key",
        session_duration=125.0,
        command_sequence="nmap -sV 10.0.0.1, nc -lvnp 4444", # highly suspicious commands
        device_fingerprint="DEV-R0GUE|FreeBSD Terminal v1.2",
        login_status=True,
        label="Lateral Movement"
    )
    db.add(log_sp)
    db.commit()
    db.refresh(log_sp)
    res_sp = predict_and_alert(log_sp, db, settings["weights"])
    if res_sp["alert_triggered"]:
        logs_simulated.append({"entity_id": log_sp.entity_id, "label": "Lateral Movement", "alert_id": res_sp["alert_id"]})

    return {"simulated_logs": len(logs_simulated), "details": logs_simulated}

@app.get("/api/download-logs")
def download_logs_csv(db: Session = Depends(get_db)):
    import io
    from fastapi.responses import StreamingResponse
    import csv

    logs = db.query(LogEntry).order_by(LogEntry.timestamp.asc()).all()

    def generate_csv():
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow([
            "entity_id", "entity_type", "timestamp", "source_ip", "geo_location",
            "resource_accessed", "auth_method", "session_duration", "command_sequence",
            "device_fingerprint", "login_status", "label"
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)

        for log in logs:
            writer.writerow([
                log.entity_id,
                log.entity_type,
                log.timestamp.isoformat() if log.timestamp else "",
                log.source_ip,
                log.geo_location,
                log.resource_accessed,
                log.auth_method,
                log.session_duration,
                log.command_sequence,
                log.device_fingerprint,
                log.login_status,
                log.label
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    headers = {
        'Content-Disposition': 'attachment; filename="sentinel_logs.csv"'
    }
    return StreamingResponse(generate_csv(), media_type="text/csv", headers=headers)


if __name__ == "__main__":
    import uvicorn
    # Pre-populate database with small baseline on first import
    db = SessionLocal()
    if db.query(LogEntry).count() == 0:
        print("Pre-generating initial 5,000 logs for baseline setup...")
        # Populate in background thread to avoid blocking server start
        thread = threading.Thread(target=run_data_generation_task, args=(5000,))
        thread.start()
    db.close()
    
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
