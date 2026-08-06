import './App.css';
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MiniMap,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

// ─── Constants ──────────────────────────────────────────────
const NODE_HEIGHT = 38;
const NODE_WIDTH_MIN = 140;
const NODE_WIDTH_MAX = 280;
const COMP_SEP_X = 40;
const COMP_SEP_Y = 70;
const COMPS_PER_ROW = 4;

// ─── Franchise colour palette ───────────────────────────────
const FRANCHISE_COLORS = {
  'Star Trek':           '#2a9d8f',
  'Law & Order':         '#e76f51',
  'CSI':                 '#264653',
  'NCIS':                '#457b9d',
  'Stargate':            '#2a9d23',
  'Doctor Who':          '#9d4ddd',
  'The X-Files':         '#2b9348',
  'Marvel':              '#b362ff',
  "Grey's Anatomy":      '#e63946',
  'Chicago':             '#4361ee',
  'Saved by the Bell':   '#f4a261',
  'Degrassi':            '#8d99ae',
  "Three's Company":     '#ef233c',
  'The Office':          '#a8dadc',
  'Twin Peaks':          '#c70039',
  'Mission: Impossible': '#901A12',
  'M*A*S*H':             '#8d0417',
  'Andy Griffith':       '#f16744',
  'Cheers / Wings':      '#ffb5a7',
  'The Simpsons':        '#ffd60a',
  'The Brady Bunch':     '#f4a261',
  'Hill Street Blues':   '#4361ee',
  'Friends / Melrose':   '#ff9f1c',
  'Family Ties':         '#087e8b',
  'The Golden Girls':    '#ff9aa2',
  'The Munsters':        '#2a2b2a',
  'The Addams Family':   '#3a1c71',
  'Batman 1966':         '#ffc300',
  'The Love Boat':       '#4fb6e8',
  'Bewitched':             '#008080',
  'Seinfeld':              '#ffdd00',
  'The Twilight Zone':     '#663276',
  'The West Wing':         '#003366',
  'Veronica Mars':         '#8e44ad',
  'Supernatural':          '#c0394b',
  'Smallville':            '#2ecc71',
  'Other':                 '#6b7280',
};

function getFranchiseColor(group) {
  return FRANCHISE_COLORS[group] || FRANCHISE_COLORS['Other'];
}

// ─── Helper: dynamic node width based on label length ───────
function getNodeWidth(label) {
  const len = (label || '').length;
  return Math.min(NODE_WIDTH_MAX, Math.max(NODE_WIDTH_MIN, 110 + len * 7));
}

// ─── Helper: darken a hex colour for the border ─────────────
function darken(hex, amt) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) + amt);
  const g = Math.max(0, ((num >> 8) & 0xff) + amt);
  const b = Math.max(0, (num & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ─── Custom node component ──────────────────────────────────
function ShowNode({ data }) {
  const bg = data.color || '#6b7280';
  const borderHex = data.isMatch ? '#FF6B00' : darken(bg, -30);
  const borderWidth = data.isMatch ? 3 : 2;
  const boxShadow = data.isMatch
    ? '0 0 16px #FF6B00'
    : '0 2px 6px rgba(0,0,0,0.4)';
  const opacity = data.isNeighbor ? 0.55 : 1;

  return (
    <>
      <div
        className="show-node"
        style={{
          background: bg,
          border: `${borderWidth}px solid ${borderHex}`,
          boxShadow,
          opacity,
        }}
      >
        <span className="show-node-label" title={data.label}>
          {data.label}
        </span>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const nodeTypes = { custom: ShowNode };

// ─── Connected-component detection (undirected) ─────────────
function getConnectedComponents(nodeIds, edges) {
  const adj = new Map();
  nodeIds.forEach((id) => adj.set(id, new Set()));
  edges.forEach((e) => {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  });

  const visited = new Set();
  const components = [];
  for (const id of nodeIds) {
    if (!visited.has(id)) {
      const comp = [];
      const queue = [id];
      visited.add(id);
      while (queue.length) {
        const curr = queue.shift();
        comp.push(curr);
        const neighbors = adj.get(curr) || new Set();
        for (const nb of neighbors) {
          if (!visited.has(nb) && adj.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      components.push(comp);
    }
  }
  return components;
}

// ─── Dagre layout for a single subgraph ─────────────────────
function dagreLayout(nodes, edges, direction = 'TB') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 25, ranksep: 70 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: node.width, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, { weight: 1 });
  });

  dagre.layout(g);

  const isHorizontal = direction === 'LR';
  return nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: { x: x - node.width / 2, y: y - NODE_HEIGHT / 2 },
    };
  });
}

