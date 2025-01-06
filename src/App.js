import logo from './logo.svg';
import './App.css';
import React, { useEffect, useRef } from 'react';
import { ReactFlow, Controls, Background, ReactFlowInstance, BackgroundVariant } from '@xyflow/react';
// import ReactFlow, { useNodesState, useEdgesState, ReactFlowInstance } from 'react-flow-renderer';
// import { ReactFlowInstance } from 'react-flow-renderer';
import '@xyflow/react/dist/style.css';

const edges = [{ id: '1-2', source: '1', target: '2' }];

const nodes = [
  {
    id: '1', // required
    position: { x: 100, y: 100 }, // required
    data: { label: 'Hello' }, // required
    type: 'input',
  },{
    id: '2', // required
    position: { x: 200, y: 200 }, // required
    data: { label: 'banana' }, // required
  },
];
 
const onLoad = (reactFlowInstance) => {
  reactFlowInstance.fitView();
}

function Flow() {
  return (
    <div className="graph-playground-div">
      <ReactFlow nodes={nodes}
      colorMode="dark"
      edges={edges}
      onInit={(instance) => setTimeout(() => instance.fitView(), 0)}
      onLoad={(instance) => setTimeout(() => instance.fitView(), 0)}>
      <Background color="#FF0000" variant={BackgroundVariant.Dot} />
      <Controls />
      </ReactFlow>
    </div>
  );
}
 
export default Flow;