```markdown
# Smart Logistics Platform: API & Dataset Requirements Specification

## 1. Comprehensive Dataset Requirements

The platform relies on a combination of enterprise historical data, streaming real-time operational feeds, unstructured regulatory corpora, and spatial-temporal datasets across four core system modules.

### 1.1 Predictive Demand Forecasting Engine Datasets

| Dataset Name | Data Type & Format | Source / Origin | Update Frequency | Key Fields / Features |
| :--- | :--- | :--- | :--- | :--- |
| **Historical Enterprise Sales & Orders** | Structured (`.parquet` / Delta Lake) | ERP / POS Systems | Daily / Batch | `timestamp`, `sku_id`, `warehouse_id`, `quantity_sold`, `unit_price`, `stockout_flag` |
| **Microeconomic & Macroeconomic Feeds** | Time-Series (`JSON` / CSV) | Trading Economics, World Bank API | Weekly / Monthly | `cpi_index`, `regional_fuel_price`, `inflation_rate`, `consumer_confidence_index` |
| **Regional Weather & Climate Feeds** | Spatial-Temporal NetCDF / JSON | NOAA, OpenWeatherMap, ERA5 | Hourly / 3-Hourly | `latitude`, `longitude`, `precipitation_mm`, `temperature_c`, `wind_speed`, `storm_warning` |
| **Promotions & Marketing Events** | Unstructured / Semi-Structured JSON | Enterprise Marketing DB | Weekly | `campaign_id`, `targeted_skus`, `discount_percentage`, `start_date`, `end_date`, `region` |

---

### 1.2 Route Optimization & Fleet Management Datasets

| Dataset Name | Data Type & Format | Source / Origin | Update Frequency | Key Features & Metrics |
| :--- | :--- | :--- | :--- | :--- |
| **Spatial Road Network Graphs** | Vector Graph (`OSM` / Protobuf) | OpenStreetMap, HERE Maps | Monthly | `node_id`, `edge_id`, `distance_km`, `speed_limit`, `road_class`, `height_weight_restrictions` |
| **Live Vehicular Telematics** | Streaming Time-Series (`JSON` / MQTT) | 3PL Fleet GPS, OBD-II | Real-time (1–5 sec) | `vehicle_id`, `latitude`, `longitude`, `speed_kmh`, `fuel_soc_pct`, `engine_temp`, `idle_time` |
| **Traffic Congestion Logs** | Spatial Grid Vector (`GeoJSON`) | TomTom / Mapbox API | Streaming (1–5 min) | `segment_id`, `average_speed`, `delay_seconds`, `incident_type`, `roadblock_flag` |
| **Fleet Specifications & Capacity** | Relational DB (`PostgreSQL`) | TMS Fleet Registry | On Changes | `vehicle_id`, `max_volume_m3`, `max_payload_kg`, `refrigerated_flag`, `cost_per_km` |

---

### 1.3 LLM & RAG Compliance & Document Datasets

| Dataset Name | Data Type & Format | Source / Origin | Update Frequency | Purpose / Application |
| :--- | :--- | :--- | :--- | :--- |
| **Harmonized System (HS) Codebook** | Vector Embeddings & Structured JSON | World Customs Organization (WCO) | Annual / Quarterly | Semantic vector search for automated 6-to-10 digit HS code mapping based on item text descriptions[cite: 1]. |
| **Global Trade & Tariff Regulations** | Text Documents (`PDF`, `HTML`, Vectors) | Customs Authorities (e.g., CBP, EU TARIC) | Monthly / On Update | RAG knowledge base for validating customs declarations, import permits, and tariff calculations[cite: 1]. |
| **Historical Logistics Documents** | Unstructured PDFs & Scanned Images | Legacy WMS / TMS Archives | Batch Baseline | Pre-training and fine-tuning target schemas for OCR/IDP parsing of Bills of Lading, Invoices, and Packing Lists[cite: 1]. |
| **Standardized Contract Templates** | Text Templates / Markdown | Legal & Compliance Ops | On Regulatory Updates | Seed prompts and clause libraries for multi-agent dynamic shipping contract generation[cite: 1]. |

---

### 1.4 Digital Twin Simulation Datasets

| Dataset Name | Data Type & Format | Source / Origin | Update Frequency | Purpose / Application |
| :--- | :--- | :--- | :--- | :--- |
| **Warehouse & Fulfillment Node Specs** | Structured JSON / Graph | Enterprise WMS | Dynamic / Real-time | `node_id`, `storage_capacity_m3`, `dock_doors`, `handling_rate_units_hr`, `operating_cost` |
| **Disruption Scenario Logs** | Event Traces (`JSON-LD`) | Synthetic Stress Tests & Port Logs | Historical / On Demand | Historical logs of port congestion spikes, labor strikes, and extreme weather disruptions used to train "What-If" AI models[cite: 1]. |

---

## 2. API Architecture & Interface Requirements

The platform exposes RESTful JSON APIs for synchronous analytical processing, gRPC endpoints for high-throughput streaming/telemetry, and Webhooks for event-driven alerts.


```

