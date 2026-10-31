<<<<<<< HEAD
# Intelligent Network Self-Healing Simulator

A complete, interactive network simulator that monitors a virtual network, detects link failures, router failures, and congestion, calculates alternative routes, and automatically restores traffic flow. Built as a Computer Science Engineering demonstration project covering Operating Systems, Computer Networks, and AI/ML concepts.

## Overview

The simulator implements the full self-healing feedback loop:

1. **Monitor** the network state continuously.
2. **Detect** a failure or congestion condition.
3. **Evaluate** available alternative routes.
4. **Select** a suitable alternative based on the routing strategy.
5. **Reroute** traffic automatically.
6. **Measure** recovery performance (detection time, computation time, total recovery time).
7. **Continue** monitoring.

All operations occur inside a virtual software simulation — no real routers, administrator privileges, or physical infrastructure are required.

## Features

- Interactive network topology canvas (Cytoscape.js) with drag, zoom, pan, and inspection.
- Add/remove routers and links; select source and destination endpoints.
- Two routing strategies:
  - **Shortest path** — Dijkstra with latency-based cost.
  - **Adaptive** — Dijkstra with a cost combining normalized latency, a congestion penalty, and a packet-loss penalty.
- Failure injection: link failure/restore, router failure/restore, congestion injection, bandwidth/latency/packet-loss changes.
- Automatic recovery with configurable delay; manual recovery mode also supported.
- Discrete time-stepped traffic simulation accounting for bandwidth, latency, queueing delay, packet loss, router availability, and offered load.
- Random Forest congestion-risk classifier (implemented in TypeScript) with train/predict/evaluate and an honest deterministic fallback when no model is trained.
- Live dashboard with KPIs, time-series charts (latency, loss, utilization, throughput, queue length, recovery events), and an event log.
- Recovery timeline showing detection time, route computation time, total recovery time, affected flows, and dropped packets.
- Analytics page with scenario comparison, routing-strategy comparison, and CSV export of metrics, events, and scenarios.
- 35 automated engine tests covering routing, failure detection, recovery, congestion, metrics, invalid input, ML prediction, and persistence.

## Technology stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Topology visualization:** Cytoscape.js
- **Charts:** Recharts
- **Icons:** Lucide React
- **Simulation engine & ML:** TypeScript (runs entirely in the browser)

## Architecture

The simulation engine runs entirely in the browser as TypeScript modules — no separate server process is required. This makes the project straightforward to run and demonstrate.

```
src/
  engine/
    types.ts          # Core domain types (nodes, edges, metrics, events, routes)
    util.ts           # Cost function, normalization, summary stats
    routing.ts        # Dijkstra's algorithm with configurable edge cost
    networkEngine.ts  # Central engine: graph state, traffic sim, failures, recovery, metrics
    ml.ts             # Random Forest classifier (train/predict/evaluate/CSV parse)
  hooks/
    useSimulator.ts   # React hook wiring the engine to the UI with a render loop
  components/
    TopologyCanvas.tsx  # Cytoscape.js interactive graph
    ui.tsx              # Shared UI primitives (Card, Button, Badge, etc.)
  pages/
    Dashboard.tsx     # KPIs, charts, recent alerts
    Simulator.tsx     # Topology canvas, inspector, routing & traffic controls
    FailureLab.tsx    # Failure injection + recovery timeline + event log
    Analytics.tsx     # Scenario comparison, routing comparison, CSV export
    ML.ts             # Dataset upload, training, prediction, model status
    Settings.tsx      # Routing weights, thresholds, architecture & algorithm docs
  tests/
    engine.test.ts    # 35 automated tests
```

## Prerequisites

- Node.js 18+ and npm

## Installation & running

```bash
npm install
npm run dev
```

The app runs at the Vite dev URL (typically `http://localhost:5173`).

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript type checking |
| `npm run test` | Run the 35 engine tests |
| `npm run lint` | ESLint |
| `npm run preview` | Preview the production build |

## Sample walkthrough

1. Open the app — a sample topology (Source, 5 routers, Destination with 9 links and multiple paths) loads automatically.
2. Go to **Network Simulator** and click **Start** to begin traffic simulation.
3. Watch the dashboard populate with live metrics.
4. Go to **Failure Lab**, select a link that is part of the active route (shown in cyan on the topology), and click **Disable**.
5. The engine detects the failure, schedules automatic recovery, recomputes a route around the failure, and logs the recovery event with timing details.
6. Go to **Analytics**, save the scenario, then try the same failure with a different routing strategy or with auto-recovery disabled to compare outcomes.
7. Go to **Machine Learning**, click **Generate synthetic data**, then **Train model** to enable ML-driven congestion risk prediction that feeds the adaptive routing cost.

## ML workflow

The ML module is a genuine Random Forest ensemble (bootstrap sampling + random feature subsets + Gini impurity splits). It trains only on data you provide.

- **Upload a CSV** with columns: `utilization, latency, packetLoss, queueLength, trafficRate, availableBandwidth, label` (label = 0 or 1).
- **Generate synthetic data** for a clearly-labelled demonstration set (documented derivation rules in `ml.ts`).
- Train the model and view accuracy, precision, recall, and F1.
- Run live predictions on the active route's links; the probability feeds the adaptive routing cost as a congestion-risk penalty.

**Dataset honesty note:** CIC-IDS2017 is an intrusion-detection dataset and does not contain ground-truth congestion labels. It is not used for congestion training here. Use a dataset with an explicit congestion label, or the clearly-labelled synthetic generator. The simulator never fabricates accuracy or invents training records. When no model is trained, the simulator falls back to deterministic congestion thresholds.

## Routing cost function

```
edge_cost = latencyWeight × normalized_latency
          + congestionWeight × congestion_penalty
          + lossWeight × normalized_packet_loss
```

All terms are normalized to [0, 1] so different units don't distort the result. The cost is non-negative (required for Dijkstra). Weights are configurable on the Settings page.

## Recovery time definition

Recovery time measures the simulated interval from failure detection to successful route recomputation (both in simulated seconds, not wall-clock time). This is reported per recovery event in the Failure Lab timeline and aggregated in the Analytics scenario table.

## Testing

```bash
npm run test
```

Tests cover: Dijkstra on a known graph, adaptive vs. shortest routing under congestion, failed link/router detection, automatic rerouting, no-alternate-route disconnection, restoration recovery, congestion threshold detection, traffic overload, metric calculations, invalid graph modifications, API error handling, ML prediction with a trained model, ML fallback, and CSV/event persistence.

<img width="503" height="553" alt="Screenshot 2026-10-31 at 11 04 25 PM" src="https://github.com/user-attachments/assets/b7aa1224-a0bb-4420-8ca4-60ea6c960a40" />

## Known limitations

- All traffic is simulated in software — no real packets are sent.
- The traffic model is a simplified time-stepped approximation, not a full discrete-event simulator like ns-3.
- ML evaluation metrics are in-sample when using synthetic data; use a held-out set for unbiased accuracy.
- Recovery time measures simulated route recomputation, not real wall-clock time.
- The simulation engine runs in the browser; there is no separate Python backend in this deployment. A Python/FastAPI backend structure is described in the original project specification and can be added if server-side processing is required.
=======
# CN_PROJECT
>>>>>>> bfcebb8508a6e0aad904db3db83e13346fc1aa51
