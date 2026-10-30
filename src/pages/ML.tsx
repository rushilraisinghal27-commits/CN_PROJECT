import { useState, useRef } from 'react';
import { BrainCircuit, Upload, Play, FileText, CheckCircle2, XCircle, Sparkles, GitBranch, Layers, Boxes, ChevronRight, ChevronDown } from 'lucide-react';
import type { useSimulator } from '@/hooks/useSimulator';
import {
  trainModel, predict, getModelStatus, parseCsv, generateSyntheticTrainingSet, getForest,
  type MLTrainingRecord, type MLFeatureVector, type MLTrainResult, type TreeNode,
} from '@/engine/ml';
import { Card, CardHeader, Button, Field, Badge, EmptyState } from '@/components/ui';
import TryModelPanel from '@/components/TryModelPanel';

interface Props { sim: ReturnType<typeof useSimulator>; }

export default function MLPage({ sim }: Props) {
  const { state } = sim;
  const [records, setRecords] = useState<MLTrainingRecord[]>([]);
  // The rows the current model was actually trained on (used by "Try the model").
  const [trainedRecords, setTrainedRecords] = useState<MLTrainingRecord[]>([]);
  const [datasetName, setDatasetName] = useState<string | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [trainResult, setTrainResult] = useState<MLTrainResult | null>(null);
  const [status, setStatus] = useState(getModelStatus());
  const [prediction, setPrediction] = useState<ReturnType<typeof predict> | null>(null);
  const [nTrees, setNTrees] = useState(10);
  const [forest, setForest] = useState<ReturnType<typeof getForest> | null>(null);
  const [openTree, setOpenTree] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setDatasetName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const { records: recs, errors } = parseCsv(text);
      setRecords(recs);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleSynthetic = () => {
    const recs = generateSyntheticTrainingSet(200);
    setRecords(recs);
    setDatasetName('synthetic_demo.csv (generated, not a real dataset)');
    setParseErrors([]);
  };

  const handleTrain = () => {
    const result = trainModel(records, nTrees);
    setTrainResult(result);
    if (result.trained) setTrainedRecords(records);
    setStatus(getModelStatus());
    setForest(getForest());
    setOpenTree(null);
  };

  // Predict on the current route's first active edge, if any
  const handlePredictLive = () => {
    const route = state.route;
    if (!route || route.edges.length === 0) return;
    const edge = state.edges.find((e) => e.id === route.edges[0]);
    if (!edge) return;
    const features: MLFeatureVector = {
      utilization: edge.utilization,
      latency: edge.latency,
      packetLoss: edge.packetLoss,
      queueLength: edge.queueLength,
      trafficRate: state.config.trafficRatePps,
      availableBandwidth: edge.bandwidth * (1 - edge.utilization),
    };
    setPrediction(predict(features));
  };

  // A CSV with utilization in percent (e.g. 85) vs the synthetic/engine 0..1 scale (0.85).
  // Simulator values are converted to whichever scale the model was trained on.
  const percentUnits = trainedRecords.length === 0 || Math.max(...trainedRecords.map((r) => r.utilization)) > 1.5;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Machine Learning</h2>
        <p className="text-sm text-slate-400">Random Forest congestion-risk classifier with honest fallback</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Dataset" subtitle="Upload a labelled CSV or generate synthetic data" />
          <div className="p-4 space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => fileRef.current?.click()}><Upload className="w-3.5 h-3.5" /> Upload CSV</Button>
              <Button variant="ghost" size="sm" onClick={handleSynthetic}><Sparkles className="w-3.5 h-3.5" /> Generate synthetic data</Button>
            </div>
            <div className="text-xs text-slate-400">
              <p>Expected columns: <code className="text-slate-300">utilization, latency, packetLoss, queueLength, trafficRate, availableBandwidth, label</code></p>
              <p className="mt-1">Label must be 0 (not congested) or 1 (congested). Minimum 10 rows.</p>
            </div>
            {datasetName && (
              <div className="text-xs flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-300">{datasetName}</span>
                <Badge color={records.length > 0 ? 'emerald' : 'rose'}>{records.length} records</Badge>
              </div>
            )}
            {parseErrors.length > 0 && (
              <div className="text-xs text-rose-300 bg-rose-900/20 border border-rose-700/40 rounded p-2 space-y-0.5">
                {parseErrors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Training" subtitle="Train the Random Forest classifier" />
          <div className="p-4 space-y-3">
            <Field label={`Number of trees: ${nTrees}`}>
              <input type="range" min={3} max={25} value={nTrees} onChange={(e) => setNTrees(parseInt(e.target.value))} className="w-full accent-sky-500" />
            </Field>
            <Button variant="success" size="sm" onClick={handleTrain} disabled={records.length < 10}>
              <Play className="w-3.5 h-3.5" /> Train model
            </Button>
            {trainResult && (
              <div className={`text-xs rounded p-3 ${trainResult.trained ? 'bg-emerald-900/20 border border-emerald-700/40 text-emerald-200' : 'bg-rose-900/20 border border-rose-700/40 text-rose-200'}`}>
                <div className="flex items-center gap-1.5 font-medium mb-1">
                  {trainResult.trained ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {trainResult.trained ? 'Training complete' : 'Training failed'}
                </div>
                <div className="text-[11px] opacity-80">{trainResult.message}</div>
                {trainResult.trained && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2 text-[11px]">
                    <span>Accuracy: {trainResult.accuracy.toFixed(3)}</span>
                    <span>Precision: {trainResult.precision.toFixed(3)}</span>
                    <span>Recall: {trainResult.recall.toFixed(3)}</span>
                    <span>F1: {trainResult.f1.toFixed(3)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Model status" subtitle="Current trained-model state" />
        <div className="p-4">
          {!status.trained ? (
            <EmptyState message={status.message} icon={<BrainCircuit className="w-6 h-6" />} />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Samples" value={status.nSamples} />
              <StatBox label="Trees" value={status.nTrees} />
              <StatBox label="Accuracy" value={status.accuracy.toFixed(3)} />
              <StatBox label="F1" value={status.f1.toFixed(3)} />
              <StatBox label="Precision" value={status.precision.toFixed(3)} />
              <StatBox label="Recall" value={status.recall.toFixed(3)} />
              <div className="col-span-2">
                <div className="text-[11px] text-slate-400 uppercase tracking-wider">Features</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {status.featureNames.map((f) => <Badge key={f} color="sky">{f}</Badge>)}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Live prediction"
          subtitle="Predict congestion risk on the first link of the active route"
          action={<Button size="sm" variant="primary" onClick={handlePredictLive} disabled={!state.route}>Predict</Button>}
        />
        <div className="p-4">
          {!prediction ? (
            <EmptyState message="Run a prediction to see congestion-risk output. When no model is trained, a deterministic fallback (utilization threshold) is used." />
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge color={prediction.available ? (prediction.label === 1 ? 'rose' : 'emerald') : 'amber'}>
                  {prediction.available ? (prediction.label === 1 ? 'Congested' : 'Not congested') : 'Fallback'}
                </Badge>
                {prediction.probability !== null && (
                  <span className="text-xs text-slate-400">p(congested) = {prediction.probability.toFixed(3)}</span>
                )}
                {prediction.confidence !== null && (
                  <span className="text-xs text-slate-400">confidence = {prediction.confidence.toFixed(2)}</span>
                )}
              </div>
              <p className="text-xs text-slate-500">{prediction.message}</p>
              <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-800">
                A probability is not a guarantee. Predictions feed the adaptive routing cost as a congestion-risk penalty.
              </p>
            </div>
          )}
        </div>
      </Card>

      <TryModelPanel
        key={percentUnits ? 'pct' : 'frac'}
        links={state.edges}
        trafficRatePps={state.config.trafficRatePps}
        records={trainedRecords}
        percentUnits={percentUnits}
      />

      {forest && (
        <Card>
          <CardHeader
            title="How the Random Forest worked on your CSV"
            subtitle={`Built from ${forest.nSamples} rows of "${datasetName ?? 'the uploaded dataset'}"`}
          />
          <div className="p-4 space-y-4 text-sm text-slate-300">
            <ol className="space-y-2 list-decimal list-inside text-xs text-slate-400">
              <li>Each row of your CSV becomes one labelled training record (6 features + a 0/1 congestion label).</li>
              <li>Each of the <b>{forest.nTrees}</b> trees draws a bootstrap sample (sampling with replacement) from those records.</li>
              <li>At every split, only a random subset of features is considered — this decorrelates the trees.</li>
              <li>A split is chosen by minimizing Gini impurity; the tree grows until depth {forest.maxDepth} or a pure leaf is reached.</li>
              <li>To predict, all trees vote. The majority vote is the label; the average leaf probability is the confidence.</li>
            </ol>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Records (from CSV)" value={forest.nSamples} />
              <StatBox label="Trees in forest" value={forest.nTrees} />
              <StatBox label="Features / record" value={forest.featureNames.length} />
              <StatBox label="Max tree depth" value={forest.maxDepth} />
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400 mb-2">
                <Boxes className="w-3.5 h-3.5" /> Feature importance (split usage)
              </div>
              <div className="space-y-1.5">
                {forest.featureImportance.map((fi) => (
                  <div key={fi.feature} className="flex items-center gap-2">
                    <span className="w-40 text-xs text-slate-300">{fi.feature}</span>
                    <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-sky-500/80 rounded transition-all"
                        style={{ width: `${Math.max(2, fi.usage * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-[11px] text-slate-400">{(fi.usage * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400 mb-2">
                <Layers className="w-3.5 h-3.5" /> Individual decision trees ({forest.trees.length})
              </div>
              <div className="space-y-1.5">
                {forest.trees.map((t) => {
                  const open = openTree === t.index;
                  return (
                    <div key={t.index} className="rounded-lg border border-slate-700/50 bg-slate-800/30">
                      <button
                        type="button"
                        onClick={() => setOpenTree(open ? null : t.index)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left"
                      >
                        {open
                          ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                        <GitBranch className="w-3.5 h-3.5 text-sky-400" />
                        <span className="text-xs font-medium text-slate-200">Tree #{t.index + 1}</span>
                        <span className="text-[11px] text-slate-500">depth {t.depth} · {t.leafCount} leaves</span>
                        <span className="ml-auto flex gap-1">
                          {t.features.map((f) => (
                            <Badge key={f} color="sky">{forest.featureNames[f]}</Badge>
                          ))}
                        </span>
                      </button>
                      {open && (
                        <div className="px-3 pb-3 pt-1 overflow-x-auto">
                          <TreeView depth={0} node={t.root} featureNames={forest.featureNames} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function TreeView({
  node, depth, featureNames,
}: { node: TreeNode; depth: number; featureNames: string[] }) {
  if (node.leaf) {
    const label = node.label === 1 ? 'Congested' : 'Not congested';
    const color = node.label === 1 ? 'rose' : 'emerald';
    const pct = Math.round((node.probability ?? 0) * 100);
    return (
      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-900/60 border border-slate-700/50 text-xs">
        <span className={`px-1.5 py-0.5 rounded ${color === 'rose' ? 'bg-rose-900/50 text-rose-300' : 'bg-emerald-900/50 text-emerald-300'}`}>{label}</span>
        <span className="text-slate-400">p={pct}%</span>
      </div>
    );
  }
  const fname = node.feature !== undefined ? featureNames[node.feature] : '?';
  return (
    <div className="inline-flex flex-col gap-1" style={{ marginLeft: depth * 12 }}>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-sky-900/30 border border-sky-700/40 text-xs text-sky-200">
        {fname} ≤ {node.threshold?.toFixed(3)}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">yes</span>
          {node.left && <TreeView node={node.left} depth={depth + 1} featureNames={featureNames} />}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-slate-500">no</span>
          {node.right && <TreeView node={node.right} depth={depth + 1} featureNames={featureNames} />}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
      <div className="text-[11px] text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-slate-100">{value}</div>
    </div>
  );
}