```
   ┌────────────────────────────────────────────────────────┐
   │   Client Applications / Enterprise Systems (ERP/TMS)  │
   └──────────────────────────┬─────────────────────────────┘
                              │ (HTTPS REST / gRPC)
                              ▼

```

┌─────────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY LAYER                                 │
│          (Authentication, Rate Limiting, Request Schema Validation)             │
└──────┬──────────────────────────┬───────────────────────┬───────────────────────┘
│                          │                       │
▼                          ▼                       ▼
┌───────────────┐        ┌─────────────────┐     ┌──────────────────┐
│  Forecasting  │        │  Route Agent    │     │  Compliance/RAG  │
│  Microservice │        │  Microservice   │     │  Microservice    │
└──────┬────────┘        └────────┬────────┘     └────────┬─────────┘
│                          │                       │
└──────────────────────────┼───────────────────────┘
▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    DIGITAL TWIN SIMULATOR CO-SIMULATION ENGINE                  │
└─────────────────────────────────────────────────────────────────────────────────┘

```

### 2.1 API Endpoint Specification Matrix

| Method | Endpoint Path | Content Type | Target Service | Function & Expected SLA |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/forecasting/predict` | `application/json` | Demand Forecasting Engine | Ingests SKU IDs and horizon parameters; returns predicted demand with confidence intervals[cite: 1]. **SLA < 800ms**. |
| `POST` | `/api/v1/routing/optimize` | `application/json` | DRL Route Optimization Agent | Accepts matrix of stops, vehicle constraints, and live traffic state; returns optimized route order and ETA[cite: 1]. **SLA < 1.5s**. |
| `POST` | `/api/v1/compliance/parse-doc` | `multipart/form-data` | LLM IDP Engine | Accepts unstructured document uploads (PDF/JPG); extracts structured, validated JSON representation[cite: 1]. **SLA < 3.0s**. |
| `POST` | `/api/v1/compliance/hs-classify` | `application/json` | RAG Compliance Service | Ingests product description and destination country; returns candidate HS codes with vector match confidence scores[cite: 1]. **SLA < 500ms**. |
| `POST` | `/api/v1/twin/simulate-scenario` | `application/json` | Digital Twin Discrete-Event Simulator | Triggers a "What-If" scenario (e.g., port closure duration); returns dynamic network risk analysis and alternative routes[cite: 1]. **SLA < 5.0s**. |
| `POST` | `/api/v1/telemetry/ingress` | `application/grpc` | Ingestion Gateway | Streaming gRPC channel for receiving real-time vehicle GPS, OBD-II logs, and WMS inventory events[cite: 1]. **Latency < 50ms**. |

---

### 2.2 Endpoint Payload Specifications

#### A. Demand Forecasting API (`/api/v1/forecasting/predict`)

**Request Payload:**
```json
{
  "request_id": "req-99201-a",
  "forecast_horizon_days": 14,
  "granularity": "daily",
  "warehouse_ids": ["WH-NASHIK-01", "WH-MUMBAI-02"],
  "sku_list": ["SKU-ELECTRONICS-882", "SKU-AGRI-102"],
  "include_exogenous_factors": true
}

```

**Response Payload:**

```json
{
  "request_id": "req-99201-a",
  "status": "SUCCESS",
  "generated_at": "2026-10-01T20:15:00Z",
  "forecasts": [
    {
      "sku_id": "SKU-ELECTRONICS-882",
      "warehouse_id": "WH-NASHIK-01",
      "predictions": [
        {
          "date": "2026-10-02",
          "predicted_demand_units": 450,
          "confidence_interval_95": {
            "lower": 410,
            "upper": 490
          },
          "recommended_safety_stock": 120
        }
      ]
    }
  ]
}

```

---

#### B. Document Parsing & Extraction API (`/api/v1/compliance/parse-doc`)

**Request:** `multipart/form-data` with `file=@bill_of_lading_992.pdf` and `doc_type="BILL_OF_LADING"`.

**Response Payload:**

```json
{
  "document_id": "doc-88102-x",
  "parsed_status": "VALIDATED",
  "confidence_score": 0.982,
  "extracted_data": {
    "shipper": {
      "name": "AgriTech Solutions Ltd",
      "address": "Nashik, MH, India"
    },
    "consignee": {
      "name": "Global Port Services",
      "address": "Rotterdam, Netherlands"
    },
    "carrier_code": "MAEU",
    "vessel_name": "MAERSK MC-KINNEY",
    "port_of_loading": "INBOM",
    "port_of_discharge": "NLRTM",
    "cargo_items": [
      {
        "line_item": 1,
        "description": "Temperature controlled organic agricultural produce",
        "gross_weight_kg": 18400.0,
        "assigned_hs_code": "0709.99"
      }
    ]
  },
  "compliance_flags": []
}

```

