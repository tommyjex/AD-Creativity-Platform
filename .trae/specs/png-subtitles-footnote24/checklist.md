# PNG 字幕与脚注字号验收

状态：本地实施与离线验收完成。0.3.6 已安装；真实 MediaKit 成片留待后续验收。

- [x] 普通与混合字幕默认 PNG，最终尺寸与 transform 一致。
- [x] 4 倍采样缩图及预乘 Alpha，字重与字体选择不变。
- [x] 自动脚注 24px，人工字号优先，必要扩框及画布边界保护。
- [x] 字幕全文、时间、正文字号、底板、码率、品牌与产品命名保持。
- [x] 字体/PNG 失败与存储失败可回退原生文字，取消透传，签名地址不进摘要。
- [x] 完整独立包与平台相关测试、实际字体检查通过：779 + 687 passed；两安装验证模式各 234 用例。
- [x] PNG 预览桌面、平板、手机验证：creator/viewer 六场景。
- [x] 0.3.6 本地包构建安装、22 模块一致、原有 24 个历史产物 SHA 与 egg-info 保持。
- [x] 本地后端健康检查：无活跃任务后重启，8000 端口 health 200，平台共享编译器来自已安装的 0.3.6。
- [x] 新 PNG 实际字体样张导出，标明非真实供应商成片：exports/29秒_新PNG字幕预览_脚注24px.png。
- [x] Ruff 致命错误/编译/diff、部署脚本离线测试通过，未提交、推送或生产部署。
- [ ] 真实 MediaKit 成片视觉效果（本轮不调用，后续验收）。

证据在 `evidence/`：`installed-tests.xml`、`platform-installed-tests.xml`、`verification/release-{installed,isolated}.json`、`browser/results.json`、`sample-29s.json`、`runtime-verification.json`。前端 lint/typecheck 通过。浏览器测试第一次启动工作目录为平台根目录导致 Tailwind 未找到配置；修正为 frontend 后六场景通过，测试生成的 TypeScript 路径已移除。
