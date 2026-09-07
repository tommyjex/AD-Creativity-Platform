import type {
  AigcLogError
} from "@/lib/aigc/run-log";
import type {
  AigcPipelineRunNode,
  AigcV2Node
} from "@/lib/aigc/types";

const JSON_PARSER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  json_parser_invalid_path: "JSONPath 无效，请检查表达式后重试。",
  json_parser_invalid_json: "上游内容不是有效 JSON，请只传入纯 JSON 或单个 JSON 代码块。",
  json_parser_path_not_found: "JSONPath 未匹配到内容，请检查字段路径。",
  json_parser_path_ambiguous: "JSONPath 匹配到多个结果，请改为只匹配一个数组。",
  json_parser_result_not_array: "JSONPath 的结果不是数组，请选择一个数组字段。",
  json_parser_item_limit_exceeded: "数组项目超过 20 项，请缩小 JSONPath 结果范围。",
  json_parser_source_changed: "解析器已被删除或变更，请重新运行当前画布。",
  json_parser_materialization_failed: "文本节点生成失败，请检查画布后重试。"
};

export interface JsonPathInputFeedback {
  kind: "error" | "hint";
  message: string;
}

export function jsonPathInputFeedback(value: string): JsonPathInputFeedback {
  const normalized = value.trim();
  if (!normalized) {
    return { kind: "error", message: "JSONPath 不能为空。" };
  }
  if (normalized.length > 500) {
    return { kind: "error", message: "JSONPath 最多 500 个字符。" };
  }
  if (!normalized.startsWith("$")) {
    return { kind: "error", message: "JSONPath 必须以 $ 开头。" };
  }
  return {
    kind: "hint",
    message: "示例：$.items。保存和运行时将由服务端校验完整语法。"
  };
}

export function jsonParserErrorMessage(
  error: AigcLogError | null
): string | null {
  if (!error) return null;
  return error.code
    ? JSON_PARSER_ERROR_MESSAGES[error.code] ?? error.message
    : error.message;
}

export function jsonParserItemCount(
  node: Pick<AigcPipelineRunNode, "result"> | null | undefined
): number | null {
  return node?.result.kind === "text_items" && Array.isArray(node.result.items)
    ? node.result.items.length
    : null;
}

export function managedTextSource(
  node: AigcV2Node,
  nodes: readonly AigcV2Node[]
): {
  itemLabel: string;
  parserId: string;
  parserName: string;
} | null {
  if (
    node.type !== "text" ||
    typeof node.config.generated_by_parser_node_id !== "string" ||
    typeof node.config.generated_item_index !== "number"
  ) {
    return null;
  }
  const parserId = node.config.generated_by_parser_node_id;
  const parser = nodes.find(
    (candidate) => candidate.id === parserId && candidate.type === "json_parser"
  );
  if (!parser) return null;
  const parserNumber =
    nodes
      .filter((candidate) => candidate.type === "json_parser")
      .findIndex((candidate) => candidate.id === parserId) + 1;
  const parserCount = nodes.filter(
    (candidate) => candidate.type === "json_parser"
  ).length;
  return {
    itemLabel: `JSON 项 ${node.config.generated_item_index + 1}`,
    parserId,
    parserName:
      parserCount > 1 ? `JSON 解析器${parserNumber}` : "JSON 解析器"
  };
}
