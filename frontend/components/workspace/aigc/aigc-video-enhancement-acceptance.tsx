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
  AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
  normalizeVideoEnhancementConfig
} from "@/lib/aigc/video-enhancement";
import type { VideoEnhancementConfig } from "@/lib/aigc/types";

const STORAGE_KEY = "aigc.acceptance.video-enhancement.v2";
const VIDEO_URL = "/acceptance/aigc-video-fullscreen.mp4";

type FixtureNodeType =
  | "video-source"
  | "video_enhancement"
  | "video-result";
type RunStatus = "failed" | "idle" | "running" | "succeeded";

interface FixtureState {
  attempts: number;
  config: VideoEnhancementConfig;
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
  config: AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
  edges: [],
  nodes: ["video-source"],
  runStatus: "idle"
};

const NODE_POSITIONS: Record<FixtureNodeType, { x: number; y: number }> = {
  "video-source": { x: 40, y: 110 },
  video_enhancement: { x: 340, y: 110 },
  "video-result": { x: 660, y: 110 }
};

const NODE_LABELS: Record<FixtureNodeType, string> = {
  "video-source": "视频节点（本地）",
  video_enhancement: "视频画质增强",
  "video-result": "视频节点（上游）"
};

const nodeTypes = {
  acceptanceNode: AcceptanceFlowNode
};

export function AigcVideoEnhancementAcceptance() {
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
        data-testid="video-enhancement-acceptance"
      >
        <p className="text-sm text-muted-foreground">正在准备非计费验收场景…</p>
      </main>
    );
  }

  return <AigcVideoEnhancementAcceptanceContent />;
}

