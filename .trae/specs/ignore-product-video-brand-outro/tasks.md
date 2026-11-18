# 品牌内容排除实施计划

用户已授权按照 spec 在当前会话实施；保留现有改动，不提交、推送、部署或调用计费模型。

**目标：** 产品、开箱和旧默认调用采用统一品牌排除规则。

**架构：** 共享包负责确定性规则与提取过滤。平台在新阶段的选择、上下文、结果处理和图层编译前复用规则，以快照版本区分新任务与历史执行。

**技术栈：** Python、FastAPI、Next.js、pytest、Vitest、Playwright。

- [x] 共享规则：新增 `brand_rules.py`，严格整行匹配；仅重组同块、连续行号且共同时间重叠的完整标语；增加正反例测试。
- [x] 提取：增强 `provider.py` 提示词，在 `service.py` 返回前过滤有效结果；保留 schema、调用签名、原始响应与安全聚合日志。为已冻结旧任务保留旧策略入口。
- [x] 平台：在 `subtitle_translation.py` 过滤翻译选择、上下文、名称识别、结果、预览和压制输入；品牌条目不产生失败或缺译提示，历史源文、样式与译文不删除。
- [x] 快照：新 extract/translate/render 身份写入品牌规则版本；旧任务按冻结策略执行，已提交压制只轮询；保留 revision 和晚到保护。
- [x] 前端：复用安全警告显示跳过状态，阻止品牌译文进入普通文字与 PNG 预览；保留现有布局。
- [x] 发布：更新包至 0.3.3，构建 wheel/sdist，固定 requirements，复制源码归档并记录 SHA；旧包保留。
- [x] 验证：运行共享包与平台离线测试、Ruff、编译、diff、部署脚本测试和安装一致性检查；前端变动执行 Vitest 与三个视口的 Playwright。

验证命令使用项目 `.venv/bin/python -m pytest`，平台测试设置 `PYTHONPATH` 为项目根目录；源包测试先使用 `standalone/video-subtitle-grounding/src`，发布后以安装 wheel 重跑。真实字体使用已有 `/tmp/subtitle-role-real-fonts`，中间输出放在 `/tmp`。
