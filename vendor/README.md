# Versioned subtitle backend dependency

`video_subtitle_grounding-0.3.1-py3-none-any.whl` 是平台使用的固定版本 Python 包，源码由独立 `video-subtitle-grounding` 仓库维护。wheel 是部署所需发布产物，应随平台适配层一起发布。保留 0.1.0、0.2.0、0.2.1、0.2.2 和 0.3.0 wheel 供同步回滚相应适配层。

- 版本：0.3.1
- wheel SHA256：`a146a6221ba12adc52c2b1009f49a66f9167f2b4954e0eb999e041614c392ed6`
- 源码归档：`exports/video-subtitle-grounding-0.3.1-source.tar.gz`（与独立包 sdist 字节一致）。
- 源码归档 SHA256：`c6933c7ecd3dca11711b2d6b2b5decde6965bd4835e45d88d321ef6718bca71b`
- 本地独立仓库：`standalone/video-subtitle-grounding`（平台 Git 忽略此目录）。
- wheel 包含提取、翻译、排版与 MediaKit 多轨压制 Python 源码及包元数据，不含配置密钥、业务数据或测试视频。

更新时在独立仓库测试并构建新版本，替换平台 `requirements.txt` 的固定文件名，再运行字幕提取、翻译、压制和多轨集成测试。生产部署通过 `scripts/deploy_server.sh` 从项目根目录安装，不依赖服务器登录 GitHub。

0.3.0 新增 72 条产品命名范式、未知型号/规格模型识别与名称保护。确认型号使用实际 Avenir Black，规格使用 Avenir Light，普通文字保留角色及人工字体规则。产品行用共同字号/基线绘制整行透明 PNG，平台内部 TOS 图层不进入公共资产画廊；预览读取同源鉴权 URL，供应商提交时刷新签名 URL。存储失败退回普通文字并返回警告。

0.3.1 将型号/规格判定设为全自动：翻译、保存、POST 排版计算及前端压制前保存自动识别；异常重试一次，仍失败保留普通字幕。文本、同块上下文与字典版本组成判定指纹，预览与重复保存复用结果；移除人工拆分、产品关闭和手动识别 UI，产品提示不要求人工校验。

排版版本：`single-line-adaptive-panel35-product-font-v3`；字典版本：`tineco-names-20261116-v1`。平台 JSON 新字段无需数据库迁移。线上只拉平台仓库后运行部署脚本，不拉第二个仓库；需要同时发布后端适配层、前端和 wheel 并重启。GET 读取和纯排版函数不调用模型；历史成片需重新压制才更新。回滚 0.2.2 必须同步回滚平台适配层与前端，不能只换 wheel。

本地已验证真实 Black/Light PNG、源包/wheel 一致性、安装位置和模拟接口。真实模型识别质量及真实 MediaKit 成片尚未验收，详见 `.trae/specs/recognize-and-style-product-names/checklist.md`。

0.2.2 回滚 wheel SHA256：`3108406c8e99f5877fc00eeace68beaba63f00af27272cea3fa91c551daa25ca`；源码归档 SHA256：`f71fbc66f53ffa111820f9f33ff7f119ee02f59f88686010bdb7a2157f241b56`。

0.2.2 使用 `single-line-adaptive-panel35-role-font-v2` 排版版本。自动模式逐条按 `visual_role` 选择实际字体：`headline` 使用 Century Gothic Bold，`body`、`footnote`、缺失及未知角色使用 Century Gothic Regular（不是 Light/Thin）；人工 `style.font` 覆盖优先。文件字体提交保持 `bold: false`；自动缺字回退到 `ALi_PuHui` 时只有标题请求加粗，仍保留未验证提示。回滚到 0.2.1 时需同步恢复排版版本与前端默认字体规则，不能仅替换 wheel。离线验证不代表真实 MediaKit 成片字重验收。

0.2.1 回滚 wheel SHA256：`02bdef75ac48cfd98cad654167bf6c89ee260eced27104df2486529160f17db8`。

0.2.1 新增异步上传回调；平台使用它在 Files 上传成功后立即持久化任务到文件 ID 的关联。数据库保存失败会停止推理并清理供应商文件。任务快照字段为 `provider_file_id` 与 `provider_file_uploaded_at`，不变更提取接口响应或数据库结构。
