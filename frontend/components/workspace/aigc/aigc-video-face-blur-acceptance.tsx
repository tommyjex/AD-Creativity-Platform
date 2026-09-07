"use client";

import {
  Background,
  Controls,
  Handle,
  type Connection,
  type Edge,
  MarkerType,
  type Node,
  type NodeProps,
  Position,
  ReactFlow
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from "react";
import { AigcVideoPlayer } from "@/components/workspace/aigc/aigc-video-player";
import { Button } from "@/components/ui/button";
import { installAcceptanceNetworkGuard } from "@/lib/aigc/acceptance-network-guard";
import {
  AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG,
  videoFaceBlurModeLabel,
  videoFaceBlurStrengthLabel
} from "@/lib/aigc/video-face-blur";
import type { VideoFaceBlurConfig } from "@/lib/aigc/types";

const STORAGE_KEY = "aigc.acceptance.video-face-blur.v2";
const VIDEO_URL = "/acceptance/aigc-video-fullscreen.mp4";

type FixtureNodeType =
  | "video-source"
  | "video_face_blur"
  | "video-result";
type RunStatus = "failed" | "idle" | "succeeded";

interface FixtureState {
  attempts: number;
  config: VideoFaceBlurConfig;
  edges: Edge[];
  nodes: FixtureNodeType[];
  runStatus: RunStatus;
}

interface AcceptanceNodeData extends Record<string, unknown> {
  label: string;
  nodeType: FixtureNodeType;
  summary: string;
}

type AcceptanceNode = Node<AcceptanceNodeData, "acceptanceNode">;

const INITIAL_STATE: FixtureState = {
  attempts: 0,
  config: AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG,
  edges: [],
  nodes: ["video-source"],
  runStatus: "idle"
};

const NODE_POSITIONS: Record<FixtureNodeType, { x: number; y: number }> = {
  "video-source": { x: 40, y: 110 },
  video_face_blur: { x: 340, y: 110 },
  "video-result": { x: 660, y: 110 }
};

const NODE_LABELS: Record<FixtureNodeType, string> = {
  "video-source": "视频节点（本地）",
  video_face_blur: "视频人脸打码",
  "video-result": "视频节点（上游）"
};

const nodeTypes = {
  acceptanceNode: AcceptanceFlowNode
};

export function AigcVideoFaceBlurAcceptance() {
  const ready = useSyncExternalStore(
    subscribeToClientReady,
    getClientReadySnapshot,
    getServerReadySnapshot
  );

  useEffect(() => installAcceptanceNetworkGuard(), []);

  if (!ready) {
    return (
      <main
        className="grid min-h-[calc(100dvh-4rem)] place-items-center p-4"
        data-ready="false"
        data-testid="video-face-blur-acceptance"
      >
        <p className="text-sm text-muted-foreground">
          正在准备非计费验收场景…
        </p>
      </main>
    );
  }

  return <AigcVideoFaceBlurAcceptanceContent />;
}

function AigcVideoFaceBlurAcceptanceContent() {
  const [state, setState] = useState<FixtureState>(readStoredState);
  const [feedback, setFeedback] = useState("等待编辑");

  const flowNodes = useMemo(
    () =>
      state.nodes.map<AcceptanceNode>((nodeType) => ({
        data: {
          label: NODE_LABELS[nodeType],
          nodeType,
          summary: nodeSummary(nodeType, state.config, state.runStatus)
        },
        id: nodeType,
        position: NODE_POSITIONS[nodeType],
        type: "acceptanceNode"
      })),
    [state.config, state.nodes, state.runStatus]
  );

  const connectNodes = useCallback((connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    ) {
      return;
    }
    setState((current) => ({
      ...current,
      edges: addFixtureEdge(current.edges, connection.source, connection.target),
      runStatus: "idle"
    }));
    setFeedback("已连接节点");
  }, []);

  function addNode(nodeType: FixtureNodeType) {
    setState((current) =>
      current.nodes.includes(nodeType)
        ? current
        : {
            ...current,
            nodes: [...current.nodes, nodeType],
            runStatus: "idle"
          }
    );
    setFeedback(`已添加${NODE_LABELS[nodeType]}`);
  }

  function connectPipeline() {
    if (
      !state.nodes.includes("video-source") ||
      !state.nodes.includes("video_face_blur") ||
      !state.nodes.includes("video-result")
    ) {
      setFeedback("请先添加三个节点");
      return;
    }
    setState((current) => ({
      ...current,
      edges: [
        createEdge("video-source", "video_face_blur"),
        createEdge("video_face_blur", "video-result")
      ],
      runStatus: "idle"
    }));
    setFeedback("已连接：视频输入 → 视频人脸打码 → 视频输出");
  }

  function updateConfig(patch: Partial<VideoFaceBlurConfig>) {
    setState((current) => ({
      ...current,
      config: normalizeConfig({ ...current.config, ...patch }),
      runStatus: "idle"
    }));
    setFeedback("配置已更新，尚未保存");
  }

  function saveFixture() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setFeedback("已保存到浏览器 localStorage");
  }

  function resetFixture() {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(INITIAL_STATE);
    setFeedback("已重置验收场景");
  }

  function executeFixture() {
    if (!isCompletePipeline(state)) {
      setFeedback("执行前必须添加并连接完整流程");
      return;
    }
    setState((current) => ({
      ...current,
      attempts: 1,
      runStatus: "failed"
    }));
    setFeedback("Mock 执行失败：模拟供应商瞬时错误");
  }

  function retryFixture() {
    setState((current) => ({
      ...current,
      attempts: 2,
      runStatus: "succeeded"
    }));
    setFeedback("Mock 重试成功：已生成本地打码视频");
  }

  return (
    <main
      className="grid min-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(360px,1fr)_auto] gap-3 p-4"
      data-ready="true"
      data-testid="video-face-blur-acceptance"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">视频人脸打码非计费验收</h1>
          <p className="text-xs text-muted-foreground">
            完全浏览器内 Mock；只使用 localStorage 和本站静态 MP4。
          </p>
        </div>
        <div
          className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          data-testid="network-safety"
        >
          MediaKit、/face-blur-video 与 API Key 均不可用
        </div>
      </header>

      <section className="grid min-h-0 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="space-y-3 rounded-lg border bg-card p-3">
          <h2 className="text-sm font-semibold">节点</h2>
          {(
            [
              "video-source",
              "video_face_blur",
              "video-result"
            ] as FixtureNodeType[]
          ).map((nodeType) => (
            <Button
              className="w-full justify-start"
              disabled={state.nodes.includes(nodeType)}
              key={nodeType}
              onClick={() => addNode(nodeType)}
              size="sm"
              variant="outline"
            >
              添加{NODE_LABELS[nodeType]}
            </Button>
          ))}
          <Button className="w-full" onClick={connectPipeline} size="sm">
            连接完整流程
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={saveFixture} size="sm" variant="secondary">
              保存
            </Button>
            <Button onClick={resetFixture} size="sm" variant="ghost">
              重置
            </Button>
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {feedback}
          </p>
        </aside>

        <div
          className="min-h-[360px] overflow-hidden rounded-lg border bg-muted/30"
          data-testid="video-face-blur-canvas"
        >
          <ReactFlow
            defaultViewport={{ x: 10, y: 30, zoom: 0.9 }}
            edges={state.edges}
            fitView
            nodes={flowNodes}
            nodeTypes={nodeTypes}
            onConnect={connectNodes}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <ConfigPanel config={state.config} onChange={updateConfig} />
      </section>

      <section className="grid gap-3 rounded-lg border bg-card p-3 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Mock 运行</h2>
          <Button className="w-full" onClick={executeFixture} size="sm">
            执行
          </Button>
          <Button
            className="w-full"
            disabled={state.runStatus !== "failed"}
            onClick={retryFixture}
            size="sm"
            variant="outline"
          >
            重试失败节点
          </Button>
          <p className="text-xs" data-testid="run-status">
            状态：{runStatusLabel(state.runStatus)} · Attempt {state.attempts}
          </p>
        </div>
        <div className="min-w-0">
          {state.runStatus === "succeeded" ? (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <AigcVideoPlayer
                audioState
                fps={30}
                initialMetadata={{ duration: 6, height: 360, width: 640 }}
                mimeType="video/mp4"
                name="人脸打码 Mock 输出.mp4"
                resolutionLabel="640×360"
                url={VIDEO_URL}
                variant="panel"
              />
              <a
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                download="人脸打码-Mock-输出.mp4"
                href={VIDEO_URL}
              >
                下载打码视频
              </a>
            </div>
          ) : (
            <div className="grid h-44 place-items-center rounded bg-slate-950 text-xs text-slate-300">
              {state.runStatus === "failed"
                ? "Mock 失败已保留，可重试"
                : "执行成功后显示本地打码视频"}
            </div>
          )}
        </div>
      </section>
    </main>
  );
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

