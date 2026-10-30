import { useState, useMemo } from 'react';
import { Play, Pause, Square, RotateCcw, Plus, Trash2, Crosshair, ZoomIn, Maximize, Route } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import { Card, CardHeader, Button, Select, Field, NumberInput, Toggle, Badge } from '@/components/ui';
import TopologyCanvas from '@/components/TopologyCanvas';

interface Props { sim: ReturnType<typeof useSimulator>; }

export default function SimulatorPage({ sim }: Props) {
  const { state, actions } = sim;
  const [selected, setSelected] = useState<string | null>(null);
  const [addNodeName, setAddNodeName] = useState('');
  const [addLinkFrom, setAddLinkFrom] = useState('');
  const [addLinkTo, setAddLinkTo] = useState('');
  const [addLinkBw, setAddLinkBw] = useState(100);
  const [addLinkLat, setAddLinkLat] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const nodeOptions = useMemo(() => state.nodes.map((n) => ({ value: n.id, label: `${n.name} (${n.id})` })), [state.nodes]);

  const selectedNode = state.nodes.find((n) => n.id === selected);
  const selectedEdge = state.edges.find((e) => e.id === selected);

  const handleAddNode = () => {
    setError(null);
    const id = addNodeName.trim() || `R${state.nodes.length + 1}`;
    const r = actions.addNode({ id, name: id, type: 'router' });
    if ('error' in r) setError(r.error); else setAddNodeName('');
  };
  const handleAddLink = () => {
    setError(null);
    if (!addLinkFrom || !addLinkTo) { setError('Select both endpoints.'); return; }
    const r = actions.addLink({ source: addLinkFrom, target: addLinkTo, bandwidth: addLinkBw, latency: addLinkLat });
    if ('error' in r) setError(r.error);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Network Simulator</h2>
          <p className="text-sm text-slate-400">Interactive topology, routing, and live traffic simulation</p>
        </div>
        <div className="flex items-center gap-1.5">
          {state.status !== 'running' ? (
            <Button variant="success" size="sm" onClick={actions.start}><Play className="w-3.5 h-3.5" /> Start</Button>
          ) : (
            <Button variant="warning" size="sm" onClick={actions.pause}><Pause className="w-3.5 h-3.5" /> Pause</Button>
          )}
          <Button size="sm" onClick={actions.resume}>Resume</Button>
          <Button variant="ghost" size="sm" onClick={actions.stop}><Square className="w-3.5 h-3.5" /> Stop</Button>
          <Button variant="ghost" size="sm" onClick={actions.loadSample}><RotateCcw className="w-3.5 h-3.5" /> Sample</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Network topology"
            subtitle="Click nodes/edges to inspect. Drag to reposition."
            action={
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => window.dispatchEvent(new Event('topology-fit'))}><Maximize className="w-3.5 h-3.5" /></Button>
              </div>
            }
          />
          <div className="p-3 h-[480px]">
            <TopologyCanvas
              nodes={state.nodes}
              edges={state.edges}
              route={state.route}
              sourceId={state.sourceId}
              destinationId={state.destinationId}
              selectedId={selected}
              onSelect={setSelected}
            />
          </div>
          <div className="px-4 py-2.5 border-t border-slate-700/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-400" /> Active route</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500" /> Healthy link</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-orange-500" /> Congested</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-rose-500 border-dashed" /> Failed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500" /> Source</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500" /> Destination</span>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Route" subtitle="Current active path" />
            <div className="p-4 space-y-2 text-sm">
              {state.route ? (
                <>
                  <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs">
                    <Route className="w-4 h-4" />
                    {state.route.path.join(' → ')}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Cost: <span className="text-slate-200">{state.route.cost.toFixed(3)}</span></span>
                    <Badge color={state.route.strategy === 'adaptive' ? 'violet' : 'sky'}>{state.route.strategy}</Badge>
                  </div>
                  <div className="text-[11px] text-slate-500">Reason: {state.route.reason}</div>
                </>
              ) : (
                <div className="text-sm text-rose-300">No active route. Network may be disconnected.</div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Endpoints" />
            <div className="p-4 space-y-2.5">
              <Field label="Source">
                <Select value={state.sourceId ?? ''} onChange={(v) => actions.setSource(v)} options={nodeOptions} className="w-full" />
              </Field>
              <Field label="Destination">
                <Select value={state.destinationId ?? ''} onChange={(v) => actions.setDestination(v)} options={nodeOptions} className="w-full" />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Routing strategy" />
            <div className="p-4 space-y-2.5">
              <Select
                value={state.config.routingStrategy}
                onChange={(v) => actions.updateConfig({ routingStrategy: v as 'shortest' | 'adaptive' })}
                options={[
                  { value: 'shortest', label: 'Shortest path (latency)' },
                  { value: 'adaptive', label: 'Adaptive (latency+loss+congestion)' },
                ]}
                className="w-full"
              />
              <Toggle
                checked={state.config.autoRecovery}
                onChange={(v) => actions.updateConfig({ autoRecovery: v })}
                label="Automatic recovery"
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader title="Add router" />
          <div className="p-4 space-y-2.5">
            <Field label="Router name">
              <input
                value={addNodeName}
                onChange={(e) => setAddNodeName(e.target.value)}
                placeholder="R6"
                className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </Field>
            <Button variant="primary" size="sm" onClick={handleAddNode} className="w-full"><Plus className="w-3.5 h-3.5" /> Add router</Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Add link" />
          <div className="p-4 space-y-2.5">
            <Field label="From">
              <Select value={addLinkFrom} onChange={setAddLinkFrom} options={[{ value: '', label: 'Select…' }, ...nodeOptions]} className="w-full" />
            </Field>
            <Field label="To">
              <Select value={addLinkTo} onChange={setAddLinkTo} options={[{ value: '', label: 'Select…' }, ...nodeOptions]} className="w-full" />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="BW (Mbps)"><NumberInput value={addLinkBw} onChange={setAddLinkBw} min={1} /></Field>
              <Field label="Lat (ms)"><NumberInput value={addLinkLat} onChange={setAddLinkLat} min={1} /></Field>
            </div>
            <Button variant="primary" size="sm" onClick={handleAddLink} className="w-full"><Plus className="w-3.5 h-3.5" /> Add link</Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Inspector" subtitle={selected ?? 'Nothing selected'} />
          <div className="p-4 text-sm">
            {error && <div className="mb-3 text-xs text-rose-300 bg-rose-900/30 border border-rose-700/40 rounded px-2 py-1.5">{error}</div>}
            {selectedNode ? (
              <div className="space-y-1.5 text-xs">
                <Row label="ID" value={selectedNode.id} />
                <Row label="Name" value={selectedNode.name} />
                <Row label="Type" value={selectedNode.type} />
                <Row label="Status" value={selectedNode.status} accent={selectedNode.status === 'down' ? 'text-rose-300' : 'text-emerald-300'} />
                <Row label="Capacity" value={`${selectedNode.processingCapacity} pps`} />
                <Row label="Queue" value={`${selectedNode.queueLength} packets`} />
                <div className="pt-2 flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { if (state.sourceId !== selectedNode.id) actions.setSource(selectedNode.id); }}><Crosshair className="w-3 h-3" /> Set source</Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (state.destinationId !== selectedNode.id) actions.setDestination(selectedNode.id); }}>Set dest</Button>
                  <Button size="sm" variant="danger" onClick={() => { actions.removeNode(selectedNode.id); setSelected(null); }}><Trash2 className="w-3 h-3" /> Remove</Button>
                </div>
              </div>
            ) : selectedEdge ? (
              <div className="space-y-1.5 text-xs">
                <Row label="ID" value={selectedEdge.id} />
                <Row label="Endpoints" value={`${selectedEdge.source} → ${selectedEdge.target}`} />
                <Row label="Status" value={selectedEdge.status} accent={selectedEdge.failed ? 'text-rose-300' : selectedEdge.status === 'congested' ? 'text-orange-300' : 'text-emerald-300'} />
                <Row label="Latency" value={`${selectedEdge.latency} ms`} />
                <Row label="Bandwidth" value={`${selectedEdge.bandwidth} Mbps`} />
                <Row label="Utilization" value={`${(selectedEdge.utilization * 100).toFixed(1)}%`} />
                <Row label="Packet loss" value={`${(selectedEdge.packetLoss * 100).toFixed(2)}%`} />
                <Row label="Queue" value={`${selectedEdge.queueLength} packets`} />
                <div className="pt-2 flex gap-2">
                  <Button size="sm" variant="danger" onClick={() => { actions.removeLink(selectedEdge.id); setSelected(null); }}><Trash2 className="w-3 h-3" /> Remove</Button>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs">Select a node or link on the canvas to inspect or modify it.</div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Traffic configuration" />
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Traffic rate (pps)"><NumberInput value={state.config.trafficRatePps} onChange={(v) => actions.updateConfig({ trafficRatePps: v })} min={1} /></Field>
          <Field label="Packet size (bytes)"><NumberInput value={state.config.packetSizeBytes} onChange={(v) => actions.updateConfig({ packetSizeBytes: v })} min={64} /></Field>
          <Field label="Step interval (ms)"><NumberInput value={state.config.simulationStepMs} onChange={(v) => actions.updateConfig({ simulationStepMs: v })} min={100} /></Field>
          <Field label="Congestion threshold"><NumberInput value={state.config.congestionThreshold} onChange={(v) => actions.updateConfig({ congestionThreshold: v })} min={0.5} max={1} step={0.05} /></Field>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, value, accent = 'text-slate-200' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={accent}>{value}</span>
    </div>
  );
}
