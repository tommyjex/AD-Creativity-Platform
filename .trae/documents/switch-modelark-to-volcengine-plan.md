# 切换生图和生视频模型到国内火山引擎 Plan

## Summary

为解决海外 BytePlus ModelArk 结果下载超时问题，将生图和生视频模型从海外 BytePlus 切回国内火山引擎。实施时更新后端 ARK 配置默认值和根目录 `.env` 覆盖值，确保运行时使用国内火山引擎 endpoint、国内模型 ID 和用户提供的新 ARK API Key。

本计划只覆盖生图、生视频和 ARK 连接配置切换；不改文本模型、不改 TOS/MySQL 配置、不改业务流程和 UI。

## Current State Analysis

### 配置读取现状

- 后端配置入口在 `backend/app/core/config.py`。
- 当前默认值：
  - `ark_image_model = "dola-seedream-5-0-pro-260628"`
  - `ark_video_model = "dreamina-seedance-2-5-260628"`
  - `ark_base_url = "https://ark.ap-southeast.bytepluses.com/api/v3"`
- `Settings.from_env()` 读取顺序：
  - `ARK_IMAGE_MODEL` 覆盖生图模型默认值。
  - `ARK_VIDEO_MODEL` 覆盖生视频模型默认值。
  - `ARK_BASE_URL` 覆盖 base URL 默认值。
  - `ARK_API_KEY` 优先，其次回退 `BYTEPLUS_ARK_API_KEY`。

### `.env` 现状

- 根目录 `.env` 当前存在旧 `BYTEPLUS_ARK_API_KEY`。
- 当前 `.env` 未显式输出到终端的 ARK 覆盖项显示中，未发现已配置 `ARK_API_KEY`、`ARK_BASE_URL`、`ARK_IMAGE_MODEL`、`ARK_VIDEO_MODEL`。
- TOS 和 DB 已配置，且与本次模型切换无关。

### 模型调用现状

- 真实生图适配层在 `backend/app/services/modelark.py` 的 `BytePlusModelArkAdapter`。
- SDK 客户端创建时使用：
  - `api_key=self.settings.ark_api_key.get_secret_value()`
  - `base_url=self.settings.ark_base_url`
  - 生图调用使用 `self.settings.ark_image_model`
  - mock/视频生成 metadata 使用 `self.settings.ark_video_model`
- 当前类名和 provider metadata 仍包含 `BytePlus` / `byteplus-modelark` 命名；这不影响功能切换，但可在计划中保守处理，避免大范围重命名。

### 测试现状

- `backend/tests/test_config.py` 断言旧海外默认 base URL 和旧 alias 行为。
- `backend/tests/test_modelark.py` 断言生图调用旧模型 `dola-seedream-5-0-pro-260628`。
- 其他测试通过 mock 服务居多，预期只需跟随模型 ID 和配置默认值更新断言。

## Proposed Changes

### 1. 更新后端 ARK 默认配置

文件：`backend/app/core/config.py`

改动：
- 将 `ark_image_model` 默认值改为：
  - `doubao-seedream-5-0-pro-260628`
- 将 `ark_video_model` 默认值改为：
  - `doubao-seedance-2-5-260628`
- 将 `ark_base_url` 默认值改为国内火山引擎 ARK endpoint：
  - `https://ark.cn-beijing.volces.com/api/v3`
- 保留 `ARK_API_KEY` 优先、`BYTEPLUS_ARK_API_KEY` 回退的兼容读取逻辑，避免历史环境直接失效。

原因：
- 让未显式配置环境变量的本地/测试环境也默认走国内火山引擎模型。
- 保留回退逻辑降低兼容风险，但 `.env` 会显式写入 `ARK_API_KEY` 避免继续使用旧 BytePlus key。

### 2. 更新根目录 `.env` 中 ARK 运行配置

文件：`.env`

