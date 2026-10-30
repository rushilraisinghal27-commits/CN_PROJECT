import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Router, Cable, AlertTriangle, Gauge, Timer, Percent, Activity, ShieldCheck, ShieldAlert } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import { Card, CardHeader, Stat, Badge, EmptyState, Button } from '@/components/ui';

interface Props { sim: ReturnType<typeof useSimulator>; }

export default function DashboardPage({ sim }: Props) {
  const { state, actions } = sim;
  const k = useMemo(() => {
    const e = (sim as unknown as { state: typeof state }).state;
    const totalRouters = e.nodes.filter((n) => n.type !== 'source' && n.type !== 'destination').length + e.nodes.filter((n) => n.type === 'source' || n.type === 'destination').length;
    const totalLinks = e.edges.length;
    const failedLinks = e.edges.filter((ed) => ed.failed).length;
    const activeLinks = totalLinks - failedLinks;
    const last = e.metrics[e.metrics.length - 1];
    return {
      totalRouters, totalLinks, activeLinks, failedLinks,
      utilization: last?.utilization ?? 0,
      avgLatency: last?.avgLatency ?? 0,
      pdr: last?.pdr ?? 0,
      packetLoss: last?.packetLoss ?? 0,
    };
  }, [state, sim]);

  const chartData = state.metrics.map((m) => ({
    t: m.t.toFixed(1),
    latency: Number(m.avgLatency.toFixed(2)),
    loss: Number((m.packetLoss * 100).toFixed(2)),
    util: Number((m.utilization * 100).toFixed(1)),
    throughput: Number(m.throughputMbps.toFixed(2)),
    queue: Number(m.avgQueueLength.toFixed(1)),
  }));

  const recentAlerts = state.events.filter((e) => e.severity !== 'info').slice(-8).reverse();
  const recoveryEvents = state.metrics.map((m) => ({ t: m.t.toFixed(1), count: m.recoveryEvents }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Network Dashboard</h2>
          <p className="text-sm text-slate-400">Live monitoring of the simulated self-healing network</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={state.status} />
          {state.status !== 'running' ? (
            <Button variant="success" size="sm" onClick={actions.start}><Activity className="w-3.5 h-3.5" /> Start</Button>
          ) : (
            <Button variant="warning" size="sm" onClick={actions.pause}>Pause</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Kpi icon={<Router className="w-4 h-4" />} label="Routers" value={k.totalRouters} />
        <Kpi icon={<Cable className="w-4 h-4" />} label="Links" value={k.totalLinks} />
        <Kpi icon={<ShieldCheck className="w-4 h-4" />} label="Active" value={k.activeLinks} accent="text-emerald-400" />
        <Kpi icon={<AlertTriangle className="w-4 h-4" />} label="Failed" value={k.failedLinks} accent="text-rose-400" />
        <Kpi icon={<Gauge className="w-4 h-4" />} label="Utilization" value={`${(k.utilization * 100).toFixed(0)}%`} accent="text-sky-400" />
        <Kpi icon={<Timer className="w-4 h-4" />} label="Avg Latency" value={`${k.avgLatency.toFixed(1)}ms`} accent="text-amber-400" />
        <Kpi icon={<Percent className="w-4 h-4" />} label="PDR" value={`${(k.pdr * 100).toFixed(1)}%`} accent="text-emerald-400" />
        <Kpi icon={<Activity className="w-4 h-4" />} label="Loss" value={`${(k.packetLoss * 100).toFixed(1)}%`} accent="text-rose-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Latency over time" subtitle="Average end-to-end latency (ms)" />
          <div className="p-4 h-64">
            {chartData.length === 0 ? <EmptyState message="Start the simulation to collect latency samples." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} unit="ms" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="latency" stroke="#f59e0b" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent alerts" subtitle="Failures, recoveries, congestion" />
          <div className="p-3 max-h-64 overflow-auto space-y-1.5">
            {recentAlerts.length === 0 ? <EmptyState message="No alerts yet." /> : recentAlerts.map((e) => (
              <div key={e.id} className="flex items-start gap-2 text-xs px-2 py-1.5 rounded bg-slate-800/40">
                <Badge color={e.severity === 'critical' ? 'rose' : e.severity === 'warning' ? 'amber' : 'sky'}>{e.type}</Badge>
                <div className="min-w-0">
                  <div className="text-slate-300 truncate">{e.message}</div>
                  <div className="text-slate-500 text-[10px]">t={e.simTime.toFixed(2)}s</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Network utilization" subtitle="Aggregate active-link utilization (%)" />
          <div className="p-4 h-56">
            {chartData.length === 0 ? <EmptyState message="No samples yet." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="util" stroke="#0ea5e9" strokeWidth={2} fill="url(#utilGrad)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Throughput" subtitle="Delivered throughput (Mbps)" />
          <div className="p-4 h-56">
            {chartData.length === 0 ? <EmptyState message="No samples yet." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} unit="M" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="throughput" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Packet loss" subtitle="Cumulative loss ratio (%)" />
          <div className="p-4 h-48">
            {chartData.length === 0 ? <EmptyState message="No samples yet." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="loss" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Queue length" subtitle="Average link queue (packets)" />
          <div className="p-4 h-48">
            {chartData.length === 0 ? <EmptyState message="No samples yet." /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="queue" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recovery events" subtitle="Cumulative recoveries over time" />
          <div className="p-4 h-48">
            {recoveryEvents.length === 0 ? <EmptyState message="No recoveries recorded yet." icon={<ShieldAlert className="w-6 h-6" />} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recoveryEvents}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="t" stroke="#64748b" fontSize={11} unit="s" />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="stepAfter" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  fontSize: 12,
  color: '#e2e8f0',
};

function Kpi({ icon, label, value, accent = 'text-slate-100' }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <Card className="p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400 uppercase tracking-wider truncate">{label}</div>
        <div className={`text-lg font-semibold ${accent}`}>{value}</div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' | 'violet'; label: string }> = {
    idle: { color: 'slate', label: 'Idle' },
    running: { color: 'emerald', label: 'Running' },
    paused: { color: 'amber', label: 'Paused' },
    recovering: { color: 'sky', label: 'Recovering' },
    degraded: { color: 'amber', label: 'Degraded' },
    disconnected: { color: 'rose', label: 'Disconnected' },
    completed: { color: 'slate', label: 'Completed' },
  };
  const m = map[status] ?? map.idle;
  return <Badge color={m.color}>{m.label}</Badge>;
}