function AigcVideoEnhancementAcceptanceContent() {
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
      !state.nodes.includes("video_enhancement") ||
      !state.nodes.includes("video-result")
    ) {
      setFeedback("请先添加三个节点");
      return;
    }
    setState((current) => ({
      ...current,
      edges: [
        createEdge("video-source", "video_enhancement"),
        createEdge("video_enhancement", "video-result")
      ],
      runStatus: "idle"
    }));
    setFeedback("已连接：视频输入 → 视频画质增强 → 视频输出");
  }

  function updateConfig(patch: Partial<VideoEnhancementConfig>) {
    setState((current) => ({
      ...current,
      config: normalizeVideoEnhancementConfig({
        ...current.config,
        ...patch
      }),
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
      attempts: current.attempts + 1,
      runStatus: "succeeded"
    }));
    setFeedback("Mock 重试成功：已生成本地视频结果");
  }

  return (
    <main
      className="grid min-h-[calc(100dvh-4rem)] grid-rows-[auto_minmax(360px,1fr)_auto] gap-3 p-4"
      data-ready="true"
      data-testid="video-enhancement-acceptance"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold">视频画质增强非计费验收</h1>
          <p className="text-xs text-muted-foreground">
            完全浏览器内 Mock；只使用 localStorage 和本站静态 MP4。
          </p>
        </div>
        <div
          className="rounded-md border border-emerald-500/40 bg-emerald-50 px-3 py-2 text-xs text-emerald-900"
          data-testid="network-safety"
        >
          MediaKit、/enhance-video 与 API Key 均不可用
        </div>
      </header>

      <section className="grid min-h-0 gap-3 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="space-y-3 rounded-lg border bg-card p-3">
          <h2 className="text-sm font-semibold">节点</h2>
          {(
            [
              "video-source",
              "video_enhancement",
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
          data-testid="video-enhancement-canvas"
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
          <Button
            className="w-full"
            disabled={state.runStatus === "running"}
            onClick={executeFixture}
            size="sm"
          >
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
                bitDepth={state.config.bit_depth}
                fps={state.config.fps ?? 30}
                initialMetadata={{ duration: 6, height: 360, width: 640 }}
                mimeType="video/mp4"
                name="画质增强 Mock 输出.mp4"
                resolutionLabel={
                  state.config.resolution ??
                  `${state.config.resolution_limit}px 短边`
                }
                toolVersion={state.config.tool_version}
                url={VIDEO_URL}
                variant="panel"
              />
              <a
                className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent"
                download="画质增强-Mock-输出.mp4"
                href={VIDEO_URL}
              >
                下载增强视频
              </a>
            </div>
          ) : (
            <div className="grid h-44 place-items-center rounded bg-slate-950 text-xs text-slate-300">
              {state.runStatus === "failed"
                ? "Mock 失败已保留，可重试"
                : "执行成功后显示本地视频"}
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

function AcceptanceFlowNode({
  data
}: NodeProps<AcceptanceNode>) {
  return (
    <section className="w-56 rounded-lg border border-orange-400/50 bg-card shadow-md">
      {data.nodeType !== "video-source" ? (
        <Handle
          id="video"
          position={Position.Left}
          type="target"
        />
      ) : null}
      <header className="border-b border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold">
        {data.label}
      </header>
      <p className="px-3 py-4 text-[11px] text-muted-foreground">
        {data.summary}
      </p>
      {data.nodeType !== "video-result" ? (
        <Handle
          id="video"
          position={Position.Right}
          type="source"
        />
      ) : null}
    </section>
  );
}

function ConfigPanel({
  config,
  onChange
}: {
  config: VideoEnhancementConfig;
  onChange: (patch: Partial<VideoEnhancementConfig>) => void;
}) {
  return (
    <aside className="space-y-3 overflow-auto rounded-lg border bg-card p-3">
      <h2 className="text-sm font-semibold">视频画质增强配置</h2>
      <SelectField
        label="工具版本"
        onChange={(value) =>
          onChange({
            tool_version: value as VideoEnhancementConfig["tool_version"]
          })
        }
        options={[
          ["standard", "标准版"],
          ["professional", "专业版"]
        ]}
        value={config.tool_version}
      />
      {config.tool_version === "standard" ? (
        <SelectField
          label="场景"
          onChange={(value) =>
            onChange({ scene: value as Extract<VideoEnhancementConfig, { tool_version: "standard" }>["scene"] })
          }
          options={[
            ["common", "通用"],
            ["ugc", "UGC"],
            ["short_series", "短剧"],
            ["aigc", "AIGC"],
            ["old_film", "老片"]
          ]}
          value={config.scene}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          专业版不提交场景参数
        </p>
      )}
      <SelectField
        label="增强风格"
        onChange={(value) =>
          onChange({
            enhance_style: value as VideoEnhancementConfig["enhance_style"]
          })
        }
        options={[
          ["hd", "高清"],
          ["natural", "自然"]
        ]}
        value={config.enhance_style}
      />
      <SelectField
        label="尺寸模式"
        onChange={(value) =>
          onChange({
            resolution_mode:
              value as VideoEnhancementConfig["resolution_mode"]
          })
        }
        options={[
          ["preset", "预设分辨率"],
          ["short_edge", "指定短边"]
        ]}
        value={config.resolution_mode}
      />
      {config.resolution_mode === "preset" ? (
        <SelectField
          label="分辨率"
          onChange={(value) =>
            onChange({
              resolution: value as Extract<VideoEnhancementConfig, { resolution_mode: "preset" }>["resolution"]
            })
          }
          options={[
            ["720p", "720p"],
            ["1080p", "1080p"],
            ["2k", "2K"],
            ["4k", "4K"],
            ["8k", "8K"]
          ]}
          value={config.resolution}
        />
      ) : (
        <NumberField
          label="短边像素"
          max={4320}
          min={128}
          onChange={(value) => onChange({ resolution_limit: value })}
          value={config.resolution_limit}
        />
      )}
      <NumberField
        label="帧率（留空保持原值）"
        max={120}
        min={15}
        onChange={(value) => onChange({ fps: value })}
        optional
        value={config.fps}
      />
      <SelectField
        disabled={config.bit_depth === 16}
        label="码率模式"
        onChange={(value) =>
          onChange({
            bitrate_mode: value as "custom" | "level"
          })
        }
        options={[
          ["level", "档位"],
          ["custom", "精确码率"]
        ]}
        value={config.bitrate_mode ?? "level"}
      />
      {config.bit_depth !== 16 &&
      config.bitrate_mode === "custom" ? (
        <NumberField
          label="码率 kbps"
          max={150000}
          min={10}
          onChange={(value) => onChange({ bitrate: value })}
          value={config.bitrate}
        />
      ) : null}
      <SelectField
        disabled={config.tool_version === "standard"}
        label="色深"
        onChange={(value) =>
          onChange({ bit_depth: Number(value) as VideoEnhancementConfig["bit_depth"] })
        }
        options={[
          ["8", "8-bit"],
          ["10", "10-bit"],
          ["12", "12-bit"],
          ["16", "16-bit"]
        ]}
        value={String(config.bit_depth)}
      />
      {config.bit_depth === 16 ? (
        <p className="text-xs font-medium text-amber-700">
          16-bit 自动禁用码率并使用 MOV 供应商语义；Fixture 输出仍为本站 MP4。
        </p>
      ) : null}
    </aside>
  );
}

function SelectField({
  disabled = false,
  label,
  onChange,
  options,
  value
}: {
  disabled?: boolean;
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
        disabled={disabled}
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

function NumberField({
  label,
  max,
  min,
  onChange,
  optional = false,
  value
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number | null) => void;
  optional?: boolean;
  value: number | null;
}) {
  return (
    <label className="block space-y-1 text-xs">
      <span>{label}</span>
      <input
        aria-label={label}
        className="h-8 w-full rounded-md border bg-background px-2"
        max={max}
        min={min}
        onChange={(event) =>
          onChange(
            optional && event.target.value === ""
              ? null
              : Number(event.target.value)
          )
        }
        type="number"
        value={value ?? ""}
      />
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
      attempts:
        typeof parsed.attempts === "number" ? parsed.attempts : 0,
      config: normalizeVideoEnhancementConfig(parsed.config ?? {}),
      edges: Array.isArray(parsed.edges) ? parsed.edges : [],
      nodes: Array.isArray(parsed.nodes)
        ? parsed.nodes.filter(isFixtureNodeType)
        : INITIAL_STATE.nodes,
      runStatus:
        parsed.runStatus === "failed" ||
        parsed.runStatus === "succeeded"
          ? parsed.runStatus
          : "idle"
    };
  } catch {
    return INITIAL_STATE;
  }
}

function isFixtureNodeType(value: unknown): value is FixtureNodeType {
  return (
    value === "video-source" ||
    value === "video_enhancement" ||
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
        edge.target === "video_enhancement"
    ) &&
    state.edges.some(
      (edge) =>
        edge.source === "video_enhancement" &&
        edge.target === "video-result"
    )
  );
}

function nodeSummary(
  nodeType: FixtureNodeType,
  config: VideoEnhancementConfig,
  runStatus: RunStatus
): string {
  if (nodeType === "video-source") return "本站静态视频 · 640×360 · 6 秒";
  if (nodeType === "video-result") {
    return runStatus === "succeeded" ? "本地增强结果可用" : "等待增强结果";
  }
  return [
    config.tool_version === "professional" ? "专业版" : "标准版",
    config.resolution ?? `${config.resolution_limit}px`,
    config.fps ? `${config.fps}fps` : "原帧率",
    `${config.bit_depth}-bit`
  ].join(" · ");
}

function runStatusLabel(status: RunStatus): string {
  return {
    failed: "失败",
    idle: "未执行",
    running: "运行中",
    succeeded: "成功"
  }[status];
}
