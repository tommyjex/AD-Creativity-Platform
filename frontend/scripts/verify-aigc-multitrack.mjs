import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseUrl = process.env.FRONTEND_BASE_URL || "http://127.0.0.1:3000";
const url =
  `${baseUrl}/workspace/aigc/pipelines/acceptance-multitrack/` +
  "nodes/acceptance-multitrack/timeline";
const customFontUrl =
  "https://xujianhua-utils.tos-cn-beijing.volces.com/ECOVACS/centurygothic.ttf";
const failedFontUrl = "https://fonts.example.com/fail.ttf";
const subtitleFontUrl = "https://assets.example.com/subtitle.ttf";
const storageKey = "aigc.acceptance.multitrack.v1";
const artifactsPath =
  process.env.PLAYWRIGHT_ARTIFACTS_PATH ||
  "/tmp/ad-creativity-aigc-multitrack-acceptance";
const viewports = [
  { height: 900, name: "desktop-1440x900", width: 1440 },
  { height: 768, name: "tablet-1023x768", width: 1023 },
  { height: 844, name: "mobile-390x844", width: 390 }
];
const forbiddenRequests = [];
const results = [];

assert(
  isForbiddenUrl("https://cdn-one.example.com/fonts/title.ttf?version=1"),
  "路由守卫识别任意非本地 HTTPS TTF"
);
assert(
  isForbiddenUrl("http://cdn-two.example.com/fonts/title.OTF"),
  "路由守卫识别任意非本地 HTTP OTF"
);
assert(
  !isForbiddenUrl("http://127.0.0.1:3000/acceptance/local.ttf"),
  "路由守卫允许本地 HTTP 字体"
);
assert(
  isForbiddenUrl("https://api.example.com/mediakit/jobs"),
  "路由守卫识别 MediaKit 请求"
);

await mkdir(artifactsPath, { recursive: true });
const browser = await chromium.launch({
  args: ["--disable-breakpad", "--disable-crash-reporter"],
  downloadsPath: artifactsPath,
  headless: !process.argv.includes("--headed")
});

