# PNG / Text 双路字幕压制与 CRF 16 规格

状态：已完成（离线范围）。用户要求：“再增加一路text压制的方案，用来做对比测试。压制参数，crf设置为16，不再设置码率参数video_bit_rate。前段支持选择png和text压制两种方案。”

## Why

当前平台默认将字幕绘制为 PNG，原生 text 仅用于异常回退，用户无法主动选择进行成片比较。需要提供两种可选压制方式，并以相同 CRF 编码策略比较字幕清晰度。

## What Changes

- 工作区新增 `render_mode=png|text`，默认 PNG，前端支持选择并保存。
- PNG 复用当前透明图层方案；Text 复用已有 `compile_text_subtitle_project` 原生文字入口。
- **BREAKING（新字幕压制的编码行为）**：两路统一使用 `output.codec.video_codec=h264`、`output.codec.crf=16`，不提交 `video_bit_rate`。
- 不再为新字幕压制专门下载底片补探码率；保留已有视频元数据，正常导入和尺寸/时长探测保持。
- 压制方式和编码策略加入任务快照、幂等身份与成片元数据；记录实际方式和 PNG 回退。
- 预览跟随所选方式，切换方式只失效排版及当前成片关联，保留字幕、译文、产品识别与历史产物。
- 独立字幕包预计升级 0.3.7，平台仍通过 vendor wheel 引入。

## Impact

- 关联规格：`png-subtitles-footnote24`、`preserve-subtitle-source-bitrate`、`bold-nonheadline-subtitle-text`、`recognize-and-style-product-names`、`ignore-product-video-brand-outro`。本变更新建规格，保留这些已完成规格的历史验收记录。
- 共享包：`standalone/video-subtitle-grounding/src/video_subtitle_grounding/{layout,render,api,translation_schemas}.py`，必要的 `product_layout.py` 摘要；对应 tests。
- 平台：`backend/app/schemas/subtitle_translation.py`、`backend/app/services/{subtitle_translation,subtitle_translation_media}.py`、`backend/app/core/logging.py`，字幕 routes/preview/workspace/execution/product/brand 测试。
- 前端：`frontend/lib/{api-types,subtitle-translation}.ts`、`frontend/components/workspace/subtitle-translation/{workspace-editor,use-subtitle-workspace,review-dialog,video-preview}.tsx/ts`，对应 Vitest 与 Playwright 验收。
- 包产物：共享包版本、`requirements.txt`、`vendor/README.md`、发布验证脚本；不修改普通多轨剪辑工具的全局编码策略。
- 工作区持久化使用现有 JSON；无需新增数据库表或列。

## 依据与方案选择

