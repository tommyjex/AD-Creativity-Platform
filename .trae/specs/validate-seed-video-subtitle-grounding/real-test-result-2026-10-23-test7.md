# 英文字幕测试 7 提取结果

## 测试信息

- 测试日期：2026-10-23
- 源文件：`英文字幕测试7-手机屏&首尾.mp4`
- 视频规格：1920x1080，40.92 秒，旋转 0 度
- 模型：`doubao-seed-evolving`
- 抽帧率：2.0 FPS
- 字幕条数：12
- 时间覆盖：00:00.000 - 00:41.000
- 角色统计：`headline=1`，`body=11`，`footnote=0`
- 无效片段：0
- 样式降级：无
- Token：输入 33,538，输出 1,059，总计 34,597

## 字幕明细

| # | 开始 | 结束 | 字幕文字 | 角色 | 字高比例 | 对齐 | Block / 行 | BBox（归一化） | BBox（像素） |
|---:|---:|---:|---|---|---:|---|---|---|---|
| 1 | 00:00.000 | 00:02.500 | Fault Type Troubleshooting Steps | body | 0.058 | center | `title_0 / 0` | `[255, 412, 745, 470]` | `[489, 444, 1430, 507]` |
| 2 | 00:00.000 | 00:02.500 | Failure to Charge | headline | 0.057 | center | `title_0 / 1` | `[369, 505, 630, 562]` | `[708, 545, 1209, 606]` |
| 3 | 00:02.500 | 00:09.000 | 1. First, check if the power socket is getting electricity | body | 0.043 | center | `step_1 / 0` | `[226, 855, 772, 898]` | `[433, 923, 1482, 969]` |
| 4 | 00:09.500 | 00:17.500 | 2. Do not place the floor washer back on the charging | body | 0.037 | left | `step_2 / 0` | `[218, 815, 775, 852]` | `[418, 880, 1488, 920]` |
| 5 | 00:09.500 | 00:17.500 | base when it is lying flat. | body | 0.037 | left | `step_2 / 1` | `[218, 858, 468, 895]` | `[418, 926, 898, 966]` |
| 6 | 00:17.500 | 00:25.500 | 3. Place the floor washer back on the charging base | body | 0.037 | left | `step_3 / 0` | `[230, 815, 762, 852]` | `[441, 880, 1463, 920]` |
| 7 | 00:17.500 | 00:25.500 | only after it is in an upright position. | body | 0.037 | left | `step_3 / 1` | `[230, 858, 592, 895]` | `[441, 926, 1136, 966]` |
| 8 | 00:25.500 | 00:31.000 | 4. Check if the floor washer is properly placed on the charging base. | body | 0.043 | center | `step_4 / 0` | `[146, 855, 846, 898]` | `[280, 923, 1624, 969]` |
| 9 | 00:31.000 | 00:37.000 | 5. Check if the charging contacts on the charging base and the floor | body | 0.037 | left | `step_5 / 0` | `[142, 815, 850, 852]` | `[272, 880, 1632, 920]` |
| 10 | 00:31.000 | 00:37.000 | washer are contaminated with dirt; clean them and try again. | body | 0.037 | left | `step_5 / 1` | `[142, 858, 778, 895]` | `[272, 926, 1493, 966]` |
| 11 | 00:39.000 | 00:41.000 | If the above troubleshooting steps do not resolve your issue | body | 0.046 | center | `end_0 / 0` | `[128, 332, 871, 378]` | `[245, 358, 1672, 408]` |
| 12 | 00:39.000 | 00:41.000 | please contact customer service for assistance. | body | 0.046 | center | `end_0 / 1` | `[201, 385, 797, 430]` | `[385, 415, 1530, 464]` |

## 验证结论

- 所有字幕均满足 `start_ms < end_ms`。
- 所有 BBox 均在 1000x1000 归一化坐标和视频像素边界内。
- 所有 `font_height_ratio` 均在 `(0, 1]` 范围内。
- 每个视觉行独立输出，字幕文字中不包含换行符。
- 两行字幕通过相同 `block_id` 和递增 `line_index` 保持关联。
- 本次结果没有触发角色、字号、对齐、Block 或行号回退。

## 观察

- 首屏两行标题被归为同一 `title_0` 字幕块。
- `Failure to Charge` 被识别为 `headline`；其字高比例为 `0.057`。
- `Fault Type Troubleshooting Steps` 字高比例为 `0.058`，但角色被识别为
  `body`。这说明语义角色和实测字高能够保留不同维度的信息，后续压制应以
  `font_height_ratio` 为主要字号依据，以 `visual_role` 作为语义和兜底信息。