// ─── Full graph layout: dagre per component, grid-stacked ─────
function layoutGraph(nodes, edges) {
  const nodeIds = nodes.map((n) => n.id);
  const components = getConnectedComponents(nodeIds, edges);

  // Sort components by size (largest first) for a cleaner top-left start
  components.sort((a, b) => b.length - a.length);

  const laidOutNodes = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;
  let compsInRow = 0;

  components.forEach((compIds) => {
    const compNodeIds = new Set(compIds);
    const compNodes = nodes.filter((n) => compNodeIds.has(n.id));
    const compEdges = edges.filter(
      (e) => compNodeIds.has(e.source) && compNodeIds.has(e.target)
    );

    const laidOut = dagreLayout(compNodes, compEdges, 'TB');

    // Bounding box of this component
    let compMaxX = 0;
    let compMaxY = 0;
    laidOut.forEach((node) => {
      compMaxX = Math.max(compMaxX, node.position.x + node.width);
      compMaxY = Math.max(compMaxY, node.position.y + NODE_HEIGHT);
    });

    // Offset every node in this component to its grid cell
    laidOut.forEach((node) => {
      laidOutNodes.push({
        ...node,
        position: {
          x: node.position.x + cursorX,
          y: node.position.y + cursorY,
        },
      });
    });

    const compWidth = compMaxX - cursorX;
    rowHeight = Math.max(rowHeight, compMaxY - cursorY);
    cursorX += compWidth + COMP_SEP_X;
    compsInRow++;

    // Start a new row when enough components are placed
    if (compsInRow >= COMPS_PER_ROW) {
      cursorX = 0;
      cursorY += rowHeight + COMP_SEP_Y;
      rowHeight = 0;
      compsInRow = 0;
    }
  });

  return laidOutNodes;
}

// ─── Main component ─────────────────────────────────────────
function Flow() {
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ── Fetch JSON data ───────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const [nodesRes, edgesRes] = await Promise.all([
          fetch(`${process.env.PUBLIC_URL}/data/nodes.json`),
          fetch(`${process.env.PUBLIC_URL}/data/edges.json`),
        ]);
        if (!nodesRes.ok || !edgesRes.ok) {
          throw new Error('Failed to fetch nodes/edges JSON');
        }
        const nodesData = await nodesRes.json();
        const edgesData = await edgesRes.json();

        const processedNodes = nodesData.map((n) => {
          const label = n.label ?? n.id;
          const width = getNodeWidth(label);
          const group = n.group || 'Other';
          const color = getFranchiseColor(group);
          return {
            id: n.id,
            type: 'custom',
            data: { label, color, group, isMatch: false, isNeighbor: false },
            position: { x: 0, y: 0 },
            width,
            height: NODE_HEIGHT,
          };
        });

        const processedEdges = edgesData.map((e) => ({
          id: e.id ?? `${e.source}__${e.target}`,
          source: e.source,
          target: e.target,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: '#888',
          },
          style: { stroke: '#555', strokeWidth: 1.5 },
        }));

        setRawNodes(processedNodes);
        setRawEdges(processedEdges);
        setStatus('ready');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }
    loadData();
  }, []);

  // ── Run dagre layout (per-component, grid-stacked) ─────────
  useEffect(() => {
    if (status !== 'ready') return;
    const laidOut = layoutGraph(rawNodes, rawEdges);
    setNodes(laidOut);
    setEdges(rawEdges);
  }, [status, rawNodes, rawEdges, setNodes, setEdges]);

  // ── Enhanced search: highlight matches + 1-hop neighbours ──
  const searchedNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const query = search.toLowerCase();

    const matchingIds = new Set(
      nodes
        .filter((n) => n.data.label.toLowerCase().includes(query))
        .map((n) => n.id)
    );

    if (matchingIds.size === 0) return nodes;

    // Collect connected nodes (1-hop neighbours)
    const connected = new Set(matchingIds);
    rawEdges.forEach((e) => {
      if (matchingIds.has(e.source)) connected.add(e.target);
      if (matchingIds.has(e.target)) connected.add(e.source);
    });

    return nodes.map((n) => {
      const base = n.data;
      if (matchingIds.has(n.id)) {
        return { ...n, data: { ...base, isMatch: true } };
      } else if (connected.has(n.id)) {
        return { ...n, data: { ...base, isNeighbor: true } };
      } else {
        return { ...n, data: { ...base }, style: { opacity: 0.06 } };
      }
    });
  }, [nodes, search, rawEdges]);

  // ── Build legend from groups present in data ───────────────
  const presentGroups = useMemo(() => {
    const set = new Set();
    nodes.forEach((n) => set.add(n.data.group));
    return [...set].sort();
  }, [nodes]);

  // ── Fit view after layout ─────────────────────────────────
  const onInit = useCallback((instance) => {
    setTimeout(() => instance.fitView({ padding: 0.1, duration: 0 }), 100);
  }, []);

  if (status === 'loading') {
    return <div className="graph-status">Loading the Tommy Westphall universe…</div>;
  }
  if (status === 'error') {
    return (
      <div className="graph-status">
        Couldn't load nodes/edges data. Run the scraper (webScraperPy/scraper.py)
        to generate public/data/nodes.json and public/data/edges.json.
      </div>
    );
  }

  return (
    <div className="graph-playground-div">
      <input
        className="graph-search"
        type="text"
        placeholder="Search for a show..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="graph-legend">
        {presentGroups.slice(0, 12).map((g) => (
          <div key={g} className="legend-item">
            <span className="legend-swatch" style={{ background: getFranchiseColor(g) }} />
            <span className="legend-label">{g}</span>
          </div>
        ))}
        {presentGroups.length > 12 && (
          <span className="legend-item" style={{ fontSize: 11, opacity: 0.5 }}>
            +{presentGroups.length - 12} more
          </span>
        )}
      </div>

      <ReactFlow
        nodes={searchedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        colorMode="dark"
        nodeTypes={nodeTypes}
        fitView
      >
        <Background color="#374151" variant={BackgroundVariant.Dots} gap={24} />
        <MiniMap
          nodeColor={(n) => n.data?.color || '#6b7280'}
          nodeShape="rectangle"
          nodeMinSize={8}
          pannable
          zoomable
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default Flow;
