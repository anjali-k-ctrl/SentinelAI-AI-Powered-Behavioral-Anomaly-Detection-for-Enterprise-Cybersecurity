# SentinelAI – AI-Powered Behavioral Anomaly Detection for Enterprise Cybersecurity

SentinelAI is an enterprise-grade, full-stack cybersecurity platform designed to simulate a modern Security Operations Center (SOC). It leverages a hybrid machine learning pipeline to continuously learn user and device behavior, detect access anomalies in real-time, classify specific attack types, explain threat triggers, and adapt to concept drift.

Designed with a premium dark theme inspired by **Honeywell’s brand guidelines**, SentinelAI represents a production-ready security application suitable for critical infrastructure protection and enterprise workspace monitoring.

---

# 🚀 Live Demo

Frontend:
https://sentinelai-frontend-t69w.onrender.com

Backend:
https://sentinelai-backend-cpdb.onrender.com

API Docs:
https://sentinelai-backend-cpdb.onrender.com/docs

## 🚀 Key Innovation Highlights

1. **Unsupervised Outlier Isolation (Stage 1)**: Utilizes a non-parametric `Isolation Forest` to evaluate multidimensional deviations (hour, session duration, geo, IP, auth, device, resources) without requiring labeled historic data.
2. **Temporal Sequence Analysis (Stage 2)**: Employs a `PyTorch LSTM` model (with standard mathematical NumPy vector decay fallbacks) to track sequential user interactions over time, catching multi-day "low-and-slow" exfiltrations.
3. **Multi-Class Threat Classification (Stage 3)**: Integrates an `XGBoost` classifier to immediately map behavioral vectors to specific attack signatures: Brute Force, Credential Stuffing, Impossible Travel, Lateral Movement, Device Spoofing, Exfiltration, or Insider Drift.
4. **Explainable AI (XAI)**: Generates local SHAP-like feature attributions dynamically, showing the exact percentage weight each behavioral deviation contributed to the risk rating.
5. **Mitigation of Cold Start**: Dynamically builds synthetic baseline weights using department and entity-type averages, giving immediate protection to newly enrolled identities.
6. **Concept Drift EMA Adaptation**: Employs Exponential Moving Averages (EMA) to gradually adjust baselines based on legitimate new user activities, preventing false positive alarms.
7. **Human-in-the-Loop Feedback**: Analyst decisions (Mark Safe / Confirm Threat) are saved to SQLite and automatically retrain models dynamically to reinforce detection precision.

---

## 🛠 Tech Stack

* **Frontend**: React, TypeScript, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide Icons.
* **Backend**: Python 3.10+, FastAPI, SQLite, SQLAlchemy, Pandas, NumPy, Scikit-Learn, XGBoost, PyTorch.
* **Deployment**: Docker, Docker Compose.

---

## 📁 Workspace Directory Structure

```
SentinelAI/
│
├── backend/
│   ├── app.py                  # FastAPI Application Entry & Routing
│   ├── database.py             # SQLite Schemas (Logs, Baselines, Alerts, Feedback)
│   ├── synthetic_generator.py  # High-Fidelity Enterprise Logs Simulator
│   ├── behavior_model.py       # Profile Aggregation & Cold-Start Fallbacks
│   ├── lstm_detector.py        # PyTorch Sequence Anomaly LSTM
│   ├── classifier.py           # XGBoost / Random Forest Classifier
│   ├── explainability.py       # Risk Weights & Local SHAP-Like Explanations
│   └── Dockerfile              # Containerization for Python backend
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── DashboardOverview.tsx   # SOC KPI Telemetry & Live Ticker
│   │   │   ├── AlertQueue.tsx          # Alerts Auditor Workbench
│   │   │   ├── EntityProfile.tsx       # Behavioral Baseline Explorer
│   │   │   ├── ExplainabilityPage.tsx  # Local Feature Attributions & Remediation
│   │   │   ├── DataGeneratorPage.tsx   # Attack Simulation Controls
│   │   │   ├── Analytics.tsx           # ROC curves, Precision/Recall, Confusion Matrix
│   │   │   └── Settings.tsx            # Anomaly Weight Sliders & Thresholds
│   │   ├── App.tsx             # State-Based Router & Health Polls
│   │   └── index.css           # Glassmorphism Styles & Global Resets
│   ├── tailwind.config.js      # Custom Brand Theme & Color Setup
│   ├── postcss.config.js       # PostCSS Config
│   └── Dockerfile              # Multi-Stage Build served via Nginx
│
├── requirements.txt            # Python Dependencies
├── docker-compose.yml          # Combined Deployment Configuration
└── README.md                   # Platform Documentation
```

