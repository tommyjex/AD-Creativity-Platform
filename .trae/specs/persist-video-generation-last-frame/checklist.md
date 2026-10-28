# 验收清单

- [x] 所有 AIGC 视频生成模式创建 Seedance 任务时显式发送 `return_last_frame=true`
- [x] Provider 返回的有效 `last_frame_url` 被适配层完整传递给 AIGC 网关
- [x] Provider 签名 URL 不进入数据库、普通日志或公开 API 元数据
- [x] 视频生成成功后保存一个 `storyboard_video` 视频主资产
- [x] 有效尾帧成功保存为独立、公开的 `generated_image` 资产
- [x] 尾帧 MIME 类型与扩展名来自实际下载内容
- [x] 视频与尾帧对象均存储于 TOS，不依赖 Provider URL 长期可用
- [x] 视频输出关系为 `output:video:0`
- [x] 尾帧输出关系为 `output:last_frame:0`
- [x] Run 结果中视频 ordinal 为 `0`，尾帧 ordinal 为 `1`
- [x] 现有 `video` 输出端口、视频预览和下游连接仍选择视频主资产
- [x] 本次变更不新增画布 `last_frame` 输出 Handle
- [x] Provider 未返回尾帧时视频仍成功，且不创建虚假尾帧资产
- [x] 尾帧转存失败时视频仍成功，且清理尾帧残留对象、记录和关系
- [x] 尾帧失败日志为结构化脱敏日志，不包含签名 URL、凭据或响应正文
- [x] 视频元数据包含尾帧可用状态，成功时记录独立尾帧资产 ID，失败事件进入 TLS
- [x] AI 命名为 `xxx` 时视频名称为 `xxx.mp4`
- [x] AI 命名为 `xxx` 时尾帧名称为 `xxx视频尾帧.<实际扩展名>`
- [x] 尾帧不被普通多产物规则错误命名为 `xxx-2`
- [x] 命名失败时视频和尾帧使用同一个节点回退名称基准
- [x] 尾帧资产使用 `aigc_generated_node_v2` 并记录 `name_variant=video_last_frame`
- [x] 尾帧元数据包含 `aigc_role=video_last_frame` 和 `operation=video_last_frame`
- [x] 尾帧元数据包含来源视频资产及 Pipeline、Run、Node、Task 追溯信息
- [x] 节点后续改名后，尾帧下载名动态更新为当前 `xxx视频尾帧`
- [x] 节点或 Pipeline 不可用时，尾帧下载回退冻结名称
- [x] 显式 `user_defined_v1` 尾帧资产改名保持最高下载命名优先级
- [x] 尾帧直接复用视频命名结果，不增加命名模型调用
- [x] 后端 `Content-Disposition` 与前端建议下载名一致
- [x] 资产库将独立尾帧识别为“视频尾帧”图片产物
- [x] 尾帧资产支持预览、搜索和受控下载
- [x] 尾帧预览使用 `object-contain`，不裁切、不拉伸
- [x] 独立尾帧资产不会与旧式视频 metadata 派生卡片重复展示
- [x] 历史仅含视频资产的 Run 无需迁移且行为保持兼容
- [x] 缓存命中可复用视频与尾帧两个可用资产
- [x] 新视频执行版本不复用旧版本仅视频输出缓存，历史 Run 仍正常查看
- [x] 分镜既有尾帧功能保持原行为，独立工具任务不自动新增尾帧资产
- [x] 取消、晚到结果和任务输出清理会同时处理视频与尾帧资产
- [x] Mock 全链路验收不调用真实视频生成或命名计费接口
- [x] 后端定向测试、Ruff 致命检查、compileall 和 `git diff --check` 通过
- [x] 前端定向 Vitest、TypeScript、ESLint 和 production build 通过
- [x] Playwright 在桌面、平板和手机视口通过，无新增重叠或水平溢出

## 结果页尾帧增量验收

- [x] 视频生成节点右侧“结果”页先显示主视频，再显示独立“视频尾帧”图片区块
- [x] 尾帧通过 `name_variant=video_last_frame` 和图片 MIME 被可靠识别，不依赖数组位置猜测角色
- [x] 尾帧标题明确显示“视频尾帧”，不显示为 `生成结果 2`
- [x] 尾帧缩略图使用固定媒体区和 `object-contain`，竖图与横图均不裁切、不拉伸
- [x] 尾帧区块提供“放大查看”和“下载尾帧”操作
- [x] 点击尾帧缩略图或“放大查看”在应用内 Dialog 打开，不跳转新标签页
- [x] 放大 Dialog 使用 `object-contain` 完整展示尾帧，并显示当前尾帧名称
- [x] Dialog 支持关闭按钮、Escape 和遮罩关闭，关闭后保留当前节点、结果 Tab 与滚动上下文
- [x] 结果区和 Dialog 均可下载尾帧，且使用现有受控资产内容端点
- [x] 前端建议下载名与后端 `Content-Disposition` 一致
- [x] 节点后续改名、冻结名称回退和 `user_defined_v1` 显式重命名继续按既有优先级生效
- [x] 尾帧缺失或不可用时主视频仍正常显示，不渲染空白卡片、损坏图片或不可用下载按钮
- [x] 历史仅含视频资产的 Run 无需迁移且结果页行为保持不变
- [x] 下游 `video` 与 `video_output` 节点结果只显示主视频，不重复显示尾帧
- [x] 本次变更不新增 `last_frame` 输出 Handle，不修改后端接口、资产模型或 Run 数据结构
- [x] 普通图片多产物、视频、音频和字幕结果展示无回归
- [x] Mock 验收不调用真实视频生成、命名或 TOS 服务
- [x] 相关 Vitest、TypeScript、ESLint、production build 和 `git diff --check` 通过
- [x] Playwright 在 `1440x900`、`834x1112`、`390x844` 验证通过，无重叠或水平溢出
- [x] 长 Unicode 尾帧名称在缩略图、Dialog 和下载按钮区域不溢出容器

验证范围、命令与证据见 [validation.md](validation.md)。云存储与 Provider 均使用 Mock，未进行生产调用。
