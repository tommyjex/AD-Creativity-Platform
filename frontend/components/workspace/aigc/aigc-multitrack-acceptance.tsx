"use client";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps
} from "@xyflow/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  AigcMultitrackEditor,
  type AigcMultitrackSaveResult
} from "@/components/workspace/aigc/aigc-multitrack-editor";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import { installAcceptanceNetworkGuard } from "@/lib/aigc/acceptance-network-guard";
import type { AigcTimelineSource } from "@/lib/aigc/multitrack-editor-store";
import type { MultiTrackEditConfig } from "@/lib/aigc/types";

const STORAGE_KEY = "aigc.acceptance.multitrack.v1";
const VIDEO_URL = "/acceptance/aigc-video-fullscreen.mp4";

type FixtureNodeType =
  | "video-source"
  | "multi_track_edit"
  | "video-result";
type RunStatus = "cached" | "failed" | "idle" | "succeeded";

interface FixtureNodeData extends Record<string, unknown> {
  label: string;
  nodeType: FixtureNodeType;
  summary: string;
}

type FixtureNode = Node<FixtureNodeData, "fixtureNode">;

const nodeTypes = {
  fixtureNode: FixtureFlowNode
};
const NODE_POSITIONS: Record<FixtureNodeType, { x: number; y: number }> = {
  "video-source": { x: 30, y: 90 },
  multi_track_edit: { x: 330, y: 90 },
  "video-result": { x: 650, y: 90 }
};
const NODE_LABELS: Record<FixtureNodeType, string> = {
  "video-source": "视频节点（上游）",
  multi_track_edit: "多轨剪辑",
  "video-result": "视频节点（结果）"
};
const INITIAL_CONFIG: MultiTrackEditConfig = {
  canvas: {
    background_color: "#101318FF",
    height: 1080,
    mode: "custom",
    width: 1920
  },
  output: { format: "mp4", fps: 30 },
  tracks: [
    {
      elements: [
        {
          id: "acceptance-title",
          inline_text: null,
          loop: false,
          source: {
            source_handle: "text",
            source_node_id: "acceptance-text-source"
          },
          style: {
            background_color: "#00000099",
            bold: true,
            color: "#FFFFFFFF",
            font_type: "SY_Black",
            font_size: 52,
            italic: false,
            underline: false
          },
          target_time: { end_ms: 6000, start_ms: 0 },
          transform: {
            height: 180,
            rotation: 0,
            width: 1200,
            x: 360,
            y: 760
          },
          type: "text"
        }
      ],
      hidden: false,
      id: "acceptance-text-track",
      muted: false,
      name: "标题轨道",
      order: 0,
      type: "text"
    },
    {
      elements: [
        {
          asset_id: "acceptance-subtitle-asset",
          id: "acceptance-subtitle",
          loop: false,
          style: {
            background_color: "#00000099",
            bold: false,
            color: "#FFFFFFFF",
            font_type: "SY_Black",
            font_size: 42,
            italic: false,
            underline: false
          },
          target_time: { end_ms: 6000, start_ms: 0 },
          transform: {
            height: 162,
            rotation: 0,
            width: 1536,
            x: 192,
            y: 864
          },
          type: "subtitle"
        }
      ],
      hidden: false,
      id: "acceptance-subtitle-track",
      muted: false,
      name: "字幕轨道",
      order: 1,
      type: "subtitle"
    }
  ]
};
const SOURCES: AigcTimelineSource[] = [
  {
    available: true,
    kind: "video",
    mime_type: "video/mp4",
    preview_url: VIDEO_URL,
    source_handle: "video",
    source_node_id: "acceptance-video-source"
  },
  {
    available: true,
    kind: "audio",
    source_handle: "audio",
    source_node_id: "acceptance-audio-source"
  },
  {
    available: true,
    kind: "image",
    source_handle: "image",
    source_node_id: "acceptance-image-source"
  },
  {
    available: true,
    kind: "text",
    preview_text: "Task 9 上游真实文案",
    text_preview_status: "resolved",
    source_handle: "text",
    source_node_id: "acceptance-text-source"
  }
];

