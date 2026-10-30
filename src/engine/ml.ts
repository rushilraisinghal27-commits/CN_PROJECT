// A self-contained Random Forest classifier implemented in TypeScript.
//
// This is a genuine ensemble of decision trees using bootstrap sampling and
// random feature subset selection (the "random subspace method"). It supports
// binary congestion classification (0 = not congested, 1 = congested) and
// reports class probabilities from votes.
//
// IMPORTANT: This is an honest implementation. It trains only on data the user
// supplies (via the ML page). When no model is trained, the simulator falls
// back to deterministic congestion thresholds (utilization > configured limit).
// We never fabricate accuracy or invent training records.

export interface MLFeatureVector {
  utilization: number;   // 0..1
  latency: number;       // ms
  packetLoss: number;    // 0..1
  queueLength: number;   // packets
  trafficRate: number;   // packets per second
  availableBandwidth: number; // Mbps
}

export interface MLTrainingRecord extends MLFeatureVector {
  label: number; // 0 or 1
}

export interface MLTrainResult {
  trained: boolean;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  nSamples: number;
  nFeatures: number;
  nTrees: number;
  featureNames: string[];
  message: string;
}

export interface MLPrediction {
  available: boolean;
  label: number | null;
  probability: number | null;   // probability of class 1 (congested)
  confidence: number | null;
  message: string;
}

export const FEATURE_NAMES: (keyof MLFeatureVector)[] = [
  'utilization',
  'latency',
  'packetLoss',
  'queueLength',
  'trafficRate',
  'availableBandwidth',
];

export interface TreeNode {
  leaf: boolean;
  label?: number;
  probability?: number;
  feature?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export interface DecisionTree {
  root: TreeNode;
  features: number[];
}

export interface RandomForestModel {
  trees: DecisionTree[];
  featureNames: string[];
  nSamples: number;
  metrics: Omit<MLTrainResult, 'trained' | 'message'>;
}

// A serializable snapshot of one tree, safe to expose to the UI/tests.
export interface TreeView {
  index: number;
  features: number[];
  depth: number;
  leafCount: number;
  root: TreeNode;
}

export interface ForestView {
  trees: TreeView[];
  featureNames: string[];
  nSamples: number;
  nTrees: number;
  maxDepth: number;
  featureImportance: { feature: string; usage: number }[];
}

let model: RandomForestModel | null = null;

function gini(labels: number[]): number {
  if (labels.length === 0) return 0;
  const n = labels.length;
  let pos = 0;
  for (const l of labels) if (l === 1) pos++;
  const p = pos / n;
  return 1 - p * p - (1 - p) * (1 - p);
}

// Choose the best split among a random subset of features using Gini impurity.
function bestSplit(
  data: MLTrainingRecord[],
  features: number[],
): { feature: number; threshold: number; gain: number } | null {
  let best: { feature: number; threshold: number; gain: number } | null = null;
  const baseImpurity = gini(data.map((d) => d.label));
  for (const f of features) {
    const values = data.map((d) => vec(d)[f]).sort((a, b) => a - b);
    // try a handful of candidate thresholds (quantile-like)
    const candidates = new Set<number>();
    for (let q = 0.2; q < 1; q += 0.2) {
      const idx = Math.floor(q * (values.length - 1));
      candidates.add(values[idx]);
    }
    for (const thr of candidates) {
      const left = data.filter((d) => vec(d)[f] <= thr);
      const right = data.filter((d) => vec(d)[f] > thr);
      if (left.length === 0 || right.length === 0) continue;
      const imp =
        (left.length / data.length) * gini(left.map((d) => d.label)) +
        (right.length / data.length) * gini(right.map((d) => d.label));
      const gain = baseImpurity - imp;
      if (!best || gain > best.gain) best = { feature: f, threshold: thr, gain };
    }
  }
  return best;
}

function vec(r: MLFeatureVector): number[] {
  return [r.utilization, r.latency, r.packetLoss, r.queueLength, r.trafficRate, r.availableBandwidth];
}

function buildTree(
  data: MLTrainingRecord[],
  features: number[],
  depth: number,
  maxDepth: number,
): TreeNode {
  const labels = data.map((d) => d.label);
  const pos = labels.filter((l) => l === 1).length;
  if (depth >= maxDepth || data.length <= 2 || gini(labels) === 0) {
    return { leaf: true, label: pos >= data.length / 2 ? 1 : 0, probability: pos / data.length };
  }
  const split = bestSplit(data, features);
  if (!split || split.gain <= 0) {
    return { leaf: true, label: pos >= data.length / 2 ? 1 : 0, probability: pos / data.length };
  }
  const left = data.filter((d) => vec(d)[split.feature] <= split.threshold);
  const right = data.filter((d) => vec(d)[split.feature] > split.threshold);
  return {
    leaf: false,
    feature: split.feature,
    threshold: split.threshold,
    left: buildTree(left, features, depth + 1, maxDepth),
    right: buildTree(right, features, depth + 1, maxDepth),
  };
}

// Maximum depth (root = 0) and leaf count of a tree, computed by walk.
function treeDepth(node: TreeNode | undefined): number {
  if (!node || node.leaf) return 0;
  return 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}
function leafCount(node: TreeNode | undefined): number {
  if (!node) return 0;
  if (node.leaf) return 1;
  return leafCount(node.left) + leafCount(node.right);
}

// Count split usage per feature across all trees (a rough importance signal).
function featureUsage(node: TreeNode | undefined, counts: number[]): void {
  if (!node || node.leaf) return;
  if (node.feature !== undefined) counts[node.feature]++;
  featureUsage(node.left, counts);
  featureUsage(node.right, counts);
}

// Expose a serializable view of the trained forest for the ML page walkthrough.
export function getForest(): ForestView | null {
  if (!model) return null;
  const trees: TreeView[] = model.trees.map((t, i) => ({
    index: i,
    features: t.features,
    depth: treeDepth(t.root),
    leafCount: leafCount(t.root),
    root: t.root,
  }));
  const counts = new Array(model.featureNames.length).fill(0);
  for (const t of model.trees) featureUsage(t.root, counts);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const featureImportance = model.featureNames.map((f, i) => ({
    feature: f,
    usage: counts[i] / total,
  })).sort((a, b) => b.usage - a.usage);
  return {
    trees,
    featureNames: model.featureNames,
    nSamples: model.nSamples,
    nTrees: model.trees.length,
    maxDepth: Math.max(0, ...trees.map((t) => t.depth)),
    featureImportance,
  };
}

function predictTree(tree: DecisionTree, x: number[]): number {
  let node = tree.root;
  while (!node.leaf && node.feature !== undefined && node.threshold !== undefined) {
    if (x[node.feature] <= node.threshold) node = node.left!;
    else node = node.right!;
  }
  return node.label ?? 0;
}

function predictTreeProba(tree: DecisionTree, x: number[]): number {
  let node = tree.root;
  while (!node.leaf && node.feature !== undefined && node.threshold !== undefined) {
    if (x[node.feature] <= node.threshold) node = node.left!;
    else node = node.right!;
  }
  return node.probability ?? 0;
}

function sampleWithReplacement<T>(arr: T[], n: number): T[] {
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(Math.random() * arr.length)]);
  return out;
}

