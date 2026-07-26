import json

# Analyst suggested remediation workflows based on predicted attack category
REMEDIATIONS = {
    "Brute Force": [
        "Revoke active session tokens for the affected account immediately.",
        "Block the source IP address on the perimeter firewall.",
        "Enforce a password reset on the target identity.",
        "Enable lockout policy for subsequent failed attempts."
    ],
    "Credential Stuffing": [
        "Implement rate-limiting on the Active Directory auth endpoints.",
        "Apply Web Application Firewall (WAF) blocking on the source IP.",
        "Notify affected users and prompt for multi-factor authentication enrollment.",
        "Audit login endpoints for credential leakage sources."
    ],
    "Impossible Travel": [
        "Suspend the session from the anomalous location immediately.",
        "Reach out to the employee via secondary channels (SMS/Email) to verify traveling status.",
        "Prompt the user for step-up MFA verification at next access attempt.",
        "Inspect OAuth app authorization list for unauthorized API access."
    ],
    "Lateral Movement": [
        "Isolate the compromised system or container from the local subnet.",
        "Revoke access tokens and credentials used in the unauthorized commands.",
        "Analyze endpoint detection and response (EDR) logs for local privilege escalation.",
        "Check system files for web shells or persistence mechanisms (cronjobs/registry keys)."
    ],
    "Device Spoofing": [
        "De-register the anomalous MAC address/fingerprint from MDM profile.",
        "Force device re-enrollment with security certificate validation.",
        "Audit Active Directory logs to identify when the device certificate was copied.",
        "Validate OS version conformity against patch compliance baseline."
    ],
    "Low and Slow Exfiltration": [
        "Lock down access privileges to the affected SQL/NoSQL databases.",
        "Inspect database queries for dump patterns or excessive record offsets.",
        "Enable deep packet inspection (DPI) on outgoing TLS traffic from the source device.",
        "Identify and secure external staging servers or cloud buckets used as endpoints."
    ],
    "Insider Drift": [
        "Flag the user account for an internal privilege and resource access review.",
        "Schedule a coordination meeting with the manager to verify role changes.",
        "Restrict temporary administrative access until validation is complete.",
        "Review command audit history to identify potential policy/license violations."
    ],
    "Normal": [
        "No action required. Behavior conforms to user baseline."
    ]
}

