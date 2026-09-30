import './App.css';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const SHOW_HEIGHT = 34;
const SHOW_FONT = '600 13px "Segoe UI", system-ui, sans-serif';
const TITLE_FONT = '600 11px "Segoe UI", system-ui, sans-serif';
const ORIGIN_LABEL = 'St. Elsewhere';
const RING_GAP = 230;
const LABEL_GAP = 46;

function ShowNode({ data }) {
  return (
    <div
      className={[
        'show-node',
        data.origin ? 'is-origin' : '',
        data.hub ? 'is-hub' : '',
        data.unlinked ? 'is-unlinked' : '',
      ].filter(Boolean).join(' ')}
      title={data.label}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="show-handle show-handle-center" />
      <span className="show-label">{data.label}</span>
      <Handle type="source" position={Position.Right} isConnectable={false} className="show-handle show-handle-center" />
    </div>
  );
}

function UniverseNode({ data }) {
  return (
    <div className={data.unlinked ? 'universe-frame is-unlinked' : 'universe-frame'}>
      <div className="universe-title">{data.label}</div>
    </div>
  );
}

const nodeTypes = { show: ShowNode, universe: UniverseNode };

function createMeasurer() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  return (text, font) => {
    ctx.font = font;
    return Math.ceil(ctx.measureText(text).width);
  };
}

function adjacency(nodeIds, edges) {
  const neighbors = new Map(nodeIds.map((id) => [id, []]));
  edges.forEach((edge) => {
    if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) return;
    neighbors.get(edge.source).push(edge.target);
    neighbors.get(edge.target).push(edge.source);
  });
  neighbors.forEach((list, id) => {
    neighbors.set(id, [...new Set(list)].sort((a, b) => a.localeCompare(b)));
  });
  return neighbors;
}

function growTree(origin, neighbors) {
  const depth = new Map([[origin, 0]]);
  const parent = new Map([[origin, null]]);
  const children = new Map([[origin, []]]);
  const queue = [origin];
  while (queue.length) {
    const id = queue.shift();
    neighbors.get(id).forEach((next) => {
      if (depth.has(next)) return;
      depth.set(next, depth.get(id) + 1);
      parent.set(next, id);
      if (!children.has(next)) children.set(next, []);
      children.get(id).push(next);
      queue.push(next);
    });
  }
  return { depth, parent, children };
}

function placeRadial(origin, children, sizes) {
  const placed = new Map();
  const walk = (id, theta, radius) => {
    placed.set(id, { theta, radius });
    const kids = children.get(id) || [];
    if (!kids.length) return;
    const needed = kids.reduce((sum, kid) => sum + sizes.get(kid).width + LABEL_GAP, 0);
    const fullCircle = id === origin;
    const childRadius = Math.max(
      radius + RING_GAP,
      needed / (fullCircle ? Math.PI * 2 : Math.PI * 1.15),
    );
    const spread = fullCircle ? Math.PI * 2 : Math.min(Math.PI * 1.15, needed / childRadius);
    let cursor = theta - spread / 2;
    kids.forEach((kid) => {
      const slice = spread * ((sizes.get(kid).width + LABEL_GAP) / needed);
      walk(kid, cursor + slice / 2, childRadius);
      cursor += slice;
    });
  };
  walk(origin, -Math.PI / 2, 0);
  return placed;
}

function showNode(id, sizes, labels, degree, extra) {
  const label = labels.get(id);
  const width = sizes.get(id).width;
  return {
    id,
    type: 'show',
    position: extra.position,
    width,
    height: SHOW_HEIGHT,
    style: { width, height: SHOW_HEIGHT },
    data: {
      label,
      origin: label === ORIGIN_LABEL,
      hub: !extra.unlinked && (degree.get(id) || 0) >= 6,
      unlinked: Boolean(extra.unlinked),
      depth: extra.depth,
      groupId: extra.groupId,
    },
    draggable: true,
  };
}

