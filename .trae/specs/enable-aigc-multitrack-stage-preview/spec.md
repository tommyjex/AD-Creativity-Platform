# AIGC 多轨剪辑舞台预览 Spec

## Why
当前多轨剪辑页只能显示结构占位，无法查看背景视频在播放头位置的实际画面，也不能在预览窗口直接调整文字和图片的位置与尺寸。用户需要在不执行 MediaKit 合成的情况下完成基础视觉编排。

## What Changes
- 在预览舞台中显示当前播放头对应的背景视频帧。
- 在预览舞台中叠加当前时刻可见的文字和图片。
- 文字与图片支持鼠标拖拽、四角等比缩放和画布吸附。
- 预览元素选择与时间线、属性检查器保持同步。
- 拖拽和缩放完成后一次性提交 Transform，保持撤销/重做语义稳定。
- 本期不提供连续播放、音频试听、旋转手柄和视频元素拖拽。

## Impact
- Affected specs: AIGC 多轨剪辑时间线编辑器、上游资产预览
- Affected code:
  - `frontend/lib/aigc/timeline-loader.ts`
  - `frontend/lib/aigc/multitrack-editor-store.ts`
  - `frontend/components/workspace/aigc/aigc-multitrack-preview.tsx`
  - `frontend/components/workspace/aigc/aigc-multitrack-editor.tsx`
  - 对应 Vitest 与 Playwright 验收脚本

## ADDED Requirements

### Requirement: 背景视频当前帧预览
系统 SHALL 在预览舞台显示播放头所在时间对应的可见视频帧。

#### Scenario: 播放头位于视频片段内
- **WHEN** 播放头进入一个可见视频元素的 `target_time`
- **THEN** 视频保持暂停和静音
- **AND** 当前帧定位到 `source_trim.start_ms + (playhead - target_time.start_ms) * speed`

#### Scenario: 播放头位于视频片段外
- **WHEN** 当前时刻没有可见视频元素
- **THEN** 舞台显示画布背景色
- **AND** 不保留上一片段的陈旧画面

#### Scenario: 视频素材不可预览
- **WHEN** 上游视频资产缺失、不可用或无法加载
- **THEN** 舞台显示明确的素材不可用状态
- **AND** 编辑器其他操作仍可继续

### Requirement: 文字与图片舞台叠加
系统 SHALL 按当前播放头、轨道可见性和轨道顺序显示文字与图片元素。

#### Scenario: 当前时刻存在多个视觉元素
- **WHEN** 多个文字或图片元素覆盖当前播放头
- **THEN** 系统按轨道顺序稳定叠加这些元素
- **AND** 使用画布坐标映射其 `transform`

#### Scenario: 保持素材宽高比
- **WHEN** 图片显示在其 Transform 边界框内
- **THEN** 图片使用 `object-contain`
- **AND** 不拉伸或裁切原始内容

### Requirement: 舞台选择同步
系统 SHALL 让预览舞台、时间线和属性检查器共享同一元素选择状态。

#### Scenario: 点击预览元素
- **WHEN** 用户点击当前时刻可见的文字或图片
- **THEN** 对应时间线片段和轨道被选中
- **AND** 属性检查器显示该元素

#### Scenario: 从时间线选择元素
- **WHEN** 用户从时间线选择当前时刻可见的文字或图片
- **THEN** 预览舞台显示该元素的选中框和操作手柄

### Requirement: 拖拽定位
系统 SHALL 允许用户在预览舞台拖拽当前选中的文字或图片。

#### Scenario: 完成拖拽
- **WHEN** 用户拖拽元素并释放指针
- **THEN** 屏幕位移按舞台缩放比例转换为画布像素坐标
- **AND** 一次性提交新的 `transform.x` 和 `transform.y`
- **AND** 该操作只产生一个撤销记录

#### Scenario: 拖拽吸附
- **WHEN** 元素边缘或中心进入画布边缘、水平中心线或垂直中心线的吸附阈值
- **THEN** 元素自动吸附并显示对齐参考线

### Requirement: 四角等比缩放
系统 SHALL 为选中的文字或图片提供四个角缩放手柄。

#### Scenario: 完成等比缩放
- **WHEN** 用户拖拽任意角手柄并释放
- **THEN** 系统保持元素初始宽高比
- **AND** 一次性提交新的位置、宽度和高度
- **AND** 宽高保持为正整数

### Requirement: 预览素材加载
系统 SHALL 为直接上游的视频和图片源加载安全的只读预览 URL。

#### Scenario: 上游节点具有资产
- **WHEN** 时间线 Loader 解析视频或图片上游节点
- **THEN** 它读取资产并返回经过安全 URL 归一化的预览地址
- **AND** 不将签名 URL 或素材内容写入多轨节点配置

## MODIFIED Requirements

### Requirement: 结构预览
原“结构预览”修改为可交互“画面预览”。舞台仍以 MediaKit 最终合成为准，但应准确反映当前配置的时间范围、轨道可见性和 Transform。

### Requirement: 编辑历史
属性检查器编辑、舞台拖拽和舞台缩放 SHALL 使用同一配置历史；每次完成的舞台手势 SHALL 作为一个原子变更参与撤销和重做。

## REMOVED Requirements

无。