---

#### C. Route Optimization API (`/api/v1/routing/optimize`)

**Request Payload:**

```json
{
  "depot_location": {
    "latitude": 19.9975,
    "longitude": 73.7898
  },
  "fleet_units": [
    {
      "vehicle_id": "TRUCK-01",
      "max_capacity_kg": 5000,
      "current_fuel_pct": 85.0
    }
  ],
  "deliveries": [
    {
      "delivery_id": "DEL-101",
      "location": {
        "latitude": 19.2183,
        "longitude": 72.9781
      },
      "weight_kg": 1200,
      "time_window": {
        "start": "2026-10-02T08:00:00Z",
        "end": "2026-10-02T12:00:00Z"
      }
    }
  ],
  "traffic_mode": "REALTIME"
}

```

**Response Payload:**

```json
{
  "route_id": "RT-88219-N",
  "total_distance_km": 168.4,
  "estimated_duration_minutes": 210,
  "empty_distance_km": 12.1,
  "waypoints_sequence": [
    {
      "stop_order": 1,
      "type": "DEPOT",
      "arrival_time": "2026-10-02T07:30:00Z"
    },
    {
      "stop_order": 2,
      "type": "DELIVERY",
      "delivery_id": "DEL-101",
      "arrival_time": "2026-10-02T10:15:00Z"
    }
  ],
  "fuel_consumption_liters": 22.4
}

```

---

## 3. Data Pipeline, Storage Architecture & Governance

### 3.1 Data Pipeline Infrastructure

* **Streaming Telemetry Layer**: Apache Kafka / Eclipse Mosquitto (MQTT) handling incoming IoT telemetry, vehicle GPS updates, and sensor feeds.


* **Batch Ingestion Layer**: Apache Airflow DAGs orchestrating nightly ETL jobs to pull transaction logs from legacy ERP and WMS databases.


* **Feature Store**: Redis / Feast serving as a low-latency feature store for real-time inference (e.g., retrieving recent 15-minute moving average traffic speeds for DRL routing agents).



### 3.2 Polyglot Persistence Framework

```
                          ┌────────────────────────┐
                          │ Data Pipeline / Ingest │
                          └───────────┬────────────┘
                                      │
     ┌──────────────────┬─────────────┼──────────────┬──────────────────┐
     ▼                  ▼             ▼              ▼                  ▼
┌──────────────┐  ┌───────────┐  ┌──────────┐  ──────────────┐  ┌──────────────┐
│  Vector DB   │  │ Time-     │  │ Graph DB │  │ Relational   │  │ Data Lake    │
│ (Qdrant /    │  │ Series    │  │ (Neo4j)  │  │ DB           │  │ (Parquet /   │
│  Milvus)     │  │ (Timescale│  │          │  │ (PostgreSQL) │  │  S3 / Delta) │
│              │  │  / Influx)│  │          │  │              │  │              │
└──────────────┘  └───────────┘  └──────────┘  ──────────────┘  └──────────────┘

```

* **Vector Database (Qdrant / Milvus)**: Stores dense embeddings of global trade regulations, HS code descriptions, and customs compliance guidelines for RAG.


* **Time-Series Database (TimescaleDB / InfluxDB)**: Stores high-frequency vehicle telemetry, traffic speeds, and sensor logs.


* **Graph Database (Neo4j)**: Maps supply chain physical topology, inter-warehouse routes, carrier networks, and multi-echelon dependencies.


* **Relational Database (PostgreSQL)**: Stores user credentials, system configuration, master metadata, and transactional audit trails.


* **Object Storage / Data Lake (AWS S3 / Delta Lake)**: Houses raw document PDFs, historical `.parquet` dataset snapshots, and training logs for deep learning models.



---

### 3.3 Data Quality & LLM Governance Controls

* **JSON Schema Enforcement**: Every output generated by LLM instances must strictly conform to predefined Pydantic / JSON schemas; invalid outputs automatically trigger an immediate programmatic re-prompting or rule-based fallback.


* **Data Anonymization**: Automatic PII (Personally Identifiable Information) masking on invoice and contract documents prior to sending text data to external LLM processing APIs.


* **Telemetry Sanity Validation**: Outlier filtering algorithms (e.g., isolation forests) reject corrupted GPS readings (e.g., sudden speed spikes over 200 km/h) before feeding telemetry into the Digital Twin state matrix.



```

```