function buildLayout(rawNodes, rawEdges) {
  const measure = createMeasurer();
  const labels = new Map(rawNodes.map((node) => [node.id, node.data.label]));
  const sizes = new Map(rawNodes.map((node) => {
    const label = node.data.label;
    return [node.id, {
      label,
      width: Math.max(78, measure(label, SHOW_FONT) + 28),
    }];
  }));
  const degree = new Map(rawNodes.map((node) => [node.id, 0]));
  rawEdges.forEach((edge) => {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
  });

  const ids = rawNodes.map((node) => node.id);
  const neighbors = adjacency(ids, rawEdges);
  const origin = ids.find((id) => labels.get(id) === ORIGIN_LABEL) || ids[0];
  const { depth, parent, children } = growTree(origin, neighbors);
  const placed = placeRadial(origin, children, sizes); // rings grow outward from St. Elsewhere
  const maxRadius = Math.max(...[...placed.values()].map((spot) => spot.radius));
  const center = { x: maxRadius + 160, y: maxRadius + 160 };

  const nodes = [];
  depth.forEach((value, id) => {
    const width = sizes.get(id).width;
    const spot = placed.get(id);
    const radius = spot.radius;
    const theta = spot.theta;
    nodes.push(showNode(id, sizes, labels, degree, {
      depth: value,
      position: {
        x: center.x + Math.cos(theta) * radius - width / 2,
        y: center.y + Math.sin(theta) * radius - SHOW_HEIGHT / 2,
      },
    }));
  });

  const outside = ids.filter((id) => !depth.has(id)).sort((a, b) => labels.get(a).localeCompare(labels.get(b)));
  if (outside.length) {
    const title = `Not linked back to St. Elsewhere · ${outside.length} shows`;
    const maxRow = 1500;
    let x = 28;
    let y = 48;
    let rowHeight = 0;
    let contentRight = 28;
    const placed = outside.map((id) => {
      const width = sizes.get(id).width;
      if (x > 28 && x + width > maxRow) {
        x = 28;
        y += rowHeight + 12;
        rowHeight = 0;
      }
      const child = { id, x, y, width };
      x += width + 10;
      contentRight = Math.max(contentRight, x);
      rowHeight = Math.max(rowHeight, SHOW_HEIGHT);
      return child;
    });
    const groupWidth = Math.max(contentRight + 18, measure(title, TITLE_FONT) + 48);
    const groupHeight = y + rowHeight + 28;
    nodes.push({
      id: 'outside',
      type: 'universe',
      position: { x: center.x + maxRadius + 220, y: 0 },
      width: groupWidth,
      height: groupHeight,
      data: { label: title, unlinked: true },
      style: { width: groupWidth, height: groupHeight, pointerEvents: 'none' },
      draggable: false,
      selectable: false,
      connectable: false,
    });
    placed.forEach((child) => {
      nodes.push({
        ...showNode(child.id, sizes, labels, degree, {
          depth: null,
          unlinked: true,
          groupId: 'outside',
          position: { x: child.x, y: child.y },
        }),
        parentId: 'outside',
      });
    });
  }

  const treeKeys = new Set();
  parent.forEach((parentId, id) => {
    if (parentId) treeKeys.add([parentId, id].sort().join('||'));
  });
  const edges = rawEdges
    .filter((edge) => depth.has(edge.source) && depth.has(edge.target))
    .map((edge) => {
      const key = [edge.source, edge.target].sort().join('||');
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'default',
        className: treeKeys.has(key) ? undefined : 'is-chord',
      };
    });

  return { nodes, edges, neighbors };
}

function highlightState(nodes, search, focusId, neighbors) {
  const shows = nodes.filter((node) => node.type === 'show');
  const query = search.trim().toLowerCase();

  if (query) {
    const matchIds = new Set(
      shows
        .filter((node) => String(node.data.label).toLowerCase().includes(query))
        .map((node) => node.id),
    );
    const ids = new Set(matchIds);
    if (matchIds.size > 0 && matchIds.size <= 3) {
      matchIds.forEach((id) => (neighbors.get(id) || []).forEach((next) => ids.add(next)));
    }
    return { ids: matchIds.size ? ids : new Set(), matchIds, active: matchIds.size > 0 };
  }

  if (focusId) {
    return {
      ids: new Set([focusId, ...(neighbors.get(focusId) || [])]),
      matchIds: new Set([focusId]),
      active: true,
    };
  }

  return { ids: null, matchIds: new Set(), active: false };
}

function miniMapColor(node) {
  if (node.type !== 'show') return 'rgba(255,255,255,0.05)';
  if (node.data?.origin) return '#e7c36a';
  if (node.data?.unlinked) return 'rgba(255,255,255,0.28)';
  return 'rgba(244,241,234,0.82)';
}