try {
  for (const viewport of viewports) {
    results.push(await verifyViewport(browser, viewport));
  }
  assert(
    forbiddenRequests.length === 0,
    "零真实字体/MediaKit/多轨供应商请求"
  );
  console.log(
    JSON.stringify(
      {
        artifactsPath,
        forbiddenRequests,
        result: "PASS",
        url,
        viewports: results
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}

async function verifyViewport(browser, viewport) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: viewport.height, width: viewport.width }
  });
  const consoleErrors = [];
  const pageErrors = [];
  await context.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (isForbiddenUrl(requestUrl)) {
      forbiddenRequests.push(requestUrl);
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  await context.addInitScript(() => {
    window.__aigcAcceptanceFontFaceState = { calls: [] };

    class AcceptanceFontFace {
      constructor(family, source) {
        this.family = family;
        this.source = source;
        this.record = { family, loadCount: 0, source };
        window.__aigcAcceptanceFontFaceState.calls.push(this.record);
      }

      async load() {
        this.record.loadCount += 1;
        if (this.source.includes("fail.ttf")) {
          throw new Error("Acceptance FontFace load failure");
        }
        return this;
      }
    }

    Object.defineProperty(window, "FontFace", {
      configurable: true,
      value: AcceptanceFontFace
    });
    Object.defineProperty(document.fonts, "add", {
      configurable: true,
      value: () => document.fonts
    });
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await waitUntilReady(page);

    await enterTimeline(page, viewport.name);
    assert(
      new URL(page.url()).pathname.endsWith(
        "/nodes/acceptance-multitrack/timeline"
      ),
      `${viewport.name} 位于 /timeline`
    );

    const editorBox = await page.getByTestId("aigc-timeline-editor").boundingBox();
    assert(
      editorBox &&
        Math.abs(editorBox.height - viewport.height) <= 1 &&
        Math.abs(editorBox.width - viewport.width) <= 1,
      `${viewport.name} 时间线占满视口`,
      editorBox
    );

    await page
      .getByLabel("添加上游素材")
      .selectOption({ label: "视频 · acceptance-video-source" });
    const videoClip = page.getByRole("button", {
      name: "选择片段 acceptance-video-source"
    });
    await videoClip.waitFor();
    const originalBox = await videoClip.boundingBox();
    assert(originalBox, `${viewport.name} 视频片段已创建`);
    const previewVideo = page.getByLabel(
      "背景视频 acceptance-video-source"
    );
    await previewVideo.waitFor();
    await page.waitForFunction(
      (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
      await previewVideo.elementHandle()
    );
    const previewState = await previewVideo.evaluate((element) => ({
      currentTime: element.currentTime,
      muted: element.muted,
      paused: element.paused,
      videoHeight: element.videoHeight,
      videoWidth: element.videoWidth
    }));
    assert(
      previewState.paused &&
        previewState.muted &&
        previewState.videoHeight > 0 &&
        previewState.videoWidth > 0,
      `${viewport.name} 背景视频以暂停静音帧预览`,
      previewState
    );

    const previewText = page.getByRole("button", {
      name: "选择文字 acceptance-title"
    });
    const previewTextBox = await previewText.boundingBox();
    assert(
      previewTextBox &&
        (await previewText.textContent())?.includes("Task 9 上游真实文案") &&
        (await page.getByRole("button", {
          name: "选择片段 Task 9 上游真实文案"
        }).count()) === 1,
      `${viewport.name} 画面和时间线显示实际上游文字`
    );
    await page.mouse.move(
      previewTextBox.x + previewTextBox.width / 2,
      previewTextBox.y + previewTextBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      previewTextBox.x + previewTextBox.width / 2 + 24,
      previewTextBox.y + previewTextBox.height / 2 - 12
    );
    await page.mouse.up();
    const movedPreviewTextBox = await previewText.boundingBox();
    assert(
      movedPreviewTextBox &&
        movedPreviewTextBox.x > previewTextBox.x + 12 &&
        movedPreviewTextBox.y < previewTextBox.y - 5,
      `${viewport.name} 预览文字拖拽生效`,
      { movedPreviewTextBox, previewTextBox }
    );
    const resizeHandle = previewText.getByRole("button", {
      name: "从右下角缩放 acceptance-title"
    });
    const resizeHandleBox = await resizeHandle.boundingBox();
    assert(resizeHandleBox, `${viewport.name} 文字缩放手柄可达`);
    await page.mouse.move(
      resizeHandleBox.x + resizeHandleBox.width / 2,
      resizeHandleBox.y + resizeHandleBox.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      resizeHandleBox.x + resizeHandleBox.width / 2 + 24,
      resizeHandleBox.y + resizeHandleBox.height / 2 + 8
    );
    await page.mouse.up();
    const resizedPreviewTextBox = await previewText.boundingBox();
    assert(
      resizedPreviewTextBox &&
        movedPreviewTextBox &&
        resizedPreviewTextBox.width > movedPreviewTextBox.width + 12,
      `${viewport.name} 预览文字等比缩放生效`,
      { movedPreviewTextBox, resizedPreviewTextBox }
    );
    await page.getByRole("button", { name: "撤销" }).click();
    await page.getByRole("button", { name: "撤销" }).click();

    let inspector = await openInspector(page, viewport);
    const upstreamTextPreview = inspector.getByLabel("上游文字预览");
    assert(
      (await upstreamTextPreview.inputValue()) === "Task 9 上游真实文案" &&
        (await upstreamTextPreview.getAttribute("readonly")) !== null,
      `${viewport.name} 检查器只读显示实际上游文字`
    );
    await inspector.getByRole("button", { name: "转为内联文字" }).click();
    assert(
      (await inspector.getByLabel("内联文字").inputValue()) ===
        "Task 9 上游真实文案",
      `${viewport.name} 显式转换为内联文字`
    );
    if (viewport.width < 1024) {
      await closeInspector(page, viewport);
    }
    await page.getByRole("button", { name: "撤销" }).click();
    if (viewport.width < 1024) {
      inspector = await openInspector(page, viewport);
    }
    assert(
      (await inspector.getByLabel("上游文字预览").inputValue()) ===
        "Task 9 上游真实文案",
      `${viewport.name} 一次撤销恢复上游绑定`
    );
    await inspector.getByRole("button", { name: "选择文字颜色" }).click();
    const colorPicker = page.getByRole("dialog", {
      name: "文字颜色选择器"
    });
    await colorPicker.waitFor();
    const colorPickerBox = await colorPicker.boundingBox();
    assert(
      colorPickerBox &&
        colorPickerBox.x >= 0 &&
        colorPickerBox.y >= 0 &&
        colorPickerBox.x + colorPickerBox.width <= viewport.width &&
        colorPickerBox.y + colorPickerBox.height <= viewport.height,
      `${viewport.name} 颜色浮层避让视口边缘`,
      colorPickerBox
    );
    const textAlpha = colorPicker.getByLabel("文字颜色透明度");
    await textAlpha.dispatchEvent("pointerdown", {
      isPrimary: true,
      pointerId: 11
    });
    await textAlpha.fill("25");
    await textAlpha.dispatchEvent("pointerup", {
      isPrimary: true,
      pointerId: 11
    });
    await inspector
      .getByLabel("文字颜色 RGBA")
      .waitFor({ state: "visible" });
    assert(
      (await inspector.getByLabel("文字颜色 RGBA").inputValue()) ===
        "#FFFFFF40",
      `${viewport.name} 透明度滑块与 RGBA 输入实时同步`
    );
    const previewColor = await page
      .getByTestId("preview-element-acceptance-title")
      .evaluate((element) =>
        getComputedStyle(element.firstElementChild ?? element).color
      );
    assert(
      previewColor.includes("0.25") || previewColor.includes("0.251"),
      `${viewport.name} 文字颜色实时更新到画面预览`,
      previewColor
    );
    await page.keyboard.press("Escape");
    if (viewport.width < 1024) {
      await closeInspector(page, viewport);
    }
    await page.getByRole("button", { name: "撤销" }).click();
    if (viewport.width < 1024) {
      inspector = await openInspector(page, viewport);
    }
    assert(
      (await inspector.getByLabel("文字颜色 RGBA").inputValue()) ===
        "#FFFFFFFF",
      `${viewport.name} 一次撤销恢复完整颜色手势`
    );

    const presetSelect = inspector.getByRole("combobox", {
      name: "预置字体"
    });
    assert(
      (await presetSelect.inputValue()) === "SY_Black",
      `${viewport.name} fixture 初始为非 ALi_PuHui 预置字体`
    );
    await presetSelect.selectOption("ALi_PuHui");
    assert(
      await inspector
        .getByText("预置字体仅用于 MediaKit 合成，最终字形以 MediaKit 合成为准。")
        .isVisible(),
      `${viewport.name} 显示预置字体 MediaKit 提示`
    );
    await assertInspectorLayout(inspector, viewport.name);
    await closeInspector(page, viewport);
    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    assert(
      (await storedTitleFont(page)) === "ALi_PuHui",
      `${viewport.name} ALi_PuHui 保存到 fixture`
    );

    inspector = await openInspector(page, viewport);
    await inspector.getByRole("button", { name: "自定义 URL" }).click();
    const fontUrlInput = inspector.getByLabel("字体文件 URL");
    await fontUrlInput.fill(customFontUrl);
    await fontUrlInput.press("Enter");
    const successfulFont = await waitForFontFace(page, customFontUrl);
    assert(
      successfulFont.loadCount === 1 &&
        successfulFont.family.startsWith("aigc-custom-font-") &&
        successfulFont.source === `url("${customFontUrl}")`,
      `${viewport.name} FontFace 记录成功字体 family/source/load 次数`,
      successfulFont
    );
    const appliedFamily = await computedPreviewFontFamily(
      page,
      "acceptance-title"
    );
    assert(
      appliedFamily.includes(successfulFont.family),
      `${viewport.name} 成功自定义字体应用稳定 aigc family`,
      { appliedFamily, successfulFont }
    );
    await assertInspectorLayout(inspector, viewport.name);
    await closeInspector(page, viewport);
    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    assert(
      (await storedTitleFont(page)) === customFontUrl,
      `${viewport.name} 示例 TTF URL 保存到 fixture`
    );

    await page.reload({ waitUntil: "networkidle" });
    await waitUntilReady(page);
    await enterTimeline(page, viewport.name);
    await previewText.click();
    inspector = await openInspector(page, viewport);
    assert(
      await inspector
        .getByRole("button", { name: "自定义 URL" })
        .getAttribute("aria-pressed") === "true" &&
        (await inspector.getByLabel("字体文件 URL").inputValue()) ===
          customFontUrl,
      `${viewport.name} 示例 TTF URL 重载恢复`
    );
    const restoredFont = await waitForFontFace(page, customFontUrl);
    const restoredFamily = await computedPreviewFontFamily(
      page,
      "acceptance-title"
    );
    assert(
      restoredFont.family === successfulFont.family &&
        restoredFamily.includes(successfulFont.family),
      `${viewport.name} 自定义字体重载后 family 稳定`,
      { restoredFamily, restoredFont, successfulFont }
    );

    const restoredFontInput = inspector.getByLabel("字体文件 URL");
    await restoredFontInput.fill("http://fonts.example.com/title.woff2");
    await restoredFontInput.blur();
    assert(
      await inspector
        .getByText("请输入公网 HTTPS TTF/OTF 字体文件 URL。")
        .isVisible(),
      `${viewport.name} 非法字体 URL 显示门禁提示`
    );
    assert(
      await page.getByRole("button", { name: "保存到节点" }).isDisabled(),
      `${viewport.name} 非法字体 URL 禁止保存`
    );
    assert(
      await page.getByRole("button", { name: "执行剪辑" }).isDisabled(),
      `${viewport.name} 非法字体 URL 禁止执行`
    );
    await assertInspectorLayout(inspector, viewport.name);
    await restoredFontInput.fill(failedFontUrl);
    await restoredFontInput.press("Enter");
    const failedFont = await waitForFontFace(page, failedFontUrl);
    await inspector
      .getByText("浏览器无法加载字体，MediaKit 合成仍会尝试使用该 URL")
      .waitFor();
    assert(
      failedFont.loadCount === 1 &&
        failedFont.source === `url("${failedFontUrl}")`,
      `${viewport.name} 合法 fail.ttf 触发 FontFace reject`,
      failedFont
    );
    const fallbackFamily = await computedPreviewFontFamily(
      page,
      "acceptance-title"
    );
    assert(
      !fallbackFamily.includes("aigc-custom-font-"),
      `${viewport.name} 字体加载失败回退系统字体`,
      { fallbackFamily }
    );
    assert(
      await page.getByRole("button", { name: "保存到节点" }).isEnabled(),
      `${viewport.name} 字体加载失败仍允许保存`
    );
    assert(
      await page.getByRole("button", { name: "执行剪辑" }).isEnabled(),
      `${viewport.name} 字体加载失败仍允许执行`
    );
    await closeInspector(page, viewport);
    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    assert(
      (await storedElementFont(page, "acceptance-title")) === failedFontUrl,
      `${viewport.name} fail.ttf URL 作为软失败状态保存`
    );

    await page
      .getByRole("button", { name: "选择片段 acceptance-subtitle-asset" })
      .click();
    inspector = await openInspector(page, viewport);
    const subtitlePreset = inspector.getByRole("combobox", {
      name: "预置字体"
    });
    assert(
      (await subtitlePreset.inputValue()) === "SY_Black",
      `${viewport.name} 字幕 fixture 初始预置字体可选择`
    );
    await subtitlePreset.selectOption("ALi_PuHui");
    await closeInspector(page, viewport);
    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    assert(
      (await storedElementFont(page, "acceptance-subtitle")) === "ALi_PuHui",
      `${viewport.name} 字幕预置字体保存`
    );

    inspector = await openInspector(page, viewport);
    await inspector.getByRole("button", { name: "自定义 URL" }).click();
    const subtitleFontInput = inspector.getByLabel("字体文件 URL");
    await subtitleFontInput.fill(subtitleFontUrl);
    await subtitleFontInput.press("Enter");
    const subtitleFont = await waitForFontFace(page, subtitleFontUrl);
    assert(
      subtitleFont.loadCount === 1 &&
        subtitleFont.family.startsWith("aigc-custom-font-"),
      `${viewport.name} 字幕自定义字体调用 FontFace`,
      subtitleFont
    );
    await closeInspector(page, viewport);
    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    assert(
      (await storedElementFont(page, "acceptance-subtitle")) === subtitleFontUrl,
      `${viewport.name} 字幕自定义字体保存`
    );

    const titleTrackActions = page.getByRole("button", {
      name: "轨道操作：标题轨道"
    });
    await titleTrackActions.click();
    const trackMenu = page.getByRole("menu", {
      name: "标题轨道轨道菜单"
    });
    const trackMenuBox = await trackMenu.boundingBox();
    assert(
      trackMenuBox &&
        trackMenuBox.x >= 0 &&
        trackMenuBox.y >= 0 &&
        trackMenuBox.x + trackMenuBox.width <= viewport.width &&
        trackMenuBox.y + trackMenuBox.height <= viewport.height,
      `${viewport.name} 轨道菜单避让视口边缘`,
      trackMenuBox
    );
    await trackMenu.getByRole("menuitem", { name: "删除轨道" }).click();
    const deleteDialog = page.getByRole("dialog", {
      name: "删除轨道“标题轨道”"
    });
    await deleteDialog.waitFor();
    const deleteDialogBox = await deleteDialog.boundingBox();
    assert(
      deleteDialogBox &&
        deleteDialogBox.x >= 0 &&
        deleteDialogBox.y >= 0 &&
        deleteDialogBox.x + deleteDialogBox.width <= viewport.width &&
        deleteDialogBox.y + deleteDialogBox.height <= viewport.height &&
        (await deleteDialog
          .getByText("轨道内 1 个片段将一并删除。")
          .isVisible()),
      `${viewport.name} 非空轨道显示片段数量确认`,
      deleteDialogBox
    );
    await deleteDialog.getByRole("button", { name: "取消" }).click();
    assert(
      await page.getByTitle("标题轨道").isVisible(),
      `${viewport.name} 取消删除保留轨道`
    );
    await titleTrackActions.click();
    await page.getByRole("menuitem", { name: "删除轨道" }).click();
    await page.getByRole("button", { name: "确认删除轨道" }).click();
    assert(
      (await page.getByTitle("标题轨道").count()) === 0,
      `${viewport.name} 确认删除轨道及片段`
    );
    await page.getByRole("button", { name: "撤销" }).click();
    assert(
      (await page.getByTitle("标题轨道").count()) === 1 &&
        (await page.getByRole("button", {
          name: "选择片段 Task 9 上游真实文案"
        }).count()) === 1,
      `${viewport.name} 一次撤销恢复轨道及片段`
    );

    await videoClip.hover();
    await page.mouse.move(originalBox.x + 24, originalBox.y + 18);
    await page.mouse.down();
    await page.mouse.move(originalBox.x + 68, originalBox.y + 18);
    await page.mouse.up();
    const movedBox = await videoClip.boundingBox();
    assert(
      movedBox && movedBox.x > originalBox.x + 20,
      `${viewport.name} 片段拖拽生效`
    );
    await page.getByRole("button", { name: "撤销" }).click();

    if (viewport.width < 600) {
      await page
        .getByTestId("timeline-scroll-area")
        .evaluate((element) => {
          element.scrollLeft = 250;
        });
    }
    await videoClip.hover();
    const rightTrim = videoClip.getByLabel("向右裁切");
    const trimBox = await rightTrim.boundingBox();
    const visibleClipBox = await videoClip.boundingBox();
    assert(visibleClipBox && trimBox, `${viewport.name} 裁切控制可达`);
    await page.mouse.move(trimBox.x + trimBox.width / 2, trimBox.y + 8);
    await page.mouse.down();
    await page.mouse.move(trimBox.x - 40, trimBox.y + 8);
    await page.mouse.up();
    const trimmedBox = await videoClip.boundingBox();
    assert(
      trimmedBox && trimmedBox.width < visibleClipBox.width - 20,
      `${viewport.name} 片段裁切生效`
    );
    await page.getByRole("button", { name: "撤销" }).click();
    if (viewport.width < 600) {
      await page
        .getByTestId("timeline-scroll-area")
        .evaluate((element) => {
          element.scrollLeft = 0;
        });
    }

    const ruler = page.getByRole("button", { name: "时间标尺" });
    const rulerBox = await ruler.boundingBox();
    assert(rulerBox, `${viewport.name} 时间标尺可达`);
    await page.mouse.click(rulerBox.x + 176, rulerBox.y + 14);
    await page.waitForTimeout(100);
    const playheadLeft = await page
      .getByTestId("timeline-playhead")
      .evaluate((element) => Number.parseFloat(element.style.left));
    const clipBeforeSplit = await videoClip.boundingBox();
    assert(
      clipBeforeSplit &&
        playheadLeft > 0 &&
        playheadLeft < clipBeforeSplit.width,
      `${viewport.name} 播放头位于片段内部`,
      { clipBeforeSplit, playheadLeft }
    );
    await videoClip.click();
    await videoClip.hover();
    await videoClip
      .getByRole("button", { name: "在播放头分割" })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelectorAll(
          '[aria-label="选择片段 acceptance-video-source"]'
        ).length === 2
    );
    assert(
      (await page.getByRole("button", {
        name: "选择片段 acceptance-video-source"
      }).count()) === 2,
      `${viewport.name} 播放头分割生效`
    );

    const firstSplitClip = page
      .getByRole("button", { name: "选择片段 acceptance-video-source" })
      .first();
    await firstSplitClip.click();
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "打开检查器" }).click();
      await page
        .getByTestId("mobile-inspector-drawer")
        .waitFor({ state: "visible" });
    }
    inspector =
      viewport.width < 1024
        ? page.getByTestId("mobile-inspector-drawer")
        : page.getByRole("complementary", { name: "属性检查器" });
    await inspector.getByLabel("音量").fill("0.8");
    assert(
      (await inspector.getByLabel("音量").inputValue()) === "0.8",
      `${viewport.name} 检查器精确编辑生效`
    );
    if (viewport.width < 1024) {
      await page.getByRole("button", { name: "关闭检查器" }).click();
      await page.waitForFunction(() => {
        const drawer = document.querySelector(
          '[data-testid="mobile-inspector-drawer"]'
        );
        return (
          drawer instanceof HTMLElement &&
          drawer.dataset.state === "closed" &&
          getComputedStyle(drawer).opacity === "0"
        );
      });
    }

    if (viewport.width >= 1024) {
      await page.getByTitle("视频轨道").click();
      await inspector.getByLabel("轨道名称").fill("主视频轨道");
      const videoTrackActions = page.getByRole("button", {
        name: "轨道操作：主视频轨道"
      });
      await videoTrackActions.click();
      await page.getByRole("menuitem", { name: "轨道静音" }).click();
      await videoTrackActions.click();
      await page.getByRole("menuitem", { name: "取消静音" }).click();
      assert(
        await page.getByTitle("主视频轨道").isVisible(),
        `${viewport.name} 轨道重命名与静音可用`
      );
    }

    await page.getByRole("button", { name: "保存到节点" }).click();
    await page.getByText("草稿已保存。").waitFor();
    const stored = await page.evaluate((key) => localStorage.getItem(key), storageKey);
    assert(Boolean(stored), `${viewport.name} 草稿保存到 fixture`);

    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}-timeline.png`
    });
    const layout = await inspectLayout(page);
    assert(
      layout.documentOverflow <= 1,
      `${viewport.name} 页面无横向异常溢出`,
      layout
    );
    assert(
      layout.overlaps.length === 0,
      `${viewport.name} 顶部文本与控件无重叠`,
      layout.overlaps
    );

    await page.getByRole("button", { name: "执行剪辑" }).click();
    await page.getByText("状态：失败 · Attempt 1").waitFor();
    await page.getByRole("button", { name: "重试失败节点" }).click();
    await page.getByText("状态：成功 · Attempt 2").waitFor();

    const video = page.getByLabel("播放视频：多轨剪辑 Mock 成片.mp4");
    await video.waitFor();
    await page.waitForFunction(
      (element) => element.readyState >= HTMLMediaElement.HAVE_METADATA,
      await video.elementHandle()
    );
    const media = await video.evaluate((element) => ({
      duration: element.duration,
      height: element.videoHeight,
      width: element.videoWidth
    }));
    assert(
      media.duration > 0 && media.height > 0 && media.width > 0,
      `${viewport.name} Mock 成片可播放`,
      media
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "下载多轨成片" }).click();
    const download = await downloadPromise;
    assert(
      download.suggestedFilename() === "多轨剪辑-Mock-成片.mp4",
      `${viewport.name} 成片下载文件名正确`
    );
    assert(
      (await download.createReadStream()) !== null,
      `${viewport.name} 成片下载内容可读取`
    );
    await page.screenshot({
      fullPage: true,
      path: `${artifactsPath}/${viewport.name}-result.png`
    });

    await page.getByRole("button", { name: "关闭 Mock 结果" }).click();
    await page.getByRole("button", { name: "执行剪辑" }).click();
    await page.getByText("状态：缓存复用 · Attempt 2").waitFor();
    assert(
      await page.getByText("缓存命中：复用 Attempt 2 的可用成片。").isVisible(),
      `${viewport.name} 相同输入命中缓存`
    );

    assert(consoleErrors.length === 0, `${viewport.name} 控制台无新增错误`, {
      consoleErrors
    });
    assert(pageErrors.length === 0, `${viewport.name} 页面无运行时错误`, {
      pageErrors
    });
    return {
      consoleErrors,
      media,
      name: viewport.name,
      pageErrors,
      screenshots: [
        `${artifactsPath}/${viewport.name}-timeline.png`,
        `${artifactsPath}/${viewport.name}-result.png`
      ]
    };
  } finally {
    await context.close();
  }
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const toolbar = document.querySelector(
      '[aria-label="时间线编辑操作"]'
    );
    const controls = toolbar
      ? [...toolbar.querySelectorAll("button, h1, p, span")].filter(
          (element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width > 0 &&
              rect.height > 0
            );
          }
        )
      : [];
    const overlaps = [];
    for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < controls.length;
        rightIndex += 1
      ) {
        const left = controls[leftIndex];
        const right = controls[rightIndex];
        if (left.contains(right) || right.contains(left)) continue;
        const a = left.getBoundingClientRect();
        const b = right.getBoundingClientRect();
        const overlapWidth = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapHeight =
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapWidth > 1 && overlapHeight > 1) {
          overlaps.push(
            `${left.tagName}:${left.textContent?.trim()} <> ` +
              `${right.tagName}:${right.textContent?.trim()}`
          );
        }
      }
    }
    return {
      documentOverflow: root.scrollWidth - window.innerWidth,
      overlaps
    };
  });
}

async function enterTimeline(page, viewportName) {
  await page.getByRole("button", { name: "添加多轨剪辑" }).click();
  await page.getByRole("button", { name: "添加视频结果节点" }).click();
  await page.getByRole("button", { name: "连接完整流程" }).click();
  assert(
    (await page.locator(".react-flow__edge").count()) === 2,
    `${viewportName} 创建并连接多轨节点`
  );
  await page.getByRole("button", { name: "进入全屏时间线" }).click();
  await page.getByTestId("aigc-timeline-editor").waitFor();
}

async function openInspector(page, viewport) {
  if (viewport.width < 1024) {
    await page.getByRole("button", { name: "打开检查器" }).click();
    const drawer = page.getByTestId("mobile-inspector-drawer");
    await drawer.waitFor({ state: "visible" });
    return drawer.getByRole("complementary", { name: "属性检查器" });
  }
  return page.getByRole("complementary", { name: "属性检查器" });
}

async function closeInspector(page, viewport) {
  if (viewport.width >= 1024) return;
  await page.getByRole("button", { name: "关闭检查器" }).click();
  await page.waitForFunction(() => {
    const drawer = document.querySelector(
      '[data-testid="mobile-inspector-drawer"]'
    );
    return (
      drawer instanceof HTMLElement &&
      drawer.dataset.state === "closed" &&
      getComputedStyle(drawer).opacity === "0"
    );
  });
}

async function storedTitleFont(page) {
  return storedElementFont(page, "acceptance-title");
}

async function storedElementFont(page, elementId) {
  return page.evaluate(({ elementId: id, storageKey: key }) => {
    const value = localStorage.getItem(key);
    if (!value) return undefined;
    const config = JSON.parse(value);
    const element = config.tracks
      .flatMap((track) => track.elements)
      .find((candidate) => candidate.id === id);
    return element?.style?.font_type;
  }, { elementId, storageKey });
}

async function waitForFontFace(page, fontUrl) {
  const handle = await page.waitForFunction((url) => {
    const calls = window.__aigcAcceptanceFontFaceState?.calls ?? [];
    return calls.find(
      (call) => call.source.includes(url) && call.loadCount > 0
    );
  }, fontUrl);
  return handle.jsonValue();
}

async function computedPreviewFontFamily(page, elementId) {
  return page
    .getByTestId(`preview-element-${elementId}`)
    .evaluate((element) => getComputedStyle(element).fontFamily);
}

async function assertInspectorLayout(inspector, viewportName) {
  const layout = await inspector.evaluate((element) => {
    const root = element.getBoundingClientRect();
    const clippedLabels = [...element.querySelectorAll("label, legend, p")]
      .filter((candidate) => {
        const style = getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0 &&
          (rect.left < root.left - 1 || rect.right > root.right + 1)
        );
      })
      .map((candidate) => candidate.textContent?.trim())
      .filter(Boolean);
    return {
      clippedLabels,
      horizontalOverflow: element.scrollWidth - element.clientWidth
    };
  });
  assert(
    layout.horizontalOverflow <= 1,
    `${viewportName} 字体检查器无横向溢出`,
    layout
  );
  assert(
    layout.clippedLabels.length === 0,
    `${viewportName} 字体检查器标签无裁切`,
    layout
  );
}

function isForbiddenUrl(value) {
  const parsed = new URL(value);
  const hostname = parsed.hostname.toLowerCase();
  const isHttp = parsed.protocol === "http:" || parsed.protocol === "https:";
  const isLocal =
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname);
  const isExternalFont =
    isHttp &&
    !isLocal &&
    /\.(?:ttf|otf)$/i.test(parsed.pathname);
  return (
    hostname.includes("mediakit") ||
    /mediakit/i.test(parsed.pathname) ||
    isExternalFont ||
    /\/multi-track-edit(?:[/?#]|$)/i.test(parsed.pathname)
  );
}

async function waitUntilReady(page) {
  await page.waitForFunction(
    () =>
      document
        .querySelector('[data-testid="multitrack-acceptance"]')
        ?.getAttribute("data-ready") === "true"
  );
}

function assert(condition, label, detail = null) {
  if (!condition) {
    throw new Error(
      `ASSERT FAIL ${label}${detail === null ? "" : `: ${JSON.stringify(detail)}`}`
    );
  }
  console.log(`ASSERT PASS ${label}`);
}
