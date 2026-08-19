# Checklist

- [x] 配置项 `MEDIAKIT_API_KEY`/`MEDIAKIT_BASE_URL`/轮询与超时/语言 已加入 `config.py` 并可从环境读取
- [x] `GenerationTask` 增加可空 `progress_message`，后端 schema、mysql、memory 均持久化并返回
- [x] `AssetType.SUBTITLE` 与前端 `ASSET_TYPES` 的 `"subtitle"` 一致
- [x] MediaKit ASR 真实客户端实现提交 + 轮询 + 结果解析，错误脱敏（不泄露 key/原始响应/签名 URL）
- [x] 未配置 API Key 时回退 mock，不发起网络请求，返回确定性字幕
- [x] `segments_to_srt` 生成合法 SRT，空列表返回空字符串
- [x] ffmpeg 字幕压制使用底部安全区、白字黑描边、最多两行，空 SRT 跳过压制
- [x] compose 接口后台化：依赖满足时立即返回 `running` 任务，依赖缺失返回错误且不建后台任务
- [x] compose 编排按节点更新 `progress_message`（合成基础视频→视频字幕提取中→字幕 SRT 文件提取完成→字幕压制中→剪辑完成）
- [x] 成功后产出 `final_video` 与 `subtitle` 资产，`latestFinalVideoAsset` 可识别成片
- [x] 无语音时跳过压制，任务仍 `succeeded` 并给出说明文案
- [x] ASR 或压制失败时任务 `failed`、错误脱敏，且不产出最终成片资产
- [x] `video_prompt.py` 单/合并分镜提示词不再包含字幕烧录指令，`【语音与字幕】` 改为 `【语音】`
- [x] `validate_optimized_video_prompt` 与 `extract_timeline_ranges` 与新章节名一致，不再强制字幕子串
- [x] `modelark.py` 优化器 system prompt 去除字幕要求、保留语音要求且校验通过
- [x] 前端 ComposePanel 轮询展示节点文案，`succeeded` 刷新成片、`failed` 显示脱敏错误，进行中禁用按钮
- [x] 后端全量测试在 `.venv` 通过；前端 Vitest 与 TypeScript 类型检查通过