改动：
- 新增或更新：
  - `ARK_API_KEY=<使用用户本次提供的新 key>`
  - `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
  - `ARK_IMAGE_MODEL=doubao-seedream-5-0-pro-260628`
  - `ARK_VIDEO_MODEL=doubao-seedance-2-5-260628`
- 保留 DB/TOS 现有配置不变。
- 旧 `BYTEPLUS_ARK_API_KEY` 可保留作为历史兼容，但运行时会被 `ARK_API_KEY` 覆盖；如果实现时发现旧 key 容易误导，可改为注释或删除，但不改变其他 `.env` 项。

安全要求：
- 不在代码、测试、计划文档或日志中明文输出新 API Key。
- 修改 `.env` 后，验证命令只检查配置是否读取到，不打印 secret 值。

### 3. 更新配置测试

文件：`backend/tests/test_config.py`

改动：
- 将默认/alias 测试中的 base URL 断言从海外 BytePlus endpoint 更新为国内火山引擎 endpoint。
- 增加或调整测试，确认：
  - `ARK_API_KEY` 优先于 `BYTEPLUS_ARK_API_KEY`。
  - 默认 `ark_image_model` 是 `doubao-seedream-5-0-pro-260628`。
  - 默认 `ark_video_model` 是 `doubao-seedance-2-5-260628`。
  - `ARK_IMAGE_MODEL` / `ARK_VIDEO_MODEL` 环境变量仍可覆盖默认值。

原因：
- 防止未来默认配置回退到海外 BytePlus。

### 4. 更新 ModelArk 适配层测试

文件：`backend/tests/test_modelark.py`

改动：
- 将生图模型调用断言从旧模型改为：
  - `doubao-seedream-5-0-pro-260628`
- 将生视频相关 metadata 或生成请求断言从旧模型改为：
  - `doubao-seedance-2-5-260628`
- 如测试 fixtures 手动构造 `Settings(ark_image_model=...)`，同步使用国内模型名。

原因：
- 确认真实 SDK 调用时传入的是国内火山引擎模型 ID。

### 5. 更新技术文档/spec 中的模型配置引用

文件：
- `.trae/specs/write-technical-solution/spec.md`
- `.trae/specs/write-technical-solution/tasks.md`
- `.trae/specs/write-technical-solution/checklist.md`
- `.trae/specs/implement-backend-modules/spec.md`
- 可能涉及 `.trae/specs/enable-character-image-iteration/spec.md`

改动：
- 将生图模型引用从 `dola-seedream-5-0-pro-260628` 更新为 `doubao-seedream-5-0-pro-260628`。
- 将生视频模型引用从 `dreamina-seedance-2-5-260628` 更新为 `doubao-seedance-2-5-260628`。
- 将 ARK base URL 示例从海外 BytePlus endpoint 更新为国内火山引擎 endpoint。
- 保留 SDK 包名 `byteplus-python-sdk-v2[ark]`，除非实现验证表明国内火山引擎需要更换 SDK；当前代码已通过 `base_url` 参数切换 endpoint。

原因：
- 用户之前要求 UI/技术方案变更要同步到 PRD/技术方案；本次模型切换属于技术方案的重要配置变更，需避免文档继续误导使用海外模型。

### 6. 可选命名清理，不作为强制范围

文件：`backend/app/services/modelark.py`

默认不做大范围类名重命名：
- 保留 `BytePlusModelArkAdapter` 类名，避免扩散式改动。
- 如需要减少误导，可只调整注释为“ModelArk adapter”，或更新 provider metadata 为更中性的 `modelark`。

不做：
- 不重命名 SDK 依赖。
- 不改前端。
- 不重构模型适配层架构。

## Assumptions & Decisions

- 国内火山引擎 ARK endpoint 使用 `https://ark.cn-beijing.volces.com/api/v3`。
- 文本模型 `ARK_TEXT_MODEL` 不在本次范围内，继续沿用现有配置。
- 新 ARK API Key 只写入 `.env` 的 `ARK_API_KEY`，不写入代码或测试。
- `.env` 中旧 `BYTEPLUS_ARK_API_KEY` 不再作为实际运行主 key；因为 `Settings` 已优先读取 `ARK_API_KEY`。
- 解决“下载超时”的主要路径是让模型生成结果从国内火山引擎返回，TOS 下载超时参数暂不调整。
- 不做真实付费模型调用，除非用户后续明确要求；本计划以配置读取和单元测试验证为主。

## Verification Steps

1. 配置读取验证：
   - 使用不打印 secret 的方式加载 `Settings.from_env()`。
   - 确认：
     - `ark_base_url == "https://ark.cn-beijing.volces.com/api/v3"`
     - `ark_image_model == "doubao-seedream-5-0-pro-260628"`
     - `ark_video_model == "doubao-seedance-2-5-260628"`
     - `ark_api_key` 存在，但不输出值。

2. 后端测试：
   - 在项目根目录运行：
     - `.venv/bin/python -m pytest backend/tests/test_config.py backend/tests/test_modelark.py -q`
   - 如通过，再运行：
     - `.venv/bin/python -m pytest backend/tests -q`

3. 静态搜索验证：
   - 使用 `rg` 搜索旧模型和海外 endpoint：
     - `dola-seedream-5-0-pro-260628`
     - `dreamina-seedance-2-5-260628`
     - `ark.ap-southeast.bytepluses.com`
   - 只允许历史说明或明确兼容说明中出现；运行默认配置和测试断言中不得再使用旧值。

4. 安全验证：
   - 确认测试输出、错误日志、文档和代码 diff 不包含新 API Key 明文。
   - 确认前端目录没有新增任何 ARK key 或模型密钥配置。

5. 服务重启建议：
   - 如果后端服务正在运行，实施完成后重启后端，使 `.env` 新配置生效。
   - 如需前端看到后端新生成结果，也可以同步重启前端，但前端代码本身不需要配置变更。
