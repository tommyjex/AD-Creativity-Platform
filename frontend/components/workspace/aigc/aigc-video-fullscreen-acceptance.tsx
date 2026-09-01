"use client";

import {
  Background,
  type Node,
  ReactFlow
} from "@xyflow/react";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";

type AcceptanceNode = Node<Record<string, never>, "videoAcceptance">;

const nodes: AcceptanceNode[] = [
  {
    data: {},
    id: "acceptance-video-output",
    position: { x: 120, y: 80 },
    type: "videoAcceptance"
  }
];

const nodeTypes = {
  videoAcceptance: VideoAcceptanceNode
};

export function AigcVideoFullscreenAcceptance() {
  return (
    <main className="grid h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(0,1fr)] gap-3 p-4">
      <div>
        <h1 className="text-base font-semibold">视频输出节点全屏验收</h1>
        <p className="text-xs text-muted-foreground">
          本地固定媒体，不创建生成任务。原生控件与产品全屏入口应独立可用。
        </p>
      </div>
      <div
        className="overflow-hidden rounded-lg border bg-muted/30"
        data-testid="acceptance-canvas"
      >
        <ReactFlow
          defaultViewport={{ x: 40, y: 30, zoom: 1 }}
          maxZoom={2}
          minZoom={0.5}
          nodeTypes={nodeTypes}
          nodes={nodes}
        >
          <Background />
        </ReactFlow>
      </div>
    </main>
  );
}

function VideoAcceptanceNode() {
  return (
    <section
      className="flex h-[220px] w-[260px] flex-col overflow-hidden rounded-lg border border-success/30 bg-card shadow-lg"
      data-testid="acceptance-video-output-node"
    >
      <header className="flex h-9 shrink-0 items-center border-b border-success/25 bg-success/[0.08] px-3 text-xs font-semibold">
        视频输出
      </header>
      <AigcVideoPlayer
        audioState
        initialMetadata={{ duration: 6, height: 360, width: 640 }}
        mimeType="video/mp4"
        name="验收视频输出.mp4"
        resolutionLabel="360p"
        url="/acceptance/aigc-video-fullscreen.mp4"
      />
    </section>
  );
}
