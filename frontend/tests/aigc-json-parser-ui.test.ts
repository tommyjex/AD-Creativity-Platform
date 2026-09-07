import { describe, expect, it } from "vitest";

import {
  jsonParserErrorMessage,
  jsonParserItemCount,
  jsonPathInputFeedback,
  managedTextSource
} from "@/lib/aigc/json-parser-ui";
import type {
  AigcPipelineRunNode,
  AigcV2Node
} from "@/lib/aigc/types";

describe("AIGC JSON parser UI", () => {
  it.each([
    ["", "JSONPath 不能为空。"],
    ["items[0]", "JSONPath 必须以 $ 开头。"],
    [`$${"a".repeat(500)}`, "JSONPath 最多 500 个字符。"]
  ])("reports local shape feedback for %j", (value, message) => {
    expect(jsonPathInputFeedback(value)).toEqual({ kind: "error", message });
  });

  it("leaves complete JSONPath semantics to the server", () => {
    expect(jsonPathInputFeedback("$.items[?(@.enabled)]")).toEqual({
      kind: "hint",
      message: "示例：$.items。保存和运行时将由服务端校验完整语法。"
    });
  });

  it("maps stable parser errors to actionable Chinese while retaining fallbacks", () => {
    expect(
      jsonParserErrorMessage({
        code: "json_parser_item_limit_exceeded",
        message: "too many items",
        requestId: null,
        stage: "validate"
      })
    ).toBe("数组项目超过 20 项，请缩小 JSONPath 结果范围。");
    expect(
      jsonParserErrorMessage({
        code: "unknown_parser_error",
        message: "未知错误详情",
        requestId: null,
        stage: null
      })
    ).toBe("未知错误详情");
  });

  it("reads item counts only from structured parser results", () => {
    const node = {
      result: {
        kind: "text_items",
        text: null,
        text_digest: null,
        items: [
          { index: 0, text: "一", summary: "first" },
          { index: 1, text: "二", summary: "second" }
        ],
        assets: []
      }
    } as Pick<AigcPipelineRunNode, "result">;
    expect(jsonParserItemCount(node)).toBe(2);
    expect(
      jsonParserItemCount({
        result: { ...node.result, kind: "text", items: undefined }
      })
    ).toBeNull();
  });

  it("describes managed text with a stable item label and parser display name", () => {
    const parsers: AigcV2Node[] = [
      {
        id: "parser-a",
        type: "json_parser",
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        config: { json_path: "$.items" }
      },
      {
        id: "parser-b",
        type: "json_parser",
        position: { x: 0, y: 240 },
        size: { width: 240, height: 160 },
        config: { json_path: "$.rows" }
      }
    ];
    const text: AigcV2Node = {
      id: "managed-text",
      type: "text",
      position: { x: 320, y: 0 },
      size: { width: 240, height: 160 },
      config: {
        text: "已物化内容",
        bbox_references: [],
        title: "JSON 项 3",
        generated_by_parser_node_id: "parser-b",
        generated_item_index: 2,
        generated_from_run_id: "run-1"
      }
    };

    expect(managedTextSource(text, [...parsers, text])).toEqual({
      itemLabel: "JSON 项 3",
      parserId: "parser-b",
      parserName: "JSON 解析器2"
    });
  });
});
