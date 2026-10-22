import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.db.connection import Base, db_manager
from app.db.models import (
    WarehouseNode,
    FleetVehicle,
    HSCodeItem,
    InventorySKU,
    HistoricalDailySale,
    ExogenousIndicator,
    RoadNetworkNode,
    DeliveryOrder,
    FreightBackhaul
)

logger = logging.getLogger(__name__)

WESTERN_INDIA_NODES = [
    {
        "node_id": "PORT-JNPT-01",
        "name": "Jawaharlal Nehru Port Trust (JNPT)",
        "city": "Navi Mumbai",
        "node_type": "port",
        "latitude": 18.9496,
        "longitude": 72.9515,
        "storage_capacity_m3": 500000.0,
        "current_utilization_pct": 82.5,
        "handling_rate_units_hr": 4500,
        "operating_cost_per_hr": 850.0
    },
    {
        "node_id": "WH-MUM-01",
        "name": "Mumbai Central Logistics Park",
        "city": "Mumbai",
        "node_type": "regional_hub",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "storage_capacity_m3": 120000.0,
        "current_utilization_pct": 74.0,
        "handling_rate_units_hr": 2200,
        "operating_cost_per_hr": 350.0
    },
    {
        "node_id": "WH-THN-01",
        "name": "Thane Inland Freight Hub",
        "city": "Thane",
        "node_type": "depot",
        "latitude": 19.2183,
        "longitude": 72.9781,
        "storage_capacity_m3": 85000.0,
        "current_utilization_pct": 68.0,
        "handling_rate_units_hr": 1600,
        "operating_cost_per_hr": 240.0
    },
    {
        "node_id": "WH-NSK-01",
        "name": "Nashik Agro & Industrial Depot",
        "city": "Nashik",
        "node_type": "depot",
        "latitude": 19.9975,
        "longitude": 73.7898,
        "storage_capacity_m3": 95000.0,
        "current_utilization_pct": 61.5,
        "handling_rate_units_hr": 1400,
        "operating_cost_per_hr": 210.0
    },
    {
        "node_id": "WH-PUN-01",
        "name": "Pune Auto-Corridor Fulfillment Center",
        "city": "Pune",
        "node_type": "fulfillment_center",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "storage_capacity_m3": 150000.0,
        "current_utilization_pct": 79.0,
        "handling_rate_units_hr": 2800,
        "operating_cost_per_hr": 380.0
    }
]

INITIAL_FLEET = [
    {
        "vehicle_id": "TRK-MH-01",
        "plate_number": "MH-04-AZ-2041",
        "vehicle_type": "Electric Heavy Hauler 24T",
        "max_payload_kg": 24000.0,
        "max_volume_m3": 75.0,
        "current_latitude": 18.9496,
        "current_longitude": 72.9515,
        "status": "transit",
        "battery_fuel_soc_pct": 88.0,
        "cost_per_km": 1.95
    },
    {
        "vehicle_id": "TRK-MH-02",
        "plate_number": "MH-12-BQ-8812",
        "vehicle_type": "Refrigerated Multi-Axle 18T",
        "max_payload_kg": 18000.0,
        "max_volume_m3": 55.0,
        "current_latitude": 19.0760,
        "current_longitude": 72.8777,
        "status": "idle",
        "battery_fuel_soc_pct": 95.0,
        "cost_per_km": 2.45
    },
    {
        "vehicle_id": "TRK-MH-03",
        "plate_number": "MH-15-DX-3390",
        "vehicle_type": "Container Carrier 32T",
        "max_payload_kg": 32000.0,
        "max_volume_m3": 90.0,
        "current_latitude": 19.9975,
        "current_longitude": 73.7898,
        "status": "loading",
        "battery_fuel_soc_pct": 76.0,
        "cost_per_km": 2.80
    }
]

from app.engines.compliance_catalogue import HS_CODE_CATALOGUE

