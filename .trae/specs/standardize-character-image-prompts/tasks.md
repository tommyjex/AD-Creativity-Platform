# Tasks
- [x] Task 1: 调整角色提取提示词规范。
  - [x] SubTask 1.1: 修改角色提取提示词，要求角色描述输出人物或动物三视图、白底背景。
  - [x] SubTask 1.2: 明确禁止在角色描述中输出场景、表情演绎、肢体动作演绎或剧情化画面。
  - [x] SubTask 1.3: 将项目 Brief 的 `aspect_ratio` 注入角色描述要求，并要求输出 `画面比例：<aspect_ratio>`。

- [x] Task 2: 调整单角色形象生图提示词。
  - [x] SubTask 2.1: 修改角色卡片生图提示词组装逻辑，保留三视图、白底背景、无场景、无表情或肢体动作演绎的约束。
  - [x] SubTask 2.2: 确保最终生图提示词包含项目 Brief 的画面比例。

- [x] Task 3: 补充自动化测试。
  - [x] SubTask 3.1: 添加后端测试，验证角色提取提示词包含三视图、白底、禁止场景/动作演绎和 Brief 画面比例。
  - [x] SubTask 3.2: 添加后端测试，验证单角色形象生图提示词包含三视图、白底和 Brief 画面比例。
  - [x] SubTask 3.3: 运行 `.venv` 后端相关测试。

# Task Dependencies
- Task 2 depends on Task 1。
- Task 3 depends on Task 1 and Task 2。
