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
import type { ComponentProps, ReactNode } from "react";

import { OutputNode } from "@/components/workspace/canvas/output-node";
import { ReferenceNode } from "@/components/workspace/canvas/reference-node";
import { cn } from "@/lib/utils";

import "@xyflow/react/dist/style.css";

/** Custom node renderers registered on the image canvas. */
export const defaultNodeTypes: NodeTypes = {
  output: OutputNode,
  reference: ReferenceNode
};

export interface NodeCanvasProps<NodeType extends Node = Node> {
  backgroundProps?: ComponentProps<typeof Background>;
  className?: string;
  controlsProps?: ComponentProps<typeof Controls>;
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
  backgroundProps,
  className,
  controlsProps,
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
      <div
        className={cn("relative h-full w-full", className)}
        data-testid="node-canvas-root"
      >
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
          <Background {...backgroundProps} />
          <Controls {...controlsProps} />
        </ReactFlow>
        {children}
      </div>
    </ReactFlowProvider>
  );
}
