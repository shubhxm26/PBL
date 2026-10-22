# Specification: Cognitive Software-Driven Smart Logistics Platform

## Problem Statement

Modern enterprise logistics and supply chain networks operate under severe friction caused by disconnected, legacy software systems:

1. **Inaccurate Demand Forecasting**: Traditional statistical methods (e.g., linear regressions, basic ARIMA) treat historical sales linearly, failing to adapt to sudden demand surges, macroeconomic shocks, promotional seasonality, or regional weather disruptions. This leads to costly overstocking, warehouse bloat, or critical stockouts.
2. **Sub-optimal Fleet Routing & High Carbon Footprint**: Static dispatching and classical heuristic routing fail to react dynamically to live traffic jams, sudden road hazards, and tight delivery windows. Fleets suffer from excessive fuel consumption, delivery SLA violations, and high percentages of unladen "empty kilometers."
3. **Severe Cross-Border Documentation Bottlenecks**: Logistics compliance teams spend hundreds of hours manually reviewing unstructured trade documents (Bills of Lading, Commercial Invoices, Packing Lists). Manual entry yields high error rates, incorrect Harmonized System (HS) classifications, customs fines, and shipment holds at entry ports.
4. **Lack of Proactive Risk & Disruption Stress-Testing**: Supply chain planners have no sandbox to simulate sudden operational shocks (such as port labor strikes, severe weather events, or major highway bridge closures). Disconnected data silos make it impossible to evaluate multi-echelon inventory ripple effects in real time before disaster strikes.

---

## Solution

The Cognitive Software-Driven Smart Logistics Platform is an intelligent orchestration layer that bridges enterprise data feeds with deep neural networks, reinforcement learning, local semantic retrieval, and discrete-event simulation.

From the user's perspective, the platform provides a unified, real-time command center:

- **Predictive Demand Forecasting**: Users select SKUs and forecast horizons to instantly receive multi-step neural predictions (using PyTorch LSTM/GRU) enriched with exogenous weather and promotional factors, bounded by 95% confidence intervals and dynamic safety stock thresholds.
- **Dynamic Fleet Routing & Freight Matching**: Dispatchers input delivery stops, vehicle specs, and live traffic modes to obtain optimized route sequences with turn-by-turn waypoints, fuel consumption estimates, and integrated return-trip freight matching to eliminate empty runs.
- **Automated Trade Compliance & IDP Orchestrator**: Customs officers can upload shipping PDFs/images or select sample documents to receive structured, validated JSON extractions (via Google Gemini) along with sub-second HS Code classification (via local vector embeddings) and automated discrepancy warnings.
- **Digital Twin "What-If" Scenario Studio**: Supply chain leaders can inject disruptions (e.g., port closures, extreme monsoons, highway roadblocks) to observe discrete-event simulation ripples across multi-echelon nodes, comparing baseline vs. mitigated metrics side-by-side.
- **Interactive Live Telemetry & Persona Switcher**: A global simulation toolbar allows users to play, pause, adjust speed, and inject roadblocks into live vehicle movements, while a top-bar persona selector customizes the interface for Directors, Dispatchers, Customs Officers, and IT Admins.

---

## User Stories

### Persona 1: Supply Chain Director
1. As a Supply Chain Director, I want to view high-level network KPIs (total freight cost, active vehicle fleet, on-time SLA rate, average forecast error) on the executive overview, so that I can monitor holistic supply chain health at a glance.
2. As a Supply Chain Director, I want to select different forecast horizons (7, 14, 30 days) for key inventory SKUs, so that I can plan procurement schedules with statistical confidence.
3. As a Supply Chain Director, I want to see lower and upper 95% confidence intervals around demand forecasts, so that I can evaluate demand volatility risks.
4. As a Supply Chain Director, I want automated safety stock recommendations calculated from demand variance and lead times, so that my warehouses avoid stockouts without overstocking capital.
5. As a Supply Chain Director, I want to execute discrete-event "What-If" simulations for unforeseen events (such as port closures or regional severe weather), so that I can quantify potential financial losses and shipment delays before disruptions occur.
6. As a Supply Chain Director, I want a side-by-side comparison between baseline operations and mitigated strategies during a simulated shock, so that I can present clear contingency plans to leadership.
7. As a Supply Chain Director, I want to see multi-echelon inventory levels across all fulfillment tiers (ports, regional hubs, local depots), so that I can identify inventory bottlenecks.
8. As a Supply Chain Director, I want to monitor estimated fleet CO2 emissions and fuel burn across optimized routes, so that our organization meets sustainability compliance targets.