function AcceptanceFlowNode({ data }: NodeProps<AcceptanceNode>) {
  return (
    <section className="w-56 rounded-lg border border-orange-400/50 bg-card shadow-md">
      {data.nodeType !== "video-source" ? (
        <Handle id="video" position={Position.Left} type="target" />
      ) : null}
      <header className="border-b border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold">
        {data.label}
      </header>
      <p className="px-3 py-4 text-[11px] text-muted-foreground">
        {data.summary}
      </p>
      {data.nodeType !== "video-result" ? (
        <Handle id="video" position={Position.Right} type="source" />
      ) : null}
    </section>
  );
}

function ConfigPanel({
  config,
  onChange
}: {
  config: VideoFaceBlurConfig;
  onChange: (patch: Partial<VideoFaceBlurConfig>) => void;
}) {
  return (
    <aside className="space-y-3 overflow-auto rounded-lg border bg-card p-3">
      <h2 className="text-sm font-semibold">视频人脸打码配置</h2>
      <SelectField
        label="打码方式"
        onChange={(value) =>
          onChange({
            mask_mode: value as VideoFaceBlurConfig["mask_mode"]
          })
        }
        options={[
          ["mosaic", "马赛克"],
          ["blur", "高斯模糊"]
        ]}
        value={config.mask_mode}
      />
      <SelectField
        label="打码强度"
        onChange={(value) =>
          onChange({
            mask_strength: value as VideoFaceBlurConfig["mask_strength"]
          })
        }
        options={[
          ["low", "低"],
          ["medium", "中"],
          ["high", "高"]
        ]}
        value={config.mask_strength}
      />
    </aside>
  );
}

