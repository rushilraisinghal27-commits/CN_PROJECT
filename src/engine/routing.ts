import type { SimNode, SimEdge, SimConfig } from './types';
import { edgeCost, isEdgeUsable } from './util';

// Build an adjacency map of usable edges keyed by source node id.
function adjacency(
  edges: SimEdge[],
  nodes: Map<string, SimNode>,
): Map<string, { target: string; edge: SimEdge }[]> {
  const adj = new Map<string, { target: string; edge: SimEdge }[]>();
  for (const n of nodes.values()) adj.set(n.id, []);
  for (const e of edges) {
    if (!isEdgeUsable(e, nodes)) continue;
    adj.get(e.source)?.push({ target: e.target, edge: e });
    adj.get(e.target)?.push({ target: e.source, edge: e });
  }
  return adj;
}

export interface PathResult {
  path: string[];
  edges: string[];
  cost: number;
  found: boolean;
}

// Dijkstra's shortest path using a configurable edge cost function.
// Returns the lowest-cost path from source to destination.
export function dijkstra(
  source: string,
  destination: string,
  nodes: Map<string, SimNode>,
  edges: SimEdge[],
  config: SimConfig,
  congestionRisk: Map<string, number> = new Map(),
): PathResult {
  if (!nodes.has(source) || !nodes.has(destination)) {
    return { path: [], edges: [], cost: 0, found: false };
  }
  const sn = nodes.get(source)!;
  const dn = nodes.get(destination)!;
  if (!sn.available || !dn.available) {
    return { path: [], edges: [], cost: 0, found: false };
  }

  const adj = adjacency(edges, nodes);
  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; edge: string } | null>();
  const visited = new Set<string>();
  for (const id of nodes.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(source, 0);

  // Simple priority queue (array) — sufficient for the demo-sized graphs.
  const queue: string[] = [source];

  while (queue.length > 0) {
    // extract min
    let uIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (dist.get(queue[i])! < dist.get(queue[uIdx])!) uIdx = i;
    }
    const u = queue.splice(uIdx, 1)[0];
    if (visited.has(u)) continue;
    visited.add(u);
    if (u === destination) break;

    const neighbors = adj.get(u) ?? [];
    for (const { target, edge } of neighbors) {
      if (visited.has(target)) continue;
      const risk = congestionRisk.get(edge.id) ?? 0;
      const w = edgeCost(edge, config, risk);
      const alt = dist.get(u)! + w;
      if (alt < dist.get(target)!) {
        dist.set(target, alt);
        prev.set(target, { node: u, edge: edge.id });
        if (!queue.includes(target)) queue.push(target);
      }
    }
  }

  if (dist.get(destination) === Infinity || !prev.get(destination)) {
    if (source === destination) {
      return { path: [source], edges: [], cost: 0, found: true };
    }
    return { path: [], edges: [], cost: 0, found: false };
  }

  // Reconstruct path
  const path: string[] = [];
  const edgePath: string[] = [];
  let cur: string | null = destination;
  while (cur) {
    path.unshift(cur);
    const p = prev.get(cur);
    if (p) {
      edgePath.unshift(p.edge);
      cur = p.node;
    } else {
      cur = null;
    }
  }
  return { path, edges: edgePath, cost: dist.get(destination)!, found: true };
}

// Check whether removing/altering any component still leaves a path.
export function hasAlternateRoute(
  source: string,
  destination: string,
  excludeEdgeId: string | null,
  excludeNodeId: string | null,
  nodes: Map<string, SimNode>,
  edges: SimEdge[],
  config: SimConfig,
): PathResult {
  const filtered = edges.filter(
    (e) => e.id !== excludeEdgeId && e.id !== excludeEdgeId,
  );
  const filteredNodes = new Map(nodes);
  if (excludeNodeId) {
    const nd = filteredNodes.get(excludeNodeId);
    if (nd) filteredNodes.set(excludeNodeId, { ...nd, available: false, status: 'down' });
  }
  return dijkstra(source, destination, filteredNodes, filtered, config);
}
