# 字幕产品名称识别与混合字体设计

## 目标与状态

2026-11-16 自动化迭代（用户已要求实施）：型号与规格由系统全自动判定，不显示人工拆分输入框、手动识别按钮或人工校验提示。翻译、保存译文和 POST 排版计算自动完成名称识别；按最终文本、同块上下文及字典版本复用结果。识别异常自动重试一次，仍失败则保留普通字幕继续执行，记录结构化日志。GET 读取不调用模型。兼容接口及历史字段继续保留。

在视频字幕翻译阶段识别产品名称，保留规范拼写，并在校对预览和成片中区分产品型号与规格：型号使用 Avenir LT Std 95 Black，规格使用 Avenir LT Std 35 Light。普通文字继续按已有 `visual_role` 规则排版。

用户已批准实施，并明确追加：字典未出现的产品名称，由模型根据字典范式判断型号与规格。当前进入实施阶段，采用透明 PNG 图层方案；不执行提交、部署或计费验收。

## 已确认依据

- 附件：`最新产品名称规范.pdf`，共 11 页、72 个产品名称示例。
- 原文件：`/Users/bytedance/Documents/科沃斯添可广告专项/视频字幕翻译项目/Floor ONE i5 Lite/最新产品名称规范.pdf`。
- 文件 SHA256：`42dd3ea253b7b7a95465eecda1e5bfe868af83d0c5bb3e7161d8cda9a190e1c2`。
- 已按 PDF 中实际 Black/Light 字体运行分界核对，不能仅靠空格、末尾单词或 `Stretch` 等关键词拆分。
- 用户明确示例：`FLOOR ONE S7` 为型号，`Stretch Steam` 为规格。
- 字体通过只读下载及 FreeType 检查：

| 名称部分 | 资源 ID（拟） | 实际字体 | URL |
| --- | --- | --- | --- |
| 型号 | AvenirLTStdBlack | Avenir LT Std / 95 Black，28,688 字节 | https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Black.otf |
| 规格 | AvenirLTStdLight | Avenir LT Std / 35 Light，28,084 字节 | https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/AvenirLTStd-Light.otf |

Black/Light 由文件中的真实字形表达，不合成加粗，不通过缩小字号模拟细体。

## 方案选择

| 方案 | 适用性 | 代价与限制 |
| --- | --- | --- |
| **推荐：规范字典＋模型辅助，混合字幕生成 PNG 图层** | 型号/规格基线、空格、字重、底板在同一次本地绘制中确定，MediaKit 使用已有图片元素能力 | 新增图层生成、内部存储及缓存；含产品名的成片字幕层为图片，工作区仍保留可编辑文字；尺寸变化需重新生成 |
| 规范字典＋模型辅助，多个原生文字元素拼接 | 保持供应商原生文字渲染 | 不同字体的供应商垂直锚点及相邻元素基线没有真实验证；单一底板仍需额外处理 |
| 只追加翻译提示词 | 改动最少 | 不能可靠锁定规范名称，也无法满足当前单字体元素中的型号/规格混排，不满足本需求 |

图片图层由指定字体精确绘制，不调用生成式图像接口。只对含已确认产品名称的字幕行启用该路径，其他字幕保留原生文字路径。图片元素使用已有 `type/source/target_time/transform` 契约，不新增未经验证的供应商富文本字段。

## 名称识别与翻译规则