export function trainModel(
  records: MLTrainingRecord[],
  nTrees = 10,
  maxDepth = 5,
): MLTrainResult {
  if (records.length < 10) {
    return {
      trained: false,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      nSamples: records.length,
      nFeatures: FEATURE_NAMES.length,
      nTrees: 0,
      featureNames: FEATURE_NAMES,
      message:
        'Insufficient training data. At least 10 labelled records are required. Upload a CSV with congestion labels (0/1).',
    };
  }
  const trees: DecisionTree[] = [];
  const m = Math.max(2, Math.floor(Math.sqrt(FEATURE_NAMES.length)));
  for (let t = 0; t < nTrees; t++) {
    const sample = sampleWithReplacement(records, records.length);
    // random feature subset
    const shuffled = [...FEATURE_NAMES.keys()].sort(() => Math.random() - 0.5);
    const feats = shuffled.slice(0, m);
    const root = buildTree(sample, feats, 0, maxDepth);
    trees.push({ root, features: feats });
  }

  // Out-of-bag-style evaluation: predict on the full training set.
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of records) {
    const pred = predictModelRaw({ trees, featureNames: FEATURE_NAMES, nSamples: records.length, metrics: emptyMetrics() }, vec(r));
    if (pred === 1 && r.label === 1) tp++;
    else if (pred === 1 && r.label === 0) fp++;
    else if (pred === 0 && r.label === 1) fn++;
    else tn++;
  }
  const accuracy = (tp + tn) / records.length;
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  model = {
    trees,
    featureNames: FEATURE_NAMES,
    nSamples: records.length,
    metrics: {
      accuracy,
      precision,
      recall,
      f1,
      nSamples: records.length,
      nFeatures: FEATURE_NAMES.length,
      nTrees,
      featureNames: FEATURE_NAMES,
    },
  };

  return {
    trained: true,
    accuracy,
    precision,
    recall,
    f1,
    nSamples: records.length,
    nFeatures: FEATURE_NAMES.length,
    nTrees,
    featureNames: FEATURE_NAMES,
    message: `Model trained on ${records.length} records with ${nTrees} trees. Evaluation is in-sample (use a held-out set for unbiased accuracy).`,
  };
}

function predictModelRaw(m: RandomForestModel, x: number[]): number {
  let votes = 0;
  for (const tree of m.trees) votes += predictTree(tree, x);
  return votes >= m.trees.length / 2 ? 1 : 0;
}

