# 全模态参考生视频分辨率与宽高比配置 Spec

## Why

全模态参考生视频当前分辨率固定为 720p、宽高比仅支持 16:9/9:16/1:1，无法覆盖各 Seedance 模型的实际能力。用户需要按模型能力选择分辨率，并支持更完整的宽高比选项（含自动适配）。

## What Changes

- 新增“分辨率”配置项，默认 720p，按所选模型限定可选值：
  - `Seedance 2.5`：480p、720p、1080p（默认 720p）
  - `Seedance 2.0`：480p、720p、1080p、4k（默认 720p）
  - `Seedance 2.0 Fast`：480p、720p（默认 720p）
  - `Seedance 2.0 Mini`：480p、720p（默认 720p）
- 切换模型时，若当前分辨率不在新模型允许集合内，前端将分辨率收敛为该模型默认值 720p。
- 将“宽高比”可选值从 16:9/9:16/1:1 扩展为：16:9、4:3、1:1、3:4、9:16、21:9、adaptive（自动适配，四个模型通用）。
- 前后端一致校验分辨率与宽高比：后端拒绝绕过前端的非法组合（分辨率超出模型允许集合、非法宽高比）。
- 分辨率与宽高比进入工具任务输入快照，并作为独立字段（`resolution`/`ratio`）传给 Seedance 供应商；供应商元数据回填实际提交的分辨率与宽高比。
- 移除界面“固定 720p”文案。

## Impact

- Affected specs: 全模态参考生视频配置扩展、独立视频工具模块、Seedance 视频生成适配层。
- Affected code:
  - 前端：`frontend/lib/api-types.ts`（`ToolVideoGenerationRequest`）、`frontend/components/workspace/tools-workspace.tsx`（常量、工作台面板、提交映射）、前端测试。
  - 后端：`backend/app/schemas/tool_task.py`（schema 与按模型分辨率映射/校验）、`backend/app/services/modelark.py`（服务层请求类与真实/Mock adapter 映射）、`backend/app/api/routes.py`（创建与重试两处供应商请求构造）、后端测试。

## ADDED Requirements

### Requirement: 全模态生视频分辨率配置

系统 SHALL 为全模态参考生视频提供按模型能力约束的分辨率选择，并在前后端一致校验。

#### Scenario: 按模型展示合法分辨率

- **WHEN** 用户在全模态参考生视频面板选择某个 Seedance 模型
- **THEN** 分辨率选择器仅展示该模型允许的分辨率值
- **AND** `Seedance 2.5` 允许 480p、720p、1080p
- **AND** `Seedance 2.0` 允许 480p、720p、1080p、4k
- **AND** `Seedance 2.0 Fast` 与 `Seedance 2.0 Mini` 允许 480p、720p
- **AND** 未显式选择时分辨率默认值为 720p

#### Scenario: 切换模型收敛分辨率

- **WHEN** 用户切换模型且当前已选分辨率不在新模型允许集合内
- **THEN** 前端将分辨率收敛为新模型默认值 720p
- **AND** 若当前分辨率仍在新模型允许集合内则保持不变

#### Scenario: 拒绝非法分辨率

- **WHEN** 提交请求携带的分辨率不在所选模型允许集合内
- **THEN** 后端返回验证错误且不创建任务
- **AND** 前端在提交前阻止非法分辨率提交

## MODIFIED Requirements

### Requirement: 全模态参考生视频配置

系统 SHALL 在“全模态参考生视频”标签页支持按模型能力配置时长、分辨率与宽高比，并在用户提交前后验证其合法性。

#### Scenario: 配置宽高比

- **WHEN** 用户在宽高比选择器中选择取值
- **THEN** 可选值为 16:9、4:3、1:1、3:4、9:16、21:9、adaptive
- **AND** 四个 Seedance 模型均支持上述全部宽高比取值
- **AND** 选择 adaptive 时表示由供应商根据任务类型与输入内容自动适配宽高比
- **AND** 后端对非上述取值的宽高比请求返回验证错误

#### Scenario: 提交携带分辨率与宽高比

- **WHEN** 用户提交合法的全模态参考生视频配置
- **THEN** 系统将实际模型、时长、分辨率与宽高比保存到工具任务输入快照
- **AND** 系统以独立字段 `resolution` 和 `ratio` 将分辨率与宽高比传给 Seedance 供应商
- **AND** 供应商返回的元数据回填实际提交的分辨率与宽高比

### Requirement: 全模态生视频任务重试

系统 SHALL 使用原任务输入快照中的模型、合法时长、分辨率、宽高比和参考资产重试失败任务。

#### Scenario: 重试保留分辨率与宽高比

- **WHEN** 用户重试一个失败的全模态生视频任务
- **THEN** 系统重新校验快照中的模型、时长、分辨率与宽高比
- **AND** 系统复用快照中的分辨率与宽高比构造供应商请求
- **AND** 新任务保存与原任务一致的分辨率与宽高比