function SelectField({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span>{label}</span>
      <select
        aria-label={label}
        className="h-8 w-full rounded-md border bg-background px-2"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function readStoredState(): FixtureState {
  if (typeof window === "undefined") return INITIAL_STATE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return INITIAL_STATE;
  try {
    const parsed = JSON.parse(stored) as Partial<FixtureState>;
    return {
      attempts: typeof parsed.attempts === "number" ? parsed.attempts : 0,
      config: normalizeConfig(parsed.config),
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.filter(isFixtureNodeType)
        : INITIAL_STATE.nodes,
      runStatus:
        parsed.runStatus === "failed" || parsed.runStatus === "succeeded"
          ? parsed.runStatus
          : "idle"
    };
  } catch {
    return INITIAL_STATE;
  }
}

function normalizeConfig(value: unknown): VideoFaceBlurConfig {
  const config =
    value && typeof value === "object"
      ? (value as Partial<VideoFaceBlurConfig>)
      : {};
  return {
    mask_mode: config.mask_mode === "blur" ? "blur" : "mosaic",
    mask_strength:
      config.mask_strength === "low" || config.mask_strength === "high"
        ? config.mask_strength
        : "medium"
  };
}

function isFixtureNodeType(value: unknown): value is FixtureNodeType {
  return (
    value === "video-source" ||
    value === "video_face_blur" ||
    value === "video-result"
  );
}

function createEdge(source: FixtureNodeType, target: FixtureNodeType): Edge {
  return {
    animated: true,
    id: `${source}-${target}`,
    markerEnd: { type: MarkerType.ArrowClosed },
    source,
    sourceHandle: "video",
    target,
    targetHandle: "video"
  };
}

function addFixtureEdge(
  edges: Edge[],
  source: string,
  target: string
): Edge[] {
  if (!isFixtureNodeType(source) || !isFixtureNodeType(target)) return edges;
  const edge = createEdge(source, target);
  return edges.some((candidate) => candidate.id === edge.id)
    ? edges
    : [...edges, edge];
}

function isCompletePipeline(state: FixtureState): boolean {
  return (
    state.nodes.length === 3 &&
    state.edges.some(
      (edge) =>
        edge.source === "video-source" &&
        edge.target === "video_face_blur"
    ) &&
    state.edges.some(
      (edge) =>
        edge.source === "video_face_blur" &&
        edge.target === "video-result"
    )
  );
}

function nodeSummary(
  nodeType: FixtureNodeType,
  config: VideoFaceBlurConfig,
  runStatus: RunStatus
): string {
  if (nodeType === "video-source") return "本站静态视频 · 640×360 · 6 秒";
  if (nodeType === "video-result") {
    return runStatus === "succeeded" ? "本地打码结果可用" : "等待打码结果";
  }
  return `${videoFaceBlurModeLabel(config.mask_mode)} · ${videoFaceBlurStrengthLabel(config.mask_strength)}`;
}

function runStatusLabel(status: RunStatus): string {
  return {
    failed: "失败",
    idle: "未执行",
    succeeded: "成功"
  }[status];
}