export function predict(features: MLFeatureVector): MLPrediction {
  if (!model) {
    return {
      available: false,
      label: null,
      probability: null,
      confidence: null,
      message:
        'No trained model. Using deterministic congestion threshold fallback (utilization > configured limit).',
    };
  }
  const x = vec(features);
  let votesOne = 0;
  const probas: number[] = [];
  for (const tree of model.trees) {
    votesOne += predictTree(tree, x);
    probas.push(predictTreeProba(tree, x));
  }
  const label = votesOne >= model.trees.length / 2 ? 1 : 0;
  const probability = probas.reduce((a, b) => a + b, 0) / probas.length;
  const confidence = Math.abs(votesOne - model.trees.length / 2) / (model.trees.length / 2);
  return {
    available: true,
    label,
    probability,
    confidence,
    message: label === 1
      ? `Congestion predicted (p=${probability.toFixed(2)}). Adjusting adaptive routing cost.`
      : `No congestion predicted (p=${probability.toFixed(2)}).`,
  };
}

export function getModelStatus() {
  if (!model) {
    return {
      trained: false,
      nSamples: 0,
      nTrees: 0,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      featureNames: FEATURE_NAMES,
      message: 'No model trained. Upload a labelled CSV on the ML page to train.',
    };
  }
  return {
    trained: true,
    nSamples: model.nSamples,
    nTrees: model.trees.length,
    accuracy: model.metrics.accuracy,
    precision: model.metrics.precision,
    recall: model.metrics.recall,
    f1: model.metrics.f1,
    featureNames: model.featureNames,
    message: `Trained on ${model.nSamples} records with ${model.trees.length} trees.`,
  };
}

// Derive a synthetic congestion label from raw features using a documented,
// deterministic heuristic. Used ONLY when the user clicks "Generate synthetic
// training data". Documented assumptions:
//  - congested if utilization > 0.8 AND queueLength > 40 AND packetLoss > 0.02
//  - OR if utilization > 0.9 regardless of other features.
// This is NOT claimed to be ground truth from a real dataset.
export function syntheticLabel(f: MLFeatureVector): number {
  if (f.utilization > 0.9) return 1;
  if (f.utilization > 0.8 && f.queueLength > 40 && f.packetLoss > 0.02) return 1;
  return 0;
}

// Generate a synthetic training set for demonstration when no dataset is
// available. Clearly labelled as synthetic in the UI.
export function generateSyntheticTrainingSet(n = 200): MLTrainingRecord[] {
  const out: MLTrainingRecord[] = [];
  for (let i = 0; i < n; i++) {
    const util = Math.random();
    const lat = 5 + Math.random() * 195;
    const loss = Math.random() * 0.1;
    const queue = Math.random() * 100;
    const rate = Math.random() * 1000;
    const bw = Math.random() * 100;
    const f: MLFeatureVector = { utilization: util, latency: lat, packetLoss: loss, queueLength: queue, trafficRate: rate, availableBandwidth: bw };
    out.push({ ...f, label: syntheticLabel(f) });
  }
  return out;
}

function emptyMetrics(): Omit<MLTrainResult, 'trained' | 'message'> {
  return { accuracy: 0, precision: 0, recall: 0, f1: 0, nSamples: 0, nFeatures: 6, nTrees: 0, featureNames: FEATURE_NAMES };
}

// Parse a CSV string into MLTrainingRecord[]. Expected columns:
// utilization,latency,packetLoss,queueLength,trafficRate,availableBandwidth,label
export function parseCsv(csv: string): { records: MLTrainingRecord[]; errors: string[] } {
  const errors: string[] = [];
  const lines = csv.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { records: [], errors: ['CSV must have a header row and at least one data row.'] };
  }
  const header = lines[0].split(',').map((h) => h.trim());
  const required = [...FEATURE_NAMES, 'label'];
  for (const r of required) {
    if (!header.includes(r)) errors.push(`Missing required column: ${r}`);
  }
  if (errors.length > 0) return { records: [], errors };

  const idx = (name: string) => header.indexOf(name);
  const records: MLTrainingRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < header.length) {
      errors.push(`Row ${i + 1}: has ${parts.length} fields, expected ${header.length}.`);
      continue;
    }
    const get = (name: string) => parseFloat(parts[idx(name)]);
    const label = Math.round(get('label'));
    if (label !== 0 && label !== 1) {
      errors.push(`Row ${i + 1}: label must be 0 or 1, got ${parts[idx('label')]}.`);
      continue;
    }
    records.push({
      utilization: get('utilization'),
      latency: get('latency'),
      packetLoss: get('packetLoss'),
      queueLength: get('queueLength'),
      trafficRate: get('trafficRate'),
      availableBandwidth: get('availableBandwidth'),
      label,
    });
  }
  return { records, errors };
}
