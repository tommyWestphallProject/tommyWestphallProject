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
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;

// Runs dagre over a flat node/edge list and returns nodes with computed
// x/y positions plus their source handle orientation, so ReactFlow can
// render a readable, non-overlapping graph regardless of how large it is.
function layoutWithDagre(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const isHorizontal = direction === 'LR';
  const laidOutNodes = nodes.map((node) => {
    const { x, y } = g.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      // dagre gives the *center* of the node; ReactFlow wants the top-left
      position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 },
    };
  });

  return laidOutNodes;
}

function Flow() {
  const [rawNodes, setRawNodes] = useState([]);
  const [rawEdges, setRawEdges] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [search, setSearch] = useState('');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

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
        setRawNodes(
          nodesData.map((n) => ({
            id: n.id,
            data: { label: n.label ?? n.id },
            position: { x: 0, y: 0 }, // placeholder, dagre fills this in below
          }))
        );
        setRawEdges(
          edgesData.map((e) => ({
            id: e.id ?? `${e.source}__${e.target}`,
            source: e.source,
            target: e.target,
          }))
        );
        setStatus('ready');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    const laidOut = layoutWithDagre(rawNodes, rawEdges, 'LR');
    setNodes(laidOut);
    setEdges(rawEdges);
  }, [status, rawNodes, rawEdges, setNodes, setEdges]);

  const highlightedNodes = useMemo(() => {
    if (!search.trim()) return nodes;
    const query = search.trim().toLowerCase();
    return nodes.map((n) => ({
      ...n,
      style: n.data.label.toLowerCase().includes(query)
        ? { border: '2px solid #FF6B00', boxShadow: '0 0 8px #FF6B00' }
        : { opacity: 0.25 },
    }));
  }, [nodes, search]);

  const onInit = useCallback((instance) => {
    setTimeout(() => instance.fitView(), 0);
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
      <ReactFlow
        nodes={highlightedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        colorMode="dark"
        onInit={onInit}
        fitView
      >
        <Background color="#444" variant={BackgroundVariant.Dots} />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export default Flow;