INITIAL_HS_CODES = [
    {
        "hs_code": it["hs_code"],
        "description": it["description"],
        "category": it["category"],
        "tariff_rate_pct": it["tariff_rate_pct"],
        "regulatory_restrictions": it.get("regulatory_restrictions", "")
    }
    for it in HS_CODE_CATALOGUE
]

INITIAL_SKUS = [
    {
        "sku_id": "SKU-NAS-AGRI-01",
        "name": "Nashik Organic Agricultural Feeds",
        "category": "Agriculture",
        "default_warehouse_id": "WH-NSK-01",
        "unit_price_inr": 420.0,
        "holding_cost_per_day": 1.25,
        "base_daily_demand": 450.0,
        "lead_time_days": 4,
        "service_level_target": 0.95,
        "current_stock": 3200
    },
    {
        "sku_id": "SKU-JNPT-ELEC-01",
        "name": "JNPT Semiconductor & Electronic Components",
        "category": "Electronics",
        "default_warehouse_id": "PORT-JNPT-01",
        "unit_price_inr": 12500.0,
        "holding_cost_per_day": 8.50,
        "base_daily_demand": 280.0,
        "lead_time_days": 6,
        "service_level_target": 0.98,
        "current_stock": 1850
    },
    {
        "sku_id": "SKU-PUN-AUTO-01",
        "name": "Pune High-Precision Auto Assemblies",
        "category": "Automotive",
        "default_warehouse_id": "WH-PUN-01",
        "unit_price_inr": 4800.0,
        "holding_cost_per_day": 4.20,
        "base_daily_demand": 340.0,
        "lead_time_days": 5,
        "service_level_target": 0.95,
        "current_stock": 2400
    },
    {
        "sku_id": "SKU-MUM-PHARM-01",
        "name": "Mumbai Critical Cold-Chain Vaccines",
        "category": "Pharmaceuticals",
        "default_warehouse_id": "WH-MUM-01",
        "unit_price_inr": 820.0,
        "holding_cost_per_day": 3.80,
        "base_daily_demand": 520.0,
        "lead_time_days": 3,
        "service_level_target": 0.99,
        "current_stock": 4100
    },
    {
        "sku_id": "SKU-THN-CHEM-01",
        "name": "Thane Industrial Specialty Polymers",
        "category": "Chemicals",
        "default_warehouse_id": "WH-THN-01",
        "unit_price_inr": 950.0,
        "holding_cost_per_day": 2.10,
        "base_daily_demand": 310.0,
        "lead_time_days": 4,
        "service_level_target": 0.95,
        "current_stock": 2600
    }
]


def generate_seed_historical_sales(skus: List[Dict[str, Any]], days: int = 90) -> List[Dict[str, Any]]:
    """
    Generate realistic Western India corridor daily historical sales.
    Includes day-of-week seasonality, occasional promo discounts, and monsoon weather anomaly features.
    """
    random.seed(42)  # Deterministic seed for reproducible testing
    records = []
    base_date = datetime.now(timezone.utc).date() - timedelta(days=days)

    for i in range(days):
        current_date = base_date + timedelta(days=i)
        date_str = current_date.isoformat()
        weekday = current_date.weekday()  # 0=Monday, 6=Sunday

        # Exogenous indicators
        # Monsoon season simulation in Western India (cyclical)
        monsoon_factor = 1.0 + 0.3 * math.sin(i / 15.0)
        is_rainy = random.random() < 0.25
        weather_cond = "Monsoon Rain" if is_rainy else ("Cloudy" if random.random() < 0.3 else "Clear")
        precipitation = round(random.uniform(15.0, 65.0), 1) if is_rainy else 0.0
        temperature = round(24.0 + random.uniform(0, 10) - (4.0 if is_rainy else 0.0), 1)

        # Promotional campaigns occur periodically
        promo_active = (i % 21 in [0, 1, 2, 3])

        for sku in skus:
            base = sku["base_daily_demand"]
            # Day-of-week factor: Tuesday-Thursday peaks (+15%), Sunday lower (-20%)
            dow_multiplier = 0.80 if weekday == 6 else (1.15 if weekday in [1, 2, 3] else 1.0)
            
            promo_discount = round(random.choice([10.0, 15.0, 20.0, 25.0]), 1) if promo_active else 0.0
            promo_boost = 1.0 + (promo_discount * 0.015)  # Elasticity uplift

            # Weather impact: Agri feeds surge during rain, electronics slight drop
            if sku["category"] == "Agriculture":
                weather_multiplier = 1.12 if is_rainy else 1.0
            elif sku["category"] == "Electronics":
                weather_multiplier = 0.92 if is_rainy else 1.0
            else:
                weather_multiplier = 1.0

            noise = random.gauss(0, base * 0.05)
            quantity = int(round(base * dow_multiplier * promo_boost * weather_multiplier + noise))
            quantity = max(10, quantity)

            records.append({
                "date": date_str,
                "sku_id": sku["sku_id"],
                "warehouse_id": sku["default_warehouse_id"],
                "quantity_sold": quantity,
                "promo_discount_pct": promo_discount,
                "weather_condition": weather_cond,
                "precipitation_mm": precipitation,
                "temperature_c": temperature,
                "stockout_flag": False
            })

    return records


