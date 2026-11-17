# 视频字幕按视觉角色选择字重规格

## 为什么

视频字幕翻译模块目前在没有人工字体覆盖时统一使用 Century Gothic Bold，导致说明正文和脚注与标题同样粗重。需要保留标题的粗体层级，让正文和脚注使用用户提供的常规体字体压制。

## 变更内容

- 自动字体按每条字幕的 `visual_role` 选择：只有 `headline` 使用 Century Gothic Bold；`body`、`footnote`、`null` 或缺失类型使用 Century Gothic Regular。
- 保留已有人工字体选择；“默认”表示按角色自动选择字体，不再表示全部使用粗体。
- 字体测量、校对预览、MediaKit 提交与新生成的排版摘要采用一致的字体选择。
- 更新排版版本与独立字幕包版本，避免相同草稿复用旧规则生成的压制任务。
- 不改变 VLM 输出 Schema、提取/翻译阶段、数据库结构、字幕位置、底板规则或通用 AIGC 多轨编辑器行为。

## 影响范围

- 受影响能力：视频字幕翻译的自动排版、校对预览、字幕压制、默认字体提示、发布依赖。
- 已有相关规格：`add-video-subtitle-translation`。其未完成项是供应商容量和真实渲染证据，不是本次按角色选择字体需求；本次作为独立增量规格，保留已有验收状态。
- 核心代码：
  - `standalone/video-subtitle-grounding/src/video_subtitle_grounding/layout.py`。
  - `backend/app/services/subtitle_translation_layout.py`（独立包兼容入口）。
  - `backend/app/services/subtitle_translation.py`（现有排版版本、压制任务幂等与结果写回）。
  - `frontend/lib/subtitle-translation.ts`。
  - `frontend/components/workspace/subtitle-translation/segment-editor.tsx`。
  - `frontend/components/workspace/subtitle-translation/video-preview.tsx`，仅在预览权重声明需要同步时修改。
  - 独立包与平台排版测试、前端字幕字体契约测试及字幕页面测试。
  - 独立包版本定义、平台 `requirements.txt`、`vendor/` 发布包与说明。

## 字体资源与确认结果

| 用途 | 资源 ID | 字体文件 |
| --- | --- | --- |
| 自动标题粗体 | `CenturyGothicBold` | `https://xujianhua-utils.tos-cn-beijing.volces.com/CenturyGothic/centurygothic_bold.ttf` |
| 自动正文、脚注常规体 | `CenturyGothic` | `https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf` |

2026-11-16 已通过只读下载并使用 FreeType 检查用户提供的字体：字体名称为 `Century Gothic / Regular`，大小为 137568 字节，无可变字体轴。本规格将用户所说的“细体”落实为该 Regular 文件，不宣称它是 Light/Thin 字重，也不通过缩小字号模拟细体。

## 新增需求

### 需求：按字幕角色自动选择字体

系统必须在 `style.font` 未设置、为 `null` 或为空时，按当前字幕的 `visual_role` 选择字体：

| `visual_role` | 自动字体 |
| --- | --- |
| `headline` | `CenturyGothicBold` |
| `body` | `CenturyGothic` |
| `footnote` | `CenturyGothic` |
| `null`、缺失或无法识别的旧值 | `CenturyGothic` |

系统必须逐条选择字体，不能按文字块、轨道、视频或 `line_index` 统一选择，也不能根据大小写或文本内容重新猜测角色。共享 `block_id` 的两行可使用不同字体。

#### 场景：标题与说明共用文字块

- **当** 上行 `Edge Cleaning` 的类型为 `headline`，下行 `Cleans close along walls and baseboards.` 的类型为 `body`，两行没有人工字体覆盖。
- **则** 上行用已有 Bold 文件，下行用用户提供的 Regular 文件；两行保留自己的时间、BBox、对齐、`block_id` 与 `line_index`。

#### 场景：脚注及历史缺失类型

- **当** 字幕为 `footnote`，或历史记录没有 `visual_role`。
- **则** 使用 Regular 文件，不因为角色无法判断而阻断压制。

### 需求：使用实际字体文件表达字重

系统必须使用分别对应 Bold 和 Regular 的实际字体文件进行测量与 MediaKit 压制。使用字体文件时，文字元素保持 `bold: false`，避免对已经加粗的字体再次进行合成加粗。不能仅把原先 Bold 文件的 `bold` 改为 `false`，因为该文件本身就是粗体。

#### 场景：常规体的请求载荷

- **当** 自动模式下压制 `body` 或 `footnote`。
- **则** MediaKit 文字元素的 `font_type` 为用户提供的 Regular URL，`bold` 为 `false`；本地测量也使用这个文件。

#### 场景：粗体标题的请求载荷

- **当** 自动模式下压制 `headline`。
- **则** `font_type` 为已有 Bold URL，`bold` 为 `false`；粗体由文件中的字形实现。

### 需求：角色规则与缺字回退兼容