### Persona 2: Fleet & Logistics Dispatcher
9. As a Fleet Dispatcher, I want to view an interactive geospatial map showing all depots, delivery stops, and active transit vehicles, so that I have complete situational awareness.
10. As a Fleet Dispatcher, I want to optimize multi-stop vehicle delivery routes with vehicle capacity constraints, so that trucks are not overloaded.
11. As a Fleet Dispatcher, I want the route optimizer to account for customer delivery time windows, so that deliveries arrive on time and avoid SLA penalty fines.
12. As a Fleet Dispatcher, I want live traffic congestion telemetry factored into route calculations, so that drivers bypass bottlenecks automatically.
13. As a Fleet Dispatcher, I want to inject simulated roadblocks or highway closures onto active routes, so that I can test the system's dynamic re-routing responsiveness.
14. As a Fleet Dispatcher, I want to see real-time vehicle telematics (GPS, speed, fuel state of charge, idle time), so that I can monitor driver safety and vehicle health.
15. As a Fleet Dispatcher, I want an integrated freight matching tool to match available vehicle return capacity with shipper cargo requests, so that I reduce unladen empty kilometers.
16. As a Fleet Dispatcher, I want turn-by-turn waypoint sequences and estimated arrival times for each stop, so that I can communicate schedules to warehouse receiving teams.
17. As a Fleet Dispatcher, I want to control simulation playback (Play, Pause, 1x–5x Speed), so that I can demonstrate and evaluate route progression at my own pace.

### Persona 3: Customs & Compliance Officer
18. As a Customs Officer, I want to upload unstructured shipping documents (Bills of Lading, Commercial Invoices, Packing Lists) in PDF or image format, so that entity data is extracted automatically into structured JSON.
19. As a Customs Officer, I want 1-click access to pre-loaded sample shipping documents, so that I can evaluate extraction capabilities without having to source external files.
20. As a Customs Officer, I want to view extracted trade entities (shipper, consignee, vessel, ports of loading/discharge, line items, weights, declared values) side-by-side with confidence scores, so that I can verify data fidelity.
21. As a Customs Officer, I want item textual descriptions automatically classified against international Harmonized System (HS) codebooks using vector search, so that customs tariff codes are assigned in sub-seconds.
22. As a Customs Officer, I want automated discrepancy checks between invoice lines and trade regulations (such as missing certificates of origin or tariff discrepancies), so that non-compliant shipments are flagged before customs submission.
23. As a Customs Officer, I want to inspect compliance alerts and risk flags with clear remediation advice, so that regulatory fines and border delays are prevented.
24. As a Customs Officer, I want to generate standardized shipping contract summaries highlighting liability terms and fee clauses, so that legal risks are mitigated.

### Persona 4: Enterprise IT Administrator
25. As an Enterprise IT Administrator, I want to switch between user personas with a single click, so that I can verify role-based permissions and interface views without logging in and out.
26. As an Enterprise IT Administrator, I want all external APIs to strictly validate incoming payloads against well-defined schemas, so that bad data from legacy ERPs does not crash backend engines.
27. As an Enterprise IT Administrator, I want WebSocket telemetry connections with automatic reconnection and heartbeat handling, so that client dashboards remain synced with server state.
28. As an Enterprise IT Administrator, I want the backend to support Dockerized PostgreSQL with pgvector and Redis, while offering in-memory fallbacks if services are offline, so that system availability is guaranteed.
29. As an Enterprise IT Administrator, I want an on-demand endpoint to trigger PyTorch model re-training or fine-tuning, so that models can be updated as new historical data arrives.
30. As an Enterprise IT Administrator, I want health check endpoints reporting the status of database connections, model weights, and external AI services, so that infrastructure monitoring tools can verify uptime.

---

## Implementation Decisions

### 1. Module Boundaries & Architecture
- **Monorepo Layout**: The project is organized into two primary application directories:
  - `backend`: Houses the FastAPI application, PyTorch model definitions, discrete-event simulation routines, vector search engines, and database access layer.
  - `frontend`: Houses the Vite + React client application, Tailwind CSS styling, Leaflet mapping components, Chart.js visualizations, and WebSocket clients.
- **Isolation Constraint**: All application artifacts, Docker configurations, and model checkpoints reside exclusively inside the workspace directory (`c:\Users\Asus\Desktop\PBL`). No Git operations or interactions with outer repositories are permitted.

### 2. Cognitive Logistics Engines
- **Predictive Demand Forecasting Engine**:
  - Implemented using a PyTorch neural network architecture (LSTM/GRU) capable of ingesting sequential historical sales data coupled with exogenous features (regional weather anomalies, promotional discounts).
  - Produces multi-horizon daily point predictions, 95% confidence bands (via quantile / residual variance estimation), and safety stock recommendations based on standard lead-time formulas.
- **Dynamic Route Optimization Engine**:
  - Formulated as a dynamic Vehicle Routing Problem (VRP) solved using a PyTorch Deep Reinforcement Learning (DRL) agent (policy-based / Q-learning graph scoring) combined with dynamic edge weight adjustments based on live traffic congestion.
  - Features an integrated Freight Matching component that evaluates vehicle volume/payload constraints against shipper cargo postings to optimize backhauls.
