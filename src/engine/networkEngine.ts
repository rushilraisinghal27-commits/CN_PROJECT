import type {
  SimNode,
  SimEdge,
  SimConfig,
  SimEvent,
  MetricSample,
  RouteInfo,
  RecoveryRecord,
  ScenarioResult,
  EventType,
  Severity,
  SimStatus,
} from './types';
import { dijkstra, type PathResult } from './routing';
import { uid, normalize, edgeCost, clamp, summarize } from './util';
import { predict as mlPredict, type MLFeatureVector } from './ml';

// Default configuration.
export const DEFAULT_CONFIG: SimConfig = {
  routingStrategy: 'adaptive',
  weights: { latencyWeight: 1, congestionWeight: 1.5, lossWeight: 2 },
  congestionThreshold: 0.8,
  autoRecovery: true,
  recoveryDelayMs: 500,
  trafficRatePps: 50,
  packetSizeBytes: 1024,
  simulationStepMs: 1000,
};

export class NetworkEngine {
  nodes: Map<string, SimNode> = new Map();
  edges: Map<string, SimEdge> = new Map();
  config: SimConfig = { ...DEFAULT_CONFIG, weights: { ...DEFAULT_CONFIG.weights } };
  sourceId: string | null = null;
  destinationId: string | null = null;

  route: RouteInfo | null = null;
  status: SimStatus = 'idle';
  simTime = 0;          // simulated seconds
  events: SimEvent[] = [];
  metrics: MetricSample[] = [];
  recoveries: RecoveryRecord[] = [];
  scenarios: ScenarioResult[] = [];

  // live traffic state
  private packetsSent = 0;
  private packetsDelivered = 0;
  private packetsDropped = 0;
  private droppedDuringRecovery = 0;
  private currentRecovery: RecoveryRecord | null = null;
  private pendingRecovery: { failureEventId: string; at: number } | null = null;
  private congestionRisk = new Map<string, number>();

  get source(): SimNode | null {
    return this.sourceId ? this.nodes.get(this.sourceId) ?? null : null;
  }
  get destination(): SimNode | null {
    return this.destinationId ? this.nodes.get(this.destinationId) ?? null : null;
  }

  reset() {
    this.nodes.clear();
    this.edges.clear();
    this.route = null;
    this.status = 'idle';
    this.simTime = 0;
    this.events = [];
    this.metrics = [];
    this.recoveries = [];
    this.scenarios = [];
    this.packetsSent = 0;
    this.packetsDelivered = 0;
    this.packetsDropped = 0;
    this.droppedDuringRecovery = 0;
    this.currentRecovery = null;
    this.pendingRecovery = null;
    this.congestionRisk.clear();
    this.sourceId = null;
    this.destinationId = null;
  }

  resetMetricsOnly() {
    this.metrics = [];
    this.packetsSent = 0;
    this.packetsDelivered = 0;
    this.packetsDropped = 0;
    this.droppedDuringRecovery = 0;
    this.simTime = 0;
    this.recoveries = [];
  }

  // ---- topology mutation -------------------------------------------------

  addNode(partial: Partial<SimNode>): SimNode | { error: string } {
    const id = partial.id ?? uid('R');
    if (this.nodes.has(id)) return { error: `Node ${id} already exists.` };
    const node: SimNode = {
      id,
      name: partial.name ?? id,
      type: partial.type ?? 'router',
      status: 'active',
      processingCapacity: partial.processingCapacity ?? 1000,
      currentLoad: 0,
      queueLength: 0,
      available: true,
      x: partial.x ?? Math.random() * 400 + 100,
      y: partial.y ?? Math.random() * 300 + 100,
    };
    this.nodes.set(id, node);
    if (node.type === 'source' && !this.sourceId) this.sourceId = id;
    if (node.type === 'destination' && !this.destinationId) this.destinationId = id;
    this.emit('info', 'info', id, `Node ${node.name} added.`);
    this.recomputeRoute('node added');
    return node;
  }

  removeNode(id: string): { error?: string } {
    if (!this.nodes.has(id)) return { error: `Node ${id} not found.` };
    // remove incident edges
    for (const [eid, e] of this.edges) {
      if (e.source === id || e.target === id) this.edges.delete(eid);
    }
    this.nodes.delete(id);
    if (this.sourceId === id) this.sourceId = null;
    if (this.destinationId === id) this.destinationId = null;
    this.emit('info', 'info', id, `Node ${id} removed.`);
    this.recomputeRoute('node removed');
    return {};
  }

