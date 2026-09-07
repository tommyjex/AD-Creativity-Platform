# AIGC 文生图与图生图自定义像素尺寸 Spec

## Why

AIGC 画布中的文生图与普通图生图目前只能选择 `1K / 1.5K / 2K` 档位，并通过提示词附加画幅比例，无法生成具有明确交付尺寸的图片。Seedream 5.0 Pro 官方图片生成 API 已支持将 `size` 指定为 `宽x高`，需要把该能力接入节点配置、校验、任务快照和结果验证。

## What Changes

- 文生图节点和图生图节点的普通 `image_to_image` 模式增加“自定义像素”尺寸方式。
- 保留现有 `1K / 1.5K / 2K` 档位作为默认方式，旧 Pipeline 无需迁移。
- 自定义尺寸通过现有 `size` 字段保存为规范化 `WIDTHxHEIGHT` 字符串，不新增数据库列、不升级 Pipeline `schemaVersion`。
- 自定义尺寸严格遵循 Seedream 5.0 Pro 官方限制：
  - 总像素 `width × height` 在 `[921600, 4624220]` 内；
  - 宽高比 `width / height` 在 `[1/16, 16]` 内；
  - 宽、高均为十进制正整数。
- 自定义尺寸与预设档位、画幅选择互斥；自定义模式以宽高为唯一输出尺寸来源。
- 自定义尺寸进入任务参数快照、`inputHash`、供应商请求和输出元数据。
- 下载供应商结果后校验实际图片宽高；与目标尺寸不一致时任务失败，不保存成功资产。
- 图片编辑 `image_edit` 与图层拆分 `layer_decomposition` 不在本次变更范围。

官方依据：

