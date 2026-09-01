# 修复 AIGC 视频输出全屏 Spec

## Why

AIGC 视频输出节点内的浏览器原生视频全屏控件无法正常进入全屏。当前共享播放器在视频容器上拦截完整的指针、鼠标、触摸和键盘事件链，虽然隔离了 React Flow 画布手势，但也可能干扰浏览器原生媒体控件。

## What Changes

- 收窄 AIGC 共享视频播放器的画布事件隔离范围，保留 `nodrag`、`nowheel` 等 React Flow 交互约束。
- 确保视频输出节点中的原生全屏控件可进入和退出浏览器全屏，且不会触发节点拖拽、画布平移或节点选择副作用。
- 保持现有播放、暂停、进度、音量、元数据读取、等比显示和放大预览行为。
- 对共享播放器的节点、结果面板、放大预览及视频输入使用场景增加回归覆盖。
- 不修改后端接口、资产模型、Run 数据或视频文件本身。

## Impact

- Affected specs: AIGC 视频输出节点、AIGC 视频输入节点、React Flow 节点交互
- Affected code:
  - `frontend/components/workspace/aigc/aigc-video-player.tsx`
  - `frontend/components/workspace/aigc/aigc-flow-node.tsx`
  - `frontend/components/workspace/aigc/aigc-editor.tsx`
  - `frontend/tests/aigc-video-player.test.tsx`
  - 相关浏览器验收

## ADDED Requirements

### Requirement: 视频输出节点原生全屏

系统 SHALL 允许用户通过视频输出节点播放器自带的浏览器原生全屏控件进入和退出全屏。

#### Scenario: 从视频输出节点进入全屏

- **WHEN** 视频输出节点具有可用视频，且用户点击播放器原生全屏控件
- **THEN** 浏览器进入视频全屏或平台提供的原生媒体全屏
- **AND** 视频保持原始宽高比，不裁切或拉伸
- **AND** 当前播放位置、暂停状态和音量状态不因进入全屏而被重置
- **AND** 该操作不得触发节点拖拽、画布平移或意外关闭当前工作区

#### Scenario: 退出全屏

- **WHEN** 用户通过浏览器原生方式退出视频全屏
- **THEN** 播放器返回原视频输出节点
- **AND** 节点布局、尺寸和画布缩放保持进入全屏前的状态
- **AND** 播放器仍可继续使用播放、进度、音量和全屏控件

#### Scenario: 浏览器不支持标准全屏能力

- **WHEN** 当前浏览器或运行环境不提供标准 Fullscreen API，而是使用平台原生媒体全屏
- **THEN** 系统不得阻止该平台的原生全屏行为
- **AND** 不得抛出未处理异常
- **AND** 现有“放大预览”弹窗仍可作为独立预览入口

### Requirement: 全屏交互回归保护

系统 SHALL 在恢复原生媒体控件事件链的同时，维持视频播放器与 React Flow 画布之间的交互隔离。

#### Scenario: 操作节点内原生媒体控件

- **WHEN** 用户在视频输出节点中播放、暂停、拖动进度、调整音量或切换全屏
- **THEN** 对应浏览器原生控件正常响应
- **AND** React Flow 不得开始拖动节点或平移画布
- **AND** 视频控件区域继续阻止滚轮事件缩放画布

#### Scenario: 使用共享播放器的其他视图

- **WHEN** 用户在结果面板、放大预览弹窗或视频输入节点中使用共享播放器
- **THEN** 播放、等比展示、元数据展示和原生控件保持可用
- **AND** 非 React Flow 容器不得因节点专用事件隔离逻辑受到额外限制

## MODIFIED Requirements

### Requirement: 视频输出节点

系统 SHALL 提供不创建任务的 `video_output` 节点，用于展示所选运行的视频结果。可用结果 SHALL 在节点和右侧结果面板中通过共享播放器播放；播放器 SHALL 保持原始宽高比，提供可工作的浏览器原生播放、进度、音量和全屏控件，并保留现有放大预览与受控下载入口。

#### Scenario: 查看和全屏播放视频结果

- **WHEN** 视频输出节点连接到成功的生视频节点
- **THEN** 节点与右侧结果面板显示可播放视频
- **AND** 播放器使用固定媒体区并保持视频原始宽高比
- **AND** 用户可通过浏览器原生全屏控件进入和退出全屏
- **AND** 展示可获得的分辨率、时长、是否含音频和文件状态

## REMOVED Requirements

无。