def generate_seed_exogenous_indicators(days: int = 90) -> List[Dict[str, Any]]:
    """Generate Western India corridor macro and climate indicators."""
    random.seed(42)
    indicators = []
    base_date = datetime.now(timezone.utc).date() - timedelta(days=days)

    for i in range(days):
        current_date = base_date + timedelta(days=i)
        date_str = current_date.isoformat()
        is_promo = (i % 21 in [0, 1, 2, 3])
        monsoon_score = round(1.0 + 0.4 * abs(math.sin(i / 12.0)), 2)
        fuel_index = round(100.0 + 3.0 * math.sin(i / 20.0) + random.uniform(-0.5, 0.5), 1)

        indicators.append({
            "date": date_str,
            "region": "Western India Corridor (Mumbai-JNPT-Nashik-Pune)",
            "monsoon_severity_score": monsoon_score,
            "fuel_price_index": fuel_index,
            "promo_campaign_active": is_promo,
            "notes": "Western Ghats transit active; seasonal weather monitored."
        })

    return indicators


# Corridor Road Network Graph Nodes for Western India
CORRIDOR_ROAD_NODES = [
    {
        "node_id": "NODE-JNPT",
        "name": "JNPT Port Container Terminal Gateway",
        "city": "Navi Mumbai",
        "latitude": 18.9496,
        "longitude": 72.9515,
        "highway": "NH-348",
        "is_ghat_pass": False,
        "congestion_index": 1.2
    },
    {
        "node_id": "NODE-MUM-CTR",
        "name": "Mumbai Central Freight Junction",
        "city": "Mumbai",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "highway": "Eastern Express Hwy",
        "is_ghat_pass": False,
        "congestion_index": 1.6
    },
    {
        "node_id": "NODE-THN-MAJ",
        "name": "Thane Majiwada Golden Triangle",
        "city": "Thane",
        "latitude": 19.2183,
        "longitude": 72.9781,
        "highway": "NH-48",
        "is_ghat_pass": False,
        "congestion_index": 1.8
    },
    {
        "node_id": "NODE-BHW-LOG",
        "name": "Bhiwandi Integrated Logistics Hub",
        "city": "Bhiwandi",
        "latitude": 19.2967,
        "longitude": 73.0631,
        "highway": "NH-160",
        "is_ghat_pass": False,
        "congestion_index": 1.5
    },
    {
        "node_id": "NODE-KSR-GHT",
        "name": "Kasara Ghat / Thal Pass Summit",
        "city": "Igatpuri",
        "latitude": 19.6967,
        "longitude": 73.5611,
        "highway": "NH-160",
        "is_ghat_pass": True,
        "congestion_index": 2.1
    },
    {
        "node_id": "NODE-NSK-AMB",
        "name": "Nashik Ambad Industrial Interchange",
        "city": "Nashik",
        "latitude": 19.9975,
        "longitude": 73.7898,
        "highway": "NH-160",
        "is_ghat_pass": False,
        "congestion_index": 1.1
    },
    {
        "node_id": "NODE-PNV-EXP",
        "name": "Panvel Expressway Gateway",
        "city": "Panvel",
        "latitude": 18.9894,
        "longitude": 73.1175,
        "highway": "Mumbai-Pune Exp",
        "is_ghat_pass": False,
        "congestion_index": 1.4
    },
    {
        "node_id": "NODE-LNV-GHT",
        "name": "Lonavala Khandala Bhor Ghat Summit",
        "city": "Lonavala",
        "latitude": 18.7557,
        "longitude": 73.4091,
        "highway": "Mumbai-Pune Exp",
        "is_ghat_pass": True,
        "congestion_index": 1.9
    },
    {
        "node_id": "NODE-PUN-CHK",
        "name": "Pune Chakan Heavy Auto Belt",
        "city": "Pune",
        "latitude": 18.7606,
        "longitude": 73.8611,
        "highway": "NH-60",
        "is_ghat_pass": False,
        "congestion_index": 1.3
    },
    {
        "node_id": "NODE-PUN-FC",
        "name": "Pune Central Fulfillment Interchange",
        "city": "Pune",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "highway": "NH-48",
        "is_ghat_pass": False,
        "congestion_index": 1.5
    }
]

