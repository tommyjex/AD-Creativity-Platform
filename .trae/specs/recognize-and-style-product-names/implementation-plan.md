# 产品名称识别与混合字体实施计划

> 执行方式：当前会话内联实施，按任务验证。用户已授权设计迭代后实施，无需再次评审；不提交、不推送、不部署、不调用计费验收接口。

**Goal:** 识别字典与未收录产品名称，翻译时保护型号/规格，使用实际 Avenir Black/Light 文件生成混合字幕 PNG，并与校对预览及平台发布集成。

**Architecture:** 独立包维护字典、结构验证、模型识别、翻译保护和无平台依赖的 PNG 编译。平台注入内部图层存储、签名 URL 与访问鉴权，保存/POST 预览自动判定并缓存。前端复用相同 PNG 图层，只读展示产品拆分，不要求人工校验。0.3.1 自动化迭代的执行记录见 [automation-plan.md](automation-plan.md)，以下 0.3.0 过程记录中已移除的交互不再适用。

**Tech Stack:** Python/Pillow/Pydantic/FastAPI/Ark Responses、TOS、React/Next.js/Vitest/Playwright。

## 文件与契约约定

- 新建独立 `product_names.py`：`CATALOG_VERSION`、`PRODUCT_CATALOG`、`catalog_mentions(text)`、`validated_mentions(text, mentions)`、`text_fingerprint(text)`、名称保护与还原。
- 新建独立 `product_layout.py`：`compile_product_layout(segment, video, width, height, limits)`；实际字体多段度量与 RGBA PNG。
- 修改独立 `translation.py`：`recognize_products(segments, segment_ids=...)`，模型范式输出经过本地结构验证；`translate()` 先识别再保护名称。
- 修改独立 `layout.py`：注册两种 Avenir，调度产品排版，返回运行时 `layers`（内容字节与缓存键），普通路径保持。
- 修改独立 `render.py`：接受 `layer_materializer` 注入，将运行时图层替换成有效图片 source 后提交；不将字节或 URL 写入摘要。
- 新建平台 `subtitle_translation_layers.py`：内部工作区隔离对象键、PNG 上传、签名 source、同源预览内容读取和内容缓存。
- 修改平台 schema/service/routes：产品标注、指纹、启用开关、分段摘要、图层 ID/同源预览路径；识别结果写回、编辑失效与显式名称识别 POST。
- 修改前端 API 类型、客户端、工作区 hook、review-dialog、segment-editor、video-preview、签名计算：PNG 预览、型号/规格自动判定展示、译文编辑失效重判。
- 发布独立 0.3.1：包含产品接口、图层物化能力和自动识别重试；平台固定 vendor wheel，保留旧版供同步回滚。

产品区间使用 code point 的 `[start,end)`，源信息 `origin` 为 `catalog/model_pattern/manual`；未收录模型结果允许 `catalog_id=null`。`product_text_sha256` 绑定最终纯文本；任何文本改变后旧产品区间与图层不能沿用。`product_names_enabled=false` 将该条按普通字幕处理。

## 任务 1：字典、区间与名称保护

文件：独立 `product_names.py`、`tests/test_product_names.py`。

- [x] 从已核对规格表建立 72 条带来源页的产品条目和独立型号匹配。
- [x] 实现最长匹配、词边界、大小写/空格识别规范化及重复名称区间。
- [x] 实现未知名称结构核对：原文存在、型号和规格可拼回原名、区间不重叠；不能以字典成员资格拒绝模型拆分。
- [x] 实现文本指纹、保护标记和还原，防止标记泄露；跨行规格需同块型号上下文佐证。
- [x] 定向测试并执行 Ruff。

核心验收样例：

```python
assert len(PRODUCT_CATALOG) == 72
assert catalog_mentions("FLOOR ONE STRETCH S6")[0]["spec"] == ""
candidate = {"start": 0, "end": 17, "model": "FLOOR ONE i5", "spec": "Lite",
             "origin": "model_pattern", "catalog_id": None}
assert validated_mentions("FLOOR ONE i5 Lite", [candidate])[0]["spec"] == "Lite"
```

测试中的具体 end 统一由 `len(text)` 计算，不手写可能错误的边界。

运行：独立 cwd `PYTHONPATH=src /Users/bytedance/AD-Creativity/.venv/bin/python -m pytest tests/test_product_names.py`，预期全部通过。

## 任务 2：模型范式识别与翻译保护

文件：独立 `translation.py`、`translation_schemas.py`、`tests/test_translation.py`、新增 `tests/test_product_translation.py`，平台 adapter 兼容。

- [x] 建立独立 strict recognition schema：记录 ID 与名称 text/model/spec，仅返回确认候选；模型看到完整 72 条范式及预算内文字上下文。
- [x] 批量识别未知型号、未知规格及组合，本地验证后与字典最长命中合并；已知正式字典拆分优先。
- [x] 对确认名称加内部标记后执行正文翻译，还原规范名称及未收录原名，并根据最终译文定位。
- [x] 返回每条名称标注、指纹和非阻断警告；计入识别及翻译总 usage；原始模型输出仅受控 TLS。
- [x] 提供独立名称识别方法，历史译文可识别而不重翻正文。
- [x] 覆盖识别失败时其他翻译仍可继续、未知结果直接进入混排、标记丢失或伪造、不确定候选与不可信字幕输入。

接口样例：

```python
recognition = await adapter.recognize_products(segments, segment_ids=["line-1"])
result = await adapter.translate(segments, segment_ids=["line-1"],
                                source_language="en", target_language="de")
assert result["product_mentions"]["line-1"][0]["origin"] == "model_pattern"
assert "FLOOR ONE i5 Lite" in result["translations"]["line-1"]
```

