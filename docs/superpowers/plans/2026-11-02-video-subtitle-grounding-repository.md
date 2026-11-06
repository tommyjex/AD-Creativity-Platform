# Video subtitle grounding repository implementation plan

**Goal:** 将 Ark 视频字幕提取拆为可独立安装、测试和运行的仓库，保持当前平台的接口和提取行为。

**Architecture:** 独立仓库位于 `standalone/video-subtitle-grounding`，采用 `src/video_subtitle_grounding` 包布局。平台保留鉴权、任务、资产和 TLS 生命周期，通过薄兼容层调用包。发布前使用固定版本 wheel 作为平台依赖，避免服务器部署依赖本地独立仓库目录。

**Tech Stack:** Python 3.11+、FastAPI、Pydantic 2、HTTPX、Ark SDK、FFprobe、pytest、Ruff、setuptools。

用户已确认拆分方案并要求开始执行；本会话内执行，不启动子代理，不自动提交或推送代码。

## 1. 提取核心

- [x] 复制提取 schema、provider、media、validation、service 及对应离线测试。
- [x] 删除对 `backend` 的依赖；单独抽出视频 metadata parser。
- [x] 提供最小独立 Settings，保持现有 Ark 配置名、Files API、thinking disabled、16384 tokens 默认值。
- [x] service 注入结构化日志和 TLS-only debug 回调；保留取消、临时文件和 provider 文件清理。

## 2. 独立服务与仓库

- [x] 新建 `pyproject.toml`、版本号、`.gitignore`、`.env.example`、Dockerfile、CI 和中文 README。
- [x] FastAPI 提供 `/health`、`/v1/subtitles/extract`；使用 API Key、并发限制、稳定错误结构。
- [x] API 启动校验 Ark 和启用时的 TLS 配置；SDK 使用不依赖 Web 服务配置。
- [x] 本地初始化独立 Git 仓库；不继承原仓库历史和凭据。

## 3. 平台兼容

- [x] 使用 `vendor/video_subtitle_grounding-0.1.0-py3-none-any.whl` 安装固定版本。
- [x] 将原提取模块改为兼容导出或配置、日志注入层；保留原路径和原鉴权。
- [x] 保持翻译 service 的 prepared-video 调用和原结果模型兼容。
- [x] 文档说明 wheel 更新、独立部署和后续远端版本安装方式。

## 4. 验证与交付

- [x] 独立仓库离线测试不加载平台 `.env`、不访问数据库、不调用付费模型。
- [x] 安装 wheel 后从独立目录验证 import、API 鉴权、错误处理和成功响应。
- [x] 平台字幕提取与翻译集成回归；Ruff 致命检查、编译、`git diff --check`。
- [x] 核对 GitHub CLI 和登录状态；CLI 可运行，尚未登录，因此尚未创建或推送远端仓库。

## 本地交付状态

独立仓库源码与 wheel 已完成；本地 Git 分支 `main`，未创建提交。源码仓库被平台 `.gitignore` 排除，平台通过 `vendor/` 中的 wheel 安装固定版本。源码归档作为本地交付备份。

GitHub 发布尚需用户完成登录并明确首个提交和推送授权。建议目标为 `tommyjex/video-subtitle-grounding` 私有仓库；该地址尚未创建，不能作为现有仓库链接。

## 验证结果

- 独立源码与隔离环境安装的 wheel：各 179 项离线测试通过，包含 TLS 签名、重试、队列、关闭清理。
- 平台提取和翻译集成：247 项通过；共享媒体异常、TLS 和核心提取追加回归：73 项通过（包含部分重叠测试，不相加为独立用例总数）。
- 部署脚本回归全部通过，包含 pip 从 `APP_ROOT` 解析相对 wheel 路径。
- Ruff、编译和 diff 空白检查通过；隔离环境 `pip check` 通过。
- 真实 Ark SDK 客户端和独立 FastAPI 启停通过；没有执行付费提取。
- wheel SHA256：`a624c11143bc0bdc8514dd77adfa51d82a5874e22d923808811ea4ef9b2684d3`。
- 源码归档：`exports/video-subtitle-grounding-0.1.0-source.tar.gz`，27 个白名单文件，不含 `.git`、生产配置、缓存或用户视频。
- Docker 构建、GitHub Actions、真实 OCR 和生产部署尚未执行。

真实 OCR 质量不以 mock 回归替代；本次迁移验证调用契约与兼容性，未授权额外付费识别。
