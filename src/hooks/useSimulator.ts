import { useEffect, useRef, useState, useCallback } from 'react';
import { NetworkEngine, DEFAULT_CONFIG } from '@/engine/networkEngine';
import type {
  SimNode,
  SimEdge,
  SimConfig,
  SimStatus,
  SimEvent,
  MetricSample,
  RouteInfo,
  RecoveryRecord,
  ScenarioResult,
} from '@/engine/types';

let engineSingleton: NetworkEngine | null = null;
function getEngine(): NetworkEngine {
  if (!engineSingleton) {
    engineSingleton = new NetworkEngine();
    engineSingleton.loadSampleTopology();
  }
  return engineSingleton;
}

export interface SimulatorState {
  nodes: SimNode[];
  edges: SimEdge[];
  config: SimConfig;
  status: SimStatus;
  sourceId: string | null;
  destinationId: string | null;
  route: RouteInfo | null;
  events: SimEvent[];
  metrics: MetricSample[];
  recoveries: RecoveryRecord[];
  scenarios: ScenarioResult[];
  simTime: number;
}

export function useSimulator() {
  const engineRef = useRef<NetworkEngine>(getEngine());
  const engine = engineRef.current;
  const [state, setState] = useState<SimulatorState>(() => snapshot(engine));

  // simulation loop
  useEffect(() => {
    let raf: number;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const e = engine;
      if (e.status === 'running' || e.status === 'recovering') {
        e.step(Math.min(dt, 1));
      }
      setState(snapshot(e));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const update = useCallback(() => setState(snapshot(engine)), [engine]);

  const actions = {
    loadSample: () => { engine.loadSampleTopology(); update(); },
    reset: () => { engine.reset(); update(); },
    addNode: (p: Partial<SimNode>) => { const r = engine.addNode(p); update(); return r; },
    removeNode: (id: string) => { const r = engine.removeNode(id); update(); return r; },
    addLink: (p: Partial<SimEdge> & { source: string; target: string }) => { const r = engine.addLink(p); update(); return r; },
    removeLink: (id: string) => { const r = engine.removeLink(id); update(); return r; },
    setSource: (id: string) => { const r = engine.setSource(id); update(); return r; },
    setDestination: (id: string) => { const r = engine.setDestination(id); update(); return r; },
    failLink: (id: string) => { const r = engine.failLink(id); update(); return r; },
    restoreLink: (id: string) => { const r = engine.restoreLink(id); update(); return r; },
    failNode: (id: string) => { const r = engine.failNode(id); update(); return r; },
    restoreNode: (id: string) => { const r = engine.restoreNode(id); update(); return r; },
    injectCongestion: (id: string, u: number) => { const r = engine.injectCongestion(id, u); update(); return r; },
    setLinkBandwidth: (id: string, bw: number) => { const r = engine.setLinkBandwidth(id, bw); update(); return r; },
    setLinkLatency: (id: string, ms: number) => { const r = engine.setLinkLatency(id, ms); update(); return r; },
    setLinkPacketLoss: (id: string, loss: number) => { const r = engine.setLinkPacketLoss(id, loss); update(); return r; },
    resetAllFaults: () => { engine.resetAllFaults(); update(); },
    start: () => { engine.start(); update(); },
    pause: () => { engine.pause(); update(); },
    resume: () => { engine.resume(); update(); },
    stop: () => { engine.stop(); update(); },
    runManualRecovery: () => { const r = engine.runManualRecovery(); update(); return r; },
    updateConfig: (patch: Partial<SimConfig>) => {
      Object.assign(engine.config, patch);
      if (patch.weights) Object.assign(engine.config.weights, patch.weights);
      engine.recomputeRoute('config changed');
      update();
    },
    saveScenario: (name: string, baseline: boolean) => { const r = engine.saveScenario(name, baseline); update(); return r; },
    clearScenarios: () => { engine.scenarios = []; update(); },
  };

  return { state, actions };
}

function snapshot(e: NetworkEngine): SimulatorState {
  return {
    nodes: [...e.nodes.values()],
    edges: [...e.edges.values()],
    config: { ...e.config, weights: { ...e.config.weights } },
    status: e.status,
    sourceId: e.sourceId,
    destinationId: e.destinationId,
    route: e.route ? { ...e.route } : null,
    events: [...e.events],
    metrics: [...e.metrics],
    recoveries: [...e.recoveries],
    scenarios: [...e.scenarios],
    simTime: e.simTime,
  };
}