运行：独立与平台 adapter 相关 pytest，全部 HTTP 使用 mock，不调用真实计费模型。

## 任务 3：混合字体 PNG 编译

文件：独立 `layout.py`、`product_layout.py`、`render.py`、`tests/test_product_layout.py`、`tests/test_render_api.py`。

- [x] 注册实际 Avenir 文件；产品区间 Black/Light 优先，普通区间按人工/visual_role 解析。
- [x] 汇总各段实际 advance、bbox、ascent/descent，统一字号与共同基线，先扩框再缩小整行。
- [x] 绘制整行 RGBA 与唯一底板，保留透明边缘/overhang/空格；缺字优先使用已有可读取且覆盖的字体文件并警告。
- [x] 输出 `project/layouts/warnings/layers`；图层 source 在物化前使用明确内部标记，由提交层全部替换，不能泄露到供应商。
- [x] 注入 `layer_materializer`；物化缺失或失败时保留可读警告与明确回退，不冒充混合字体压制成功。
- [x] 测试实际文件绘制与离线 fixture 回归，确认普通字幕载荷保持。

核心验收：

```python
compiled = compile_subtitle_project(segments, video)
layer = next(iter(compiled["layers"].values()))
image = Image.open(BytesIO(layer["content"]))
assert image.mode == "RGBA"
assert compiled["project"]["track"][1][0]["type"] == "image"
assert {"product_model", "product_spec"} <= {
    run["kind"] for run in compiled["layouts"]["line-1"]["text_runs"]
}
```

运行独立 layout/render 相关 pytest，增加图层内容、透明度、字形边界、单一底板、字符覆盖及缓存指纹测试。

## 任务 4：平台识别、存储与校对

文件：平台 schema、`subtitle_translation.py`、新建 `subtitle_translation_layers.py`、API routes、对应 backend tests。

- [x] schema 增加向后兼容字段，纯文本保持；产品字段进入任务快照并参与幂等。
- [x] 翻译完成写回最终产品区间；保存或预览文本改变时重新识别字典、清空旧模型区间及旧图层。
- [x] `POST /workspaces/{id}/recognize-products` 接受草稿/revision，显式识别名称而不提取或重翻；现有权限依赖拒绝 Viewer POST。GET 工作区不触发模型计费。
- [x] 同源 `GET /workspaces/{id}/layers/{hash}.png` 校验工作区访问及 hash；内部对象键包含 workspace ID，不能任意读取其他 TOS 路径。
- [x] 图层写入内部 TOS（不进入公共资产画廊），同内容缓存和存储复用；提交刷新签名 source，工作区仅保存对象 ID 和同源路径。
- [x] 混合预览复用已生成 PNG，任务提交和记录不持久化 source/图层字节；失败上传与仍被任务引用图层的生命周期保持安全。
- [x] 更新排版/字典版本，验证相同草稿首次新任务及重复提交幂等，旧任务/成片保持。

验收样例：

```python
assert response.json()["segments"][0]["product_mentions"][0]["spec"] == "Lite"
assert not response.json()["segments"][0]["render_layer_url"].startswith("https://")
assert viewer.post(recognize_url, json=payload).status_code == 403
assert client.get(layer_url).headers["content-type"].startswith("image/png")
```

运行平台字幕工作区/预览/API/MediaKit 回归，使用 mock 存储与模型。

## 任务 5：前端混合预览及名称校对

文件：API types/client、工作区 hook、review-dialog、segment-editor、video-preview、字幕 lib 与 Vitest。

- [x] 新字段可选，旧工作区仍显示；字体目录加入两份实际 Avenir 文件 URL。
- [x] 名称区域只读显示自动判定的型号/规格与来源；整行字体标明只作用于普通文字。
- [x] 保存和 POST 排版计算自动识别历史或编辑草稿，遵守 busy/revision/conflict/只读状态；移除手动识别按钮。
- [x] PNG 图层按已有等比媒体舞台与像素 bbox 预览，失败显示文本并保留警告，不缓存旧图层。
- [x] 文字编辑、尺寸/时间/颜色变化更新草稿签名与失效，code point 转换与后端一致；派生名称结果不使草稿变脏。
- [x] Vitest 与 Playwright 覆盖未知名称返回、自动保存/预览重判、旧标注失效、只读与 PNG src；TypeScript、lint。

测试样例：

```tsx
expect(screen.getByText("FLOOR ONE i5")).toBeInTheDocument();
expect(screen.getByText("Lite")).toBeInTheDocument();
expect(screen.getByRole("button", { name: /识别产品名称/ })).toBeDisabled();
```

## 任务 6：发布与验收

- [x] 独立 0.3.0 元数据、wheel/sdist、源码归档与平台依赖统一，保留 0.2.2 回滚。
- [x] 隔离 wheel 与根 `.venv` 实际安装验证，禁止源码遮蔽；独立与平台相关回归、Ruff fatal、compileall、双方 diff 检查。
- [x] 前端 build、TypeScript、全量 lint 和字幕 Vitest；保留用户原有 `next-env.d.ts` 变更，构建更新派生类型路径。
- [x] Playwright 三视口（1440×900/834×1112/390×844）：已知/未知混排、PNG 图层、校对、旧图层失效、只读、无溢出。
- [x] 对照 checklist 记录参数、本地真实字体像素、浏览器证据与未执行的计费模型/真实 MediaKit 验收；停止本次启动的测试服务。

最终证据写入同目录 `checklist.md`；包版本、部署/重启边界与历史工作区重压制说明同步发布说明。