# Initial candidate delivery orders across Western India corridor
INITIAL_DELIVERY_ORDERS = [
    {
        "delivery_id": "DEL-THN-01",
        "customer_name": "Godrej & Boyce Industrial Consignment",
        "city": "Thane",
        "address": "Eastern Express Hwy, Majiwada, Thane",
        "latitude": 19.2183,
        "longitude": 72.9781,
        "weight_kg": 4200.0,
        "volume_m3": 14.0,
        "time_window_start": "2026-10-04T08:00:00Z",
        "time_window_end": "2026-10-04T12:00:00Z",
        "priority": "HIGH",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-BHW-02",
        "customer_name": "Flipkart & Amazon E-Commerce Bulk Inbound",
        "city": "Bhiwandi",
        "address": "Mankoli - Anjurphata Link Rd, Bhiwandi",
        "latitude": 19.2967,
        "longitude": 73.0631,
        "weight_kg": 3800.0,
        "volume_m3": 18.5,
        "time_window_start": "2026-10-04T09:30:00Z",
        "time_window_end": "2026-10-04T13:30:00Z",
        "priority": "MEDIUM",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-NSK-01",
        "customer_name": "Mahindra & Mahindra Agro Machinery",
        "city": "Nashik",
        "address": "Satpur Industrial Estate, Nashik",
        "latitude": 19.9975,
        "longitude": 73.7898,
        "weight_kg": 5000.0,
        "volume_m3": 16.0,
        "time_window_start": "2026-10-04T11:00:00Z",
        "time_window_end": "2026-10-04T16:00:00Z",
        "priority": "HIGH",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-NSK-02",
        "customer_name": "Bosch Automotive Ancillary Feeder",
        "city": "Nashik",
        "address": "Ambad MIDC Industrial Cluster, Nashik",
        "latitude": 20.0125,
        "longitude": 73.7420,
        "weight_kg": 6500.0,
        "volume_m3": 21.0,
        "time_window_start": "2026-10-04T12:00:00Z",
        "time_window_end": "2026-10-04T17:00:00Z",
        "priority": "HIGH",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-PUN-01",
        "customer_name": "Tata Motors CV Assembly Plant",
        "city": "Pune",
        "address": "MIDC Phase 2, Chakan, Pune",
        "latitude": 18.7606,
        "longitude": 73.8611,
        "weight_kg": 4800.0,
        "volume_m3": 15.0,
        "time_window_start": "2026-10-04T10:00:00Z",
        "time_window_end": "2026-10-04T15:00:00Z",
        "priority": "HIGH",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-PUN-02",
        "customer_name": "Infosys / Wipro Tech Data Centre Replacements",
        "city": "Pune",
        "address": "Phase 1 Hinjewadi Infotech Park, Pune",
        "latitude": 18.5913,
        "longitude": 73.7389,
        "weight_kg": 2900.0,
        "volume_m3": 9.5,
        "time_window_start": "2026-10-04T11:30:00Z",
        "time_window_end": "2026-10-04T16:30:00Z",
        "priority": "MEDIUM",
        "status": "PENDING"
    },
    {
        "delivery_id": "DEL-MUM-01",
        "customer_name": "Cipla Critical Pharma Hub",
        "city": "Mumbai",
        "address": "MIDC Central Road, Andheri East, Mumbai",
        "latitude": 19.1136,
        "longitude": 72.8697,
        "weight_kg": 1800.0,
        "volume_m3": 6.0,
        "time_window_start": "2026-10-04T08:30:00Z",
        "time_window_end": "2026-10-04T12:30:00Z",
        "priority": "HIGH",
        "status": "PENDING"
    }
]

