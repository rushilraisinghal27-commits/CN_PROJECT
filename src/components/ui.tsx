import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-sm shadow-lg ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-700/50">
      <div>
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'success' | 'warning' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-900 disabled:opacity-40 disabled:cursor-not-allowed';
  const sizes = { sm: 'px-2.5 py-1 text-xs', md: 'px-3.5 py-2 text-sm' };
  const variants = {
    default: 'bg-slate-700 text-slate-100 hover:bg-slate-600 focus:ring-slate-500',
    primary: 'bg-sky-600 text-white hover:bg-sky-500 focus:ring-sky-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-400',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-400',
    warning: 'bg-amber-600 text-white hover:bg-amber-500 focus:ring-amber-400',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800 hover:text-slate-100',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  unit,
  accent = 'text-slate-100',
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
}) {
  return (
    <div className="px-4 py-3 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <div className="text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${accent}`}>
        {value}
        {unit && <span className="ml-1 text-xs text-slate-400 font-normal">{unit}</span>}
      </div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm text-slate-300">{label}</span>}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-500 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Input({ value, onChange, placeholder, className = '' }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-sky-500 ${className}`}
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      className={`bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-sky-500 ${className}`}
    />
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'sky' | 'emerald' | 'amber' | 'rose' | 'violet' }) {
  const colors = {
    slate: 'bg-slate-700/60 text-slate-300 border-slate-600/40',
    sky: 'bg-sky-900/40 text-sky-300 border-sky-700/40',
    emerald: 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40',
    amber: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
    rose: 'bg-rose-900/40 text-rose-300 border-rose-700/40',
    violet: 'bg-violet-900/40 text-violet-300 border-violet-700/40',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors[color]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      {icon}
      <p className="mt-3 text-sm text-center max-w-xs">{message}</p>
    </div>
  );
}
