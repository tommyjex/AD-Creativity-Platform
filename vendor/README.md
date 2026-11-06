# Versioned subtitle backend dependency

`video_subtitle_grounding-0.2.1-py3-none-any.whl` 是平台使用的固定版本 Python 包，源码由独立 `video-subtitle-grounding` 仓库维护。wheel 是部署所需发布产物，应随平台适配层一起发布。保留 0.1.0 和 0.2.0 wheel 供同步回滚相应适配层。

- 版本：0.2.1
- SHA256：`02bdef75ac48cfd98cad654167bf6c89ee260eced27104df2486529160f17db8`
- 本地独立仓库：`standalone/video-subtitle-grounding`（平台 Git 忽略此目录）。
- wheel 包含提取、翻译、排版与 MediaKit 多轨压制 Python 源码及包元数据，不含配置密钥、业务数据或测试视频。

更新时在独立仓库测试并构建新版本，替换平台 `requirements.txt` 的固定文件名，再运行字幕提取、翻译、压制和多轨集成测试。生产部署通过 `scripts/deploy_server.sh` 从项目根目录安装，不依赖服务器登录 GitHub。

0.2.1 新增异步上传回调；平台使用它在 Files 上传成功后立即持久化任务到文件 ID 的关联。数据库保存失败会停止推理并清理供应商文件。任务快照字段为 `provider_file_id` 与 `provider_file_uploaded_at`，不变更提取接口响应或数据库结构。