# Backhaul Freight Postings for Return Legs (eliminating empty kilometers)
INITIAL_BACKHAULS = [
    {
        "backhaul_id": "BHL-NSK-JNPT-01",
        "shipper_name": "Sahyadri Farmers Producer Co. & Wine Exporters",
        "origin_city": "Nashik",
        "origin_latitude": 19.9975,
        "origin_longitude": 73.7898,
        "destination_city": "Navi Mumbai (JNPT)",
        "destination_latitude": 18.9496,
        "destination_longitude": 72.9515,
        "cargo_type": "Export Table Grapes & Sula Wine Casks (Reefer)",
        "cargo_weight_kg": 5200.0,
        "volume_m3": 18.0,
        "payout_inr": 28500.0,
        "available_window_start": "2026-10-04T15:00:00Z",
        "available_window_end": "2026-10-04T22:00:00Z",
        "status": "AVAILABLE"
    },
    {
        "backhaul_id": "BHL-NSK-MUM-02",
        "shipper_name": "Nashik Organic Agricultural Syndicate",
        "origin_city": "Nashik",
        "origin_latitude": 19.9975,
        "origin_longitude": 73.7898,
        "destination_city": "Mumbai Central",
        "destination_latitude": 19.0760,
        "destination_longitude": 72.8777,
        "cargo_type": "Fresh High-Altitude Vegetables & Dairy",
        "cargo_weight_kg": 3800.0,
        "volume_m3": 12.0,
        "payout_inr": 19800.0,
        "available_window_start": "2026-10-04T14:30:00Z",
        "available_window_end": "2026-10-04T21:00:00Z",
        "status": "AVAILABLE"
    },
    {
        "backhaul_id": "BHL-PUN-JNPT-03",
        "shipper_name": "Bharat Forge Global Transmission Exports",
        "origin_city": "Pune",
        "origin_latitude": 18.7606,
        "origin_longitude": 73.8611,
        "destination_city": "Navi Mumbai (JNPT)",
        "destination_latitude": 18.9496,
        "destination_longitude": 72.9515,
        "cargo_type": "Machined Heavy Axles & Export Gearboxes",
        "cargo_weight_kg": 7400.0,
        "volume_m3": 14.5,
        "payout_inr": 36000.0,
        "available_window_start": "2026-10-04T16:00:00Z",
        "available_window_end": "2026-10-04T23:00:00Z",
        "status": "AVAILABLE"
    },
    {
        "backhaul_id": "BHL-PUN-THN-04",
        "shipper_name": "Tata Autocomp Sensor Systems",
        "origin_city": "Pune",
        "origin_latitude": 18.5204,
        "origin_longitude": 73.8567,
        "destination_city": "Thane",
        "destination_latitude": 19.2183,
        "destination_longitude": 72.9781,
        "cargo_type": "Electric Vehicle Wiring Harnesses & Sensors",
        "cargo_weight_kg": 3100.0,
        "volume_m3": 10.0,
        "payout_inr": 21500.0,
        "available_window_start": "2026-10-04T15:00:00Z",
        "available_window_end": "2026-10-04T20:30:00Z",
        "status": "AVAILABLE"
    },
    {
        "backhaul_id": "BHL-THN-JNPT-05",
        "shipper_name": "APM Terminals Intermodal Logistics",
        "origin_city": "Thane",
        "origin_latitude": 19.2183,
        "origin_longitude": 72.9781,
        "destination_city": "Navi Mumbai (JNPT)",
        "destination_latitude": 18.9496,
        "destination_longitude": 72.9515,
        "cargo_type": "Container Spare Hardware & Maritime Rigging",
        "cargo_weight_kg": 4600.0,
        "volume_m3": 11.0,
        "payout_inr": 16200.0,
        "available_window_start": "2026-10-04T13:00:00Z",
        "available_window_end": "2026-10-04T18:00:00Z",
        "status": "AVAILABLE"
    }
]

