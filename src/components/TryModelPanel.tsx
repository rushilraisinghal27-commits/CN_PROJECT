import { useMemo, useState } from 'react';
import { predict, type MLFeatureVector, type MLTrainingRecord } from '@/engine/ml';
import type { SimEdge } from '@/engine/types';
import { Card, CardHeader, Button, Select, Badge } from '@/components/ui';

// "Try the model" panel for the ML page.
//
// Units: the sliders and the model use the units of the data the model was
// trained on. For a percent-unit CSV that means utilization and packetLoss are
// 0..100, so simulator values (0..1 fractions) are multiplied by 100 when a
// link is loaded. Pass percentUnits={false} for 0..1 data (e.g. the synthetic
// generator) and no conversion is applied.

interface Props {
  links: SimEdge[];
  trafficRatePps: number;
  records: MLTrainingRecord[]; // the rows the current model was trained on
  percentUnits: boolean;
  defaultLinkId?: string;
}

type Key = keyof MLFeatureVector;

const META: Record<Key, { text: string; unit: string; step: number }> = {
  utilization: { text: 'Utilization', unit: '%', step: 1 },
  latency: { text: 'Latency', unit: 'ms', step: 1 },
  packetLoss: { text: 'Packet loss', unit: '%', step: 0.1 },
  queueLength: { text: 'Queue length', unit: 'pkts', step: 1 },
  trafficRate: { text: 'Traffic rate', unit: 'pps', step: 1 },
  availableBandwidth: { text: 'Available bandwidth', unit: 'Mbps', step: 1 },
};
const KEYS = Object.keys(META) as Key[];

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / p) * p;
};

function fromLink(link: SimEdge | undefined, trafficRatePps: number, scale: number): MLFeatureVector {
  if (!link) {
    return { utilization: 0, latency: 0, packetLoss: 0, queueLength: 0, trafficRate: trafficRatePps, availableBandwidth: 0 };
  }
  return {
    utilization: link.utilization * scale,
    latency: link.latency,
    packetLoss: link.packetLoss * scale,
    queueLength: link.queueLength,
    trafficRate: trafficRatePps,
    availableBandwidth: link.bandwidth * (1 - link.utilization),
  };
}

function pickRandom(records: MLTrainingRecord[], label: number): MLFeatureVector | null {
  const pool = records.filter((r) => r.label === label);
  if (pool.length === 0) return null;
  const r = pool[Math.floor(Math.random() * pool.length)];
  return {
    utilization: r.utilization,
    latency: r.latency,
    packetLoss: r.packetLoss,
    queueLength: r.queueLength,
    trafficRate: r.trafficRate,
    availableBandwidth: r.availableBandwidth,
  };
}

export default function TryModelPanel({
  links,
  trafficRatePps,
  records,
  percentUnits,
  defaultLinkId = 'L_S_R1',
}: Props) {
  const scale = percentUnits ? 100 : 1;
  const initialId = links.find((l) => l.id === defaultLinkId)?.id ?? links[0]?.id ?? '';
  const [linkId, setLinkId] = useState(initialId);
  const [values, setValues] = useState<MLFeatureVector>(() =>
    fromLink(links.find((l) => l.id === initialId), trafficRatePps, scale),
  );
  const [note, setNote] = useState('');

  // Slider ranges: sensible defaults, widened to cover the training data.
  const ranges = useMemo(() => {
    const out: Record<Key, number> = {
      utilization: percentUnits ? 100 : 1,
      latency: 200,
      packetLoss: percentUnits ? 100 : 1,
      queueLength: 100,
      trafficRate: 1000,
      availableBandwidth: 100,
    };
    for (const k of KEYS) {
      if (k === 'utilization' || k === 'packetLoss') continue;
      let m = out[k];
      for (const r of records) if (r[k] > m) m = r[k];
      out[k] = niceMax(m);
    }
    return out;
  }, [records, percentUnits]);

  const loadLink = (id: string) => {
    setLinkId(id);
    setValues(fromLink(links.find((l) => l.id === id), trafficRatePps, scale));
    setNote('');
  };

  const loadExample = (label: 1 | 0) => {
    const ex = pickRandom(records, label);
    const name = label === 1 ? 'congested' : 'healthy';
    if (!ex) {
      setNote(`The training data has no ${name} rows (label ${label}).`);
      return;
    }
    setValues(ex);
    setNote(`Loaded a random ${name} row (label ${label}) from the training data.`);
  };

  const pred = predict(values);
  const p = pred.available && pred.probability !== null ? pred.probability : null;
  const congested = pred.label === 1;
  const barColor = p === null ? '#475569' : `hsl(${Math.round(120 * (1 - p))}, 70%, 45%)`;

  return (
    <Card>
      <CardHeader
        title="Try the model"
        subtitle={
          percentUnits
            ? 'Move any slider to see the prediction update. Utilization and packet loss are in percent, matching the training data.'
            : 'Move any slider to see the prediction update. Utilization and packet loss are 0–1 fractions, matching the training data.'
        }
      />
      <div className="p-4 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400">Link</span>
          <Select
            value={linkId}
            onChange={loadLink}
            options={links.map((l) => ({ value: l.id, label: `${l.source}–${l.target}` }))}
          />
          <Button size="sm" variant="ghost" onClick={() => loadLink(linkId)} disabled={links.length === 0}>
            Reload from link
          </Button>
          <div className="flex-1" />
          <Button size="sm" variant="danger" onClick={() => loadExample(1)}>Load a congested example</Button>
          <Button size="sm" variant="success" onClick={() => loadExample(0)}>Load a healthy example</Button>
        </div>
        {note && <p className="text-xs text-slate-500 -mt-2">{note}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {KEYS.map((k) => {
            const fractional = !percentUnits && (k === 'utilization' || k === 'packetLoss');
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400">{META[k].text}</span>
                  <span className="font-mono text-slate-100">
                    {Number.isInteger(values[k]) ? values[k] : values[k].toFixed(2)} {META[k].unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={Math.max(ranges[k], values[k])}
                  step={fractional ? 0.01 : META[k].step}
                  value={values[k]}
                  onChange={(e) => setValues((v) => ({ ...v, [k]: parseFloat(e.target.value) }))}
                  className="mt-1 w-full accent-sky-500"
                  aria-label={META[k].text}
                />
              </div>
            );
          })}
        </div>

        <div className="rounded-lg bg-slate-800/40 border border-slate-700/40 p-4">
          {p === null ? (
            <p className="text-sm text-slate-400">No trained model yet. Train one above to see predictions here.</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400">Congestion probability</div>
                  <div className="text-3xl font-semibold text-slate-100">{(p * 100).toFixed(0)}%</div>
                </div>
                <Badge color={congested ? 'rose' : 'emerald'}>{congested ? 'Congested' : 'Not congested'}</Badge>
              </div>
              <div
                className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-700"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p * 100)}
              >
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{ width: `${p * 100}%`, backgroundColor: barColor }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
