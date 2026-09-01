"use client";

import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeTypes,
  type OnNodeDrag,
  type OnNodesChange,
  type ReactFlowProps
} from "@xyflow/react";
import type { ReactNode } from "react";

import { OutputNode } from "@/components/workspace/canvas/output-node";
import { ReferenceNode } from "@/components/workspace/canvas/reference-node";

import "@xyflow/react/dist/style.css";

/** Custom node renderers registered on the image canvas. */
export const defaultNodeTypes: NodeTypes = {
  output: OutputNode,
  reference: ReferenceNode
};

export interface NodeCanvasProps<NodeType extends Node = Node> {
  nodes: NodeType[];
  edges?: Edge[];
  nodeTypes?: NodeTypes;
  onNodesChange?: OnNodesChange<NodeType>;
  onNodeDragStop?: OnNodeDrag<NodeType>;
  reactFlowProps?: Omit<
    ReactFlowProps<NodeType>,
    "edges" | "nodeTypes" | "nodes" | "onNodeDragStop" | "onNodesChange"
  >;
  children?: ReactNode;
}

export function NodeCanvas<NodeType extends Node = Node>({
  nodes,
  edges,
  nodeTypes = defaultNodeTypes,
  onNodesChange,
  onNodeDragStop,
  reactFlowProps,
  children
}: NodeCanvasProps<NodeType>) {
  return (
    <ReactFlowProvider>
      <div className="relative h-full w-full">
        <ReactFlow<NodeType>
          {...reactFlowProps}
          edges={edges}
          fitView
          nodeTypes={nodeTypes}
          nodes={nodes}
          onNodeDragStop={onNodeDragStop}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
        {children}
      </div>
    </ReactFlowProvider>
  );
}