# Cached fallback fixtures accessible in memory
FALLBACK_SKUS = INITIAL_SKUS
FALLBACK_HISTORICAL_SALES = generate_seed_historical_sales(INITIAL_SKUS, days=90)
FALLBACK_EXOGENOUS = generate_seed_exogenous_indicators(days=90)
FALLBACK_ROAD_NODES = CORRIDOR_ROAD_NODES
FALLBACK_DELIVERY_ORDERS = INITIAL_DELIVERY_ORDERS
FALLBACK_BACKHAULS = INITIAL_BACKHAULS


def seed_initial_data(db: Session = None):
    """Seed Western India corridor data into relational store."""
    engine = db_manager.engine
    Base.metadata.create_all(bind=engine)

    owns_session = False
    if db is None:
        db = db_manager.session_maker()
        owns_session = True

    try:
        # Check if already seeded
        if db.query(WarehouseNode).first() is None:
            logger.info("Seeding Western India corridor warehouse nodes...")
            for node_data in WESTERN_INDIA_NODES:
                db.add(WarehouseNode(**node_data))

        if db.query(FleetVehicle).first() is None:
            logger.info("Seeding initial fleet vehicles...")
            for v_data in INITIAL_FLEET:
                db.add(FleetVehicle(**v_data))

        if db.query(HSCodeItem).first() is None:
            logger.info("Seeding HS code master items...")
            for hs_data in INITIAL_HS_CODES:
                db.add(HSCodeItem(**hs_data))

        if db.query(InventorySKU).first() is None:
            logger.info("Seeding inventory SKU master catalog...")
            for sku_data in INITIAL_SKUS:
                db.add(InventorySKU(**sku_data))

        if db.query(HistoricalDailySale).first() is None:
            logger.info("Seeding historical daily sales series...")
            for sale_data in FALLBACK_HISTORICAL_SALES:
                db.add(HistoricalDailySale(**sale_data))

        if db.query(ExogenousIndicator).first() is None:
            logger.info("Seeding exogenous corridor indicators...")
            for exo_data in FALLBACK_EXOGENOUS:
                db.add(ExogenousIndicator(**exo_data))

        if db.query(RoadNetworkNode).first() is None:
            logger.info("Seeding road network graph nodes...")
            for road_data in CORRIDOR_ROAD_NODES:
                db.add(RoadNetworkNode(**road_data))

        if db.query(DeliveryOrder).first() is None:
            logger.info("Seeding candidate delivery orders...")
            for del_data in INITIAL_DELIVERY_ORDERS:
                db.add(DeliveryOrder(**del_data))

        if db.query(FreightBackhaul).first() is None:
            logger.info("Seeding return backhaul freight listings...")
            for bhl_data in INITIAL_BACKHAULS:
                db.add(FreightBackhaul(**bhl_data))

        db.commit()
        logger.info("Seed data successfully committed.")
    except Exception as e:
        db.rollback()
        logger.error("Failed to seed initial data: %s", str(e))
    finally:
        if owns_session:
            db.close()