  addLink(partial: Partial<SimEdge> & { source: string; target: string }): SimEdge | { error: string } {
    if (!this.nodes.has(partial.source)) return { error: `Source node ${partial.source} not found.` };
    if (!this.nodes.has(partial.target)) return { error: `Target node ${partial.target} not found.` };
    if (partial.source === partial.target) return { error: 'Self-loops are not allowed.' };
    // duplicate check
    for (const e of this.edges.values()) {
      if (
        (e.source === partial.source && e.target === partial.target) ||
        (e.source === partial.target && e.target === partial.source)
      ) {
        return { error: `Link ${partial.source}-${partial.target} already exists.` };
      }
    }
    const id = partial.id ?? `L_${partial.source}_${partial.target}`;
    const edge: SimEdge = {
      id,
      source: partial.source,
      target: partial.target,
      status: 'active',
      latency: partial.latency ?? 10,
      bandwidth: partial.bandwidth ?? 100,
      utilization: 0,
      packetLoss: 0,
      queueLength: 0,
      cost: 0,
      failed: false,
    };
    this.edges.set(id, edge);
    this.emit('info', 'info', id, `Link ${edge.source}-${edge.target} added.`);
    this.recomputeRoute('link added');
    return edge;
  }

  removeLink(id: string): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    this.edges.delete(id);
    this.emit('info', 'info', id, `Link ${e.source}-${e.target} removed.`);
    this.recomputeRoute('link removed');
    return {};
  }

  setSource(id: string): { error?: string } {
    if (!this.nodes.has(id)) return { error: `Node ${id} not found.` };
    const n = this.nodes.get(id)!;
    if (n.type !== 'source' && n.type !== 'router') {
      return { error: 'Source must be a router or source node.' };
    }
    this.sourceId = id;
    this.recomputeRoute('source changed');
    return {};
  }

  setDestination(id: string): { error?: string } {
    if (!this.nodes.has(id)) return { error: `Node ${id} not found.` };
    const n = this.nodes.get(id)!;
    if (n.type !== 'destination' && n.type !== 'router') {
      return { error: 'Destination must be a router or destination node.' };
    }
    this.destinationId = id;
    this.recomputeRoute('destination changed');
    return {};
  }

  // ---- failures ----------------------------------------------------------

  failLink(id: string): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    if (e.failed) return { error: `Link ${id} already failed.` };
    e.failed = true;
    e.status = 'failed';
    this.emit('failure', 'critical', id, `Link ${e.source}-${e.target} failed.`);
    this.handlePotentialRecovery(id, null, 'link');
    return {};
  }

  restoreLink(id: string): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    e.failed = false;
    e.status = e.utilization > this.config.congestionThreshold ? 'congested' : 'active';
    this.emit('recovery', 'info', id, `Link ${e.source}-${e.target} restored.`);
    this.recomputeRoute('link restored');
    return {};
  }

  failNode(id: string): { error?: string } {
    const n = this.nodes.get(id);
    if (!n) return { error: `Node ${id} not found.` };
    if (n.status === 'down') return { error: `Node ${id} already down.` };
    n.status = 'down';
    n.available = false;
    this.emit('failure', 'critical', id, `Router ${n.name} went down.`);
    this.handlePotentialRecovery(null, id, 'node');
    return {};
  }

  restoreNode(id: string): { error?: string } {
    const n = this.nodes.get(id);
    if (!n) return { error: `Node ${id} not found.` };
    n.status = 'active';
    n.available = true;
    this.emit('recovery', 'info', id, `Router ${n.name} restored.`);
    this.recomputeRoute('node restored');
    return {};
  }

  injectCongestion(id: string, utilization: number): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    e.utilization = clamp(utilization, 0, 1);
    if (e.utilization > this.config.congestionThreshold && !e.failed) {
      e.status = 'congested';
      this.emit('congestion', 'warning', id, `Link ${e.source}-${e.target} congested (util=${(e.utilization * 100).toFixed(0)}%).`);
    } else if (!e.failed) {
      e.status = 'active';
    }
    this.recomputeRoute('congestion changed');
    return {};
  }

  setLinkBandwidth(id: string, bw: number): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    e.bandwidth = Math.max(1, bw);
    this.emit('info', 'info', id, `Link ${e.source}-${e.target} bandwidth set to ${e.bandwidth} Mbps.`);
    this.recomputeRoute('bandwidth changed');
    return {};
  }

  setLinkLatency(id: string, ms: number): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    e.latency = Math.max(1, ms);
    this.emit('info', 'info', id, `Link ${e.source}-${e.target} latency set to ${e.latency} ms.`);
    this.recomputeRoute('latency changed');
    return {};
  }

  setLinkPacketLoss(id: string, loss: number): { error?: string } {
    const e = this.edges.get(id);
    if (!e) return { error: `Link ${id} not found.` };
    e.packetLoss = clamp(loss, 0, 1);
    this.emit('info', 'info', id, `Link ${e.source}-${e.target} packet loss set to ${(e.packetLoss * 100).toFixed(1)}%.`);
    this.recomputeRoute('packet loss changed');
    return {};
  }

  resetAllFaults() {
    for (const n of this.nodes.values()) {
      n.status = 'active';
      n.available = true;
    }
    for (const e of this.edges.values()) {
      e.failed = false;
      e.status = e.utilization > this.config.congestionThreshold ? 'congested' : 'active';
    }
    this.emit('recovery', 'info', 'all', 'All faults reset.');
    this.recomputeRoute('all faults reset');
  }

  // ---- routing -----------------------------------------------------------

  recomputeRoute(reason: string): RouteInfo | null {
    if (!this.sourceId || !this.destinationId) {
      this.route = null;
      return null;
    }
    const result = dijkstra(
      this.sourceId,
      this.destinationId,
      this.nodes,
      [...this.edges.values()],
      this.config,
      this.congestionRisk,
    );
    if (!result.found) {
      if (this.route) {
        this.emit('reroute', 'critical', 'route', `No valid route from ${this.sourceId} to ${this.destinationId}. Network disconnected.`);
      }
      this.route = null;
      if (this.status === 'running') this.status = 'disconnected';
      return null;
    }
    const route: RouteInfo = {
      path: result.path,
      edges: result.edges,
      cost: result.cost,
      reason,
      strategy: this.config.routingStrategy,
      computedAt: this.simTime,
    };
    const changed = !this.route || this.route.edges.join(',') !== route.edges.join(',');
    this.route = route;
    if (changed && this.status !== 'idle') {
      this.emit('reroute', 'info', 'route', `Route ${route.path.join(' → ')} selected (${reason}). Cost=${route.cost.toFixed(3)}`);
    }
    if (this.status === 'disconnected') this.status = 'running';
    return route;
  }

  // ---- failure → recovery ------------------------------------------------

  private handlePotentialRecovery(failedEdgeId: string | null, failedNodeId: string | null, kind: 'link' | 'node') {
    const affectsRoute =
      (failedEdgeId !== null && this.route?.edges.includes(failedEdgeId)) ||
      (failedNodeId !== null && this.route?.path.includes(failedNodeId));

    if (!affectsRoute) {
      // not on active route — no recovery event needed
      this.recomputeRoute('failure not on active route');
      return;
    }

    const failureEventId = this.events[this.events.length - 1]?.id ?? uid('E');
    this.status = 'recovering';
    this.emit('recovery', 'warning', 'route', `Self-healing maneuver started: active route affected by ${kind} failure.`);

    if (this.config.autoRecovery) {
      this.emit('recovery', 'info', 'route', `Detecting affected flows and scheduling route recomputation (delay=${this.config.recoveryDelayMs}ms).`);
      // schedule recovery after configured delay (in sim seconds)
      const delaySec = this.config.recoveryDelayMs / 1000;
      this.pendingRecovery = { failureEventId, at: this.simTime + delaySec };
    } else {
      // manual mode: mark degraded, await user action
      this.recomputeRoute('failure; manual recovery mode');
      if (!this.route) {
        this.status = 'disconnected';
        this.emit('recovery', 'warning', 'route', 'No automatic recovery. No alternate route found; network disconnected.');
      } else {
        this.status = 'degraded';
        this.emit('recovery', 'warning', 'route', `Manual recovery mode. New route available: ${this.route.path.join(' → ')}. Activate via Run Recovery.`);
      }
    }
  }

  // Manually trigger recovery (used in manual mode or by tests).
  runManualRecovery(): RecoveryRecord | null {
    this.emit('recovery', 'warning', 'route', `Self-healing maneuver started: manual recovery triggered.`);
    if (!this.pendingRecovery && !this.route) {
      this.recomputeRoute('manual recovery');
    }
    return this.finalizeRecovery(this.events[this.events.length - 1]?.id ?? uid('E'));
  }

  private finalizeRecovery(failureEventId: string): RecoveryRecord | null {
    const detectedAt = this.simTime;
    const oldRoute = this.route ? { ...this.route } : undefined;
    this.emit('recovery', 'info', 'route', `Calculating alternative route (excluding failed component)…`);
    const result = this.recomputeRoute('automatic recovery');
    const computedAt = this.simTime;
    const success = !!result;
    const rec: RecoveryRecord = {
      id: uid('REC'),
      failureEventId,
      detectedAt,
      computedAt,
      recoveredAt: this.simTime,
      detectionTime: 0,
      routeComputationTime: computedAt - detectedAt,
      totalRecoveryTime: computedAt - detectedAt,
      affectedFlows: 1,
      droppedPackets: this.droppedDuringRecovery,
      success,
      reason: success ? `Rerouted via ${result!.path.join(' → ')}` : 'No alternate route exists.',
      oldRoute,
      newRoute: result ?? undefined,
    };
    this.recoveries.push(rec);
    if (success) {
      if (oldRoute) {
        this.emit('recovery', 'info', 'route', `Traffic redirected from ${oldRoute.path.join(' → ')} to ${result!.path.join(' → ')}.`);
      }
      this.emit('recovery', 'info', 'route', `Self-healing maneuver completed in ${rec.totalRecoveryTime.toFixed(2)}s. Network restored.`);
      this.status = 'running';
    } else {
      this.emit('recovery', 'critical', 'route', 'Self-healing maneuver failed: no alternate route exists. Network disconnected.');
      this.status = 'disconnected';
    }
    this.droppedDuringRecovery = 0;
    this.pendingRecovery = null;
    return rec;
  }

  // ---- simulation step ---------------------------------------------------

  start() {
    if (this.status === 'idle' || this.status === 'paused' || this.status === 'completed') {
      this.status = 'running';
      this.emit('info', 'info', 'sim', 'Simulation started.');
      if (!this.route) this.recomputeRoute('simulation start');
    }
  }

  pause() {
    if (this.status === 'running') {
      this.status = 'paused';
      this.emit('info', 'info', 'sim', 'Simulation paused.');
    }
  }

  resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.emit('info', 'info', 'sim', 'Simulation resumed.');
    }
  }

  stop() {
    this.status = 'completed';
    this.emit('info', 'info', 'sim', 'Simulation completed.');
  }

  // Advance the simulation by one discrete time step.
  // Implements a time-stepped traffic forwarding model:
  //  - packets are generated at the configured rate
  //  - forwarded hop-by-hop along the active route
  //  - dropped on failed links, router unavailability, or probabilistic loss
  //  - queueing delay accumulates from link/router queues
  step(dtSeconds: number = this.config.simulationStepMs / 1000): MetricSample {
    if (this.status !== 'running' && this.status !== 'recovering') {
      return this.lastSample();
    }

    const rate = this.config.trafficRatePps;
    const generated = Math.max(1, Math.round(rate * dtSeconds));
    this.packetsSent += generated;

    // clear transient load
    for (const n of this.nodes.values()) n.currentLoad = 0;
    for (const e of this.edges.values()) {
      if (!e.failed) e.queueLength = 0;
    }

    let delivered = 0;
    let dropped = 0;
    let totalLatency = 0;
    let activeEdgeUtilSum = 0;
    let activeEdgeCount = 0;
    let queueSum = 0;
    let queueCount = 0;

    const route = this.route;
    if (route && route.edges.length > 0) {
      // forward each packet along the route
      for (let p = 0; p < generated; p++) {
        let lost = false;
        let latencyAcc = 0;
        for (const edgeId of route.edges) {
          const e = this.edges.get(edgeId);
          if (!e || e.failed) { lost = true; break; }
          const sNode = this.nodes.get(e.source);
          const tNode = this.nodes.get(e.target);
          if (!sNode || !tNode || !sNode.available || !tNode.available) { lost = true; break; }
          // probabilistic packet loss
          if (Math.random() < e.packetLoss) { lost = true; break; }
          // queueing delay (M/M/1-ish): queue / capacity
          const arrivalLoad = (this.config.trafficRatePps * this.config.packetSizeBytes * 8) / 1e6; // Mbps offered
          const offered = arrivalLoad / route.edges.length;
          e.utilization = clamp(e.utilization * 0.5 + (offered / e.bandwidth) * 0.5, 0, 1);
          e.queueLength = Math.max(0, Math.round(e.utilization * 50));
          queueSum += e.queueLength;
          queueCount++;
          // transmission + propagation + queuing
          const txDelay = (this.config.packetSizeBytes * 8) / (e.bandwidth * 1e6) * 1000; // ms
          latencyAcc += e.latency + txDelay + e.queueLength * 0.5;
          sNode.currentLoad += 1;
          // router queue
          tNode.queueLength = Math.min(tNode.processingCapacity, tNode.queueLength + 1);
          if (tNode.queueLength > tNode.processingCapacity * 0.8) {
            // overload drop
            if (Math.random() < 0.05) { lost = true; break; }
          }
          // mark congestion
          if (e.utilization > this.config.congestionThreshold && e.status !== 'failed') {
            e.status = 'congested';
          } else if (e.status !== 'failed') {
            e.status = 'active';
          }
        }
        if (lost) {
          dropped++;
          if (this.status === 'recovering') this.droppedDuringRecovery++;
        } else {
          delivered++;
          totalLatency += latencyAcc;
        }
      }

      // update active-edge utilization average
      for (const edgeId of route.edges) {
        const e = this.edges.get(edgeId);
        if (e) { activeEdgeUtilSum += e.utilization; activeEdgeCount++; }
      }

      // ML predictions on active edges → update congestion risk map
      for (const edgeId of route.edges) {
        const e = this.edges.get(edgeId);
        if (!e) continue;
        const features: MLFeatureVector = {
          utilization: e.utilization,
          latency: e.latency,
          packetLoss: e.packetLoss,
          queueLength: e.queueLength,
          trafficRate: this.config.trafficRatePps,
          availableBandwidth: e.bandwidth * (1 - e.utilization),
        };
        const pred = mlPredict(features);
        const risk = pred.available && pred.probability !== null ? pred.probability : (e.utilization > this.config.congestionThreshold ? 1 : 0);
        this.congestionRisk.set(edgeId, risk);
        if (pred.available && pred.label === 1) {
          // only emit occasionally to avoid spam
          if (Math.random() < 0.1) {
            this.emit('congestion', 'warning', edgeId, `ML congestion risk on ${e.source}-${e.target}: p=${(pred.probability ?? 0).toFixed(2)}`);
          }
        }
      }
    } else {
      // no route → all generated packets dropped
      dropped = generated;
      if (this.status === 'running') this.status = 'disconnected';
    }

    this.packetsDelivered += delivered;
    this.packetsDropped += dropped;
    this.simTime += dtSeconds;

    // pending recovery? (checked after simTime advances so a step that
    // crosses the scheduled recovery time triggers it on the same step)
    if (this.pendingRecovery && this.simTime >= this.pendingRecovery.at) {
      this.finalizeRecovery(this.pendingRecovery.failureEventId);
    }

    const avgLatency = delivered > 0 ? totalLatency / delivered : 0;
    const pdr = this.packetsSent > 0 ? this.packetsDelivered / this.packetsSent : 0;
    const util = activeEdgeCount > 0 ? activeEdgeUtilSum / activeEdgeCount : 0;
    const throughputMbps = (delivered * this.config.packetSizeBytes * 8) / (dtSeconds * 1e6);
    const avgQueue = queueCount > 0 ? queueSum / queueCount : 0;
    const lossRatio = this.packetsSent > 0 ? this.packetsDropped / this.packetsSent : 0;
    const recoveryEvents = this.recoveries.length;

    const sample: MetricSample = {
      t: this.simTime,
      avgLatency,
      packetLoss: lossRatio,
      utilization: util,
      throughputMbps,
      avgQueueLength: avgQueue,
      pdr,
      recoveryEvents,
    };
    this.metrics.push(sample);
    if (this.metrics.length > 600) this.metrics.shift();

    return sample;
  }

  private lastSample(): MetricSample {
    if (this.metrics.length === 0) {
      return { t: this.simTime, avgLatency: 0, packetLoss: 0, utilization: 0, throughputMbps: 0, avgQueueLength: 0, pdr: 0, recoveryEvents: this.recoveries.length };
    }
    return this.metrics[this.metrics.length - 1];
  }

  // ---- KPIs --------------------------------------------------------------

  kpis() {
    const totalRouters = [...this.nodes.values()].filter((n) => n.type === 'router' || n.type === 'source' || n.type === 'destination').length;
    const totalLinks = this.edges.size;
    const failedLinks = [...this.edges.values()].filter((e) => e.failed).length;
    const activeLinks = totalLinks - failedLinks;
    const last = this.lastSample();
    const recoveryStatus = this.status === 'recovering' ? 'Recovering' :
      this.status === 'disconnected' ? 'Disconnected' :
      this.recoveries.length > 0 ? `Last recovery: ${this.recoveries[this.recoveries.length - 1].success ? 'Success' : 'Failed'}` : 'Idle';
    return {
      totalRouters,
      totalLinks,
      activeLinks,
      failedLinks,
      utilization: last.utilization,
      avgLatency: last.avgLatency,
      pdr: last.pdr,
      packetLoss: last.packetLoss,
      recoveryStatus,
    };
  }

  // ---- events ------------------------------------------------------------

  private emit(type: EventType, severity: Severity, component: string, message: string) {
    this.events.push({
      id: uid('E'),
      timestamp: Date.now(),
      simTime: this.simTime,
      type,
      severity,
      component,
      message,
    });
    if (this.events.length > 500) this.events.shift();
  }

  // ---- scenarios ---------------------------------------------------------

  saveScenario(name: string, baseline: boolean): ScenarioResult {
    const s = summarize(this.metrics);
    const routeCost = this.route?.cost ?? 0;
    const recTime = this.recoveries.length > 0
      ? this.recoveries.reduce((a, r) => a + r.totalRecoveryTime, 0) / this.recoveries.length
      : 0;
    const result: ScenarioResult = {
      id: uid('S'),
      name,
      createdAt: Date.now(),
      config: { ...this.config, weights: { ...this.config.weights } },
      baseline,
      recoveryEnabled: this.config.autoRecovery,
      strategy: this.config.routingStrategy,
      metrics: {
        ...s,
        recoveryTime: recTime,
        routeCost,
        droppedPackets: this.packetsDropped,
      },
      samples: [...this.metrics],
    };
    this.scenarios.push(result);
    return result;
  }

  // ---- sample topologies -------------------------------------------------

  loadSampleTopology() {
    this.reset();
    const layout: { id: string; name: string; type: SimNode['type']; x: number; y: number; cap: number }[] = [
      { id: 'S', name: 'Source', type: 'source', x: 80, y: 240, cap: 1500 },
      { id: 'R1', name: 'R1', type: 'router', x: 220, y: 120, cap: 1000 },
      { id: 'R2', name: 'R2', type: 'router', x: 220, y: 360, cap: 1000 },
      { id: 'R3', name: 'R3', type: 'router', x: 420, y: 80, cap: 1000 },
      { id: 'R4', name: 'R4', type: 'router', x: 420, y: 240, cap: 1000 },
      { id: 'R5', name: 'R5', type: 'router', x: 420, y: 400, cap: 1000 },
      { id: 'D', name: 'Dest', type: 'destination', x: 620, y: 240, cap: 1500 },
    ];
    for (const n of layout) {
      this.nodes.set(n.id, {
        id: n.id,
        name: n.name,
        type: n.type,
        status: 'active',
        processingCapacity: n.cap,
        currentLoad: 0,
        queueLength: 0,
        available: true,
        x: n.x,
        y: n.y,
      });
    }
    const links: { s: string; t: string; lat: number; bw: number }[] = [
      { s: 'S', t: 'R1', lat: 5, bw: 100 },
      { s: 'S', t: 'R2', lat: 8, bw: 80 },
      { s: 'R1', t: 'R3', lat: 10, bw: 100 },
      { s: 'R1', t: 'R4', lat: 12, bw: 90 },
      { s: 'R2', t: 'R4', lat: 14, bw: 60 },
      { s: 'R2', t: 'R5', lat: 16, bw: 70 },
      { s: 'R3', t: 'D', lat: 6, bw: 100 },
      { s: 'R4', t: 'D', lat: 9, bw: 80 },
      { s: 'R5', t: 'D', lat: 11, bw: 70 },
    ];
    for (const l of links) {
      const id = `L_${l.s}_${l.t}`;
      this.edges.set(id, {
        id,
        source: l.s,
        target: l.t,
        status: 'active',
        latency: l.lat,
        bandwidth: l.bw,
        utilization: 0,
        packetLoss: 0,
        queueLength: 0,
        cost: 0,
        failed: false,
      });
    }
    this.sourceId = 'S';
    this.destinationId = 'D';
    this.recomputeRoute('sample topology loaded');
  }
}