- [火山方舟图片生成 API](https://docs.volcengine.com/docs/82379/1541523)
- [Seedream 图片生成教程](https://docs.volcengine.com/docs/82379/1824121?lang=zh)

## Impact

- Affected specs:
  - AIGC 工作台文生图节点
  - AIGC Seedream 普通图生图模式
  - AIGC 图片任务参数、缓存和结果资产
- Affected code:
  - `frontend/lib/aigc/types.ts`
  - 新增前端共享图片尺寸解析与校验模块
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/lib/aigc/editor-store.ts`
  - `backend/app/schemas/aigc.py`
  - `backend/app/schemas/image_generation.py`
  - 新增后端共享图片尺寸解析与校验模块
  - `backend/app/services/aigc_executor.py`
  - `backend/app/services/aigc_gateway.py`
  - `backend/app/services/generation.py`
  - `backend/app/services/modelark.py`
  - 相关前后端测试与浏览器验收 fixture

## ADDED Requirements

### Requirement: 图片尺寸双模式

系统 SHALL 为文生图节点和 `operation=image_to_image` 的图生图节点提供“分辨率档位”和“自定义像素”两种互斥尺寸方式。

“分辨率档位”继续使用 `1K / 1.5K / 2K`；“自定义像素”使用独立的宽度与高度数字输入，并将有效值规范化为小写分隔符的 `WIDTHxHEIGHT`。

#### Scenario: 旧节点保持预设模式

- **WHEN** 旧 Pipeline 的文生图或图生图节点 `size` 为 `1K`、`1.5K` 或 `2K`
- **THEN** 节点按“分辨率档位”加载
- **AND** 原 `aspect_ratio`、`size`、输出格式和运行行为保持不变
- **AND** 不需要数据迁移或 `schemaVersion` 升级

#### Scenario: 切换到自定义像素

- **WHEN** 用户从“分辨率档位”切换到“自定义像素”
- **THEN** 配置面板显示宽度和高度整数输入
- **AND** 初始宽高使用当前档位与画幅对应的官方常见像素值
- **AND** 有效值以 `WIDTHxHEIGHT` 写入节点 `size`
- **AND** 画幅选择器隐藏或禁用

当前界面已支持的档位与画幅使用以下初始化值：

| 档位 | 1:1 | 4:3 | 3:4 | 16:9 | 9:16 |
| --- | --- | --- | --- | --- | --- |
| 1K | 1024x1024 | 1152x864 | 864x1152 | 1424x800 | 800x1424 |
| 1.5K | 1536x1536 | 1792x1344 | 1344x1792 | 2048x1152 | 1152x2048 |
| 2K | 2048x2048 | 2368x1776 | 1776x2368 | 2816x1584 | 1584x2816 |

#### Scenario: 切回分辨率档位

- **WHEN** 用户从“自定义像素”切回“分辨率档位”
- **THEN** 节点 `size` 设为 `2K`
- **AND** 重新显示节点原有 `aspect_ratio`
- **AND** 用户可继续选择 `1K / 1.5K / 2K` 和画幅

### Requirement: 自定义尺寸权威校验

系统 SHALL 在前端编辑、Pipeline definition 校验和运行参数解析阶段使用同一组约束校验自定义尺寸。

合法自定义尺寸必须同时满足：

1. 格式为两个十进制正整数；
2. 规范序列化为 `WIDTHxHEIGHT`，不包含空格，分隔符为小写 `x`；
3. `921600 <= width × height <= 4624220`；
4. `1/16 <= width / height <= 16`。

乘法与比例校验 SHALL 使用整数比较，避免浮点边界误差：

- 总像素直接比较 `width * height`；
- 比例比较 `width <= 16 * height` 且 `height <= 16 * width`。

#### Scenario: 合法自定义尺寸

- **WHEN** 用户输入宽 `2048`、高 `1024`
- **THEN** 前端显示尺寸有效
- **AND** 节点 `size` 保存为 `2048x1024`
- **AND** Pipeline 可以保存和运行

#### Scenario: 总像素过小

- **WHEN** 用户输入 `512x512`
- **THEN** 系统提示总像素不得低于 `921600`
- **AND** 不提交供应商请求
- **AND** 不以旧尺寸静默执行

#### Scenario: 总像素过大

- **WHEN** `width × height > 4624220`
- **THEN** 系统提示总像素超出 Seedream 5.0 Pro 上限
- **AND** Pipeline 在修复前不可运行

#### Scenario: 宽高比超限

- **WHEN** `width > 16 × height` 或 `height > 16 × width`
- **THEN** 系统提示宽高比必须在 `1:16–16:1`
- **AND** Pipeline 在修复前不可运行

#### Scenario: 非整数或缺失值

- **WHEN** 宽或高为空、为零、负数、小数或非数字
- **THEN** 前端显示字段级错误
- **AND** 不产生非法 `size`
- **AND** 保存或运行不得回退使用此前尺寸

#### Scenario: 绕过前端提交非法值

- **WHEN** 客户端直接提交非法 `size` 字符串或越界尺寸
- **THEN** 后端返回可定位到节点和 `size` 的验证错误
- **AND** 不创建任务或调用供应商

### Requirement: 自定义尺寸与画幅互斥

系统 SHALL 在自定义像素模式下，以 `WIDTHxHEIGHT` 为唯一尺寸和比例来源。节点中保留的旧 `aspect_ratio` 只用于切回预设模式，不得影响自定义尺寸请求。

#### Scenario: 自定义尺寸运行

- **WHEN** 节点 `size` 为合法 `2048x1024`
- **THEN** 供应商请求 `size` 精确为 `2048x1024`
- **AND** 系统不得向最终提示词追加节点中旧的“画幅比例”约束
- **AND** 任务与资产元数据记录目标宽 `2048`、高 `1024` 和规范 `size`

#### Scenario: 预设尺寸运行

- **WHEN** 节点 `size` 为 `2K`
- **THEN** 供应商请求继续使用 `size=2K`
- **AND** 最终提示词继续追加节点 `aspect_ratio`
- **AND** 既有预设模式行为不变

### Requirement: 自定义尺寸进入任务快照与缓存

系统 SHALL 将规范化自定义尺寸作为节点配置的一部分写入不可变任务参数快照，并纳入 `inputHash`。

#### Scenario: 修改宽或高

- **WHEN** 用户将 `2048x1024` 修改为 `1920x1080`
- **THEN** 新任务参数快照包含 `1920x1080`
- **AND** `inputHash` 发生变化
- **AND** 不复用 `2048x1024` 的历史结果

#### Scenario: 重试失败任务

- **WHEN** 用户重试一个自定义尺寸任务
- **THEN** 重试使用原任务冻结的规范宽高
- **AND** 不读取节点后来修改的新尺寸

### Requirement: 自定义尺寸结果校验

系统 SHALL 在把供应商结果保存为成功资产前读取实际图片宽高。自定义尺寸任务的实际宽高必须与请求目标完全一致。

#### Scenario: 输出尺寸正确

- **WHEN** 请求尺寸为 `2048x1024` 且下载结果实际为 `2048x1024`
- **THEN** 系统保存成功图片资产
- **AND** 资产元数据记录请求尺寸与实际宽高

#### Scenario: 输出尺寸不一致

- **WHEN** 请求尺寸为 `2048x1024` 但下载结果为其他尺寸
- **THEN** 任务以稳定的输出尺寸校验错误失败
- **AND** 不创建成功资产或缓存结果
- **AND** 已上传的临时对象和部分资产得到清理

### Requirement: 模式范围限制

自定义像素尺寸 SHALL 仅用于：

- `text_to_image` 文生图节点；
- `image_to_image` 节点的 `operation=image_to_image` 普通图生图模式。

#### Scenario: 图片编辑模式

- **WHEN** Seedream 节点切换为 `operation=image_edit`
- **THEN** 配置继续使用既有尺寸档位
- **AND** 不显示自定义宽高输入

#### Scenario: 图层拆分模式

- **WHEN** Seedream 节点切换为 `operation=layer_decomposition`
- **THEN** 配置继续只提供 `auto / 1K / 1.5K / 2K`
- **AND** 不接受或透传 `WIDTHxHEIGHT`

#### Scenario: 模式切换携带不兼容自定义尺寸

- **WHEN** 一个使用自定义尺寸的普通图生图节点切换为图片编辑或图层拆分
- **THEN** 节点尺寸自动收敛为该模式的既有默认值：图片编辑使用 `2K`，图层拆分使用 `auto`
- **AND** 不保留无法运行的自定义尺寸

## MODIFIED Requirements

### Requirement: 文生图节点图片尺寸

文生图节点 SHALL 支持 `1K / 1.5K / 2K` 分辨率档位和满足官方约束的 `WIDTHxHEIGHT` 自定义像素尺寸。预设模式继续结合 `aspect_ratio` 构建生成约束；自定义模式不得叠加独立画幅约束。

### Requirement: 普通图生图节点图片尺寸

`image_to_image` 节点在 `operation=image_to_image` 时 SHALL 支持 `1K / 1.5K / 2K` 分辨率档位和满足官方约束的 `WIDTHxHEIGHT` 自定义像素尺寸。参考图数量、提示词、BBox 引用、输出格式和输出端口规则保持不变。

### Requirement: 图片任务供应商参数

AIGC 文生图与普通图生图任务 SHALL 将规范化节点 `size` 原样传给 Seedream 5.0 Pro。预设档位和自定义尺寸不得在适配层互相转换；任务快照、重试、元数据和缓存均使用同一规范值。

## REMOVED Requirements

### Requirement: 文生图与普通图生图只能使用分辨率档位

**Reason**: Seedream 5.0 Pro 官方图片生成 API 支持合法 `WIDTHxHEIGHT`，仅允许档位无法满足明确交付尺寸需求。

**Migration**: 现有 `1K / 1.5K / 2K` 数据保持原值和行为；只有用户主动切换到自定义像素后才写入 `WIDTHxHEIGHT`。
