import json
import numpy as np
import pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
from .database import UserProfile, LogEntry, SessionLocal

class BehaviorModel:
    def __init__(self):
        pass

    def build_profiles_from_db(self, db: Session):
        """
        Scan all normal logs in the database and construct behavioral profiles.
        """
        # Fetch only normal logs to construct clean baselines
        logs = db.query(LogEntry).filter(LogEntry.label == "Normal").all()
        if not logs:
            print("No normal logs found in database. Cannot construct baselines.")
            return
        
        # Convert to DataFrame for aggregation
        data = []
        for l in logs:
            data.append({
                "entity_id": l.entity_id,
                "entity_type": l.entity_type,
                "hour": l.timestamp.hour,
                "source_ip": l.source_ip,
                "geo_location": l.geo_location,
                "resource_accessed": l.resource_accessed,
                "auth_method": l.auth_method,
                "session_duration": l.session_duration,
                "command_sequence": l.command_sequence,
                "device_fingerprint": l.device_fingerprint
            })
        
        df = pd.DataFrame(data)
        
        # Group by entity_id
        grouped = df.groupby("entity_id")
        
        for entity_id, group in grouped:
            entity_type = group["entity_type"].iloc[0]
            
            # Simple aggregates
            avg_duration = float(group["session_duration"].mean())
            std_duration = float(group["session_duration"].std())
            if np.isnan(std_duration):
                std_duration = 0.0
                
            active_hours = [int(h) for h in group["hour"].unique()]
            
            # Frequencies as dicts
            ips = {str(k): int(v) for k, v in group["source_ip"].value_counts().to_dict().items()}
            locations = {str(k): int(v) for k, v in group["geo_location"].value_counts().to_dict().items()}
            resources = {str(k): int(v) for k, v in group["resource_accessed"].value_counts().to_dict().items()}
            
            # Lists of uniques
            devices = list(group["device_fingerprint"].unique())
            auths = list(group["auth_method"].unique())
            
            # Flatten commands
            all_cmds = []
            for cmd_seq in group["command_sequence"].dropna():
                cmds = [c.strip() for c in cmd_seq.split(",") if c.strip()]
                all_cmds.extend(cmds)
            common_cmds = list(pd.Series(all_cmds).value_counts().head(10).index) if all_cmds else []

            # Save or update UserProfile
            profile = db.query(UserProfile).filter(UserProfile.entity_id == entity_id).first()
            if not profile:
                profile = UserProfile(entity_id=entity_id)
                db.add(profile)
                
            profile.entity_type = entity_type
            profile.avg_session_duration = avg_duration
            profile.std_session_duration = std_duration
            profile.active_hours = json.dumps(active_hours)
            profile.known_ips = json.dumps(ips)
            profile.known_locations = json.dumps(locations)
            profile.known_devices = json.dumps(devices)
            profile.known_resources = json.dumps(resources)
            profile.known_auth_methods = json.dumps(auths)
            profile.command_patterns = json.dumps(common_cmds)
            
            # Guess department from resource usage or default
            if not profile.department:
                if entity_type == "Service Account":
                    profile.department = "Operations"
                else:
                    # Match with common resource lists
                    matched_dept = "Engineering"
                    max_intersect = 0
                    from .synthetic_generator import RESOURCES
                    for dept, res_list in RESOURCES.items():
                        intersect = len(set(resources.keys()).intersection(res_list))
                        if intersect > max_intersect:
                            max_intersect = intersect
                            matched_dept = dept
                    profile.department = matched_dept

        db.commit()
        print("Behavioral profiles successfully constructed.")

    def get_cold_start_profile(self, db: Session, department: str, entity_type: str):
        """
        Builds a synthetic profile based on department/entity type/global averages
        when a user has no prior history.
        """
        # Fetch profiles in the same department
        query = db.query(UserProfile)
        if department:
            query = query.filter(UserProfile.department == department)
        elif entity_type:
            query = query.filter(UserProfile.entity_type == entity_type)
            
        sibling_profiles = query.all()
        
        if not sibling_profiles:
            # Global fallback
            sibling_profiles = db.query(UserProfile).all()
            
        if not sibling_profiles:
            # Absolute fallback
            return {
                "entity_id": "COLD_START",
                "avg_session_duration": 30.0,
                "std_session_duration": 15.0,
                "active_hours": list(range(8, 19)),
                "known_ips": {},
                "known_locations": {},
                "known_devices": [],
                "known_resources": {},
                "known_auth_methods": ["Password", "MFA-Authenticator"],
                "command_patterns": [],
                "confidence": 0.5
            }
            
        # Average numeric columns
        avg_dur = np.mean([p.avg_session_duration for p in sibling_profiles])
        std_dur = np.mean([p.std_session_duration for p in sibling_profiles])
        
        # Merge lists and frequencies
        merged_hours = set()
        merged_ips = {}
        merged_locations = {}
        merged_devices = set()
        merged_resources = {}
        merged_auths = set()
        merged_cmds = set()
        
        for p in sibling_profiles:
            merged_hours.update(p.get_active_hours())
            merged_devices.update(p.get_known_devices())
            merged_auths.update(p.get_known_auth_methods())
            merged_cmds.update(json.loads(p.command_patterns))
            
            for ip, count in p.get_known_ips().items():
                merged_ips[ip] = merged_ips.get(ip, 0) + count
            for loc, count in p.get_known_locations().items():
                merged_locations[loc] = merged_locations.get(loc, 0) + count
            for res, count in p.get_known_resources().items():
                merged_resources[res] = merged_resources.get(res, 0) + count
                
        # Confidence decays based on sample sizes
        confidence = 0.8 if len(sibling_profiles) > 5 else 0.6
        
        return {
            "entity_id": "COLD_START",
            "avg_session_duration": float(avg_dur),
            "std_session_duration": float(std_dur),
            "active_hours": list(merged_hours),
            "known_ips": merged_ips,
            "known_locations": merged_locations,
            "known_devices": list(merged_devices),
            "known_resources": merged_resources,
            "known_auth_methods": list(merged_auths),
            "command_patterns": list(merged_cmds),
            "confidence": confidence
        }

    def update_profile_with_drift(self, db: Session, entity_id: str, new_log: LogEntry, alpha=0.1):
        """
        Implement Concept Drift Handling using rolling exponential moving windows (EMA).
        legitimate new behavior slowly adjusts the baseline.
        """
        profile = db.query(UserProfile).filter(UserProfile.entity_id == entity_id).first()
        if not profile:
            return
        
        # 1. Update session duration (EMA)
        profile.avg_session_duration = (1 - alpha) * profile.avg_session_duration + alpha * new_log.session_duration
        
        # 2. Update active hours
        hours = profile.get_active_hours()
        hour = new_log.timestamp.hour
        if hour not in hours:
            hours.append(hour)
            profile.active_hours = json.dumps(hours)
            
        # 3. Update known IPs
        ips = profile.get_known_ips()
        ips[new_log.source_ip] = ips.get(new_log.source_ip, 0) + 1
        profile.known_ips = json.dumps(ips)
        
        # 4. Update known geolocations
        locs = profile.get_known_locations()
        locs[new_log.geo_location] = locs.get(new_log.geo_location, 0) + 1
        profile.known_locations = json.dumps(locs)
        
        # 5. Update known devices
        devices = profile.get_known_devices()
        if new_log.device_fingerprint not in devices:
            devices.append(new_log.device_fingerprint)
            profile.known_devices = json.dumps(devices)
            
        # 6. Update known resources
        res = profile.get_known_resources()
        res[new_log.resource_accessed] = res.get(new_log.resource_accessed, 0) + 1
        profile.known_resources = json.dumps(res)
        
        # 7. Update command patterns
        cmds = json.loads(profile.command_patterns)
        new_cmds = [c.strip() for c in new_log.command_sequence.split(",") if c.strip()]
        for nc in new_cmds:
            if nc not in cmds:
                cmds.append(nc)
        profile.command_patterns = json.dumps(cmds[:15]) # keep top 15
        
        db.commit()

    def get_deviation_features(self, log, profile_dict):
        """
        Calculates deviation metrics for log variables relative to profile.
        Returns a dict of features for ML inputs and explainability.
        """
        features = {}
        
        # 1. Geo anomaly
        geo = log.geo_location
        known_locs = profile_dict.get("known_locations", {})
        if not known_locs:
            features["geo_anomaly"] = 0.5
        elif geo in known_locs:
            # proportion of access from this location
            total = sum(known_locs.values())
            ratio = known_locs[geo] / max(1, total)
            features["geo_anomaly"] = float(1.0 - ratio) # high dev if rare
        else:
            features["geo_anomaly"] = 1.0 # completely new country/city
            
        # 2. IP anomaly
        ip = log.source_ip
        known_ips = profile_dict.get("known_ips", {})
        if not known_ips:
            features["ip_anomaly"] = 0.5
        elif ip in known_ips:
            total = sum(known_ips.values())
            ratio = known_ips[ip] / max(1, total)
            features["ip_anomaly"] = float(1.0 - ratio)
        else:
            features["ip_anomaly"] = 1.0
            
        # 3. Device Anomaly
        dev = log.device_fingerprint
        known_devs = profile_dict.get("known_devices", [])
        if not known_devs:
            features["device_anomaly"] = 0.5
        elif dev in known_devs:
            features["device_anomaly"] = 0.0
        else:
            features["device_anomaly"] = 1.0
            
        # 4. Working Hour Anomaly
        hour = log.timestamp.hour if isinstance(log.timestamp, datetime) else int(log.timestamp.split("T")[1].split(":")[0])
        known_hours = profile_dict.get("active_hours", [])
        if not known_hours:
            features["hour_anomaly"] = 0.5
        elif hour in known_hours:
            features["hour_anomaly"] = 0.0
        else:
            # calculate distance to nearest active hour
            min_dist = min([abs(hour - kh) for kh in known_hours])
            features["hour_anomaly"] = float(min(1.0, min_dist / 12.0))
            
        # 5. Resource Anomaly
        res = log.resource_accessed
        known_res = profile_dict.get("known_resources", {})
        if not known_res:
            features["resource_anomaly"] = 0.5
        elif res in known_res:
            total = sum(known_res.values())
            ratio = known_res[res] / max(1, total)
            features["resource_anomaly"] = float(1.0 - ratio)
        else:
            features["resource_anomaly"] = 1.0
            
        # 6. Session Duration Anomaly
        duration = log.session_duration
        avg_dur = profile_dict.get("avg_session_duration", 30.0)
        std_dur = profile_dict.get("std_session_duration", 15.0)
        std_dur = std_dur if std_dur > 0 else 5.0
        
        z_score = abs(duration - avg_dur) / std_dur
        features["session_anomaly"] = float(min(1.0, z_score / 3.0)) # cap at 3 standard deviations
        
        # 7. Authentication Method Anomaly
        auth = log.auth_method
        known_auths = profile_dict.get("known_auth_methods", [])
        if not known_auths:
            features["auth_anomaly"] = 0.5
        elif auth in known_auths:
            features["auth_anomaly"] = 0.0
        else:
            features["auth_anomaly"] = 1.0
            
        # 8. Command Anomaly
        log_cmds = [c.strip() for c in log.command_sequence.split(",") if c.strip()]
        known_cmds = profile_dict.get("command_patterns", [])
        
        if not log_cmds:
            features["command_anomaly"] = 0.0
        elif not known_cmds:
            features["command_anomaly"] = 0.5
        else:
            # fraction of unrecognized commands
            unrecognized = sum([1 for c in log_cmds if c not in known_cmds])
            features["command_anomaly"] = float(unrecognized / len(log_cmds))

        return features
