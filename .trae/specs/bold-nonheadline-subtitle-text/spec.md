# 非 headline 字幕文字加粗

状态：源码实施与离线验收完成；用户随后授权“打包并安装新包，验证字幕样式是否生效”。本轮本地构建、安装 0.3.5 并重启后端验证，不提交、推送或生产部署。

## 目标及接口依据

用户要求：MediaKit `text / subtitle` 元素专属字段中，只要字幕不是 `headline`，`bold` 设置为 `true`。

官方文档：https://docs.volcengine.com/docs/intelligent-processing/multi-track-edit?lang=zh

`bold` 为 Boolean，表示是否加粗，默认 false。`text` 和 `subtitle` 共享该字段；`image` 不支持此字段。目前本项目逐行字幕提交为 `type=text`，不提交 SRT 类型元素。

## 当前逻辑

共享包 `layout.py::_layout` 当前设置 `bold = bool(missing) and fallback_bold`。使用字体文件的普通文字为 false；自动 headline 缺字回退到预设字体时为 true。标题默认选实际 Century Gothic Bold，正文及附注默认选 Century Gothic Regular。

平台 `subtitle_translation_layout.py` 直接共享独立包编译器。混合产品名字幕由 `product_layout.py` 绘制 PNG，以 image 元素提交；物化失败时回退到普通文字。

## 方案选择

1. **推荐：在共享文字编译器中按原始 visual_role 设置 bold。** 平台、独立 API、普通文字及 PNG 失败回退统一生效，避免在提交层重复维护规则。
2. 在平台 MediaKit 提交前修改元素。独立 API 不能自动覆盖，且元素没有原始 visual_role，需增加映射，复杂度更高。
3. 将 PNG 全部替换成文字。会损失型号 Black / 规格 Light 的混合字体效果，超出本次字段变更范围。

## 明确规则与范围

- `visual_role != "headline"`：提交的文字元素 `bold=true`，包含 body、footnote、null、缺失及旧未知角色。
- `visual_role == "headline"`：保留现有逻辑。实际字体文件仍 false；自动标题缺字回退到预设字体时仍 true；人工字体选择保持原行为。
- 人工字体选择不覆盖非 headline 的加粗要求；只改 bold，不改变 font_type。
- 适用于产品视频、开箱视频及未指定类型的普通文字；PNG 失败回退也使用同一规则。
- PNG/image 元素不追加非法 bold 参数，不改已有 PNG 字体或像素；因此产品混合字体 PNG 不会因本次修改额外加粗。
- 保持字号下限 1px、位置、单行规则、背景、原视频码率、音轨、品牌排除和产品字典。
- 不新增前端控件。现有文字预览使用字体文件，不作为供应商合成加粗的精确效果证明；本次不扩展为预览或字体测量系统改造。

## 发布与历史任务

- 按用户最新授权本地构建 0.3.5，更新 requirements 和 release verifier，新增 vendor wheel/sdist 与 exports 源码归档；全部历史产物保持。
- 排版版本更新为 `single-line-adaptive-panel35-nonheadline-bold-v5`，确保同一草稿新压制可获得新幂等身份。
- 编码策略 `source-video-bit-rate-v1`、品牌版本、字典版本保持。
- 已提交的历史任务恢复或重试只轮询原供应商任务；新压制及需要重新编译的新提交采用新规则，历史成片保持。
- 保留既有未提交改动及全部旧包，不提交、推送或生产部署；本轮安装新包，确认无活跃工具任务后重启本地后端。验证安装与隔离导入均不被源码路径覆盖。

## 验证及限制

- 测试 headline/body/footnote/null/缺失/未知角色，实际字体、人工字体、缺字回退、两种视频类型与独立 API。
- 验证 PNG 不携带 bold，物化失败后的文字元素遵循角色规则。
- 回归原码率、底板、品牌排除、字号、幂等及旧任务恢复。
- 共享包安装后与平台适配层离线 pytest、Ruff、编译、diff，以及原产物 SHA 验证。两个安装模式验证字体、底板、码率、PNG 像素与实际提交参数。
- 不调用计费模型或 MediaKit。bold 的实际字重、额外字宽与供应商最终排版效果需真实成片验收，离线字体测量不能证明其精确效果。
