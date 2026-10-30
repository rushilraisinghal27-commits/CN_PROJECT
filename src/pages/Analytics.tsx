import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { Download, Save, Trash2, BarChart3 } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import { Card, CardHeader, Button, Field, Input as TextInput, EmptyState, Badge } from '@/components/ui';

interface Props { sim: ReturnType<typeof useSimulator>; }

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

export default function AnalyticsPage({ sim }: Props) {
  const { state, actions } = sim;
  const [scenarioName, setScenarioName] = useState('');

  const scenarios = state.scenarios;
  const hasMetrics = state.metrics.length > 0;

  const comparisonData = scenarios.map((s) => ({
    name: s.name.length > 18 ? s.name.slice(0, 18) + '…' : s.name,
    latency: Number(s.metrics.avgLatency.toFixed(2)),
    pdr: Number((s.metrics.pdr * 100).toFixed(1)),
    throughput: Number(s.metrics.throughputMbps.toFixed(2)),
    loss: Number((s.metrics.packetLoss * 100).toFixed(2)),
    recovery: Number(s.metrics.recoveryTime.toFixed(2)),
    cost: Number(s.metrics.routeCost.toFixed(3)),
  }));

  const currentSeries = state.metrics.map((m) => ({
    t: m.t.toFixed(1),
    latency: Number(m.avgLatency.toFixed(2)),
    throughput: Number(m.throughputMbps.toFixed(2)),
    util: Number((m.utilization * 100).toFixed(1)),
  }));

  const saveScenario = () => {
    if (!hasMetrics) return;
    const name = scenarioName.trim() || `Scenario ${scenarios.length + 1}`;
    actions.saveScenario(name, false);
    setScenarioName('');
  };

  const exportMetrics = () => {
    const rows = ['t,avgLatency,packetLoss,utilization,throughputMbps,avgQueueLength,pdr,recoveryEvents'];
    for (const m of state.metrics) {
      rows.push([m.t, m.avgLatency, m.packetLoss, m.utilization, m.throughputMbps, m.avgQueueLength, m.pdr, m.recoveryEvents].join(','));
    }
    download('metrics.csv', rows.join('\n'));
  };

  const exportEvents = () => {
    const rows = ['timestamp,simTime,type,severity,component,message'];
    for (const e of state.events) {
      rows.push([e.timestamp, e.simTime, e.type, e.severity, e.component, `"${e.message.replace(/"/g, '""')}"`].join(','));
    }
    download('events.csv', rows.join('\n'));
  };

  const exportScenarios = () => {
    const rows = ['id,name,strategy,recoveryEnabled,avgLatency,p95Latency,pdr,packetLoss,throughputMbps,avgUtilization,maxUtilization,recoveryTime,routeCost,droppedPackets'];
    for (const s of scenarios) {
      rows.push([
        s.id, `"${s.name}"`, s.strategy, s.recoveryEnabled,
        s.metrics.avgLatency, s.metrics.p95Latency, s.metrics.pdr, s.metrics.packetLoss,
        s.metrics.throughputMbps, s.metrics.avgUtilization, s.metrics.maxUtilization,
        s.metrics.recoveryTime, s.metrics.routeCost, s.metrics.droppedPackets,
      ].join(','));
    }
    download('scenarios.csv', rows.join('\n'));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Performance Analytics</h2>
          <p className="text-sm text-slate-400">Compare scenarios, routing strategies, and export results</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={exportMetrics} disabled={!hasMetrics}><Download className="w-3.5 h-3.5" /> Metrics CSV</Button>
          <Button variant="ghost" size="sm" onClick={exportEvents} disabled={state.events.length === 0}><Download className="w-3.5 h-3.5" /> Events CSV</Button>
          <Button variant="ghost" size="sm" onClick={exportScenarios} disabled={scenarios.length === 0}><Download className="w-3.5 h-3.5" /> Scenarios CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader title="Live metrics" subtitle="From the current simulation run" />
        <div className="p-4">
          {!hasMetrics ? (
            <EmptyState message="No measurements yet. Start the simulation and let it run to collect metrics." icon={<BarChart3 className="w-6 h-6" />} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="throughput" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                    <YAxis stroke="#64748b" fontSize={11} unit="%" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="util" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Save current run as scenario"
          subtitle="Snapshot the current metrics for comparison"
          action={<Button size="sm" variant="primary" onClick={saveScenario} disabled={!hasMetrics}><Save className="w-3.5 h-3.5" /> Save</Button>}
        />
        <div className="p-4">
          <Field label="Scenario name">
            <TextInput value={scenarioName} onChange={setScenarioName} placeholder={`Scenario ${scenarios.length + 1}`} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Scenario comparison"
          subtitle={`${scenarios.length} saved scenario(s)`}
          action={scenarios.length > 0 ? <Button size="sm" variant="ghost" onClick={actions.clearScenarios}><Trash2 className="w-3.5 h-3.5" /> Clear</Button> : undefined}
        />
        <div className="p-4">
          {scenarios.length === 0 ? (
            <EmptyState message="Save scenarios to compare routing strategies and recovery configurations side by side." />
          ) : (
            <div className="space-y-6">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="latency" fill="#f59e0b" name="Avg latency (ms)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="throughput" fill="#10b981" name="Throughput (Mbps)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="recovery" fill="#22d3ee" name="Recovery time (s)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 px-2">Scenario</th>
                      <th className="text-left py-2 px-2">Strategy</th>
                      <th className="text-left py-2 px-2">Recovery</th>
                      <th className="text-right py-2 px-2">Avg lat</th>
                      <th className="text-right py-2 px-2">P95 lat</th>
                      <th className="text-right py-2 px-2">PDR</th>
                      <th className="text-right py-2 px-2">Loss</th>
                      <th className="text-right py-2 px-2">Throughput</th>
                      <th className="text-right py-2 px-2">Util</th>
                      <th className="text-right py-2 px-2">Recovery</th>
                      <th className="text-right py-2 px-2">Dropped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenarios.map((s) => (
                      <tr key={s.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-200">{s.name}</td>
                        <td className="py-2 px-2"><Badge color={s.strategy === 'adaptive' ? 'violet' : 'sky'}>{s.strategy}</Badge></td>
                        <td className="py-2 px-2">{s.recoveryEnabled ? 'on' : 'off'}</td>
                        <td className="py-2 px-2 text-right text-slate-300">{s.metrics.avgLatency.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-slate-300">{s.metrics.p95Latency.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-emerald-300">{(s.metrics.pdr * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right text-rose-300">{(s.metrics.packetLoss * 100).toFixed(2)}%</td>
                        <td className="py-2 px-2 text-right text-slate-300">{s.metrics.throughputMbps.toFixed(2)}</td>
                        <td className="py-2 px-2 text-right text-slate-300">{(s.metrics.avgUtilization * 100).toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right text-slate-300">{s.metrics.recoveryTime.toFixed(2)}s</td>
                        <td className="py-2 px-2 text-right text-slate-300">{s.metrics.droppedPackets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Report summary" subtitle="Configuration, results, and limitations" />
        <div className="p-4 text-sm text-slate-300 space-y-2">
          <p><span className="text-slate-500">Strategy:</span> {state.config.routingStrategy} · <span className="text-slate-500">Auto-recovery:</span> {state.config.autoRecovery ? 'enabled' : 'disabled'} · <span className="text-slate-500">Traffic:</span> {state.config.trafficRatePps} pps</p>
          <p><span className="text-slate-500">Route:</span> {state.route ? state.route.path.join(' → ') : 'none'} · <span className="text-slate-500">Cost:</span> {state.route?.cost.toFixed(3) ?? '—'}</p>
          <p className="text-xs text-slate-500 pt-2 border-t border-slate-800">
            All metrics are derived from the in-browser discrete-event simulation. The traffic model accounts for link bandwidth, latency, queueing delay, packet loss, router availability, and offered load. Recovery time measures the simulated interval from failure detection to successful route recomputation. Results are representative of the simulation model, not of any physical network.
          </p>
        </div>
      </Card>
    </div>
  );
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