- **LLM & RAG Compliance Orchestrator**:
  - Employs local transformer embeddings (PyTorch / HuggingFace `transformers`) for sub-second vector similarity retrieval against an international HS Code catalogue and customs rulebook.
  - Utilizes the Google GenAI SDK (`google-genai`) with Gemini models for Intelligent Document Processing (IDP), parsing unstructured shipping documents into strict JSON structures and flagging compliance discrepancies.
- **Cognitive Digital Twin Simulator**:
  - Implemented as a discrete-event simulation (DES) modeling supply chain nodes (ports, regional warehouses, fulfillment centers) and transit links.
  - Supports user-injected shock events (Port Strike, Extreme Monsoon, Highway Collapse) and computes multi-echelon inventory propagation, SLA delays, financial impact, and automated mitigation routing.

### 3. Real-Time Telemetry & Simulation Controller
- **WebSocket Streaming**: A centralized WebSocket endpoint broadcasts live simulation ticks, vehicle GPS coordinates, sensor readings (speed, fuel, temperature), and re-routing alerts to connected frontends.
- **Simulation Playback Toolbar**: The frontend features a unified controller providing Play, Pause, Step, Speed (1x, 2x, 5x), and a one-click "Inject Roadblock" trigger.

### 4. Data Layer & Orchestration
- **Containerized Persistence**: A workspace-level `docker-compose.yml` configures PostgreSQL 17 with the `pgvector` extension (for persistent vector search and relational entities) and Redis (for feature caching and state queues).
- **Graceful Fallback**: The backend includes self-healing fallbacks: if PostgreSQL or Redis are not reachable, the system gracefully falls back to local in-memory fixtures so that the application remains fully functional during demonstrations.
- **Seeded Domain Data**: Pre-seeded with realistic logistics data for the Western India economic corridor (Mumbai Port / JNPT, Thane, Nashik, Pune), including warehouse capacities, fleet specs, and historical sales series.

### 5. Role-Based Access Control (RBAC) & Persona Switcher
- The frontend features a persistent top-bar persona selector with four roles: Supply Chain Director, Fleet Dispatcher, Customs Officer, and IT Administrator.
- Switching personas immediately updates active tab access, action permissions, and relevant KPI widgets, while attaching appropriate role headers to outbound API requests.

---

## Testing Decisions

### Testing Seam
The platform will be tested at the **Highest Possible Seam**: the **External API Integration Seam** and **UI Action Seam**:
1. **API Integration Seam**: We test the entire system by sending real HTTP requests and WebSocket messages to the FastAPI application endpoints:
   - Demand forecasting requests (`/api/v1/forecasting/predict`) asserting schema validity, horizon bounds, and confidence interval ordering ($lower \le point \le upper$).
   - Route optimization requests (`/api/v1/routing/optimize`) asserting valid waypoint sequences, vehicle capacity compliance, and traffic mode adjustments.
   - Compliance endpoints (`/api/v1/compliance/parse-doc`, `/api/v1/compliance/hs-classify`) asserting structured JSON outputs, valid HS codes, and discrepancy detection.
   - Scenario simulation requests (`/api/v1/twin/simulate-scenario`) asserting discrete-event execution completion in $< 5$ seconds and comparative metrics calculation.
2. **Behavioral Testing Criteria**:
   - Tests assert observable system behaviors and output contracts, rather than private internal method implementations.
   - Tests verify that failure modes (e.g. invalid document formats, missing fields, or network disruption) yield clear structured error responses with fallback defaults.

---

## Out of Scope

1. **Physical Hardware / IoT Device Deployment**: The platform operates as a software-only orchestration layer using simulated or API-driven telematics; physical OBD-II / GPS hardware provisioning is out of scope.
2. **Direct Production ERP / TMS Modifications**: Legacy ERP (SAP, Oracle) and TMS write-backs will be demonstrated via simulated API dispatch payloads rather than live enterprise production database writes.
3. **Multi-Region Cloud Kubernetes Clusters**: Deployment orchestration for this prototype is scoped to local Docker Compose and developer environments; multi-region geo-replicated K8s clusters are out of scope.
4. **Third-Party Commercial Map API Keys**: The frontend map uses open-access Leaflet.js with OpenStreetMap tiles to eliminate mandatory third-party commercial billing dependencies.

---

## Further Notes

- **AI SDK Usage**: The system uses the modern official `google-genai` SDK with the configured `GEMINI_API_KEY` present in the workspace `.env`.
- **CPU-Friendly Execution**: PyTorch models are designed and pre-trained with lightweight, compact architectures ensuring sub-second inference and rapid execution on standard CPU hardware without requiring dedicated GPUs.
