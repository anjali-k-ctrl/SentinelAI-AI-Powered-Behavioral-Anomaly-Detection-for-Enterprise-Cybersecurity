import random
import uuid
import json
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

# Seed for reproducibility
random.seed(42)
np.random.seed(42)

# Enterprise Metadata
DEPARTMENTS = ["Engineering", "DevOps", "HR", "Finance", "Sales", "Security", "IT", "Operations"]
GEO_LOCATIONS = [
    {"country": "US", "city": "New York", "ips": ["198.51.100.", "203.0.113."]},
    {"country": "India", "city": "Bangalore", "ips": ["115.110.15.", "182.72.82."]},
    {"country": "Germany", "city": "Munich", "ips": ["194.94.24.", "195.4.12."]},
    {"country": "UK", "city": "London", "ips": ["81.187.96.", "82.165.12."]},
    {"country": "Singapore", "city": "Singapore", "ips": ["122.11.192.", "124.81.0."]}
]

RESOURCES = {
    "Engineering": ["Gitlab", "Jenkins", "AWS-Dev-Console", "Jira", "Slack", "internal-wiki"],
    "DevOps": ["Kubernetes-Prod-Cluster", "AWS-Prod-Console", "Bastion-Host", "Gitlab", "Grafana", "Vault"],
    "HR": ["Workday", "HR-Database", "Slack", "Office365", "internal-wiki"],
    "Finance": ["ERP-System", "Oracle-BillingDB", "Excel-Sharepoint", "Slack", "Office365"],
    "Sales": ["Salesforce", "Customer-Portal", "Slack", "Office365"],
    "Security": ["SIEM-Console", "Vault", "Active-Directory", "Firewall-Manager", "Bastion-Host"],
    "IT": ["Active-Directory", "MDM-Portal", "Helpdesk-Ticketing", "Office365", "internal-wiki"],
    "Operations": ["SCADA-HMI-Gateway", "Edge-Device-Manager", "Office365", "Slack"]
}

AUTH_METHODS = ["MFA-Authenticator", "Password", "SSH-Key", "OAuth-AzureAD"]
DEVICES = {
    "Windows": ["Win11-Enterprise, Chrome", "Win10-Enterprise, Edge", "Win11-Home, Firefox"],
    "Mac": ["macOS-Sequoia, Safari", "macOS-Sonoma, Chrome", "macOS-Ventura, Firefox"],
    "Linux": ["Ubuntu-22.04, Chrome", "RedHat-Enterprise, Terminal", "Debian-12, Terminal"]
}

COMMAND_PATTERNS = {
    "Engineering": ["git pull", "git add", "git commit", "git push", "npm install", "npm run dev", "docker build"],
    "DevOps": ["kubectl get pods", "kubectl logs", "ssh -i devops.pem", "sudo systemctl restart nginx", "docker compose up -d"],
    "HR": ["view_profile", "edit_salary", "approve_leave", "search_candidate", "export_salaries_csv"],
    "Finance": ["run_audit", "generate_invoice", "view_revenue_sheet", "process_wire_transfer"],
    "Sales": ["search_lead", "update_deal_stage", "export_contacts", "view_pipeline"],
    "Security": ["analyze_log", "revoke_token", "block_ip", "view_threat_intel", "scan_vulnerabilities"],
    "IT": ["reset_password", "enroll_device", "update_group_policy", "restart_dhcp_server"],
    "Operations": ["monitor_telemetry", "ack_alarm", "push_firmware_update", "query_historian"]
}

