# 非 headline 字幕加粗实施计划

按已确认设计在当前会话内联执行。源码实施后用户追加授权本地打包安装验证；不提交、推送或生产部署。

目标：共享文字编译器将所有非 headline 的文字元素 bold 设置为 true，保留标题原行为。

架构：共享 layout 的输出字段及排版版本由平台现有别名自动复用。版本标记区分新排版幂等身份，本地包升级到 0.3.5。PNG 渲染逻辑保持。

- [x] 更新共享和平台现有 bold 断言，增加缺失角色、独立 API、两类视频和 PNG 回退覆盖；运行专项测试确认旧实现不满足。
- [x] 修改 `layout.py` 的 bold 表达式和排版版本，回归普通文字、标题与缺字回退。
- [x] 通过 source PYTHONPATH 分开运行共享源码与平台相关 pytest；验证旧任务恢复、码率及 PNG。
- [x] Ruff、编译、两仓库 diff 和原包 SHA 检查；记录验收。

实现表达式：

```python
"bold": segment.get("visual_role") != "headline" or (bool(missing) and fallback_bold)
```

源码测试：独立仓库目录下 `PYTHONPATH=src` 运行 pytest；平台目录下 `PYTHONPATH=standalone/video-subtitle-grounding/src:.` 运行 pytest。前者不加入平台路径，保持独立包隔离契约。

追加本地打包安装阶段：

- [x] 更新 0.3.5 包版本、requirements 和 release verifier，增加 bold 与 PNG 字段断言。
- [x] 从 sdist 构建 wheel，新增 vendor 包和 exports 源码归档；保留旧产物及 egg-info。
- [x] 安装平台与隔离副本，验证导入路径、源码一致性及每种模式 234 个真实字体策略用例。
- [x] 从无源码 PYTHONPATH 的 `/tmp` 执行安装包全量测试：767 passed。
- [x] 平台安装包回归 687 passed；确认无活跃任务后本地后端重启，健康接口 200。
- [x] 更新最终验收记录。

不提交、推送或生产部署。
