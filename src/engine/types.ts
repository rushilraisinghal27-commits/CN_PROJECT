// Core simulation types for the Intelligent Network Self-Healing Simulator.

export type NodeType = 'router' | 'source' | 'destination';
export type NodeStatus = 'active' | 'down';
export type EdgeStatus = 'active' | 'failed' | 'congested';

export interface SimNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  processingCapacity: number; // packets per second
  currentLoad: number;        // packets per second currently queued/processed
  queueLength: number;        // current queue occupancy (packets)
  available: boolean;
  x: number;
  y: number;
}

export interface SimEdge {
  id: string;
  source: string;
  target: string;
  status: EdgeStatus;
  latency: number;       // ms (base propagation delay)
  bandwidth: number;     // Mbps capacity
  utilization: number;   // 0..1 fraction of bandwidth in use
  packetLoss: number;    // 0..1 fraction
  queueLength: number;   // packets queued on link
  cost: number;          // routing cost (computed)
  failed: boolean;       // explicit failure flag
}

export type RoutingStrategy = 'shortest' | 'adaptive';

export interface RoutingWeights {
  latencyWeight: number;
  congestionWeight: number;
  lossWeight: number;
}

export interface SimConfig {
  routingStrategy: RoutingStrategy;
  weights: RoutingWeights;
  congestionThreshold: number; // utilization fraction above which a link is "congested"
  autoRecovery: boolean;
  recoveryDelayMs: number;      // simulated delay before recovery kicks in
  trafficRatePps: number;       // packets per second offered
  packetSizeBytes: number;
  simulationStepMs: number;     // discrete time step
}

export type SimStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'recovering'
  | 'degraded'
  | 'disconnected'
  | 'completed';

export type EventType =
  | 'info'
  | 'failure'
  | 'recovery'
  | 'reroute'
  | 'congestion'
  | 'metric';
export type Severity = 'info' | 'warning' | 'critical';

export interface SimEvent {
  id: string;
  timestamp: number;       // epoch ms
  simTime: number;         // simulated seconds elapsed
  type: EventType;
  severity: Severity;
  component: string;       // node or link id
  message: string;
}

export interface MetricSample {
  t: number;                  // simulated seconds
  avgLatency: number;
  packetLoss: number;
  utilization: number;
  throughputMbps: number;
  avgQueueLength: number;
  pdr: number;                // packet delivery ratio 0..1
  recoveryEvents: number;     // cumulative recoveries at this sample
}

export interface RouteInfo {
  path: string[];          // node ids
  edges: string[];         // edge ids
  cost: number;
  reason: string;
  strategy: RoutingStrategy;
  computedAt: number;      // sim time
}

export interface RecoveryRecord {
  id: string;
  failureEventId: string;
  detectedAt: number;       // sim seconds
  computedAt: number;       // sim seconds
  recoveredAt: number;      // sim seconds
  detectionTime: number;    // seconds
  routeComputationTime: number;
  totalRecoveryTime: number;
  affectedFlows: number;
  droppedPackets: number;
  success: boolean;
  reason: string;
  oldRoute?: RouteInfo;
  newRoute?: RouteInfo;
}

export interface ScenarioResult {
  id: string;
  name: string;
  createdAt: number;
  config: SimConfig;
  baseline: boolean;
  recoveryEnabled: boolean;
  strategy: RoutingStrategy;
  metrics: {
    avgLatency: number;
    p95Latency: number;
    pdr: number;
    packetLoss: number;
    throughputMbps: number;
    avgUtilization: number;
    maxUtilization: number;
    recoveryTime: number;
    routeCost: number;
    droppedPackets: number;
  };
  samples: MetricSample[];
}
