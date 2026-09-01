import type {
  AigcNodeRegistryItem,
  AigcPortDefinition,
  AigcPortType,
  AigcVideoGenerationMode,
  VideoGenerationConfig
} from "@/lib/aigc/types";
import {
  SEEDANCE_DEFAULT_ASPECT_RATIO,
  SEEDANCE_DEFAULT_DURATION_SECONDS,
  SEEDANCE_DEFAULT_GENERATE_AUDIO,
  SEEDANCE_DEFAULT_MODEL,
  SEEDANCE_DEFAULT_RESOLUTION,
  SEEDANCE_DEFAULT_TASK_TYPE,
  SEEDANCE_MODELS
} from "@/lib/seedance";

export const AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving";
export const AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
export const AIGC_DEFAULT_IMAGE_OPERATION = "image_to_image" as const;
export const AIGC_DEFAULT_VIDEO_CONFIG: VideoGenerationConfig = {
  model: SEEDANCE_DEFAULT_MODEL,
  generation_mode: "text_to_video",
  task_type: SEEDANCE_DEFAULT_TASK_TYPE,
  resolution: SEEDANCE_DEFAULT_RESOLUTION,
  aspect_ratio: SEEDANCE_DEFAULT_ASPECT_RATIO,
  duration_seconds: SEEDANCE_DEFAULT_DURATION_SECONDS,
  generate_audio: SEEDANCE_DEFAULT_GENERATE_AUDIO
};

function port(
  id: string,
  label: string,
  type: AigcPortType,
  options: {
    required?: boolean;
    multiple?: boolean;
    maxConnections?: number;
    modes?: AigcVideoGenerationMode[];
  } = {}
): AigcPortDefinition {
  return {
    id,
    label,
    type,
    required: options.required ?? true,
    multiple: options.multiple ?? false,
    max_connections: options.maxConnections ?? 1,
    modes: options.modes ?? []
  };
}

export const AIGC_NODE_REGISTRY = [
  {
    type: "text_input",
    label: "文本输入",
    category: "input",
    executable: false,
    inputs: [],
    outputs: [port("text", "文本", "text")],
    models: []
  },
  {
    type: "image_input",
    label: "图片输入",
    category: "input",
    executable: false,
    inputs: [],
    outputs: [port("image", "图片", "image_asset")],
    models: []
  },
  {
    type: "video_input",
    label: "视频输入",
    category: "input",
    executable: false,
    inputs: [],
    outputs: [port("video", "视频", "video_asset")],
    models: []
  },
  {
    type: "audio_input",
    label: "音频输入",
    category: "input",
    executable: false,
    inputs: [],
    outputs: [port("audio", "音频", "audio_asset")],
    models: []
  },
  {
    type: "llm",
    label: "LLM",
    category: "model",
    executable: true,
    inputs: [port("prompt", "提示词", "text")],
    outputs: [port("text", "文本", "text")],
    models: [AIGC_DEFAULT_TEXT_MODEL]
  },
  {
    type: "text_to_image",
    label: "文生图",
    category: "model",
    executable: true,
    inputs: [port("prompt", "提示词", "text")],
    outputs: [port("image", "图片", "image_asset")],
    models: [AIGC_DEFAULT_IMAGE_MODEL]
  },
  {
    type: "image_to_image",
    label: "Seedream 图片模型",
    category: "model",
    executable: true,
    inputs: [
      port("image", "图片", "image_asset", {
        multiple: true,
        maxConnections: 10
      }),
      port("edit_image", "编辑图片", "image_asset", {
        required: false
      }),
      port("edit_layer", "编辑图层", "image_layer", {
        required: false
      }),
      port("prompt", "提示词", "text")
    ],
    outputs: [
      port("image", "图片", "image_asset"),
      port("edited_layer", "编辑图层", "edited_layer"),
      port("layers", "图层集", "layer_set")
    ],
    models: [AIGC_DEFAULT_IMAGE_MODEL]
  },
  {
    type: "video_generation",
    label: "生视频",
    category: "model",
    executable: true,
    inputs: [
      port("prompt", "提示词", "text", {
        required: false,
        modes: [
          "text_to_video",
          "first_frame",
          "first_last_frame",
          "multimodal_reference"
        ]
      }),
      port("first_frame", "首帧", "image_asset", {
        required: false,
        modes: ["first_frame", "first_last_frame"]
      }),
      port("last_frame", "尾帧", "image_asset", {
        required: false,
        modes: ["first_last_frame"]
      }),
      port("reference_images", "参考图片", "image_asset", {
        required: false,
        multiple: true,
        maxConnections: 30,
        modes: ["multimodal_reference"]
      }),
      port("reference_videos", "参考视频", "video_asset", {
        required: false,
        multiple: true,
        maxConnections: 10,
        modes: ["multimodal_reference"]
      }),
      port("reference_audios", "参考音频", "audio_asset", {
        required: false,
        multiple: true,
        maxConnections: 10,
        modes: ["multimodal_reference"]
      })
    ],
    outputs: [port("video", "视频", "video_asset")],
    models: SEEDANCE_MODELS
  },
  {
    type: "layer_canvas",
    label: "图层画布",
    category: "control",
    executable: true,
    inputs: [port("layers", "图层集", "layer_set")],
    outputs: [
      port("selected_layer", "选中图层", "image_layer", {
        required: false
      }),
      port("layers", "图层集", "layer_set")
    ],
    models: []
  },
  {
    type: "layer_composite",
    label: "图层合成",
    category: "control",
    executable: true,
    inputs: [
      port("layers", "图层集", "layer_set"),
      port("replacement", "替换图层", "edited_layer")
    ],
    outputs: [
      port("image", "图片", "image_asset"),
      port("layers", "图层集", "layer_set")
    ],
    models: []
  },
  {
    type: "text_output",
    label: "文本输出",
    category: "output",
    executable: false,
    inputs: [port("text", "文本", "text")],
    outputs: [],
    models: []
  },
  {
    type: "image_output",
    label: "图片输出",
    category: "output",
    executable: false,
    inputs: [port("image", "图片", "image_asset")],
    outputs: [],
    models: []
  },
  {
    type: "video_output",
    label: "视频输出",
    category: "output",
    executable: false,
    inputs: [port("video", "视频", "video_asset")],
    outputs: [],
    models: []
  }
] as const satisfies readonly AigcNodeRegistryItem[];

export const AIGC_NODE_REGISTRY_BY_TYPE = new Map(
  AIGC_NODE_REGISTRY.map((entry) => [entry.type, entry])
);
