# PNG 字幕绘制与 24px 脚注实施计划

执行方式：用户已批准 PNG 与 24px 方向，按会话既有偏好内联执行，无子代理、无提交、无生产发布。

Goal：普通和混合字体字幕采用高质量 PNG，自动脚注默认 24px。

Architecture：共享文字度量编译器保留为回退；raster.py 集中绘制。平台复用既有私有图层存储和同源图片预览；失败时显式文字编译。Tech Stack：Python/Pillow/FastAPI、Next.js 既有预览。

- [x] 1. 新增 `tests/test_raster.py`：实际字体/确定性 fixture 验证默认 PNG、Alpha 边缘、尺寸、字体与输入不变、24px/人工覆盖/相邻行与边界/取消。
- [x] 2. 新增 `raster.py` 的 `draw_layer` 与 `rasterize_text`，混合字体共用绘制函数；普通 PNG 从 `_layout` 取得框、字号和实际字体。
- [x] 3. 增加 `compile_text_subtitle_project`，默认普通路径输出 PNG，脚注目标 24px；LAYOUT_VERSION v6。
- [x] 4. render 与平台使用显式文字回退；平台重新生成摘要，取消透传，签名不进摘要。
- [x] 5. 原生文字 wire-contract 专项测试明确使用 `rasterize=False`；默认 PNG 的包 API 与平台预览/渲染测试覆盖新行为。独立 779、平台 687 passed。
- [x] 6. 新增 `scripts/verify-subtitle-png-browser.py` 复用既有 fixture，六场景验证实际字体普通三行 PNG 及失败回退，未修改产品 UI。
- [x] 7. 0.3.6 已从 sdist 构建 wheel，平台/隔离安装与源码一致；24 个旧产物和 egg-info 保持；无活跃任务后重启本地后端。
- [x] 8. 29 秒三行样张导出，Ruff/编译/两仓库 diff 和离线部署脚本检查通过；真实成片尚未验收。
