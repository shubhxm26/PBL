# Cognitive Software-Driven Smart Logistics & Multi-Agent Orchestration Platform

[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch%202.2%2B-EE4C2C.svg)](https://pytorch.org/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB.svg)](https://react.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20v4-38B2AC.svg)](https://tailwindcss.com/)
[![CesiumJS](https://img.shields.io/badge/3D%20GIS-CesiumJS%201.146%2B-blueviolet.svg)](https://cesium.com/)
[![Tests](https://img.shields.io/badge/Tests-93%20Passed-brightgreen.svg)]()

An enterprise-grade, cognitive software orchestration layer designed to eliminate friction across multi-echelon supply chain networks. Deployed on the **Western India Economic Corridor** (JNPT Port / Mumbai ↔ Thane ↔ Nashik ↔ Pune), the platform seamlessly couples deep neural networks, reinforcement learning, local semantic vector search, discrete-event simulation, and real-time WebSocket telemetry.

---

## Architecture Overview

```
                                  +-----------------------------------------------+
                                  |         CLIENT / PRESENTATION LAYER           |
                                  |   Vite + React 19 + Tailwind v4 + Leaflet.js  |
                                  +-----------------------+-----------------------+
                                                          | HTTP / WebSockets (X-Persona-Role)
                                                          v
                                  +-----------------------------------------------+
                                  |            FASTAPI GATEWAY & RBAC             |
                                  |  - Role-Based Access Control (4 Personas)     |
                                  |  - System Diagnostics & Health Monitor        |
                                  |  - Real-Time WebSocket Telemetry Hub          |
                                  +-----------------------+-----------------------+
                                                          |
             +--------------------+-----------------------+--------------------+---------------------+
             |                                            |                    |                     |
             v                                            v                    v                     v
+--------------------------+                 +--------------------------+  +---------------+  +---------------------+
| 1. Demand Forecaster     |                 | 2. Dynamic Fleet Router  |  | 3. Trade IDP  |  | 4. Digital Twin     |
| - PyTorch LSTM/GRU       |                 | - PyTorch DRL Policy Net |  | - Gemini IDP  |  | - Discrete-Event    |
| - Multi-Horizon (7-30d)  |                 | - Capacity & Time Windows|  | - Vector RAG  |  | - Multi-Echelon     |
| - 95% Confidence Bounds  |                 | - Congestion Penalization|  | - HS Classify |  | - Shock Propagation |
| - Dynamic Safety Stock   |                 | - Backhaul Freight Match |  | - Discrepancy |  | - Mitigated SLA /   |
| - Exogenous Weather/Promo|                 | - Turn-by-Turn Waypoints |  |   Validation  |  |   Risk Reduction    |
+--------------------------+                 +--------------------------+  +---------------+  +---------------------+
             |                                            |                    |                     |
             +--------------------+-----------------------+--------------------+---------------------+
                                                          |
                                                          v
                                  +-----------------------------------------------+
                                  |          DATA PERSISTENCE & RESILIENCE        |
                                  |  Primary: PostgreSQL 17 (pgvector) + Redis 7  |
                                  |  Fallback: In-Memory SQLite + InMemoryRedis   |
                                  |  Checkpoints: PyTorch .pt Weight Stores       |
                                  +-----------------------------------------------+
```

### Core Monorepo Layout

```
PBL/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Endpoints: health, persona, admin, forecasting, routing, compliance, twin, telemetry
│   │   ├── checkpoints/     # PyTorch .pt weights (forecasting_lstm.pt, routing_drl.pt)
│   │   ├── core/            # RBAC middleware, system diagnostics
│   │   ├── db/              # Connection manager (pgvector / SQLite fallback), SQLAlchemy models, seed data
│   │   ├── engines/         # Forecasting, Routing, Compliance RAG, Digital Twin, Telemetry engines
│   │   ├── config.py        # Pydantic BaseSettings (.env loader)
│   │   └── main.py          # FastAPI application factory & WebSocket hub
│   ├── tests/               # 57 automated tests (E2E integration, forecasting, routing, compliance, twin, telemetry)
│   ├── train_models.py      # Standalone PyTorch CPU training harness for .pt checkpoints
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # DashboardShell, ForecastingTab, RoutingTab, ComplianceTab, DigitalTwinTab, Navbar
│   │   ├── context/         # PersonaContext (Director, Dispatcher, Customs, Admin)
│   │   ├── services/        # Centralized API service with X-Persona-Role header injection
│   │   ├── App.jsx          # Root application component
│   │   └── main.jsx         # Vite entry point
│   ├── package.json         # Node.js dependencies
│   └── vite.config.js       # Vite configuration with backend proxy
├── docker-compose.yml       # PostgreSQL 17 with pgvector + Redis 7 Alpine
├── SPECIFICATION.md         # Full system specifications and acceptance criteria
└── README.md                # Enterprise deployment & user manual
```

---

## The 4 Cognitive Logistics Engines

### 1. Predictive Demand Forecasting Engine
- **Model**: PyTorch Multi-Horizon LSTM/GRU Neural Network (`input_dim=5, hidden_dim=48, max_horizon=30`).
- **Features**: Historical daily volume series, weekly trigonometric cycles ($\sin/\cos$), promotional discounts ($0–50\%$), and exogenous monsoon/weather disruption indices.
- **Statistical Uncertainty**: Dual-headed architecture emitting point forecasts alongside empirical residual variance yielding strict 95% confidence intervals ($lower \le point \le upper$).
- **Safety Stock Calculator**: Formulates dynamic buffer inventory based on customer SLA service levels ($95\%$) and supplier replenishment lead times.

### 2. Dynamic Route Optimizer & Freight Matching Engine
- **Model**: PyTorch Deep Reinforcement Learning (DRL) Attention Route Policy Network.
- **VRP Constraints**: Respects vehicle payload limits ($24,000$ kg), customer delivery time windows, and depot dispatch sequences.
- **Traffic Congestion Mode**: Dynamically penalizes travel duration, fuel burn, and CO2 emissions across congested segments (e.g., NH48 Mumbai–Thane–Nashik corridor).
- **Return Backhaul Matching**: Matches empty return legs with active shipper freight postings, calculating compatibility scores, fuel cost savings, and eliminated empty kilometers.

### 3. Trade Compliance & Intelligent Document Processing (IDP)
- **IDP Processing**: Uses the Google GenAI SDK (`google-genai` / Gemini 2.5 Flash) to parse unstructured shipping documents (Bills of Lading, Commercial Invoices) into strictly typed JSON.
- **Vector RAG Classification**: Sub-second ($< 500$ms SLA) semantic search matching cargo descriptions against an international Harmonized System (HS) catalogue.
- **Automated Discrepancy Engine**: Cross-references invoice line items against customs rulebooks, identifying tariff mismatches, valuation anomalies, weight inversions, and missing regulatory certificates (Phytosanitary, CDSCO) with remediation advice.

### 4. 3D Cognitive Digital Twin & Autonomous AI Sentinel
- **CesiumJS 3D Photogrammetry & Macro-Facility Beacons**: Interactive 3D spatial twin rendering 5 multi-echelon hubs (JNPT Port, Bhiwandi DC, Thane Hub, Nashik Depot, Pune Center) with dynamic volumetric stock capacity rings (Green $\ge 60\%$, Amber $30-59\%$, Red $< 30\%$).
- **3D Highway Flow Conduits & Dynamic Shockwaves**: Multi-segment highway corridors (NH-48, Mumbai-Pune Expressway, NH-160 Kasara Ghat) animated with volumetric flow polylines, alternative detour bypass conduits, and pulsating radar shockwaves centered over disruption epicenters.
- **Cyber-Tactical 2.5D/3D Schematic Offline Fallback**: High-performance SVG schematic vector view providing full operational fidelity, Western Ghats topography, animated highway flow conduits, and node inspector drawers when Cesium Ion tokens are unconfigured or offline.
- **Autonomous AI Sentinel**: 1Hz macro-corridor telemetry monitor streaming over WebSockets with automated risk classification (Green/Yellow/Red), proactive contingency detour triggers, and instant connection-resynchronization.
- **Discrete-Event Simulation (DES)**: Sub-5-second execution evaluating Baseline vs. Mitigated SLA delays, inventory stockout risks, holding cost surges, and automated contingency re-routing paths.

---

## 4 User Personas & Role-Based Access Control (RBAC)

The platform features a persistent top-bar **Persona Switcher** that immediately adjusts active views, action permissions, and API headers (`X-Persona-Role`):

| Persona | Role Key | Allowed Views | Primary Workflows |
|---|---|---|---|
| **Supply Chain Director** | `director` | `kpis`, `forecasting`, `routing`, `twin`, `telemetry` | Multi-horizon demand planning, 95% confidence bands, Digital Twin shock simulation, corridor sustainability |
| **Fleet Dispatcher** | `dispatcher` | `routing`, `telemetry` | Interactive Leaflet GIS tracking, route sequence optimization, 1-click backhaul freight assignment, roadblock injection |
| **Customs & Compliance Officer** | `customs` | `compliance` | 1-Click sample trade documents, Gemini IDP JSON extraction, sub-second HS classification, discrepancy audits |
| **Enterprise IT Administrator** | `admin` | `*` (All views + `system`) | Live system health (PostgreSQL, Redis, AI SDK), on-demand PyTorch model re-training, RBAC permission auditing |

---

## Rapid Zero-Friction Startup

### Prerequisites
- **Python**: 3.10, 3.11, or 3.12+
- **Node.js**: 18.0+ & npm
- **Docker Compose** *(Optional)*: If Docker is unavailable, the backend **automatically falls back to in-memory SQLite and InMemoryRedis** with 100% operational fidelity.

---

### Option A: Standard Local Startup (With Automated In-Memory Fallback)

#### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Verify or regenerate PyTorch model weights
python train_models.py --epochs 10

# Launch FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API is now online at `http://127.0.0.1:8000`. Interactive documentation is available at `http://127.0.0.1:8000/docs`.

#### 2. Frontend Setup
In a second terminal:
```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
Open your browser to **`http://localhost:5173`**.

##### Optional: Cesium Ion 3D Globe Token Configuration
The platform features an enterprise **3D Cesium Digital Twin** with high-resolution global terrain and 3D building photogrammetry.
- **Zero-Config Cyber-Tactical Offline Fallback**: If no token is configured, the platform **automatically renders a high-performance Cyber-Tactical 2.5D/3D Schematic Vector View** with dynamic capacity rings, animated SVG highway flow conduits, active hazard pulses, and detours—with zero setup required.
- **Enabling High-Resolution 3D Globe**:
  1. Create a free Cesium Ion account at [cesium.com/ion](https://cesium.com/ion) and generate a default access token.
  2. Create or edit `frontend/.env`:
     ```env
     VITE_CESIUM_ION_TOKEN=your_cesium_ion_access_token_here
     ```
  3. Restart the Vite dev server (`npm run dev`), or paste your token directly into the in-app **Cesium Setup Modal** to activate the 3D globe immediately without restarting.
  4. Use the top-left **3D Globe / 3D Schematic** toggle button inside the viewport to switch between views anytime.

---

### Option B: Dockerized Persistence (PostgreSQL 17 with pgvector & Redis 7)

To run with containerized PostgreSQL and Redis:
```bash
# From workspace root, start database services
docker-compose up -d

# Verify healthy containers
docker-compose ps
```
The backend automatically detects the PostgreSQL and Redis containers on port 5432 and 6379, enabling pgvector storage and caching. If the containers are stopped, the backend seamlessly switches back to in-memory mode without interrupting active users.

---

## Standalone PyTorch Model Training

The platform includes a dedicated, CPU-optimized training script (`backend/train_models.py`) to generate or retrain the PyTorch `.pt` model weights from scratch:

```bash
cd backend

# Train all models (LSTM Forecaster + DRL Route Policy)
python train_models.py --epochs 25

# Train only the demand forecaster
python train_models.py --models forecasting --epochs 30 --lr 0.005

# Train only the DRL route optimizer
python train_models.py --models routing --epochs 20

# Run silently in scripts or CI
python train_models.py --quiet
```

Checkpoints are persisted in `backend/app/checkpoints/`:
- `forecasting_lstm.pt` (~178 KB)
- `routing_drl.pt` (~76 KB)

*Note: Enterprise IT Administrators can also trigger model retraining directly from the UI or via the `POST /api/v1/admin/retrain-models` REST endpoint.*

---

## Sample API Requests (cURL)

### 1. Demand Forecasting Prediction
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/forecasting/predict" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: director" \
  -d '{
    "sku_id": "SKU-NAS-AGRI-01",
    "forecast_horizon_days": 14,
    "granularity": "daily",
    "include_exogenous_factors": true,
    "exogenous_overrides": {
      "promo_discount_pct": 0.20,
      "weather_severity": "HIGH"
    }
  }'
```

### 2. Fleet Route Optimization
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/routing/optimize" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: dispatcher" \
  -d '{
    "depot_location": {
      "latitude": 18.9496,
      "longitude": 72.9515,
      "name": "JNPT Port Depot"
    },
    "fleet_units": [
      {
        "vehicle_id": "TRK-MH-01",
        "max_capacity_kg": 24000.0,
        "current_fuel_pct": 88.0
      }
    ],
    "deliveries": [
      {
        "delivery_id": "DEL-THN-01",
        "location": { "latitude": 19.2183, "longitude": 72.9781, "name": "Thane Hub" },
        "weight_kg": 4200.0,
        "time_window": { "start": "2026-10-04T08:00:00Z", "end": "2026-10-04T12:00:00Z" }
      },
      {
        "delivery_id": "DEL-NSK-02",
        "location": { "latitude": 19.9975, "longitude": 73.7898, "name": "Nashik Agro" },
        "weight_kg": 6500.0,
        "time_window": { "start": "2026-10-04T13:00:00Z", "end": "2026-10-04T17:00:00Z" }
      }
    ],
    "traffic_mode": "STANDARD"
  }'
```

### 3. Sub-Second HS Code Semantic Classification
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/compliance/hs-classify" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: customs" \
  -d '{
    "description": "Industrial lithium-ion battery packs and rechargeable energy storage cells",
    "declared_hs_code": "8507.60.00",
    "top_k": 3
  }'
```

### 4. Trade Document IDP Parsing & Compliance Audit
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/compliance/parse-doc" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: customs" \
  -d '{
    "sample_id": "SAMPLE-INV-AGRO-02"
  }'
```

### 5. Digital Twin "What-If" Shock Simulation
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/twin/simulate-scenario" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: director" \
  -d '{
    "scenario_id": "port_strike",
    "shock_intensity": 75.0,
    "enable_mitigation": true,
    "simulation_horizon_days": 7
  }'
```

### 6. On-Demand PyTorch Model Retraining (Admin Only)
```bash
curl -X POST "http://127.0.0.1:8000/api/v1/admin/retrain-models" \
  -H "Content-Type: application/json" \
  -H "X-Persona-Role: admin" \
  -d '{
    "models": "all",
    "epochs": 15,
    "lr": 0.005
  }'
```

---

## Interactive Persona Walkthrough & Demo Guide

Follow this guided tour to demonstrate the platform across all four roles:

### Step 1: Supply Chain Director Walkthrough
1. Select **Supply Chain Director** from the top-bar persona dropdown.
2. In the **Executive KPIs** tab, observe high-level corridor volume, on-time SLA ($98.4\%$), forecast error ($4.1\%$), and active transit units.
3. Switch to the **Demand Forecasting** tab:
   - Select an inventory SKU (e.g., `Nashik Organic Agricultural Feeds`).
   - Toggle horizons between **7 Days**, **14 Days**, and **30 Days**.
   - Notice the multi-step neural forecast with shaded **95% Confidence Intervals** and suggested buffer safety stock.
   - Adjust the **Promotional Uplift** and **Weather Disruption** sliders to observe dynamic demand sensitivity.
4. Navigate to the **Digital Twin Command Center** tab:
   - Experience the **3D Cesium Twin Viewport** (or instant **Cyber-Tactical 2.5D/3D Schematic View**).
   - In the top-right camera dock, click **JNPT Port** to glide the camera directly above the marine terminal and inspect its dynamic stock capacity rings.
   - Click on any facility node (or beacon) to slide open the **Facility Inspector Drawer**, displaying live capacity %, inbound container throughput, and active transport conduits.
   - In the **Scenario Studio** (bottom-left drawer), select the **JNPT Port Labor Strike** preset, adjust intensity to **75%**, and observe the red shockwave ring pulsing across Mumbai harbor.
   - Click **Simulate Shock Wave**; within $< 2$ seconds, view the **Comparative Financial Impact Drawer** (bottom-right) revealing Net Savings (₹10,40,000 INR), SLA delays avoided, and mitigation bypass conduits.
   - Notice the **Role Lens Selector** at the top of the impact drawer: as Director, observe executive ROI and financial cost avoidance.

### Step 2: Fleet Dispatcher Walkthrough
1. Switch persona to **Fleet Dispatcher**. Note that the active view dynamically updates to authorized routing workflows.
2. In the **Digital Twin Command Center**:
   - Notice the top ribbon indicates `Fleet Dispatcher` mode with operational telemetry focus.
   - The Scenario Studio shows a clean RBAC advisory note explaining that shock simulation triggers are reserved for Directors and Admins.
   - In the Impact Drawer, switch to the **Dispatcher** lens to focus on fleet detours, delay hours avoided, and alternative bypass conduits around the Kasara Ghat mudslide.
3. Under the **Route & Fleet Optimizer** tab:
   - View the interactive Leaflet map centered over the Western India corridor (Mumbai, JNPT, Thane, Nashik, Pune).
   - Select vehicle `TRK-MH-01` and toggle traffic mode between **Standard** and **Congested** to inspect route duration and emissions penalties.
   - Scroll down to the **Backhaul Freight Matching** section; click **1-Click Assign Backhaul** on a return-haul freight posting to immediately eliminate empty kilometers.
4. In the global **Simulation Controller** bar:
   - Click **Play** to start vehicle telemetry animations along the corridor.
   - Click **Inject Roadblock** to simulate a highway bridge obstruction; observe the vehicle marker dynamically recalculating an alternative bypass route.

### Step 3: Customs & Compliance Officer Walkthrough
1. Switch persona to **Customs Officer**.
2. Under the **Trade Compliance & IDP** tab:
   - Click the preset button **Clean Electronics BoL**; view extracted structured JSON (shipper, consignee, declared value, ports) and notice the **APPROVED** green badge.
   - Click **Discrepant Agro Invoice**; observe the automated compliance engine flagging a critical valuation anomaly and a missing Phytosanitary Certificate with explicit remediation advice.
   - Use the **HS Code Classifier** query box to test any product description (e.g., `solar panel microinverters`) and witness sub-second vector RAG tariff classification.
3. In the **Digital Twin Command Center**:
   - Switch to the **Customs** lens in the Impact Drawer to audit JNPT port clearance dwell times and demurrage cost reductions.

### Step 4: Enterprise IT Administrator Walkthrough
1. Switch persona to **Enterprise IT Administrator**.
2. Open the **IT Administration** tab:
   - Inspect the **Infrastructure & Service Status** cards (PostgreSQL status, Redis status, Gemini AI key configuration, and PyTorch `.pt` model weights).
   - Under **PyTorch Neural Model Re-Training**, select `All Models`, choose `15 Epochs`, and click **Trigger Model Retraining**. Observe the live progress indicator and view the resulting training losses, validation metrics, and updated checkpoint file sizes.
   - In the **RBAC Policy Tester**, click **Run RBAC Guard Test** to verify HTTP 200 OK authorization. Click **Switch to Director (Assert 403)** to verify immediate rejection and security policy enforcement.
3. In the **Digital Twin Command Center**:
   - Switch to the **Admin** lens to inspect real-time DES engine execution latency ($< 5.0$s SLA target), 60+ FPS rendering statistics, and active WebSocket streaming connection health.

---

## Verification & Automated Test Suite

The platform includes an automated end-to-end test suite (93 total tests passing) verifying backend neural inference, REST APIs, WebSocket resynchronization, geospatial topologies, and frontend build integrity:

```bash
# 1. Run backend automated test suite (64 tests)
cd backend
python -m pytest tests/ -v

# 2. Run frontend automated test suite (29 tests)
cd ../frontend
npm test

# 3. Verify zero lint errors
npx oxlint

# 4. Verify production Vite bundle
npm run build
```

---

## License

Enterprise cognitive logistics platform. Developed for multi-echelon corridor optimization.