---

## 🏃 Local Setup Instructions

### Prerequisites
Make sure you have [Python 3.10+](https://www.python.org/) and [Node.js 18+](https://nodejs.org/) installed locally.

### 1. Run Backend Service
Navigate to the root directory and install dependencies:
```powershell
python -m pip install -r requirements.txt
```
Start the FastAPI server:
```powershell
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
*Note: On first startup, the database is auto-created (`backend/sentinel_ai.db`) and a small set of 5,000 baseline logs are pre-populated in the background.*

### 2. Run Frontend Web Client
Navigate to the `frontend/` directory:
```powershell
cd frontend
npm install
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

---

## 🐳 Docker Deployment

To spin up the entire application (React static client served via Nginx, Python FastAPI server, and SQLite database) on ports `80` and `8000` simultaneously, simply run:
```bash
docker-compose up --build
```
* Access the SOC Dashboard: `http://localhost`
* Access API Docs: `http://localhost:8000/docs`

---

## 📡 REST API Reference

| Endpoint | Method | Payload / Query | Description |
| :--- | :---: | :---: | :--- |
| `/api/status` | `GET` | None | Returns active state of background generator/training task. |
| `/api/generate-data` | `POST` | `{"num_records": 50000}` | Triggers bulk generator simulating normal & attack logs. |
| `/api/train` | `POST` | None | Re-trains Isolation Forest, PyTorch LSTM, and XGBoost models. |
| `/api/predict` | `POST` | `LogInput` JSON | Runs real-time prediction and triggers alerts if anomalous. |
| `/api/alerts` | `GET` | `?status=Pending&limit=10` | Lists alerts with corresponding access log parameters. |
| `/api/alerts/{id}` | `GET` | Alert ID path | Returns local feature attributions and remediation steps. |
| `/api/entity/{id}` | `GET` | Entity ID path | Returns baseline behavior properties and access history. |
| `/api/metrics` | `GET` | None | Returns ROC coordinates, Confusion Matrix, and F1/Recall rates. |
| `/api/feedback` | `POST` | `FeedbackRequest` | Stores analyst validation and marks status (Safe/Threat). |
| `/api/settings` | `GET` / `POST` | `SettingsUpdate` JSON | Reads/Updates risk category weights and alert triggers. |
| `/api/download-logs` | `GET` | None | Streams the logs database as a downloadable CSV file. |
| `/api/simulate-live-logs` | `POST` | None | Ingests a live feed of mock traffic (normal and attacks). |

---

## 🎯 SOC Simulation & Hackathon Demo Workflow

1. **Log Simulation**: Navigate to **Synthetic Log Generator**, select `20,000 logs`, and click **Generate**. Watch the progress bar compile the datasets and train the ML pipelines.
2. **Observe live traffic**: Go to the **Dashboard Overview** and click **Simulate Live Event Stream** in the top header. You will see new scrolling sessions populating the **Live Activity Alert Log** in real-time.
3. **Investigate Threat Indicators**: A red notification banner will trigger if anomalous behaviors are intercepted. Click **Investigate** on a high-risk alert.
4. **Audit diagnostics**: Inspect the **Explainability** page. Observe the SHAP attribution chart detailing which variables (e.g., Network Subnet, target Resource) caused the spike. Review the side-by-side forensic contrast compared against the user baseline.
5. **Mitigate & Reinforce**: Follow the **Recommended Response** checklists, write analyst findings in the notes, and click **Confirm Security Threat** or **Mark Safe**.
6. **Track Performance**: Inspect the **AI Analytics Metrics** page to verify overall pipeline performance (ROC Curve and interactive Confusion Matrix).
