import { Activity, BookOpen, Cpu, Database, GitBranch, AlertTriangle } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import { Card, CardHeader, Field, NumberInput, Toggle, Badge } from '@/components/ui';

interface Props { sim: ReturnType<typeof useSimulator>; }

export default function SettingsPage({ sim }: Props) {
  const { state, actions } = sim;
  const { config } = state;

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <div>
        <h2 className="text-xl font-semibold">Settings & Documentation</h2>
        <p className="text-sm text-slate-400">Routing weights, thresholds, architecture, and algorithm notes</p>
      </div>

      <Card>
        <CardHeader title="Routing weights" subtitle="Cost function: w₁·normLatency + w₂·congestionPenalty + w₃·lossPenalty" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Latency weight"><NumberInput value={config.weights.latencyWeight} onChange={(v) => actions.updateConfig({ weights: { ...config.weights, latencyWeight: v } })} min={0} step={0.1} /></Field>
          <Field label="Congestion weight"><NumberInput value={config.weights.congestionWeight} onChange={(v) => actions.updateConfig({ weights: { ...config.weights, congestionWeight: v } })} min={0} step={0.1} /></Field>
          <Field label="Loss weight"><NumberInput value={config.weights.lossWeight} onChange={(v) => actions.updateConfig({ weights: { ...config.weights, lossWeight: v } })} min={0} step={0.1} /></Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Simulation configuration" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Congestion threshold (0–1)"><NumberInput value={config.congestionThreshold} onChange={(v) => actions.updateConfig({ congestionThreshold: v })} min={0.5} max={1} step={0.05} /></Field>
          <Field label="Recovery delay (ms)"><NumberInput value={config.recoveryDelayMs} onChange={(v) => actions.updateConfig({ recoveryDelayMs: v })} min={0} step={100} /></Field>
          <div className="flex items-end pb-1.5">
            <Toggle checked={config.autoRecovery} onChange={(v) => actions.updateConfig({ autoRecovery: v })} label="Automatic recovery" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="System status" />
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoBox label="Nodes" value={state.nodes.length} />
          <InfoBox label="Links" value={state.edges.length} />
          <InfoBox label="Events" value={state.events.length} />
          <InfoBox label="Recoveries" value={state.recoveries.length} />
          <InfoBox label="Metric samples" value={state.metrics.length} />
          <InfoBox label="Saved scenarios" value={state.scenarios.length} />
          <div className="col-span-2 flex items-center">
            <div className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40 w-full flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Engine:</span>
              <Badge color="emerald">running in-browser</Badge>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Architecture" />
        <div className="p-4 text-sm text-slate-300 space-y-2">
          <p className="flex items-start gap-2"><Cpu className="w-4 h-4 text-sky-400 mt-0.5 shrink-0" /> The simulation engine runs entirely in the browser (TypeScript). It implements the graph model, Dijkstra routing with configurable edge costs, discrete time-stepped traffic forwarding, failure detection, automatic recovery, metrics aggregation, and a Random Forest congestion classifier.</p>
          <p className="flex items-start gap-2"><GitBranch className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> Routing: standard shortest-path (latency) vs. adaptive (latency + congestion penalty + packet loss). Costs are normalized and non-negative for Dijkstra.</p>
          <p className="flex items-start gap-2"><Database className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> ML: a Random Forest ensemble with bootstrap sampling and random feature subsets. Trains only on user-supplied or clearly-synthetic data. Falls back to deterministic thresholds when no model is trained.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Algorithms" />
        <div className="p-4 text-sm text-slate-300 space-y-3">
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Dijkstra's shortest path</h4>
            <p className="text-xs text-slate-400">Computes the minimum-cost path from source to destination using a priority queue. Edge cost is configurable; the default combines normalized latency, a congestion penalty, and a packet-loss penalty. All weights are non-negative.</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Failure detection & recovery</h4>
            <p className="text-xs text-slate-400">When a link or router on the active route fails, the engine marks the status, checks whether the failure affects the current route, and either schedules automatic recovery (after the configured delay) or waits for manual recovery. Recovery reruns Dijkstra on the surviving graph and records detection time, computation time, and total recovery time.</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Traffic simulation</h4>
            <p className="text-xs text-slate-400">A time-stepped model. Each step generates packets at the configured rate and forwards them hop-by-hop along the active route. Drops occur on failed links, unavailable routers, or probabilistic packet loss. Queueing delay is modeled from link utilization and queue occupancy. All units: pps for rate, Mbps for bandwidth, ms for latency, bytes for packet size.</p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wider text-slate-400 mb-1">Random Forest</h4>
            <p className="text-xs text-slate-400">An ensemble of decision trees built with bootstrap aggregation and random feature subsets (sqrt(n) features per tree). Splits use Gini impurity. Predictions are majority votes; probabilities are averaged leaf-class proportions. Evaluation is in-sample — use a held-out set for unbiased metrics.</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Limitations & assumptions" />
        <div className="p-4 text-sm text-slate-300 space-y-2">
          <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> All traffic is simulated in software — no real packets are sent.</p>
          <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> The traffic model is a simplified time-stepped approximation, not a full discrete-event network simulator (e.g., ns-3).</p>
          <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> ML evaluation metrics are in-sample when using synthetic data. Do not present them as independently validated.</p>
          <p className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" /> Recovery time measures simulated route recomputation, not real wall-clock time.</p>
        </div>
      </Card>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <div className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}
