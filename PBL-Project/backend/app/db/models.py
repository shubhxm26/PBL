from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime
from datetime import datetime, timezone
from app.db.connection import Base


class WarehouseNode(Base):
    __tablename__ = "warehouse_nodes"

    node_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=False)
    node_type = Column(String(50), nullable=False)  # port, regional_hub, depot
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    storage_capacity_m3 = Column(Float, nullable=False, default=10000.0)
    current_utilization_pct = Column(Float, nullable=False, default=65.0)
    handling_rate_units_hr = Column(Integer, nullable=False, default=1200)
    operating_cost_per_hr = Column(Float, nullable=False, default=150.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FleetVehicle(Base):
    __tablename__ = "fleet_vehicles"

    vehicle_id = Column(String(50), primary_key=True, index=True)
    plate_number = Column(String(30), nullable=False)
    vehicle_type = Column(String(50), nullable=False)
    max_payload_kg = Column(Float, nullable=False, default=16000.0)
    max_volume_m3 = Column(Float, nullable=False, default=60.0)
    current_latitude = Column(Float, nullable=False)
    current_longitude = Column(Float, nullable=False)
    status = Column(String(30), nullable=False, default="idle")  # idle, transit, maintenance
    battery_fuel_soc_pct = Column(Float, nullable=False, default=100.0)
    cost_per_km = Column(Float, nullable=False, default=2.4)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class HSCodeItem(Base):
    __tablename__ = "hs_code_items"

    hs_code = Column(String(20), primary_key=True, index=True)
    description = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    tariff_rate_pct = Column(Float, nullable=False, default=7.5)
    regulatory_restrictions = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class InventorySKU(Base):
    __tablename__ = "inventory_skus"

    sku_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    category = Column(String(50), nullable=False)
    default_warehouse_id = Column(String(50), nullable=False)
    unit_price_inr = Column(Float, nullable=False, default=150.0)
    holding_cost_per_day = Column(Float, nullable=False, default=1.5)
    base_daily_demand = Column(Float, nullable=False, default=400.0)
    lead_time_days = Column(Integer, nullable=False, default=5)
    service_level_target = Column(Float, nullable=False, default=0.95)
    current_stock = Column(Integer, nullable=False, default=2500)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class HistoricalDailySale(Base):
    __tablename__ = "historical_daily_sales"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(20), nullable=False, index=True)
    sku_id = Column(String(50), nullable=False, index=True)
    warehouse_id = Column(String(50), nullable=False)
    quantity_sold = Column(Integer, nullable=False)
    promo_discount_pct = Column(Float, nullable=False, default=0.0)
    weather_condition = Column(String(50), nullable=False, default="Clear")
    precipitation_mm = Column(Float, nullable=False, default=0.0)
    temperature_c = Column(Float, nullable=False, default=28.0)
    stockout_flag = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ExogenousIndicator(Base):
    __tablename__ = "exogenous_indicators"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(20), nullable=False, index=True)
    region = Column(String(60), nullable=False)
    monsoon_severity_score = Column(Float, nullable=False, default=1.0)
    fuel_price_index = Column(Float, nullable=False, default=100.0)
    promo_campaign_active = Column(Boolean, nullable=False, default=False)
    notes = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class RoadNetworkNode(Base):
    __tablename__ = "road_network_nodes"

    node_id = Column(String(50), primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    highway = Column(String(50), nullable=False, default="NH-48")
    is_ghat_pass = Column(Boolean, nullable=False, default=False)
    congestion_index = Column(Float, nullable=False, default=1.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    delivery_id = Column(String(50), primary_key=True, index=True)
    customer_name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=False)
    address = Column(String(255), nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    volume_m3 = Column(Float, nullable=False, default=10.0)
    time_window_start = Column(String(30), nullable=False)
    time_window_end = Column(String(30), nullable=False)
    priority = Column(String(20), nullable=False, default="HIGH")
    status = Column(String(20), nullable=False, default="PENDING")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class FreightBackhaul(Base):
    __tablename__ = "freight_backhauls"

    backhaul_id = Column(String(50), primary_key=True, index=True)
    shipper_name = Column(String(100), nullable=False)
    origin_city = Column(String(50), nullable=False)
    origin_latitude = Column(Float, nullable=False)
    origin_longitude = Column(Float, nullable=False)
    destination_city = Column(String(50), nullable=False)
    destination_latitude = Column(Float, nullable=False)
    destination_longitude = Column(Float, nullable=False)
    cargo_type = Column(String(100), nullable=False)
    cargo_weight_kg = Column(Float, nullable=False)
    volume_m3 = Column(Float, nullable=False, default=12.0)
    payout_inr = Column(Float, nullable=False)
    available_window_start = Column(String(30), nullable=False)
    available_window_end = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="AVAILABLE")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