1. 将附件转换成版本化的产品名称字典，保存规范全名、型号、规格、来源页和明确的 OCR 别名。字体决策不依赖 `visual_role`。
2. 本地匹配优先：完整名称最长匹配，检查词边界，允许识别阶段忽略大小写和重复空格；输出使用规范大小写及单空格。`iFLOOR`、`i5`、`FlashDry`、`FurFree` 等保持原规范。
3. 可以识别独立型号；有完整名称时不同时创建其嵌套型号标签。多个产品名、重复出现分别记录区间。普通 `Steam`、`Pro`、`Stretch` 不单独视为产品规格。
4. 翻译前保护确认的产品名称，向模型提供字典命中、同块及邻行上下文。型号和规格均作为正式名称保留原拼写，不将 `Stretch Steam` 翻译成目标语言中的普通描述。
5. 模型参照完整字典的型号/规格范式识别未收录的产品名称，包括新型号、新规格、新组合及同文字块跨行名称。模型成功拆分的未收录名称直接进入 Black/Light 排版，不要求字典命中或先人工新增字典。保留该名称原文拼写，来源记为 `model_pattern`；本地核对原文存在、分段可还原名称、区间边界和不重叠，不直接信任模型偏移、字体 URL 或任意名称改写。
6. 已确认名称用内部标记保护后，翻译结束恢复规范全名，再用最终纯文本计算区间；校验标记数量、名称完整性和最终区间。内部标记不进入用户字幕、成片、正常日志或持久化译文。
7. 识别失败、候选有歧义或标记异常时保留可编辑文本并显示定位到该字幕的警告；不新增全工作区硬拦截。无法确认的区间不强制替换名称或套用产品字体，其他字幕继续处理。
8. 已翻译的历史草稿在保存和 POST 排版计算时自动判定最终译文中的名称，无需重跑视频 VLM 提取或正文翻译。GET 读取仅复用已保存结果和本地字典，不调用模型。未收录名称按字典范式由模型判定；结果按文本、同块上下文及字典版本缓存。失败自动重试一次，仍失败则保留普通文字，不要求人工校验。

## 数据契约

保留 `text` 与 `translated_text` 为单行纯文本，不写入 HTML、Markdown 或 ASS 标记，不修改提取阶段的 VLM Schema。

新增可选、向后兼容的产品识别结果，旧草稿缺失时使用空列表。概念字段：

```json
{
  "product_mentions": [
    {
      "catalog_id": "floor-one-s7-stretch-steam",
      "start": 0,
      "end": 26,
      "model": "FLOOR ONE S7",
      "spec": "Stretch Steam",
      "origin": "catalog",
      "status": "confirmed"
    }
  ]
}
```

以上区间针对最终 `translated_text`，采用 Unicode code point、左闭右开；`FLOOR ONE S7 Stretch Steam` 长度为 26，示例区间为 `[0, 26)`。实际结果必须由文本计算，前端使用 code point 数组转换，不能直接使用 UTF-16 偏移。

产品标注含来源和最终文本指纹：字典结果携带可信字典 ID；未收录名称的 `catalog_id` 为空，`origin` 为 `model_pattern`，使用已验证的模型拆分。文本编辑后自动失效并重新识别，不沿用旧区间。`model/spec` 为名称分段信息；字体与图层由服务端规则派生，客户端不能通过模型输出注入字体 URL。

排版摘要新增分段及图层元数据，例如 `text_runs`（普通文字/型号/规格、区间、字体 ID、哈希和测量位置）及 `render_layer_asset_id`。混合字幕不将整行的单个 `font_type` 冒充全部实际字体；已有普通字幕摘要继续兼容。

工作区使用已有 JSON 内容存储；确认字段序列化及任务快照适配后，不预设需要数据库 DDL 迁移。

## 排版与图层