function FlowCanvas() {
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [status, setStatus] = useState('loading');
  const [search, setSearch] = useState('');
  const [focusId, setFocusId] = useState(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const neighborsRef = useRef(new Map());
  const nodesRef = useRef(nodes);
  const skipFit = useRef(true);
  const { fitView } = useReactFlow();
  nodesRef.current = nodes;

  useEffect(() => {
    let cancelled = false;
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
        if (cancelled) return;
        setRawNodes(nodesData.map((node) => ({
          id: node.id,
          data: { label: node.label ?? node.id },
        })));
        setRawEdges(edgesData.map((edge) => ({
          id: edge.id ?? `${edge.source}__${edge.target}`,
          source: edge.source,
          target: edge.target,
        })));
        setStatus('ready');
      } catch (err) {
        console.error(err);
        if (!cancelled) setStatus('error');
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const laidOut = buildLayout(rawNodes, rawEdges);
    neighborsRef.current = laidOut.neighbors;
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
    setLayoutReady(true);
  }, [status, rawNodes, rawEdges, setNodes, setEdges]);

  const highlight = useMemo(
    () => highlightState(nodes, search, focusId, neighborsRef.current),
    [nodes, search, focusId],
  );

  const viewNodes = useMemo(() => {
    if (!highlight.active) {
      return nodes.map((node) => ({ ...node, className: undefined }));
    }
    const activeGroups = new Set(
      nodes
        .filter((node) => node.type === 'show' && highlight.ids.has(node.id))
        .map((node) => node.data.groupId),
    );
    return nodes.map((node) => {
      if (node.type === 'universe') {
        return { ...node, className: activeGroups.has(node.id) ? undefined : 'is-dim' };
      }
      const matched = highlight.matchIds.has(node.id);
      const linked = highlight.ids.has(node.id);
      return {
        ...node,
        className: [
          matched ? 'is-match' : '',
          linked && !matched ? 'is-linked' : '',
          linked ? '' : 'is-dim',
        ].filter(Boolean).join(' ') || undefined,
      };
    });
  }, [nodes, highlight]);

  const viewEdges = useMemo(() => {
    if (!highlight.active) {
      return edges.map((edge) => ({
        ...edge,
        hidden: edge.className === 'is-chord',
      }));
    }
    return edges.map((edge) => {
      const hot = highlight.ids.has(edge.source) && highlight.ids.has(edge.target);
      return {
        ...edge,
        hidden: edge.className === 'is-chord' && !hot,
        className: hot ? 'is-hot' : 'is-dim',
      };
    });
  }, [edges, highlight]);

  useEffect(() => {
    if (!layoutReady) return undefined;
    if (skipFit.current) {
      skipFit.current = false;
      return undefined;
    }
    const state = highlightState(nodesRef.current, search, focusId, neighborsRef.current);
    const frame = requestAnimationFrame(() => {
      if (!state.active) return;
      fitView({
        nodes: [...state.ids].map((id) => ({ id })),
        padding: 0.45,
        duration: 480,
        maxZoom: 1.15,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [layoutReady, search, focusId, fitView]);

  const onNodeClick = useCallback((event, node) => {
    if (node.type !== 'show' || search.trim()) return;
    setFocusId((current) => (current === node.id ? null : node.id));
  }, [search]);

  const onPaneClick = useCallback(() => {
    setFocusId(null);
  }, []);

  useEffect(() => {
    if (!layoutReady) return undefined;
    let attempts = 0;
    let timer = 0;
    const frameOrigin = () => {
      const originNode = nodesRef.current.find((node) => node.data?.origin);
      if (originNode) {
        fitView({
          nodes: [{ id: originNode.id }],
          padding: 0.45,
          minZoom: 1,
          maxZoom: 1,
          duration: 0,
        });
      }
      attempts += 1;
      if (attempts < 8) timer = window.setTimeout(frameOrigin, 100);
    };
    timer = window.setTimeout(frameOrigin, 60);
    return () => window.clearTimeout(timer);
  }, [layoutReady, fitView]);

  const matchCount = highlight.matchIds.size;

  if (status === 'loading' || (status === 'ready' && !layoutReady)) {
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
      <div className="graph-toolbar">
        <input
          className="graph-search"
          type="text"
          placeholder="Search for a show"
          value={search}
          aria-label="Search for a show"
          onChange={(event) => {
            setSearch(event.target.value);
            setFocusId(null);
          }}
        />
        <p className="graph-hint">
          {search.trim()
            ? (matchCount === 0 ? 'No shows match.' : `${matchCount} match${matchCount === 1 ? '' : 'es'}.`)
            : 'St. Elsewhere is the center. Zoom out to follow the crossovers outward.'}
        </p>
      </div>
      <ReactFlow
        nodes={viewNodes}
        edges={viewEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        colorMode="dark"
        minZoom={0.04}
        maxZoom={1.6}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        proOptions={{ hideAttribution: false }}
      >
        <Background color="rgba(255,255,255,0.16)" gap={22} size={1.1} variant={BackgroundVariant.Dots} />
        <MiniMap
          pannable
          zoomable
          maskColor="rgba(10, 11, 14, 0.72)"
          nodeStrokeWidth={0}
          nodeColor={miniMapColor}
        />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

function Flow() {
  return (
    <ReactFlowProvider>
      <FlowCanvas />
    </ReactFlowProvider>
  );
}

export default Flow;