export function AigcMultitrackAcceptance() {
  const ready = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot
  );

  useEffect(() => installAcceptanceNetworkGuard(), []);

  if (!ready) {
    return (
      <main
        className="grid h-[100dvh] place-items-center bg-[#0b0d10] text-zinc-400"
        data-ready="false"
        data-testid="multitrack-acceptance"
      >
        正在准备非计费多轨验收场景…
      </main>
    );
  }

  return <AigcMultitrackAcceptanceContent />;
}

function AigcMultitrackAcceptanceContent() {
  const [phase, setPhase] = useState<"canvas" | "timeline">("canvas");
  const [nodes, setNodes] = useState<FixtureNodeType[]>(["video-source"]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [config, setConfig] = useState(readStoredConfig);
  const [revision, setRevision] = useState(1);
  const [attempts, setAttempts] = useState(0);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [resultOpen, setResultOpen] = useState(false);
  const [cachedInput, setCachedInput] = useState<string | null>(null);
  const flowNodes = useMemo(
    () =>
      nodes.map<FixtureNode>((nodeType) => ({
        data: {
          label: NODE_LABELS[nodeType],
          nodeType,
          summary:
            nodeType === "multi_track_edit"
              ? "视频 / 图片 / 音频 / 文本 → 视频"
              : nodeType === "video-source"
                ? "video_asset 输出"
                : "video_asset 输入"
        },
        id: nodeType,
        position: NODE_POSITIONS[nodeType],
        type: "fixtureNode"
      })),
    [nodes]
  );

  function addNode(nodeType: FixtureNodeType) {
    setNodes((current) =>
      current.includes(nodeType) ? current : [...current, nodeType]
    );
  }

  function connectPipeline() {
    if (
      !nodes.includes("multi_track_edit") ||
      !nodes.includes("video-result")
    ) {
      return;
    }
    setEdges([
      fixtureEdge("video-source", "multi_track_edit"),
      fixtureEdge("multi_track_edit", "video-result")
    ]);
  }

  async function save(
    nextConfig: MultiTrackEditConfig
  ): Promise<AigcMultitrackSaveResult> {
    const nextRevision = revision + 1;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    setConfig(nextConfig);
    setRevision(nextRevision);
    setRunStatus("idle");
    return { config: nextConfig, revision: nextRevision };
  }

  async function execute(nextConfig: MultiTrackEditConfig) {
    const input = JSON.stringify(nextConfig);
    setResultOpen(true);
    if (cachedInput === input) {
      setRunStatus("cached");
      return;
    }
    setAttempts(1);
    setRunStatus("failed");
    throw new Error("Mock MediaKit 提交失败：可安全重试。");
  }

  function retry() {
    setAttempts(2);
    setCachedInput(JSON.stringify(config));
    setRunStatus("succeeded");
  }

  if (phase === "canvas") {
    return (
      <main
        className="grid h-[100dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden bg-[#0b0d10] p-3 text-zinc-100"
        data-ready="true"
        data-testid="multitrack-acceptance"
      >
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold">多轨剪辑非计费验收</h1>
            <p className="text-xs text-zinc-500">
              浏览器内 fixture，MediaKit 与多轨供应商端点均被阻断。
            </p>
          </div>
          <span
            className="border border-emerald-500/40 bg-emerald-950/40 px-3 py-1.5 text-xs text-emerald-300"
            data-testid="network-safety"
          >
            Mock MediaKit
          </span>
        </header>
        <section className="grid min-h-0 gap-3 md:grid-cols-[13rem_minmax(0,1fr)]">
          <aside className="space-y-2 overflow-y-auto border border-[#2a3038] bg-[#15181d] p-3">
            <h2 className="text-sm font-semibold">节点面板</h2>
            <Button
              className="w-full justify-start"
              disabled={nodes.includes("multi_track_edit")}
              onClick={() => addNode("multi_track_edit")}
              size="sm"
              variant="outline"
            >
              添加多轨剪辑
            </Button>
            <Button
              className="w-full justify-start"
              disabled={nodes.includes("video-result")}
              onClick={() => addNode("video-result")}
              size="sm"
              variant="outline"
            >
              添加视频结果节点
            </Button>
            <Button className="w-full" onClick={connectPipeline} size="sm">
              连接完整流程
            </Button>
            <p className="text-[11px] text-zinc-500">
              多轨输入：视频 30、图片 50、音频 30、文本 30。
            </p>
          </aside>
          <div
            className="min-h-[260px] overflow-hidden border border-[#2a3038] bg-[#101318]"
            data-testid="multitrack-canvas"
          >
            <ReactFlow
              defaultViewport={{ x: 10, y: 30, zoom: 0.9 }}
              edges={edges}
              fitView
              nodes={flowNodes}
              nodeTypes={nodeTypes}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </section>
        <Button
          className="justify-self-end"
          disabled={edges.length !== 2}
          onClick={() => setPhase("timeline")}
        >
          进入全屏时间线
        </Button>
      </main>
    );
  }

  return (
    <div data-ready="true" data-testid="multitrack-acceptance">
      <AigcMultitrackEditor
        config={config}
        onBack={() => setPhase("canvas")}
        onExecute={execute}
        onSave={save}
        onUploadSubtitle={async () => "acceptance-subtitle-asset"}
        revision={revision}
        sources={SOURCES}
        title="Task 9 多轨剪辑验收"
      />
      {resultOpen ? (
        <section
          aria-label="Mock 运行结果"
          className="fixed inset-3 z-50 mx-auto grid max-w-3xl content-start gap-3 overflow-y-auto border border-[#343a43] bg-[#15181d] p-4 text-zinc-100 shadow-2xl sm:inset-y-8"
          data-testid="multitrack-run-result"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Mock 运行结果</h2>
              <p className="text-xs text-zinc-400" data-testid="run-status">
                状态：{runStatusLabel(runStatus)} · Attempt {attempts}
              </p>
            </div>
            <Button
              aria-label="关闭 Mock 结果"
              onClick={() => setResultOpen(false)}
              size="sm"
              variant="ghost"
            >
              关闭
            </Button>
          </div>
          {runStatus === "failed" ? (
            <div className="space-y-3 border border-red-500/30 bg-red-950/20 p-3">
              <p className="text-xs text-red-300">
                Mock MediaKit 提交失败：已脱敏，可安全重试。
              </p>
              <Button onClick={retry} size="sm" variant="outline">
                重试失败节点
              </Button>
            </div>
          ) : null}
          {runStatus === "succeeded" || runStatus === "cached" ? (
            <>
              <p className="text-xs text-emerald-300">
                {runStatus === "cached"
                  ? "缓存命中：复用 Attempt 2 的可用成片。"
                  : "Mock 重试成功：本地成片已就绪。"}
              </p>
              <AigcVideoPlayer
                audioState
                fps={config.output.fps}
                initialMetadata={{ duration: 6, height: 360, width: 640 }}
                mimeType="video/mp4"
                name="多轨剪辑 Mock 成片.mp4"
                url={VIDEO_URL}
                variant="panel"
              />
              <a
                className="inline-flex h-9 items-center justify-center border border-[#343a43] px-3 text-sm hover:bg-white/5"
                download="多轨剪辑-Mock-成片.mp4"
                href={VIDEO_URL}
              >
                下载多轨成片
              </a>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function FixtureFlowNode({ data }: NodeProps<FixtureNode>) {
  return (
    <section className="w-56 border border-orange-400/50 bg-[#15181d] shadow-md">
      {data.nodeType !== "video-source" ? (
        <Handle id="video-in" position={Position.Left} type="target" />
      ) : null}
      <header className="border-b border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold">
        {data.label}
      </header>
      <p className="px-3 py-4 text-[11px] text-zinc-400">{data.summary}</p>
      {data.nodeType !== "video-result" ? (
        <Handle id="video-out" position={Position.Right} type="source" />
      ) : null}
    </section>
  );
}

function fixtureEdge(source: FixtureNodeType, target: FixtureNodeType): Edge {
  return {
    id: `${source}-${target}`,
    markerEnd: { type: MarkerType.ArrowClosed },
    source,
    sourceHandle: "video-out",
    target,
    targetHandle: "video-in"
  };
}

function readStoredConfig(): MultiTrackEditConfig {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : structuredClone(INITIAL_CONFIG);
  } catch {
    return structuredClone(INITIAL_CONFIG);
  }
}

function runStatusLabel(status: RunStatus) {
  return {
    cached: "缓存复用",
    failed: "失败",
    idle: "未执行",
    succeeded: "成功"
  }[status];
}

function subscribeToClientReady(): () => void {
  return () => undefined;
}

function getClientReadySnapshot(): boolean {
  return true;
}

function getServerReadySnapshot(): boolean {
  return false;
}