- 产品区间内：型号 Black、规格 Light，优先于标题/正文/脚注规则及整行 `style.font`。整行人工字体仅作用于产品名称外的普通文字，UI 明确提示这一点；产品拆分结果只读展示，译文变化后自动重新判定。
- 产品区间外：人工字体优先，否则 `headline` 使用 Century Gothic Bold，`body/footnote/缺失角色` 使用 Century Gothic Regular。
- 纯型号无规格时只绘制 Black；`FLOOR ONE STRETCH S6` 按附件整段 Black，不改写为 `FLOOR ONE S6 Stretch`。
- 同行各段使用同一最终字号和共同基线，分别用实际字体测量 advance、字形边界、ascent/descent；明确分配型号与规格间的单个空格，不丢失或重复。
- 整行宽度按各段实际测量汇总，延续单行扩框、邻行限制和视频边界保护；优先扩框，再在必要时统一缩小整行字号，不仅缩小规格。
- 透明 PNG 包含整条字幕行及需要的唯一底板。沿用现有近白/近黑/其他背景颜色策略、透明度和对齐，不添加描边，不切割多个半透明底板造成接缝。
- 图层按最终视频展示尺寸栅格化，包含字形 overhang 和抗锯齿安全边缘，显式记录内容原点及图层 bbox；供应商按等比、无裁切的精确 transform 放置，禁止拉伸文字。
- 时间、原始 bbox、`block_id/line_index`、角色和译文保留；渲染 bbox 可以因新字体测量变化。
- 缺字按分段自动回退并保留全文，记录可读状态；本地图层不能绘制供应商专有预置字体，必须选用已注册且有真实文件的现有可用字体。仍无法覆盖时保留普通文字渲染，不提示人工校验。

## 预览、存储与重压制

- 校对编辑器仍使用纯文本，只读展示自动识别出的型号/规格及处理状态；移除产品拆分输入框、关闭复选框和手动识别按钮，不提示人工校验。
- 混合字幕预览使用与压制相同测量结果和 PNG 图层，避免 DOM 与 Pillow 的字符定位差异；生成中的预览可显示文本占位与状态，失败时保留普通文字可读预览。
- 正式图层写入内部 TOS 存储，由平台注入独立包的图层物化接口；纯排版逻辑不自行读取平台配置或数据库，不复制第二套字体规则。
- 使用内容指纹缓存：最终文本、产品区间、字典版本、字体文件 SHA256、字号、颜色、底板、对齐、渲染 bbox、视频展示尺寸和排版版本变化均失效。图层对象 ID 可保存，签名访问 URL 只在提交时生成，不能长期写入工作区。
- 字体文件允许列表和下载大小限制继续生效；图层权限与现有工作区资源一致，不将内部图层暴露为公开业务资产。
- 校对修改后旧图层不得被新任务复用；待供应商任务结束前不得删除仍被引用的图层。失败上传与废弃图层按既有存储生命周期清理，不删除历史成片。
- 更新排版版本及独立包版本（在当前 0.2.2 基础上增量发布），将字典版本纳入任务指纹。同一新版本重复提交仍幂等；历史任务与成片保持可查。
- 线上继续只拉取平台仓库、安装 `vendor/` wheel，再重启后端。

## 附件名称字典核对表

表中“无”表示只有型号，其余每个规格对应附件中的一个完整名称。以下覆盖 72 个示例；实施时每个名称独立保存来源页及 ID。