系统必须保留已有缺字回退和可读警告。自动选择的字体缺字时继续回退到现有 MediaKit `ALi_PuHui` 预置字体：`headline` 使用 `bold: true`，其余类型使用 `bold: false`。回退字体的本地字形度量及最终合成粗体效果没有验证，必须继续显示相关未验证提示，不能把本地测量结果当作真实成片验证。

#### 场景：常规体缺字

- **当** 自动正文选用 Regular 文件，但译文含该文件缺少的字符。
- **则** 保留原文内容与既有回退流程，提交预置字体且不加粗，显示缺字和度量未验证提示。

#### 场景：标题缺字

- **当** 自动标题选用 Bold 文件，但译文含该文件缺少的字符。
- **则** 回退预置字体并请求加粗，显示既有回退提示；不承诺最终字重或排版已经过真实压制验收。

## 修改需求

### 需求：人工字体覆盖保持优先

系统必须继续支持现有 `style.font` 的字体资源 ID 或合法字体 URL。用户明确选择的字体优先于自动角色规则，保持其原有字体文件、字重和回退行为；不把已有人工选择的 Bold 字体批量改为 Regular。清空人工选择后恢复角色自动规则。

#### 场景：正文人工使用粗体

- **当** `body` 字幕明确保存了 `style.font: "CenturyGothicBold"`。
- **则** 保留该人工选择；本次新增规则只改变默认模式。

#### 场景：标题人工使用常规体

- **当** `headline` 字幕明确选择 `CenturyGothic`、思源字体或其他现有合法字体。
- **则** 不自动替换该字体。恢复“默认”后再按角色选用标题粗体。

### 需求：校对预览与默认提示同步

系统必须将字体下拉框的默认提示改为“自动 · 标题粗体，正文/脚注常规体”或语义等同的简洁文案。字体目录中的粗体选项不再标注为所有字幕的统一默认值。

前端在缺少当前有效排版结果时，必须按相同的角色规则选择预览字体。已保存的 `font_type` 是派生摘要，不是人工字体覆盖；默认模式下不能仅因为旧摘要保存了 Bold URL，就跳过新的角色规则。重新计算后，应使用新规则生成的字体和测量结果。显式人工字体选择仍应得到正确预览。

#### 场景：旧正文草稿带粗体摘要

- **当** 旧正文记录没有 `style.font`，但历史 `font_type` 为 Bold URL。
- **则** 校对默认字体按正文 Regular 规则解析；重新计算字号后，摘要和提交使用 Regular，不将历史派生字段升级为人工设置。

### 需求：依照最终选用字体重新测量

系统必须基于实际选用的字体重新计算文字宽度、估算字号、有效字号及单行横向扩框。换字重可能改变度量与派生的渲染 BBox，但不得修改原始 BBox、时间、角色或译文，也不得引入描边、额外底板或强制换行。

#### 场景：正文长译文切换常规体

- **当** 旧默认粗体正文采用新规则再次计算排版。
- **则** 使用 Regular 度量，继续执行既有单行扩框与边界保护，不复用旧粗体测量值。

### 需求：重新压制与版本化发布

系统必须将 `LAYOUT_VERSION` 更新为新的稳定版本（建议 `single-line-adaptive-panel35-role-font-v2`），继续通过现有任务幂等机制，使相同草稿首次使用新规则时生成新的压制任务，同一新版本的重复提交仍幂等。

独立包从 `0.2.1` 升级为 `0.2.2`，平台消费匹配版本 wheel。保留配置/日志/兼容入口的既有职责，线上仍只需拉取平台仓库并通过部署脚本安装随仓库发布的 wheel。

#### 场景：已有成片采用旧规则

- **当** 用户在新版本部署后对已有工作区再次点击压制。
- **则** 不返回旧排版版本的压制任务，而是按新规则压制；无需重新执行 VLM 提取或翻译。
- **并且** 已生成的视频不自动重写，历史成片和旧任务保持可查。

## 移除需求

### 需求：所有自动字幕统一默认粗体

**原因**：统一粗体无法表达用户要求的标题、正文和脚注层级。

**迁移**：仅自动模式在后续预览/计算/压制时采用新规则；人工字体覆盖和历史成片不变，不执行数据库迁移或全库写入。

## 验证与边界

- 离线测试覆盖 `headline`、`body`、`footnote`、缺失/非法角色、同块不同角色、人工覆盖、缺字回退、单行测量和版本幂等。
- 前端通过字幕相关 Vitest、TypeScript、lint；按实际改动执行构建与 1440×900、834×1112、390×844 三档 Playwright 检查。
- 独立包与平台通过必要的字幕/MediaKit 回归、Ruff 致命检查、编译和 `git diff --check`，并验证平台加载 `0.2.2` wheel。
- 当前仅已确认 Regular 文件可读取及其真实字体名称；不表示实际压制效果已验证。真实 MediaKit 验收单独标注是否执行及结果，不因离线测试通过而宣称成片字重已验证。
- 提案阶段不修改业务代码，不调用计费接口，不部署、不提交或推送仓库。
