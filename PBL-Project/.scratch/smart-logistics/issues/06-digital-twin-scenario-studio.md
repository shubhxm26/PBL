# 06: Digital Twin Scenario Studio Slice

**What to build:** A Supply Chain Director can select and stress-test major operational shock events (Port Labor Strike at JNPT, Extreme Monsoon Road Closures, Expressway Bridge Failure) with an interactive severity slider, run a discrete-event simulation across multi-echelon network nodes (ports, central distribution centers, regional hubs), and evaluate comparative baseline vs. mitigated metrics (Risk Index, SLA delay hours, holding cost surge, CO2 impact) with automated contingency rerouting recommendations.

**Blocked by:** 02: Predictive Demand Forecasting Vertical Slice, 03: Fleet Route Optimizer & Freight Matching Slice

**Status:** completed

- [x] Multi-echelon logistics network topology (JNPT Port, Bhiwandi DC, Thane Hub, Nashik Depot, Pune Center) modeled with node capacities, replenishment lead times, and inventory holding costs.
- [x] Discrete-Event Simulation (DES) engine models inventory propagation, transit delays, stockout probabilities, and alternative mitigation routing during injected shocks.
- [x] API endpoint `POST /api/v1/twin/simulate-scenario` processes scenario selection, shock intensity (1–100%), and mitigation toggle, returning execution results and comparative metrics in $< 5$ seconds.
- [x] Frontend `DigitalTwinTab` displays scenario preset cards, interactive intensity slider, network topology node status diagram, and side-by-side comparative KPI cards (Baseline vs. Mitigated).
- [x] Automated tests assert simulation response time $< 5s$, metric calculation consistency, and mitigation improvement assertion ($mitigated\_sla\_delay \le baseline\_sla\_delay$).