class SyntheticDataGenerator:
    def __init__(self, num_users=1000, num_devices=250):
        self.num_users = num_users
        self.num_devices = num_devices
        self.users = []
        self.devices = []
        self.user_baselines = {}
        self.device_baselines = {}
        self._initialize_entities()

    def _initialize_entities(self):
        # 1. Generate Devices
        for i in range(self.num_devices):
            dev_id = f"DEV-{100 + i:03d}"
            mac = ":".join([f"{random.randint(0, 255):02x}" for _ in range(6)])
            os_name = random.choice(list(DEVICES.keys()))
            fp = f"{dev_id}|{random.choice(DEVICES[os_name])}|MAC:{mac}"
            self.devices.append({"dev_id": dev_id, "fingerprint": fp, "os": os_name})

        # 2. Generate Users & Service Accounts
        for i in range(self.num_users):
            is_service = random.random() < 0.05  # 5% service accounts
            dept = "Operations" if is_service else random.choice(DEPARTMENTS)
            
            if is_service:
                user_id = f"SVC-{1000 + i:04d}"
                entity_type = "Service Account"
            else:
                user_id = f"USR-{1000 + i:04d}"
                entity_type = "User"

            # Assign location baseline
            loc = random.choice(GEO_LOCATIONS)
            ip_subnet = random.choice(loc["ips"])
            allowed_ips = [f"{ip_subnet}{random.randint(2, 254)}" for _ in range(3)]
            
            # Select working hour range
            if is_service:
                start_h, end_h = 0, 23  # Always active
            else:
                if dept in ["DevOps", "Security"]:
                    start_h, end_h = random.choice([(7, 18), (8, 20), (12, 22)])
                elif dept == "HR":
                    start_h, end_h = (9, 17)
                else:
                    start_h, end_h = (8, 18)

            # Assign standard devices
            user_devices = random.sample(self.devices, k=random.choice([1, 2]))
            
            self.user_baselines[user_id] = {
                "entity_id": user_id,
                "entity_type": entity_type,
                "department": dept,
                "geo": loc,
                "ips": allowed_ips,
                "working_hours": (start_h, end_h),
                "auth_methods": random.sample(AUTH_METHODS, k=2),
                "devices": user_devices,
                "resources": RESOURCES[dept],
                "commands": COMMAND_PATTERNS[dept],
                "avg_session": random.uniform(10, 120),  # minutes
                "std_session": random.uniform(5, 30)
            }
            self.users.append(user_id)

    def generate_normal_log(self, user_id, timestamp):
        baseline = self.user_baselines[user_id]
        
        # Determine hour based on working hours with slight shift
        h_start, h_end = baseline["working_hours"]
        hour = int(np.random.normal((h_start + h_end) / 2.0, (h_end - h_start) / 4.0))
        hour = max(0, min(23, hour)) # Clip to valid hours
        
        # Adjust timestamp hour
        log_time = timestamp.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
        
        # Select IP and Geo
        ip = random.choice(baseline["ips"])
        geo = f"{baseline['geo']['country']}/{baseline['geo']['city']}"
        
        # Select device
        dev = random.choice(baseline["devices"])
        
        # Select Resource
        res = random.choice(baseline["resources"])
        
        # Session duration (normal distribution)
        duration = max(1.0, np.random.normal(baseline["avg_session"], baseline["std_session"]))
        
        # Command sequence (choose 2-5 commands)
        cmds = random.sample(baseline["commands"], k=min(len(baseline["commands"]), random.randint(2, 5)))
        cmd_seq = ", ".join(cmds)
        
        # Auth Method
        auth = random.choice(baseline["auth_methods"])
        
        # Login status (99% success under normal circumstances)
        status = random.random() < 0.99

        return {
            "entity_id": user_id,
            "entity_type": baseline["entity_type"],
            "timestamp": log_time,
            "source_ip": ip,
            "geo_location": geo,
            "resource_accessed": res,
            "auth_method": auth,
            "session_duration": round(duration, 2),
            "command_sequence": cmd_seq,
            "device_fingerprint": dev["fingerprint"],
            "login_status": status,
            "label": "Normal"
        }

    # Attack Injections
    def inject_brute_force(self, user_id, start_time):
        baseline = self.user_baselines[user_id]
        logs = []
        
        # Attack from a rogue IP
        rogue_ip = f"198.51.100.{random.randint(2, 254)}"
        geo = "Russia/Moscow" if random.random() < 0.5 else "China/Beijing"
        
        # 8-15 rapid failed attempts
        num_attempts = random.randint(8, 15)
        curr_time = start_time
        
        for _ in range(num_attempts):
            curr_time += timedelta(seconds=random.randint(2, 8))
            logs.append({
                "entity_id": user_id,
                "entity_type": baseline["entity_type"],
                "timestamp": curr_time,
                "source_ip": rogue_ip,
                "geo_location": geo,
                "resource_accessed": "Active-Directory",
                "auth_method": "Password",
                "session_duration": 0.1,
                "command_sequence": "login_failed",
                "device_fingerprint": "UNK-DEV|Python-Request-Client",
                "login_status": False,
                "label": "Brute Force"
            })
        
        # Sometimes followed by a successful compromise
        if random.random() < 0.3:
            curr_time += timedelta(seconds=random.randint(5, 10))
            logs.append({
                "entity_id": user_id,
                "entity_type": baseline["entity_type"],
                "timestamp": curr_time,
                "source_ip": rogue_ip,
                "geo_location": geo,
                "resource_accessed": random.choice(baseline["resources"]),
                "auth_method": "Password",
                "session_duration": round(random.uniform(5, 20), 2),
                "command_sequence": "whoami, ls, download_tools",
                "device_fingerprint": "UNK-DEV|Python-Request-Client",
                "login_status": True,
                "label": "Brute Force"
            })
            
        return logs

    def inject_credential_stuffing(self, start_time):
        logs = []
        attacker_ip = f"185.220.101.{random.randint(2, 254)}" # Tor exit node style
        geo = "Netherlands/Amsterdam"
        
        # Attack 15-25 random users in rapid succession
        num_users_to_attack = random.randint(15, 25)
        curr_time = start_time
        
        for _ in range(num_users_to_attack):
            # Target a mix of real users and fake random usernames
            if random.random() < 0.6:
                target_user = random.choice(self.users)
                target_type = self.user_baselines[target_user]["entity_type"]
            else:
                target_user = f"USR-{random.randint(9000, 9999)}"
                target_type = "User"
                
            curr_time += timedelta(seconds=random.randint(1, 3))
            logs.append({
                "entity_id": target_user,
                "entity_type": target_type,
                "timestamp": curr_time,
                "source_ip": attacker_ip,
                "geo_location": geo,
                "resource_accessed": "Active-Directory",
                "auth_method": "Password",
                "session_duration": 0.05,
                "command_sequence": "login_failed",
                "device_fingerprint": "UNK-DEV|Go-HttpClient",
                "login_status": False,
                "label": "Credential Stuffing"
            })
            
        return logs

    def inject_impossible_travel(self, user_id, base_time):
        baseline = self.user_baselines[user_id]
        
        # Normal login in Bangalore
        time1 = base_time
        log1 = {
            "entity_id": user_id,
            "entity_type": baseline["entity_type"],
            "timestamp": time1,
            "source_ip": "182.72.82.44",
            "geo_location": "India/Bangalore",
            "resource_accessed": random.choice(baseline["resources"]),
            "auth_method": random.choice(baseline["auth_methods"]),
            "session_duration": 15.0,
            "command_sequence": ", ".join(random.sample(baseline["commands"], k=2)),
            "device_fingerprint": baseline["devices"][0]["fingerprint"],
            "login_status": True,
            "label": "Normal"
        }
        
        # Login 10 minutes later from New York (Impossible Speed)
        time2 = base_time + timedelta(minutes=10)
        log2 = {
            "entity_id": user_id,
            "entity_type": baseline["entity_type"],
            "timestamp": time2,
            "source_ip": "198.51.100.89",
            "geo_location": "US/New York",
            "resource_accessed": "AWS-Dev-Console",
            "auth_method": "Password",
            "session_duration": 30.0,
            "command_sequence": "whoami, query_configs",
            "device_fingerprint": "DEV-999|macOS-Sonoma, Chrome|MAC:00:1a:2b:3c:4d:5e",
            "login_status": True,
            "label": "Impossible Travel"
        }
        return [log1, log2]

    def inject_lateral_movement(self, user_id, start_time):
        baseline = self.user_baselines[user_id]
        logs = []
        
        # Normal session first
        curr_time = start_time
        logs.append(self.generate_normal_log(user_id, curr_time))
        
        # 1-2 hours later, access highly restricted admin resources
        curr_time += timedelta(hours=random.randint(1, 2))
        
        # Restricted resources
        restricted_res = "Kubernetes-Prod-Cluster" if baseline["department"] != "DevOps" else "Oracle-BillingDB"
        
        logs.append({
            "entity_id": user_id,
            "entity_type": baseline["entity_type"],
            "timestamp": curr_time,
            "source_ip": random.choice(baseline["ips"]),
            "geo_location": f"{baseline['geo']['country']}/{baseline['geo']['city']}",
            "resource_accessed": restricted_res,
            "auth_method": "SSH-Key",
            "session_duration": 45.5,
            "command_sequence": "sudo su -, cat /etc/shadow, nmap -sP 10.0.0.0/24, ssh admin@prod-db",
            "device_fingerprint": baseline["devices"][0]["fingerprint"],
            "login_status": True,
            "label": "Lateral Movement"
        })
        return logs

    def inject_device_spoofing(self, user_id, timestamp):
        baseline = self.user_baselines[user_id]
        
        # Spoofed device details
        spoofed_fingerprint = f"DEV-{random.randint(800, 999)}|FreeBSD, curl|MAC:00:fe:da:88:99:aa"
        
        return [{
            "entity_id": user_id,
            "entity_type": baseline["entity_type"],
            "timestamp": timestamp,
            "source_ip": random.choice(baseline["ips"]),
            "geo_location": f"{baseline['geo']['country']}/{baseline['geo']['city']}",
            "resource_accessed": random.choice(baseline["resources"]),
            "auth_method": "Password",
            "session_duration": 5.0,
            "command_sequence": "ping gateway, curl http://metadata.internal",
            "device_fingerprint": spoofed_fingerprint,
            "login_status": True,
            "label": "Device Spoofing"
        }]

    def inject_low_slow(self, user_id, start_time):
        baseline = self.user_baselines[user_id]
        logs = []
        
        # 5 consecutive nights of minor exfiltration
        curr_day = start_time
        for i in range(5):
            curr_day += timedelta(days=1)
            # Active at 3 AM local time
            night_time = curr_day.replace(hour=3, minute=random.randint(10, 50))
            
            # Accessing database backup files gradually
            logs.append({
                "entity_id": user_id,
                "entity_type": baseline["entity_type"],
                "timestamp": night_time,
                "source_ip": random.choice(baseline["ips"]),
                "geo_location": f"{baseline['geo']['country']}/{baseline['geo']['city']}",
                "resource_accessed": "Oracle-BillingDB" if baseline["department"] != "HR" else "HR-Database",
                "auth_method": "Password",
                "session_duration": round(2.0 + (i * 1.5), 2),  # gradually increasing
                "command_sequence": f"pg_dump -t billing_table_part{i+1}, tar -czf chunk{i+1}.tar.gz",
                "device_fingerprint": baseline["devices"][0]["fingerprint"],
                "login_status": True,
                "label": "Low and Slow Exfiltration"
            })
        return logs

    def inject_insider_drift(self, user_id, start_time):
        baseline = self.user_baselines[user_id]
        logs = []
        
        curr_day = start_time
        # Over 10 days, user slowly shifts from typical department resources to DevOps resources
        devops_resources = RESOURCES["DevOps"]
        devops_commands = COMMAND_PATTERNS["DevOps"]
        
        for i in range(10):
            curr_day += timedelta(days=1)
            work_time = curr_day.replace(hour=random.randint(9, 17), minute=random.randint(0, 59))
            
            # Probability of DevOps activity increases day by day
            prob_drift = i / 10.0
            
            if random.random() < prob_drift:
                res = random.choice(devops_resources)
                cmds = random.sample(devops_commands, k=random.randint(1, 3))
                cmd_seq = ", ".join(cmds)
                label = "Insider Drift"
            else:
                res = random.choice(baseline["resources"])
                cmds = random.sample(baseline["commands"], k=random.randint(2, 3))
                cmd_seq = ", ".join(cmds)
                label = "Normal" # labeled as normal but represents drift behavior

            logs.append({
                "entity_id": user_id,
                "entity_type": baseline["entity_type"],
                "timestamp": work_time,
                "source_ip": random.choice(baseline["ips"]),
                "geo_location": f"{baseline['geo']['country']}/{baseline['geo']['city']}",
                "resource_accessed": res,
                "auth_method": random.choice(baseline["auth_methods"]),
                "session_duration": round(np.random.normal(baseline["avg_session"], baseline["std_session"]), 2),
                "command_sequence": cmd_seq,
                "device_fingerprint": baseline["devices"][0]["fingerprint"],
                "login_status": True,
                "label": label
            })
        return logs

    def generate_dataset(self, num_records=200000):
        print(f"Generating dataset with {num_records} records...")
        logs = []
        base_time = datetime.now() - timedelta(days=45) # 45 days of historical logs
        
        # Calculate normal vs attack records
        num_attacks = int(num_records * 0.03)
        num_normals = num_records - num_attacks
        
        # Generate Normal Logs
        times = [base_time + timedelta(seconds=i * (45 * 24 * 3600 // num_normals)) for i in range(num_normals)]
        for i in range(num_normals):
            user = random.choice(self.users)
            log = self.generate_normal_log(user, times[i])
            logs.append(log)
            
        # Inject Attacks (distributed randomly across the period)
        attack_types = [
            "Brute Force", 
            "Credential Stuffing", 
            "Impossible Travel", 
            "Lateral Movement", 
            "Device Spoofing", 
            "Low and Slow Exfiltration", 
            "Insider Drift"
        ]
        
        attack_count = 0
        attempts = 0
        
        while attack_count < num_attacks and attempts < num_attacks * 10:
            attempts += 1
            att_type = random.choice(attack_types)
            user = random.choice(self.users)
            rand_time = base_time + timedelta(seconds=random.randint(0, 45 * 24 * 3600))
            
            try:
                if att_type == "Brute Force":
                    atk = self.inject_brute_force(user, rand_time)
                elif att_type == "Credential Stuffing":
                    atk = self.inject_credential_stuffing(rand_time)
                elif att_type == "Impossible Travel":
                    atk = self.inject_impossible_travel(user, rand_time)
                elif att_type == "Lateral Movement":
                    atk = self.inject_lateral_movement(user, rand_time)
                elif att_type == "Device Spoofing":
                    atk = self.inject_device_spoofing(user, rand_time)
                elif att_type == "Low and Slow Exfiltration":
                    atk = self.inject_low_slow(user, rand_time)
                elif att_type == "Insider Drift":
                    atk = self.inject_insider_drift(user, rand_time)
                else:
                    continue
                
                logs.extend(atk)
                attack_count += len(atk)
            except Exception as e:
                # Catch indexing or list errors in case of random out of bounds
                continue

        # Sort logs by timestamp
        df = pd.DataFrame(logs)
        df = df.sort_values(by="timestamp").reset_index(drop=True)
        
        # Ensure we have exactly or close to the requested number of records by slicing
        df = df.head(num_records)
        return df

if __name__ == "__main__":
    generator = SyntheticDataGenerator(num_users=100, num_devices=50)
    df = generator.generate_dataset(1000)
    print(df.head())
    print(df["label"].value_counts())
