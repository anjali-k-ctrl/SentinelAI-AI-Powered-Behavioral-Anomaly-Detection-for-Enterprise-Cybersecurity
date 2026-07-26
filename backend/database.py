import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# Database path in workspace
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sentinel_ai.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class LogEntry(Base):
    __tablename__ = "log_entries"

    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String(50), index=True)
    entity_type = Column(String(50))  # User, Service Account, Edge Device
    timestamp = Column(DateTime, default=datetime.utcnow)
    source_ip = Column(String(50))
    geo_location = Column(String(100))
    resource_accessed = Column(String(100))
    auth_method = Column(String(50))
    session_duration = Column(Float)
    command_sequence = Column(Text)  # Comma-separated list of commands
    device_fingerprint = Column(String(200))
    login_status = Column(Boolean)  # True = Success, False = Failure
    label = Column(String(100))  # Normal or specific attack type

class UserProfile(Base):
    __tablename__ = "user_profiles"

    entity_id = Column(String(50), primary_key=True, index=True)
    entity_type = Column(String(50))
    department = Column(String(100), nullable=True)
    
    # Store aggregated behavioral patterns as JSON text
    avg_session_duration = Column(Float, default=0.0)
    std_session_duration = Column(Float, default=0.0)
    active_hours = Column(Text, default="[]")  # e.g., "[9, 10, 11, 12, 13, 14, 15, 16, 17]"
    known_ips = Column(Text, default="{}")     # e.g., '{"192.168.1.10": 20}'
    known_locations = Column(Text, default="{}") # e.g., '{"India/Mumbai": 25}'
    known_devices = Column(Text, default="[]")   # List of device fingerprints
    known_resources = Column(Text, default="{}") # List of accessed resources and frequencies
    known_auth_methods = Column(Text, default="[]") # List of preferred authentication methods
    command_patterns = Column(Text, default="[]")  # List of typical commands

    def get_active_hours(self):
        return json.loads(self.active_hours)

    def get_known_ips(self):
        return json.loads(self.known_ips)

    def get_known_locations(self):
        return json.loads(self.known_locations)

    def get_known_devices(self):
        return json.loads(self.known_devices)

    def get_known_resources(self):
        return json.loads(self.known_resources)

    def get_known_auth_methods(self):
        return json.loads(self.known_auth_methods)

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    entity_id = Column(String(50), index=True)
    entity_type = Column(String(50))
    log_entry_id = Column(Integer, ForeignKey("log_entries.id"))
    risk_score = Column(Float)
    predicted_attack_type = Column(String(100))
    confidence = Column(Float)
    
    # JSON-encoded weights and features
    explanation = Column(Text)  # Feature contributions: e.g., '{"geo_anomaly": 25, "device_anomaly": 20}'
    reasons = Column(Text)      # Human-readable reasons: e.g., '["New country detected", "Login outside normal hours"]'
    
    status = Column(String(50), default="Pending")  # Pending, Investigating, Resolved Safe, Resolved Threat
    analyst_feedback = Column(String(50), nullable=True)  # Accepted, Rejected, False Positive
    analyst_notes = Column(Text, nullable=True)

    log_entry = relationship("LogEntry")

    def get_explanation(self):
        return json.loads(self.explanation) if self.explanation else {}

    def get_reasons(self):
        return json.loads(self.reasons) if self.reasons else []

class SystemSetting(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text)  # JSON-encoded value

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Initialize default settings
    db = SessionLocal()
    try:
        default_settings = {
            "anomaly_threshold": "0.15", # top 15% anomalies
            "risk_threshold": "50.0",     # alert if risk > 50
            "retraining_interval": "1000", # retrain models every 1000 records
            "concept_drift_window": "30",  # 30-day sliding window for baseline
            "synthetic_attack_ratio": "0.03", # 3% attacks
            "weights": json.dumps({
                "geo_anomaly": 0.25,
                "device_anomaly": 0.20,
                "behavior_anomaly": 0.25,
                "command_anomaly": 0.20,
                "auth_anomaly": 0.10
            })
        }
        for k, v in default_settings.items():
            setting = db.query(SystemSetting).filter(SystemSetting.key == k).first()
            if not setting:
                db.add(SystemSetting(key=k, value=v))
        db.commit()
    except Exception as e:
        print(f"Error initializing default settings: {e}")
        db.rollback()
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
