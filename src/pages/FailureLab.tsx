import { useMemo, useState } from 'react';
import { Zap, Power, PowerOff, Activity, RotateCcw, Gauge, Clock, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import { Card, CardHeader, Button, Select, Field, NumberInput, Badge, EmptyState } from '@/components/ui';

interface Props { sim: ReturnType<typeof useSimulator>; }

export default function FailureLabPage({ sim }: Props) {
  const { state, actions } = sim;
  const [targetLink, setTargetLink] = useState('');
  const [targetNode, setTargetNode] = useState('');
  const [congestionLink, setCongestionLink] = useState('');
  const [congestionUtil, setCongestionUtil] = useState(0.9);
  const [bwLink, setBwLink] = useState('');
  const [bwVal, setBwVal] = useState(40);
  const [latLink, setLatLink] = useState('');
  const [latVal, setLatVal] = useState(80);
  const [lossLink, setLossLink] = useState('');
  const [lossVal, setLossVal] = useState(0.05);
  const [error, setError] = useState<string | null>(null);

  const linkOptions = useMemo(() => state.edges.map((e) => ({ value: e.id, label: `${e.source}–${e.target}` })), [state.edges]);
  const nodeOptions = useMemo(() => state.nodes.filter((n) => n.type === 'router').map((n) => ({ value: n.id, label: n.name })), [state.nodes]);

  const timeline = state.recoveries.slice().reverse();

  const run = (fn: () => { error?: string }) => {
    setError(null);
    const r = fn();
    if (r.error) setError(r.error);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Failure Lab</h2>
          <p className="text-sm text-slate-400">Inject failures and watch the self-healing loop respond</p>
        </div>
        <div className="flex gap-2">
          <Badge color={state.config.autoRecovery ? 'emerald' : 'amber'}>
            {state.config.autoRecovery ? 'Auto recovery ON' : 'Manual recovery'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={actions.resetAllFaults}><RotateCcw className="w-3.5 h-3.5" /> Reset all faults</Button>
        </div>
      </div>

      {error && <div className="text-xs text-rose-300 bg-rose-900/30 border border-rose-700/40 rounded px-3 py-2">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Link failures" subtitle="Disable or restore individual links" />
          <div className="p-4 space-y-3">
            <Field label="Target link">
              <Select value={targetLink} onChange={setTargetLink} options={[{ value: '', label: 'Select…' }, ...linkOptions]} className="w-full" />
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" className="flex-1" onClick={() => targetLink && run(() => actions.failLink(targetLink))}>
                <PowerOff className="w-3.5 h-3.5" /> Disable
              </Button>
              <Button variant="success" size="sm" className="flex-1" onClick={() => targetLink && run(() => actions.restoreLink(targetLink))}>
                <Power className="w-3.5 h-3.5" /> Restore
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Router failures" subtitle="Take routers up or down" />
          <div className="p-4 space-y-3">
            <Field label="Target router">
              <Select value={targetNode} onChange={setTargetNode} options={[{ value: '', label: 'Select…' }, ...nodeOptions]} className="w-full" />
            </Field>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" className="flex-1" onClick={() => targetNode && run(() => actions.failNode(targetNode))}>
                <PowerOff className="w-3.5 h-3.5" /> Disable
              </Button>
              <Button variant="success" size="sm" className="flex-1" onClick={() => targetNode && run(() => actions.restoreNode(targetNode))}>
                <Power className="w-3.5 h-3.5" /> Restore
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Congestion injection" subtitle="Set utilization on a link" />
          <div className="p-4 space-y-3">
            <Field label="Target link">
              <Select value={congestionLink} onChange={setCongestionLink} options={[{ value: '', label: 'Select…' }, ...linkOptions]} className="w-full" />
            </Field>
            <Field label={`Utilization: ${(congestionUtil * 100).toFixed(0)}%`}>
              <input type="range" min={0} max={1} step={0.05} value={congestionUtil} onChange={(e) => setCongestionUtil(parseFloat(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <Button variant="warning" size="sm" className="w-full" onClick={() => congestionLink && run(() => actions.injectCongestion(congestionLink, congestionUtil))}>
              <Gauge className="w-3.5 h-3.5" /> Apply congestion
            </Button>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Bandwidth change" />
          <div className="p-4 space-y-3">
            <Field label="Link">
              <Select value={bwLink} onChange={setBwLink} options={[{ value: '', label: 'Select…' }, ...linkOptions]} className="w-full" />
            </Field>
            <Field label="New bandwidth (Mbps)"><NumberInput value={bwVal} onChange={setBwVal} min={1} /></Field>
            <Button variant="primary" size="sm" className="w-full" onClick={() => bwLink && run(() => actions.setLinkBandwidth(bwLink, bwVal))}>Apply</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Delay injection" />
          <div className="p-4 space-y-3">
            <Field label="Link">
              <Select value={latLink} onChange={setLatLink} options={[{ value: '', label: 'Select…' }, ...linkOptions]} className="w-full" />
            </Field>
            <Field label="New latency (ms)"><NumberInput value={latVal} onChange={setLatVal} min={1} /></Field>
            <Button variant="primary" size="sm" className="w-full" onClick={() => latLink && run(() => actions.setLinkLatency(latLink, latVal))}>Apply</Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Packet loss injection" />
          <div className="p-4 space-y-3">
            <Field label="Link">
              <Select value={lossLink} onChange={setLossLink} options={[{ value: '', label: 'Select…' }, ...linkOptions]} className="w-full" />
            </Field>
            <Field label="Loss probability (0–1)"><NumberInput value={lossVal} onChange={setLossVal} min={0} max={1} step={0.01} /></Field>
            <Button variant="primary" size="sm" className="w-full" onClick={() => lossLink && run(() => actions.setLinkPacketLoss(lossLink, lossVal))}>Apply</Button>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recovery timeline"
          subtitle="Self-healing events with detection, computation, and total recovery times"
          action={
            <div className="flex items-center gap-2">
              {!state.config.autoRecovery && (
                <Button size="sm" variant="primary" onClick={() => actions.runManualRecovery()}>
                  <Zap className="w-3.5 h-3.5" /> Run recovery
                </Button>
              )}
            </div>
          }
        />
        <div className="p-4">
          {timeline.length === 0 ? (
            <EmptyState message="No recovery events yet. Inject a failure on a link that is part of the active route to trigger self-healing." icon={<ShieldAlert className="w-6 h-6" />} />
          ) : (
            <div className="space-y-2">
              {timeline.map((r) => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${r.success ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'}`}>
                    {r.success ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${r.success ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {r.success ? 'Recovery succeeded' : 'Recovery failed'}
                      </span>
                      <span className="text-[11px] text-slate-500">@ t={r.detectedAt.toFixed(2)}s</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{r.reason}</div>
                    {r.oldRoute && <div className="text-[11px] text-slate-500 mt-0.5">Old: {r.oldRoute.path.join(' → ')}</div>}
                    {r.newRoute && <div className="text-[11px] text-cyan-400 mt-0.5">New: {r.newRoute.path.join(' → ')}</div>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Detection: {r.detectionTime.toFixed(2)}s</span>
                      <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Computation: {r.routeComputationTime.toFixed(2)}s</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Total: {r.totalRecoveryTime.toFixed(2)}s</span>
                      <span>Flows affected: {r.affectedFlows}</span>
                      <span>Dropped: {r.droppedPackets}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Event log" subtitle="Chronological simulation events" />
        <div className="p-3 max-h-72 overflow-auto">
          {state.events.length === 0 ? (
            <EmptyState message="No events recorded." />
          ) : (
            <div className="space-y-1">
              {state.events.slice().reverse().slice(0, 60).map((e) => (
                <div key={e.id} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded hover:bg-slate-800/40">
                  <span className="text-slate-500 font-mono w-16 shrink-0">{e.simTime.toFixed(2)}s</span>
                  <Badge color={e.severity === 'critical' ? 'rose' : e.severity === 'warning' ? 'amber' : 'slate'}>{e.type}</Badge>
                  <span className="text-slate-300 truncate">{e.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
