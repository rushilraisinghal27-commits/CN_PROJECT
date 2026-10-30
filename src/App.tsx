import { useState } from 'react';
import { LayoutDashboard, Network, FlaskConical, BarChart3, BrainCircuit, Settings, Activity } from 'lucide-react';
import { useSimulator } from '@/hooks/useSimulator';
import DashboardPage from '@/pages/Dashboard';
import SimulatorPage from '@/pages/Simulator';
import FailureLabPage from '@/pages/FailureLab';
import AnalyticsPage from '@/pages/Analytics';
import MLPage from '@/pages/ML';
import SettingsPage from '@/pages/Settings';

type Page = 'dashboard' | 'simulator' | 'failure' | 'analytics' | 'ml' | 'settings';

const NAV: { id: Page; label: string; icon: typeof Network }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'simulator', label: 'Network Simulator', icon: Network },
  { id: 'failure', label: 'Failure Lab', icon: FlaskConical },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'ml', label: 'Machine Learning', icon: BrainCircuit },
  { id: 'settings', label: 'Settings & Docs', icon: Settings },
];

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const sim = useSimulator();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-60 shrink-0 bg-slate-900/80 border-r border-slate-800 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">Self-Healing</h1>
              <p className="text-[11px] text-slate-400 leading-tight">Network Simulator</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 px-2.5 space-y-0.5">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = page === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setPage(n.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  active ? 'bg-sky-600/20 text-sky-300 border border-sky-700/40' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-4 py-3 border-t border-slate-800 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${statusColor(sim.state.status)}`} />
            <span className="capitalize">{sim.state.status}</span>
            <span className="ml-auto">t={sim.state.simTime.toFixed(1)}s</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-auto">
        {page === 'dashboard' && <DashboardPage sim={sim} />}
        {page === 'simulator' && <SimulatorPage sim={sim} />}
        {page === 'failure' && <FailureLabPage sim={sim} />}
        {page === 'analytics' && <AnalyticsPage sim={sim} />}
        {page === 'ml' && <MLPage sim={sim} />}
        {page === 'settings' && <SettingsPage sim={sim} />}
      </main>
    </div>
  );
}

function statusColor(s: string) {
  switch (s) {
    case 'running': return 'bg-emerald-400';
    case 'paused': return 'bg-amber-400';
    case 'recovering': return 'bg-sky-400 animate-pulse';
    case 'degraded': return 'bg-orange-400';
    case 'disconnected': return 'bg-rose-400';
    case 'completed': return 'bg-slate-400';
    default: return 'bg-slate-500';
  }
}