2026-11-17 核对 [MediaKit 官方多轨剪辑 API](https://docs.volcengine.com/docs/intelligent-processing/multi-track-edit?lang=zh)：

- `output.codec.crf` 为 Integer，默认 23，仅对 H.264 / H.265 生效。
- `output.codec.video_codec` 默认 H.264；本方案显式写入 `h264`，固定两路比较的编码器。
- `video_bit_rate` 单位 bps；设置后 CRF 不生效。
- 原生 text 支持字体 URL、字号、颜色、bold、背景色、对齐及 transform。

选择最小方案：工作区选择方式，每次发起一个现有 render 任务；先压制 PNG，再切换 Text 压制，通过保留的任务与资产下载比较。暂不增加自动双任务、并排播放器或产品文字 run 拆分。

### 对比范围与既有字体差异

普通标题、正文、脚注使用相同译文、实际字体 URL、排版度量、字号、框、时间、底板及颜色；自动脚注继续以 24px 为目标，人工字号优先。第 29 秒三行是重点对比样本。

Text 沿用当前原生文字参数：实际 Century Gothic Bold 标题维持现有 headline 规则；body、footnote、缺失和未知角色维持原生 `bold=true`。PNG 保持实际字体文件绘制，不新增合成加粗。本轮不调整字重，因此比较包含当前两路字重处理差异，不能声称是严格只有栅格化方式不同的实验。

当前 Text 编译器每条字幕使用一个字体，不支持单行 Avenir Black / Light 的产品混排。Text 模式复用这个行为，保留产品识别数据与原文，但产品混排行按整行普通角色字体或人工字体压制。对这些行返回安全提示 `text_product_font_fallback`，前端简短显示“Text 模式：产品名按整行字体压制”；无产品混排时不显示。PNG 产品混排保持。

## ADDED Requirements

### Requirement: 持久化压制方式

系统 SHALL 在工作区创建、读取、保存、预览及 render 快照中支持 `render_mode`，取值为 `png|text`，默认 `png`。前后端类型一致；缺字段的历史工作区视为 PNG，显式 null 或非法枚举按配置输入错误处理。

#### Scenario: 默认与历史兼容
- **WHEN** 新建工作区或读取没有 `render_mode` 的旧工作区
- **THEN** 前端显示 PNG，新的预览和压制采用 PNG；不批量迁移历史任务或资产。

#### Scenario: 选择并保存 Text
- **WHEN** 有写权限的用户选择 Text
- **THEN** 保存方式、增加 revision，刷新后仍显示 Text；已提取字幕、翻译、排除状态、人工样式和产品识别数据保持。

### Requirement: 主动原生文字压制

系统 SHALL 根据冻结的 `render_mode` 选择编译入口。Text 模式的字幕轨道全部采用 MediaKit `type=text`，不绘制或上传字幕 PNG，不调用图层物化器；底片仍为 video 元素。

#### Scenario: Text 编译与提交
- **WHEN** 用户提交 Text render
- **THEN** 生成原生文字元素，保留文字全文、单行规则、时间、角色/人工字体、24px 脚注、底板及对齐；不存在 `subtitle-layer:` 来源或 PNG 依赖。

#### Scenario: 产品名称混排
- **WHEN** Text 模式中存在有效产品字体混排
- **THEN** 使用既有整行字体回退并明确提示，识别记录保持；不偷偷用 PNG 压制该行。

### Requirement: 前端统一入口

系统 SHALL 在工作区配置区增加一个“字幕压制方式”选择控件：`PNG · 图片绘制` 与 `Text · 原生文字`，默认 PNG；与视频类型控件遵循相同权限、busy、冲突及活动任务禁用规则。

#### Scenario: 两个压制按钮
- **WHEN** 用户从主界面“压制已保存字幕”或校对弹窗“保存并压制视频”提交
- **THEN** 均使用当前已保存的工作区方式，按钮附近或弹窗描述简短标明当前方式；不增加第二套互相独立的选择状态。

#### Scenario: 只读用户和活动任务
- **WHEN** 用户无写权限、有 revision 冲突或当前存在活动阶段任务
- **THEN** 选择器不可修改，当前方式仍可见；后端继续执行既有权限和任务校验。

### Requirement: 可追溯对比结果

系统 SHALL 在新 render 快照保存 `render_mode`、`encoding_policy_version` 与编码配置，提交后保存 `effective_render_mode`；每条有效字幕摘要记录实际方式。实际汇总枚举为 `png|text|mixed`，`mixed` 表示部分字幕回退 text。

#### Scenario: 两路任务不互相复用
- **WHEN** 相同底片与字幕分别提交 PNG 和 Text
- **THEN** 生成不同幂等身份，保留各自 provider_task_id、布局摘要和成片资产；切换方式不删除前一份历史产物。

#### Scenario: PNG 异常回退
- **WHEN** 用户选择 PNG，但生成、缺字或存储异常导致部分或全部字幕用 text
- **THEN** 沿用既有韧性回退，最终 payload 使用 CRF 16；记录请求方式 PNG 和实际 text/mixed，并在任务摘要或当前成片旁提示“已回退 Text”或“部分字幕回退 Text”，不将结果标为纯 PNG。

#### Scenario: 任务与资产展示
- **WHEN** 查看新的字幕阶段任务或下载成片
- **THEN** 任务摘要显示请求方式及必要的回退提示；成片 metadata 保存请求/实际方式和 CRF 16，可由现有资产与任务历史定位两份产物。
- **THEN** 没有这些字段的历史产物不虚构实际方式或 CRF，可标为“历史参数”。

## MODIFIED Requirements

### Requirement: 固定 CRF 编码

所有新提交的字幕 render SHALL 生成以下 codec，不受底片或参考视频已有 `video_bit_rate` 数值、缺失或损坏影响：

```json
{"output":{"format":"mp4","codec":{"video_codec":"h264","crf":16}}}
```

该示例省略既有 fps / disable_audio 等字段；实现中仍保留这些字段、画布尺寸及正常音轨行为。`video_bit_rate` 必须完全不出现在提交的 output.codec，不以 null、0 或旧快照值代替。PNG、Text、独立 render API 和异常回退共用同一编码策略。

#### Scenario: 源视频有或无码率
- **WHEN** 底片元数据码率为 7000、7000000、null、未探测或无效值
- **THEN** 两路均提交 `video_codec=h264, crf=16`，不提交视频码率，不出现新策略的“无法读取码率”警告。

#### Scenario: 编码不受 PNG 回退影响
- **WHEN** PNG 物化失败重新编译 Text
- **THEN** codec 保持 CRF 16，不从旧 metadata 或 encoding_result 恢复 video_bit_rate。

### Requirement: 预览与方式一致

预览 SHALL 使用当前工作区方式。PNG 正常显示鉴权 PNG；Text 使用文字摘要与 DOM 排版示意，不展示残留 PNG。Text 预览仍明确为示意，不能证明供应商最终字重、锚点或编码效果。

#### Scenario: 方式切换
- **WHEN** PNG 与 Text 之间切换
- **THEN** 清理 `render_layer_asset_id/url`、旧 text_runs 和旧排版字段，重新计算当前方式的摘要；清理旧排版警告，保留字幕内容与产品判定缓存。
- **THEN** 当前成片关联和 render 阶段关联失效，保留历史资产及历史任务；不失效 extract/translate 阶段。

#### Scenario: 不保存排版计算
- **WHEN** 在校对弹窗点击“计算排版 · 不保存”
- **THEN** 按已保存方式计算当前草稿，继续遵守“不保存”的 revision 语义；模式本身只由工作区选择器保存。

### Requirement: 冻结配置与历史恢复

新任务 SHALL 将方式及 `crf16-h264-v2` 编码策略加入幂等身份，提交前持久化 `encoding_result={source_asset_id, video_codec:h264, crf:16}`。布局版本升级，防止沿用旧任务或旧预览状态；PNG 有效像素策略保持原有 4 倍采样。

#### Scenario: 工作区发生变化
- **WHEN** 任务排队后工作区方式或其他压制内容被修改
- **THEN** 执行仍使用冻结快照；旧结果不能作为新方式的当前成片写回，沿用 revision/晚到写回保护。

#### Scenario: 已提交供应商任务恢复
- **WHEN** 历史任务已有 provider_task_id，重启或可恢复重试
- **THEN** 只轮询原任务，不重新编译，不补写模式/CRF 16，不重复提交。

#### Scenario: 未提交或需要重新提交的旧任务
- **WHEN** 历史任务没有可恢复的供应商任务，执行时必须重新提交
- **THEN** 取得新策略身份，清除旧编码解析结果，按冻结字幕重新编译；旧快照缺方式时使用 PNG，不能将工作区当前方式强加给旧快照。
- **THEN** 用户需要比较另一种方式时从当前工作区发起新的 render，避免复用旧失败任务的身份。

### Requirement: 日志与输出元数据

系统 SHALL 将请求方式、实际方式、crf、video_codec、encoding_policy_version 纳入安全结构化日志白名单，沿用现有 TLS 管道；成片 metadata 保存相同安全配置。不输出模型原文、签名 URL 或凭据。

## REMOVED Requirements

### Requirement: 新字幕压制沿用源视频码率

**Reason**：用户改用固定 CRF 16；设置 video_bit_rate 会使 CRF 不生效。

**Migration**：保留历史视频码率 metadata、历史任务快照与旧资产；新字幕 render 不读取它作为输出配置，不再调用 `ensure_metadata(...require_video_bit_rate=True)` 为码率补探，不再生成 `source_video_bit_rate_unavailable`。正常视频导入/存储可继续附带探测出的码率，不删除通用媒体能力。不影响其他多轨剪辑请求。

## 实施边界与验收

- 先完成规格评审，再实施、测试并构建本地 0.3.7 wheel；保留全部旧产物与用户未提交改动。
- 不包含 git 提交、推送、生产部署或自动发起真实计费模型/MediaKit 任务。
- 离线验收覆盖实际提交参数与前端选择；第 29 秒普通三行验证标题 41px、正文 34px、自动脚注 24px 的度量基线。
- 真正 PNG / Text 成片对比需用户另行发起或明确授权真实压制；重点看第 29 秒正文发毛与脚注清晰度，同时记录文件大小。CRF 16 不承诺输出码率/体积固定，也不能仅凭本地预览宣布供应商视觉问题已解决。

## 最终验收状态

2026-11-17 已按 `checklist.md` 逐项复核代码、前次独立审计结果和离线浏览器证据；任务 7 的实际方式快照回退、任务 8 的排版诊断清理已独立定向重跑通过。请求方式与实际方式分开记录，历史无字段任务/产物不伪造实际方式或 CRF 16。

任务 5 最终报告已确认六场景通过、mobile creator 外部缓存重测、仅清理 run-owned 缓存、配置字节恢复及测试端口关闭；前端 144 项测试及标准 lint/typecheck 通过，父任务提供最终 diff 检查通过证据。

任务 6/9 已修正旧版本断言，重新从 sdist 构建 0.3.7 wheel 并同步 vendor/exports。隔离及本地安装完整共享包测试各 842 项通过、零失败/跳过；两个 verifier 模式各通过 481 个实际字体策略用例，22 个模块和 49 个非生成归档文件与源码一致。安装包平台 18 个相关模块 826 项通过；Ruff 致命检查、编译、两仓库 diff 及部署脚本离线测试通过。原 SHA 快照保留，59 个保留条目（含 27 个旧包产物及五个构建前 egg-info 文件）一致。安装前和停止后端前即时确认零活动工具任务，按保存命令安全重启，PID 57378、health 200，0.3.7 导入来自平台 `.venv`。最终证据见 `/tmp/subtitle-crf16-release.aZKLB7/final-report.md` 和 `checklist.md`。

本规格已完成（离线范围）；真实计费成片比较继续保持未验收，不属于本次关闭条件。上述最终报告不使用升级前测试或初次失败发布结果替代最终验收。
