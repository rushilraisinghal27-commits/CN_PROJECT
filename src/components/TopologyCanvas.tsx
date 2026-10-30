import { useEffect, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
import type { SimNode, SimEdge, RouteInfo } from '@/engine/types';

interface Props {
  nodes: SimNode[];
  edges: SimEdge[];
  route: RouteInfo | null;
  sourceId: string | null;
  destinationId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function TopologyCanvas({ nodes, edges, route, sourceId, destinationId, selectedId, onSelect }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // init once
  useEffect(() => {
    if (!ref.current || cyRef.current) return;
    const cy = cytoscape({
      container: ref.current,
      wheelSensitivity: 0.2,
      style: [
        { selector: 'node', style: {
          'label': 'data(label)', 'text-valign': 'bottom', 'text-halign': 'center',
          'color': '#cbd5e1', 'font-size': 11, 'text-margin-y': 4,
          'width': 38, 'height': 38, 'border-width': 2, 'background-color': '#0ea5e9',
          'border-color': '#0284c7', 'shape': 'round-rectangle',
        }},
        { selector: 'node[type="source"]', style: { 'background-color': '#10b981', 'border-color': '#059669', 'shape': 'triangle' }},
        { selector: 'node[type="destination"]', style: { 'background-color': '#f59e0b', 'border-color': '#d97706', 'shape': 'triangle' }},
        { selector: 'node[?active]', style: { 'background-color': '#0ea5e9' }},
        { selector: 'node[?down]', style: { 'background-color': '#475569', 'border-color': '#334155', 'opacity': 0.6 }},
        { selector: 'node:selected', style: { 'border-width': 4, 'border-color': '#e2e8f0' }},
        { selector: 'edge', style: {
          'width': 3, 'line-color': '#334155', 'target-arrow-color': '#334155',
          'target-arrow-shape': 'triangle', 'curve-style': 'bezier',
          'label': 'data(label)', 'font-size': 9, 'color': '#94a3b8', 'text-background-color': '#0f172a', 'text-background-opacity': 0.7, 'text-background-padding': '1px',
        }},
        { selector: 'edge[?failed]', style: { 'line-color': '#ef4444', 'target-arrow-color': '#ef4444', 'line-style': 'dashed', 'width': 2 }},
        { selector: 'edge[?congested]', style: { 'line-color': '#f97316', 'target-arrow-color': '#f97316', 'width': 4 }},
        { selector: 'edge[?onRoute]', style: { 'line-color': '#22d3ee', 'target-arrow-color': '#22d3ee', 'width': 5 }},
        { selector: 'edge:selected', style: { 'line-color': '#e2e8f0', 'target-arrow-color': '#e2e8f0', 'width': 5 }},
      ],
      elements: [],
    });
    cy.on('tap', 'node', (e) => onSelect(e.target.id()));
    cy.on('tap', 'edge', (e) => onSelect(e.target.id()));
    cy.on('tap', (e) => { if (e.target === cy) onSelect(null); });
    cyRef.current = cy;
    return () => { cy.destroy(); cyRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update elements
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const routeEdgeIds = new Set(route?.edges ?? []);
    const els: ElementDefinition[] = [];
    for (const n of nodes) {
      els.push({
        data: {
          id: n.id, label: n.name, type: n.type,
          active: n.available && n.status === 'active' ? 1 : 0,
          down: n.status === 'down' ? 1 : 0,
        },
        position: { x: n.x, y: n.y },
      });
    }
    for (const e of edges) {
      els.push({
        data: {
          id: e.id, source: e.source, target: e.target,
          label: `${e.latency}ms·${e.bandwidth}M`,
          failed: e.failed ? 1 : 0,
          congested: !e.failed && e.utilization > 0.8 ? 1 : 0,
          onRoute: routeEdgeIds.has(e.id) ? 1 : 0,
        },
      });
    }
    cy.elements().remove();
    cy.add(els);
    // preserve layout positions from node data
    cy.nodes().forEach((n) => {
      const data = nodes.find((x) => x.id === n.id());
      if (data) n.position({ x: data.x, y: data.y });
    });
    cy.fit(undefined, 60);
  }, [nodes, edges, route]);

  // selection highlight
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.$(':selected').unselect();
    if (selectedId) {
      const el = cy.getElementById(selectedId);
      if (el && el.length > 0) el.select();
    }
  }, [selectedId]);

  // expose layout helpers via custom events
  useEffect(() => {
    const handler = () => cyRef.current?.fit(undefined, 60);
    window.addEventListener('topology-fit', handler);
    return () => window.removeEventListener('topology-fit', handler);
  }, []);

  return <div ref={ref} className="w-full h-full min-h-[400px] bg-slate-950/40 rounded-lg" />;
}
