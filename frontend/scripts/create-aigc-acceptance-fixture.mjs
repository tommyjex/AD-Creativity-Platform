const backendBaseUrl = (
  process.env.BACKEND_BASE_URL ||
  process.env.NEXT_PUBLIC_BACKEND_BASE_URL ||
  "http://127.0.0.1:8000"
).replace(/\/$/, "");
const frontendBaseUrl = (
  process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

const definition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "acceptance-prompt",
      type: "text_input",
      position: { x: 40, y: 40 },
      size: { width: 240, height: 160 },
      config: {
        text: "验收 fixture：仅用于保存和布局检查，不执行生成。"
      }
    },
    {
      id: "acceptance-video-input",
      type: "video_input",
      position: { x: 40, y: 260 },
      size: { width: 240, height: 180 },
      config: { asset_id: null }
    },
    {
      id: "acceptance-audio-input",
      type: "audio_input",
      position: { x: 40, y: 480 },
      size: { width: 240, height: 160 },
      config: { asset_id: null }
    },
    {
      id: "acceptance-video-model",
      type: "video_generation",
      position: { x: 360, y: 120 },
      size: { width: 260, height: 220 },
      config: {
        model: "doubao-seedance-2-5-260628",
        generation_mode: "text_to_video",
        resolution: "1080p",
        aspect_ratio: "16:9",
        duration_seconds: 12,
        generate_audio: true
      }
    },
    {
      id: "acceptance-video-output",
      type: "video_output",
      position: { x: 700, y: 120 },
      size: { width: 260, height: 220 },
      config: { title: "验收视频结果" }
    }
  ],
  edges: [
    {
      id: "acceptance-prompt-edge",
      sourceNodeId: "acceptance-prompt",
      sourceHandle: "text",
      targetNodeId: "acceptance-video-model",
      targetHandle: "prompt"
    },
    {
      id: "acceptance-output-edge",
      sourceNodeId: "acceptance-video-model",
      sourceHandle: "video",
      targetNodeId: "acceptance-video-output",
      targetHandle: "video"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 0.85 }
};

const response = await fetch(`${backendBaseUrl}/api/aigc/pipelines`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: `AIGC 验收 Fixture ${new Date().toISOString()}`,
    description: "开发环境验收数据；执行入口已禁用。",
    definition
  })
});

if (!response.ok) {
  throw new Error(
    `创建验收 fixture 失败 (${response.status}): ${await response.text()}`
  );
}

const pipeline = await response.json();
console.log(
  `${frontendBaseUrl}/workspace/aigc/acceptance?pipelineId=${pipeline.id}`
);
console.log(
  `${frontendBaseUrl}/workspace/aigc/acceptance?scenario=mock-results`
);
