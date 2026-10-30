import type { SimNode, SimEdge, SimConfig, MetricSample } from './types';

// Normalize a value to 0..1 using a soft cap.
export function normalize(value: number, cap: number): number {
  if (cap <= 0) return 0;
  return Math.max(0, Math.min(1, value / cap));
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// Compute a non-negative routing cost for an edge per the chosen strategy.
// cost = latencyWeight*normLatency + congestionWeight*congestionPenalty + lossWeight*lossPenalty
export function edgeCost(
  edge: SimEdge,
  config: SimConfig,
  congestionRisk: number = 0,
): number {
  const normLatency = normalize(edge.latency, 200);       // 200ms cap
  const congestionPenalty =
    config.routingStrategy === 'adaptive'
      ? normalize(edge.utilization, 1) * 0.6 + congestionRisk * 0.4
      : normalize(edge.utilization, 1);
  const lossPenalty = normalize(edge.packetLoss, 0.1);     // 10% loss cap
  const c =
    config.weights.latencyWeight * normLatency +
    config.weights.congestionWeight * congestionPenalty +
    config.weights.lossWeight * lossPenalty;
  return Math.max(0.0001, c);
}

export function isEdgeUsable(edge: SimEdge, nodes: Map<string, SimNode>): boolean {
  if (edge.failed || edge.status === 'failed') return false;
  const s = nodes.get(edge.source);
  const t = nodes.get(edge.target);
  if (!s || !t) return false;
  if (!s.available || s.status === 'down') return false;
  if (!t.available || t.status === 'down') return false;
  return true;
}

// Aggregate a metric series into summary stats.
export function summarize(samples: MetricSample[]) {
  if (samples.length === 0) {
    return {
      avgLatency: 0,
      p95Latency: 0,
      pdr: 0,
      packetLoss: 0,
      throughputMbps: 0,
      avgUtilization: 0,
      maxUtilization: 0,
      recoveryTime: 0,
      routeCost: 0,
      droppedPackets: 0,
    };
  }
  const latencies = samples.map((s) => s.avgLatency).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
  const avg = (fn: (s: MetricSample) => number) =>
    samples.reduce((acc, s) => acc + fn(s), 0) / samples.length;
  return {
    avgLatency: avg((s) => s.avgLatency),
    p95Latency: p95,
    pdr: avg((s) => s.pdr),
    packetLoss: avg((s) => s.packetLoss),
    throughputMbps: avg((s) => s.throughputMbps),
    avgUtilization: avg((s) => s.utilization),
    maxUtilization: Math.max(...samples.map((s) => s.utilization)),
    recoveryTime: 0,
    routeCost: 0,
    droppedPackets: 0,
  };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
