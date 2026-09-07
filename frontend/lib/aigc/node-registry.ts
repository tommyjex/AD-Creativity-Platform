import type {
  AigcNodeType,
  AigcPortDefinition,
  AigcPortType,
  AigcV2NodeRegistryItem,
  AigcV2NodeType,
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
import { AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG } from "@/lib/aigc/video-enhancement";
import { AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG } from "@/lib/aigc/video-face-blur";
import { AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG } from "@/lib/aigc/multitrack";

export const AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving";
export const AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
export const AIGC_DEFAULT_JSON_PATH = "$.items";
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
export { AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG };
export { AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG };
export { AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG };

export const AIGC_EXECUTION_NODE_TYPES = [
  "llm",
  "text_to_image",
  "image_to_image",
  "video_generation",
  "video_enhancement",
  "video_face_blur",
  "multi_track_edit",
  "json_parser"
] as const satisfies readonly (AigcNodeType | AigcV2NodeType)[];

export function isAigcExecutionNodeType(
  type: AigcNodeType | AigcV2NodeType
): boolean {
  return (AIGC_EXECUTION_NODE_TYPES as readonly string[]).includes(type);
}

function port(
  id: string,
  label: string,
  type: AigcPortType,
  options: {
    required?: boolean;
    multiple?: boolean;
    maxConnections?: number;
    systemOnly?: boolean;
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
    system_only: options.systemOnly ?? false,
    modes: options.modes ?? []
  };
}

const AIGC_MODEL_CONTROL_NODE_REGISTRY = [
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
    type: "video_enhancement",
    label: "视频画质增强",
    category: "model",
    executable: true,
    inputs: [port("video", "视频", "video_asset")],
    outputs: [port("video", "视频", "video_asset")],
    models: []
  },
  {
    type: "video_face_blur",
    label: "视频人脸打码",
    category: "model",
    executable: true,
    inputs: [port("video", "视频", "video_asset")],
    outputs: [port("video", "视频", "video_asset")],
    models: []
  },
  {
    type: "multi_track_edit",
    label: "多轨剪辑",
    category: "control",
    executable: true,
    inputs: [
      port("videos", "视频", "video_asset", {
        required: false,
        multiple: true,
        maxConnections: 30
      }),
      port("images", "图片", "image_asset", {
        required: false,
        multiple: true,
        maxConnections: 50
      }),
      port("audios", "音频", "audio_asset", {
        required: false,
        multiple: true,
        maxConnections: 30
      }),
      port("texts", "文本", "text", {
        required: false,
        multiple: true,
        maxConnections: 30
      })
    ],
    outputs: [port("video", "视频", "video_asset")],
    models: []
  },
  {
    type: "json_parser",
    label: "JSON 解析器",
    category: "control",
    executable: true,
    inputs: [port("text", "文本", "text")],
    outputs: [
      port("items", "文本项", "text", {
        required: false,
        multiple: true,
        maxConnections: 20,
        systemOnly: true
      })
    ],
    models: []
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
  }
] as const satisfies readonly AigcV2NodeRegistryItem[];

const AIGC_V2_MODALITY_NODE_REGISTRY = [
  {
    type: "text",
    label: "文本节点",
    category: "modality",
    executable: false,
    inputs: [port("text", "文本", "text", { required: false })],
    outputs: [port("text", "文本", "text")],
    models: []
  },
  {
    type: "image",
    label: "图片节点",
    category: "modality",
    executable: false,
    inputs: [port("image", "图片", "image_asset", { required: false })],
    outputs: [port("image", "图片", "image_asset")],
    models: []
  },
  {
    type: "video",
    label: "视频节点",
    category: "modality",
    executable: false,
    inputs: [port("video", "视频", "video_asset", { required: false })],
    outputs: [port("video", "视频", "video_asset")],
    models: []
  },
  {
    type: "audio",
    label: "音频节点",
    category: "modality",
    executable: false,
    inputs: [port("audio", "音频", "audio_asset", { required: false })],
    outputs: [port("audio", "音频", "audio_asset")],
    models: []
  }
] as const satisfies readonly AigcV2NodeRegistryItem[];

export const AIGC_V2_NODE_REGISTRY = [
  ...AIGC_V2_MODALITY_NODE_REGISTRY,
  ...AIGC_MODEL_CONTROL_NODE_REGISTRY
] as const satisfies readonly AigcV2NodeRegistryItem[];

export const AIGC_NODE_REGISTRY = AIGC_V2_NODE_REGISTRY;
export const AIGC_EDITOR_NODE_REGISTRY = AIGC_V2_NODE_REGISTRY;

export const AIGC_NODE_REGISTRY_BY_TYPE = new Map<
  string,
  AigcV2NodeRegistryItem
>(
  AIGC_V2_NODE_REGISTRY.map((entry) => [
    entry.type,
    entry
  ])
);
