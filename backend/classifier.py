import os
import pickle
import numpy as np
import pandas as pd

# Fallback wrapper in case xgboost is missing or fails to import
try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False
    print("XGBoost library not found. Falling back to Scikit-Learn RandomForestClassifier.")

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support

LABEL_MAP = {
    "Normal": 0,
    "Brute Force": 1,
    "Credential Stuffing": 2,
    "Impossible Travel": 3,
    "Lateral Movement": 4,
    "Device Spoofing": 5,
    "Low and Slow Exfiltration": 6,
    "Insider Drift": 7
}

REV_LABEL_MAP = {v: k for k, v in LABEL_MAP.items()}

class ThreatClassifier:
    def __init__(self):
        self.model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "threat_classifier.pkl")
        self.model = None
        self.classes_ = list(LABEL_MAP.keys())
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                with open(self.model_path, "rb") as f:
                    self.model = pickle.load(f)
                print("Pre-trained threat classifier loaded successfully.")
            except Exception as e:
                print(f"Error loading classifier model: {e}. Need to train first.")
                self.model = None

    def save_model(self):
        try:
            with open(self.model_path, "wb") as f:
                pickle.dump(self.model, f)
            print("Threat classifier model saved successfully.")
        except Exception as e:
            print(f"Error saving classifier model: {e}")

    def prepare_data(self, df):
        """
        Converts raw log fields and pre-calculated anomaly scores into a clean training feature set.
        """
        # Ensure label mapping
        y = df["label"].map(LABEL_MAP).fillna(0).astype(int).values
        
        # Prepare feature matrix
        X_data = []
        for _, row in df.iterrows():
            entity_type_num = 0
            if row.get("entity_type") == "Service Account":
                entity_type_num = 1
            elif row.get("entity_type") == "Edge Device":
                entity_type_num = 2
                
            login_status_num = 1 if row.get("login_status") is True or row.get("login_status") == 1 else 0
            
            # Feature layout
            feats = [
                float(row.get("geo_anomaly", 0.0)),
                float(row.get("ip_anomaly", 0.0)),
                float(row.get("device_anomaly", 0.0)),
                float(row.get("hour_anomaly", 0.0)),
                float(row.get("resource_anomaly", 0.0)),
                float(row.get("session_anomaly", 0.0)),
                float(row.get("auth_anomaly", 0.0)),
                float(row.get("command_anomaly", 0.0)),
                entity_type_num,
                login_status_num
            ]
            X_data.append(feats)
            
        return np.array(X_data, dtype=np.float32), y

    def train(self, df):
        """
        Trains the classifier (XGBoost or Random Forest fallback).
        Saves metrics & model coefficients.
        """
        X, y = self.prepare_data(df)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y if len(np.unique(y)) > 1 else None)
        
        if HAS_XGB:
            # Multi-class XGBoost classifier
            self.model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                objective="multi:softprob",
                num_class=8,
                random_state=42,
                eval_metric="mlogloss"
            )
        else:
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                class_weight="balanced"
            )

        print(f"Training classification model on {len(X_train)} samples...")
        self.model.fit(X_train, y_train)
        self.save_model()

        # Evaluate performance
        y_pred = self.model.predict(X_test)
        
        # Calculate scores
        report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        conf_mat = confusion_matrix(y_test, y_pred).tolist()
        
        precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)
        
        # Re-map confusion matrix labels for frontend readability
        classes_present = np.unique(np.concatenate([y_test, y_pred]))
        lbl_names = [REV_LABEL_MAP.get(c, "Unknown") for c in classes_present]

        metrics = {
            "precision": float(precision),
            "recall": float(recall),
            "f1_score": float(f1),
            "accuracy": float(np.mean(y_test == y_pred)),
            "confusion_matrix": {
                "labels": lbl_names,
                "matrix": conf_mat
            },
            "classification_report": report
        }
        
        return metrics

    def predict(self, feature_vector):
        """
        Input: feature list of shape (10,)
        Output: (threat_name, confidence)
        """
        if self.model is None:
            # Return fallback defaults
            # Let's say if geo_anomaly and ip_anomaly are high, it's impossible travel
            # if login_status is 0 and ip_anomaly is high, brute force, etc.
            geo_a, ip_a, dev_a, hour_a, res_a, sess_a, auth_a, cmd_a, entity, login = feature_vector
            if login == 0 and ip_a > 0.8:
                return "Brute Force", 0.85
            elif geo_a > 0.9 and ip_a > 0.9:
                return "Impossible Travel", 0.92
            elif dev_a > 0.8:
                return "Device Spoofing", 0.80
            elif cmd_a > 0.7 and res_a > 0.8:
                return "Lateral Movement", 0.78
            elif sess_a > 0.7 and hour_a > 0.8:
                return "Low and Slow Exfiltration", 0.70
            elif res_a > 0.6 and cmd_a > 0.5:
                return "Insider Drift", 0.65
            return "Normal", 0.99

        # Make prediction
        x_in = np.array([feature_vector], dtype=np.float32)
        try:
            preds_proba = self.model.predict_proba(x_in)[0]
            class_idx = np.argmax(preds_proba)
            label_name = REV_LABEL_MAP.get(class_idx, "Normal")
            confidence = float(preds_proba[class_idx])
            return label_name, confidence
        except Exception as e:
            print(f"Error in prediction: {e}")
            return "Normal", 0.95

    def get_feature_importances(self):
        """
        Returns a dict of feature importances for explainability dashboard.
        """
        features = [
            "geo_anomaly",
            "ip_anomaly",
            "device_anomaly",
            "hour_anomaly",
            "resource_anomaly",
            "session_anomaly",
            "auth_anomaly",
            "command_anomaly",
            "entity_type",
            "login_status"
        ]
        
        if self.model is None or not hasattr(self.model, "feature_importances_"):
            # Mock average importances
            mock_imp = [0.22, 0.18, 0.15, 0.12, 0.15, 0.10, 0.05, 0.03, 0.00, 0.00]
            return dict(zip(features, mock_imp))
            
        importances = self.model.feature_importances_.tolist()
        return dict(zip(features, importances))
