# 提示词优化韧性校验设计

## 背景

当前提示词优化会将品牌、型号、颜色、文案、数量等模型输出偏差统一视为安全失败，并返回 `422`。这些偏差大多可以由后端根据原始输入确定性恢复，直接中断任务会导致优化功能频繁失败。

本次调整采用“可用性优先”的三级策略：

1. 可确定恢复的事实由后端自动补回并记录告警。
2. 无法可靠修复但不涉及资产安全的质量偏差放行并记录告警。
3. 只有资产安全、明确语义反转和不可用输出继续硬拦截。

## 范围

覆盖 `text_to_image` 和 `image_to_image` 的：

- `full_design` 分层提示词。
- `local_edit` 单段编辑提示词。
- 对应的图片引用说明。

非生图目标继续沿用现有校验行为。本次不修改公开 API，不新增前端阻断流程。

## 方案

### 1. 确定性事实补回

后端从原始 `text` 和每条 `reference_instructions` 提取以下事实：

- 品牌与型号。
- 引号包裹的明确文案。
- 颜色。
- 原始对象数量。
- 比例和带单位测量值。
- 已有 canonical anchors。

补回规则：

- `full_design` 主提示词：补入首个有效正向 section，避开 `Composition` 和 `Negative Prompt`。
- `local_edit` 主提示词：追加到单段末尾，保持无标题、无换行。
- 引用说明：只补入对应来源索引的引用项，不跨引用移动事实。
- 已存在的事实不重复添加。
- 补回内容使用固定英文前缀，原始字面量保持逐字一致。

每类补回产生结构化 warning，例如：

- `protected_literal_repaired`
- `required_color_repaired`
- `canonical_anchor_repaired`
- `reference_constraint_repaired`

补回后仍运行相同事实校验，确认修复结果确实包含原始约束。

### 2. 告警放行

以下规则不再抛出 `PromptOptimizationSafetyError`：

- 模型新增对象数量。
- 对象数量与其他对象重新绑定。
- 模型遗漏普通主体关键词。
- 引用动作措辞发生变化。
- Negative Prompt 与主体或颜色可能冲突。
- 英文纯度、section 数量、标签重复和推荐 section 缺失。

对应结果正常返回，并通过现有结构化日志记录 warning。公开响应仍保持：

```json
{
  "optimized_text": "...",
  "optimized_reference_instructions": []
}
```

### 3. 保留硬拦截

只有以下情况继续导致请求失败：

- Provider 返回空内容、非法 JSON 或不匹配的模式结构。
- 结果超过接口长度上限。
- BBox token、坐标、资产 ID 或引用顺序丢失、改写或跨引用移动。
- 图片来源、Pipeline revision、Run 和资产归属校验失败。
- Provider 生成未知或伪造的 canonical anchor。
- 用户明确否定条件被反转为正向动作。
- 输出无法通过确定性补回恢复为可验证结果。

新增数量、数量重绑定和普通内容质量问题均不得返回 `422`。

## 数据流

1. Provider 返回 `local_edit` 或 `full_design` 结果。
2. 后端完成格式归一化。
3. 提取原始输入中的可恢复事实。
4. 对主提示词和引用说明执行确定性补回。
5. 收集 warning。
6. 执行剩余硬校验。
7. 记录结构化 warning 并返回成功响应。

补回过程不得调用第二次模型，也不得修改原始请求或持久化 Pipeline。

## 组件调整

### `prompt_optimization.py`

- 增加独立的事实提取和补回函数。
- `full_design` 与 `local_edit` 复用同一事实模型，分别使用不同渲染策略。
- 将对象数量新增/重绑定校验从 `_enforce_safety` 调整为 `_collect_warning`。
- 保留 BBox、资产引用和明确否定条件的硬校验。

### `generation.py`

- 延续现有 warning 结构化日志。
- 不改变 HTTP 响应结构和状态码映射。
- 实施完成后移除临时 TRAE 调试插桩。

## 错误处理

- 自动补回成功：返回 `200`，记录 warning。
- 普通质量偏差：返回 `200`，记录 warning。
- 安全来源或明确否定条件失败：返回 `422`。
- Provider 或响应解析失败：返回 `502`。

日志不得包含完整提示词、图片 URL、资产 ID 或用户文案，只记录 warning code、目标类型和优化模式。

## 测试

### 单元测试

- 品牌、型号、引号文案、颜色、原数量和测量值遗漏后被补回。
- `full_design` 补回进入正向 section。
- `local_edit` 补回后仍为单段。
- 引用事实只补回对应索引。
- 已存在事实不会重复。
- 新增数量和数量重绑定返回成功并产生 warning。
- BBox 丢失、错序、跨引用移动仍失败。
- 未知 canonical anchor 和明确否定条件反转仍失败。

### 服务测试

- Warning 被结构化记录且响应为 `200`。
- 非生图目标行为不变。
- 安全失败仍为 `422`，Provider 故障仍为 `502`。

### 回归验证

- 运行提示词优化相关后端测试。
- 运行后端全量测试。
- 使用 Mock Provider 覆盖浏览器优化流程，不触发真实计费接口。

## 非目标

- 不在公开响应中新增 warning 字段。
- 不增加第二次 Provider 修复调用。
- 不改变提示词优化弹窗或前端交互。
- 不放宽资产来源、BBox 和 Run 归属校验。
