# 03: Fleet Route Optimizer & Freight Matching Slice

**What to build:** A Fleet Dispatcher can select delivery orders and vehicle specifications across the Mumbai–JNPT–Thane–Nashik–Pune corridor, trigger a PyTorch DRL / dynamic graph routing solver to generate an optimal waypoint sequence factoring in vehicle payload limits, customer time windows, and live traffic congestion, and view matched return-haul freight postings to eliminate empty kilometers.

**Blocked by:** 01: Core Architecture, Database & Persona Shell

**Status:** completed

- [x] Corridor road network graph nodes, vehicle profiles, delivery stops, and available backhaul freight listings seeded in database and fallback fixtures.
- [x] PyTorch DRL / graph route solver calculates optimal stop visit orders, estimated fuel burn, CO2 emissions, and ETA per stop under standard and congested traffic modes.
- [x] Freight matching engine identifies compatible return-leg cargo requests matching truck capacity and route geometry.
- [x] API endpoint `POST /api/v1/routing/optimize` accepts vehicle specs, delivery stops, and traffic mode, returning route geometry, turn-by-turn waypoints, metrics, and matched freight backhauls.
- [x] Frontend `RoutingTab` renders an interactive Leaflet.js map with route polyline, depot/customer stop markers, turn-by-turn waypoint table, vehicle payload utilization bar, and a Backhaul Freight Matching card with 1-click assignment.
- [x] Automated tests verify vehicle capacity adherence, valid waypoint sequencing, and backhaul pairing compatibility.