| 页 | 型号（Black） | 规格（Light） |
| --- | --- | --- |
| 1 | iFLOOR 3 | 无；Breeze Complete |
| 1 | iFLOOR Y2 | 无 |
| 1 | iFLOOR Y5 | 无 |
| 1 | iFLOOR 5 | Breeze；Steam |
| 2 | FLOOR ONE i5 | Stretch；Max |
| 2 | FLOOR ONE i6 | Stretch |
| 3 | FLOOR ONE SWITCH i5 | Stretch Breeze；Power Kit；Stretch |
| 3 | FLOOR ONE SWITCH i6 | Stretch |
| 3 | FLOOR ONE SWITCH S6 | Stretch Breeze；Power Kit |
| 4 | FLOOR ONE S5 | Pro；Pro 2；Steam；Max；Combo Power Kit；Stretch |
| 5 | FLOOR ONE S6 | 无；Stretch Lite；Stretch Pro；Stretch Ultra |
| 5 | FLOOR ONE STRETCH S6 | 无 |
| 5 | FLOOR ONE SWITCH S6 | Stretch |
| 6 | FLOOR ONE S7 | Pro；FlashDry；Steam；Max Pro；Stretch；Stretch Ultra；Stretch Steam；Stretch Steam Plus |
| 6 | FLOOR ONE SWITCH S7 | 无；Stretch |
| 7 | FLOOR ONE S7 | Artist |
| 7 | FLOOR ONE S9 | Artist；Artist Premium；Artist Pro；Artist Steam |
| 7 | FLOOR ONE STATION S9 | Artist |
| 8 | PURE ONE AIR | 无；Pet |
| 8 | PURE ONE X | Essentials |
| 8 | A11 | Hero；Hero Ex |
| 8 | A20 | 无 |
| 8 | A30S | 无 |
| 8 | PURE ONE A50S | 无 |
| 8 | PURE ONE A90S | 无 |
| 9 | PURE ONE S11 | 无 |
| 9 | PURE ONE S15 | Pro |
| 9 | PURE ONE S12 | Pro Ex |
| 9 | PURE ONE S30 | 无；Pro |
| 9 | PURE ONE S50 | 无；Pro |
| 9 | PURE ONE S70 | 无 |
| 9 | PURE ONE STATION | FurFree |
| 9 | PURE ONE STATION 5 | 无；Pro |
| 10 | TINECO iCARPET | 无 |
| 10 | TINECO CARPET ONE | 无；Pro |
| 10 | CARPET ONE | Cruiser；Spot；Spot Essentials |
| 11 | MODA ONE | 无 |
| 11 | ZIVA ONE | 无 |
| 11 | TOASTY ONE | 无 |

附件未收录的组合（例如 `FLOOR ONE i5 Lite`）由模型参照 `FLOOR ONE i5 Stretch/Max` 等范式判断为型号 `FLOOR ONE i5` 和规格 `Lite`；验证原文与分段一致后即可应用 Black/Light。该名称标明模型推断来源，不冒充附件正式条目，也不自动污染规范字典。新型号（例如 `FLOOR ONE S10 Stretch Steam`）同样允许模型拆分并排版。

## 涉及模块

- 独立包：新增产品字典与识别模块，调整 `translation.py`、`translation_schemas.py`、`layout.py`、`render.py` 及可选图层物化接口，补充版本化发布与测试。
- 平台：字幕 schema、任务快照/写回/幂等、校对预览 API、内部图层存储注入；保持独立包兼容入口职责。
- 前端：字幕 API 类型、分段摘要与图层预览、产品自动判定结果展示、普通字体提示和缓存失效。
- 不涉及通用 AIGC 多轨编辑器行为、VLM 提取范围、品牌 Logo/包装印刷文字识别规则或独立产品库管理。

## 验收与证据边界

- 72 个附件名称逐项验证全名、型号/规格分界和来源页；用户示例以及 `FLOOR ONE STRETCH S6` 必须单独覆盖。
- 翻译测试覆盖名称保护、多语种正文、误译恢复、标记异常、未收录名称由模型成功拆分及直接排版、重复名称、多个产品、OCR 别名、跨行上下文、普通 `Steam/Pro` 不误识别；模型失败或无依据的拆分保留非阻断提示。
- 文本编辑后重新识别，含 emoji 的 code point 区间与前端转换一致；纯文本与区间无损往返。
- 实际 Black/Light 字体测量与 PNG 像素检查验证共同字号、基线、空格、边界、底板、透明度及无裁切；缺字验证有真实文件且警告明确。
- 平台回归覆盖图层权限、缓存、失败回退、签名 URL 生命周期、任务幂等、旧成片保留；必要 lint、编译及双方 diff 检查。
- 前端 Vitest、TypeScript、全量 lint、构建；Playwright 桌面 1440×900、平板 834×1112、手机 390×844，检查混合字体预览、校对、只读权限及无溢出。
- 本地 PNG/浏览器通过不能作为真实 MediaKit 视频输出已通过的证据。真实供应商压制及实际翻译质量验证需单独记录是否执行，不在未授权时调用计费接口。