class ExplainabilityEngine:
    def __init__(self):
        pass

    def calculate_risk_score(self, features, weights=None):
        """
        Features dict keys:
          - geo_anomaly
          - ip_anomaly
          - device_anomaly
          - hour_anomaly
          - resource_anomaly
          - session_anomaly
          - auth_anomaly
          - command_anomaly
        
        Weights config keys:
          - geo_anomaly (default 0.25)
          - device_anomaly (default 0.20)
          - behavior_anomaly (hour + session, default 0.25)
          - command_anomaly (default 0.20)
          - auth_anomaly (default 0.10)
        """
        if weights is None:
            weights = {
                "geo_anomaly": 0.25,
                "device_anomaly": 0.20,
                "behavior_anomaly": 0.25,
                "command_anomaly": 0.20,
                "auth_anomaly": 0.10
            }

        # Adapt behavior anomaly from hour and session anomalies (weighted average of the two)
        geo_score = features.get("geo_anomaly", 0.0) * weights["geo_anomaly"]
        dev_score = features.get("device_anomaly", 0.0) * weights["device_anomaly"]
        
        # Behavior anomaly combines hour and session duration anomalies
        behavior_val = 0.5 * features.get("hour_anomaly", 0.0) + 0.5 * features.get("session_anomaly", 0.0)
        behavior_score = behavior_val * weights["behavior_anomaly"]
        
        cmd_score = features.get("command_anomaly", 0.0) * weights["command_anomaly"]
        auth_score = features.get("auth_anomaly", 0.0) * weights["auth_anomaly"]
        
        raw_score = geo_score + dev_score + behavior_score + cmd_score + auth_score
        
        # Scale to 0-100
        risk_score = min(100.0, max(0.0, raw_score * 100))
        return round(risk_score, 1)

    def generate_explanation(self, features, prediction, weights=None):
        """
        Generates human-readable descriptions, SHAP-style local feature contributions,
        and recommended analyst actions.
        """
        if weights is None:
            weights = {
                "geo_anomaly": 0.25,
                "device_anomaly": 0.20,
                "behavior_anomaly": 0.25,
                "command_anomaly": 0.20,
                "auth_anomaly": 0.10
            }

        reasons = []
        explanation_weights = {}

        # 1. Evaluate Geolocation
        geo_val = features.get("geo_anomaly", 0.0)
        geo_contrib = geo_val * weights["geo_anomaly"] * 100
        explanation_weights["Geolocation"] = round(geo_contrib, 1)
        if geo_val > 0.8:
            reasons.append("New country/city login location detected")
        elif geo_val > 0.4:
            reasons.append("Unusual geolocation access frequency")

        # 2. Evaluate IP Address
        ip_val = features.get("ip_anomaly", 0.0)
        # Combine IP and Geo under network for simpler presentation
        ip_contrib = ip_val * 0.1 * 100 # small extra attribution
        explanation_weights["Network Subnet"] = round(ip_contrib, 1)
        if ip_val > 0.8:
            reasons.append("Authentication from unfamiliar source IP address")

        # 3. Evaluate Device
        dev_val = features.get("device_anomaly", 0.0)
        dev_contrib = dev_val * weights["device_anomaly"] * 100
        explanation_weights["Device Fingerprint"] = round(dev_contrib, 1)
        if dev_val > 0.8:
            reasons.append("Authentication using unrecognized device fingerprint")

        # 4. Evaluate Session Hours
        hour_val = features.get("hour_anomaly", 0.0)
        hour_contrib = hour_val * (weights["behavior_anomaly"] / 2.0) * 100
        explanation_weights["Access Timing"] = round(hour_contrib, 1)
        if hour_val > 0.7:
            reasons.append("Session initialized outside standard working hours")

        # 5. Evaluate Resource
        res_val = features.get("resource_anomaly", 0.0)
        # Resource acts as behavioral anomaly addition
        res_contrib = res_val * 0.15 * 100
        explanation_weights["Resource Target"] = round(res_contrib, 1)
        if res_val > 0.8:
            reasons.append("Accessing high-sensitivity/unfamiliar database or console")

        # 6. Evaluate Session Duration
        sess_val = features.get("session_anomaly", 0.0)
        sess_contrib = sess_val * (weights["behavior_anomaly"] / 2.0) * 100
        explanation_weights["Session Duration"] = round(sess_contrib, 1)
        if sess_val > 0.8:
            reasons.append("Session duration deviates drastically from baseline average")

        # 7. Evaluate Auth Method
        auth_val = features.get("auth_anomaly", 0.0)
        auth_contrib = auth_val * weights["auth_anomaly"] * 100
        explanation_weights["Authentication Method"] = round(auth_contrib, 1)
        if auth_val > 0.8:
            reasons.append("Uncommon authentication mechanism used")

        # 8. Evaluate Commands
        cmd_val = features.get("command_anomaly", 0.0)
        cmd_contrib = cmd_val * weights["command_anomaly"] * 100
        explanation_weights["Command Sequence"] = round(cmd_contrib, 1)
        if cmd_val > 0.7:
            reasons.append("High volume of unrecognized administrative console commands executed")

        # Fallback if no specific high score but generally anomalous
        if not reasons:
            reasons.append("Minor anomalies detected across network, timing, and resources")

        # Suggested actions
        actions = REMEDIATIONS.get(prediction, REMEDIATIONS["Normal"])

        return {
            "reasons": reasons,
            "feature_contributions": explanation_weights,
            "suggested_actions": actions
        }
