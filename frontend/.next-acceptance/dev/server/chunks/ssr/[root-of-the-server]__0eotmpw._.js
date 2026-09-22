module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

var mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/workspace/aigc/acceptance/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AigcAcceptancePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$upstream$2d$precise$2d$edit$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$face$2d$blur$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$fullscreen$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$enhancement$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/download.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
const MOCK_VIDEO_ASSET = {
    asset_id: "acceptance-video",
    ordinal: 0,
    mime_type: "video/mp4",
    download_url: "/api/assets/acceptance-video/content",
    available: true
};
const MOCK_VIDEO_TITLE = "验收 Mock 成片";
async function AigcAcceptancePage({ searchParams }) {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const { pipelineId, scenario } = await searchParams;
    if (scenario === "mock-results") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(MockMediaResults, {}, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 34,
            columnNumber: 12
        }, this);
    }
    if (scenario === "video-fullscreen") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$fullscreen$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcVideoFullscreenAcceptance"], {}, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 37,
            columnNumber: 12
        }, this);
    }
    if (scenario === "video-enhancement") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$enhancement$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcVideoEnhancementAcceptance"], {}, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 40,
            columnNumber: 12
        }, this);
    }
    if (scenario === "video-face-blur") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$face$2d$blur$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcVideoFaceBlurAcceptance"], {}, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 43,
            columnNumber: 12
        }, this);
    }
    if (scenario === "upstream-precise-edit") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$upstream$2d$precise$2d$edit$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcUpstreamPreciseEditAcceptance"], {}, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 46,
            columnNumber: 12
        }, this);
    }
    if (!pipelineId) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "mx-auto max-w-2xl space-y-4 p-8",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                    className: "text-xl font-semibold",
                    children: "AIGC 浏览器验收"
                }, void 0, false, {
                    fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                    lineNumber: 51,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-sm text-muted-foreground",
                    children: "先在 frontend 目录运行 npm run acceptance:aigc，再打开命令输出的 URL。该 fixture 只创建和保存画布，不会创建生成任务。"
                }, void 0, false, {
                    fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                    lineNumber: 52,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("code", {
                    className: "block rounded-md bg-muted p-3 text-xs",
                    children: "npm run acceptance:aigc"
                }, void 0, false, {
                    fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                    lineNumber: 56,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 50,
            columnNumber: 7
        }, this);
    }
    const api = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createApiClient"])();
    let pipeline;
    let loadError;
    try {
        pipeline = await api.getAigcPipeline(pipelineId, {
            cache: "no-store"
        });
    } catch (error) {
        loadError = error;
    }
    if (!pipeline) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
            className: "grid h-[calc(100dvh-4rem)] place-items-center px-6",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-destructive",
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(loadError)
            }, void 0, false, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 76,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
            lineNumber: 75,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute right-3 top-16 z-50 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm",
                children: "验收模式：真实执行已禁用"
            }, void 0, false, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 85,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcEditor"], {
                allowExecution: false,
                entity: pipeline,
                mode: "pipeline"
            }, void 0, false, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 88,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, this);
}
function MockMediaResults() {
    const videoUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(MOCK_VIDEO_ASSET.download_url);
    const videoDownload = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAigcVideoDownload"])(MOCK_VIDEO_ASSET, MOCK_VIDEO_TITLE);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "mx-auto grid min-h-[calc(100dvh-4rem)] max-w-5xl gap-6 p-4 sm:grid-cols-2 sm:p-8",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "min-w-0 space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "text-base font-semibold",
                        children: "Mock 视频结果"
                    }, void 0, false, {
                        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                        lineNumber: 107,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                        audioState: true,
                        initialMetadata: {
                            duration: 12,
                            height: 1080,
                            width: 1920
                        },
                        mimeType: MOCK_VIDEO_ASSET.mime_type,
                        name: `${MOCK_VIDEO_TITLE}.mp4`,
                        resolutionLabel: "1080p",
                        url: videoUrl,
                        variant: "panel"
                    }, void 0, false, {
                        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                        lineNumber: 108,
                        columnNumber: 9
                    }, this),
                    videoDownload ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        className: "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                        download: videoDownload.filename,
                        href: videoDownload.url,
                        children: "下载 Mock 视频"
                    }, void 0, false, {
                        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                        lineNumber: 118,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 106,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "min-w-0 space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold",
                        children: "媒体空态"
                    }, void 0, false, {
                        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                        lineNumber: 128,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                        audioState: null,
                        initialMetadata: {
                            duration: null,
                            height: null,
                            width: null
                        },
                        mimeType: null,
                        name: "不可用视频",
                        unavailableText: "Mock 结果已失效",
                        url: null,
                        variant: "panel"
                    }, void 0, false, {
                        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                        lineNumber: 129,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 127,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-muted-foreground sm:col-span-2",
                children: "此页面只渲染本地 Mock 元数据，不请求运行或生成 API。"
            }, void 0, false, {
                fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
                lineNumber: 139,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/workspace/aigc/acceptance/page.tsx",
        lineNumber: 105,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/workspace/aigc/acceptance/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", (function(__turbopack_context__){

__turbopack_context__.n(__turbopack_context__.i("[project]/app/workspace/aigc/acceptance/page.tsx [app-rsc] (ecmascript)"));
}),
"[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcEditor",
    ()=>AigcEditor,
    "connectionValidationFeedback",
    ()=>connectionValidationFeedback,
    "getAigcConnectionValidationError",
    ()=>getAigcConnectionValidationError,
    "isValidAigcConnection",
    ()=>isValidAigcConnection,
    "toFlowEdge",
    ()=>toFlowEdge
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcEditor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcEditor() from the server but AigcEditor is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx", "AigcEditor");
const connectionValidationFeedback = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call connectionValidationFeedback() from the server but connectionValidationFeedback is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx", "connectionValidationFeedback");
const getAigcConnectionValidationError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call getAigcConnectionValidationError() from the server but getAigcConnectionValidationError is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx", "getAigcConnectionValidationError");
const isValidAigcConnection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call isValidAigcConnection() from the server but isValidAigcConnection is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx", "isValidAigcConnection");
const toFlowEdge = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call toFlowEdge() from the server but toFlowEdge is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx", "toFlowEdge");
}),
"[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcEditor",
    ()=>AigcEditor,
    "connectionValidationFeedback",
    ()=>connectionValidationFeedback,
    "getAigcConnectionValidationError",
    ()=>getAigcConnectionValidationError,
    "isValidAigcConnection",
    ()=>isValidAigcConnection,
    "toFlowEdge",
    ()=>toFlowEdge
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcEditor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcEditor() from the server but AigcEditor is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx <module evaluation>", "AigcEditor");
const connectionValidationFeedback = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call connectionValidationFeedback() from the server but connectionValidationFeedback is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx <module evaluation>", "connectionValidationFeedback");
const getAigcConnectionValidationError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call getAigcConnectionValidationError() from the server but getAigcConnectionValidationError is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx <module evaluation>", "getAigcConnectionValidationError");
const isValidAigcConnection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call isValidAigcConnection() from the server but isValidAigcConnection is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx <module evaluation>", "isValidAigcConnection");
const toFlowEdge = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call toFlowEdge() from the server but toFlowEdge is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-editor.tsx <module evaluation>", "toFlowEdge");
}),
"[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-editor.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcUpstreamPreciseEditAcceptance",
    ()=>AigcUpstreamPreciseEditAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcUpstreamPreciseEditAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcUpstreamPreciseEditAcceptance() from the server but AigcUpstreamPreciseEditAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx", "AigcUpstreamPreciseEditAcceptance");
}),
"[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcUpstreamPreciseEditAcceptance",
    ()=>AigcUpstreamPreciseEditAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcUpstreamPreciseEditAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcUpstreamPreciseEditAcceptance() from the server but AigcUpstreamPreciseEditAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx <module evaluation>", "AigcUpstreamPreciseEditAcceptance");
}),
"[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$upstream$2d$precise$2d$edit$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$upstream$2d$precise$2d$edit$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-upstream-precise-edit-acceptance.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$upstream$2d$precise$2d$edit$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoEnhancementAcceptance",
    ()=>AigcVideoEnhancementAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoEnhancementAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoEnhancementAcceptance() from the server but AigcVideoEnhancementAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx", "AigcVideoEnhancementAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoEnhancementAcceptance",
    ()=>AigcVideoEnhancementAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoEnhancementAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoEnhancementAcceptance() from the server but AigcVideoEnhancementAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx <module evaluation>", "AigcVideoEnhancementAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$enhancement$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$enhancement$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-enhancement-acceptance.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$enhancement$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoFaceBlurAcceptance",
    ()=>AigcVideoFaceBlurAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoFaceBlurAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoFaceBlurAcceptance() from the server but AigcVideoFaceBlurAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx", "AigcVideoFaceBlurAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoFaceBlurAcceptance",
    ()=>AigcVideoFaceBlurAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoFaceBlurAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoFaceBlurAcceptance() from the server but AigcVideoFaceBlurAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx <module evaluation>", "AigcVideoFaceBlurAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$face$2d$blur$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$face$2d$blur$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-face-blur-acceptance.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$face$2d$blur$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoFullscreenAcceptance",
    ()=>AigcVideoFullscreenAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoFullscreenAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoFullscreenAcceptance() from the server but AigcVideoFullscreenAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx", "AigcVideoFullscreenAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoFullscreenAcceptance",
    ()=>AigcVideoFullscreenAcceptance
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoFullscreenAcceptance = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoFullscreenAcceptance() from the server but AigcVideoFullscreenAcceptance is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx <module evaluation>", "AigcVideoFullscreenAcceptance");
}),
"[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$fullscreen$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$fullscreen$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-fullscreen-acceptance.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$fullscreen$2d$acceptance$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoPlayer",
    ()=>AigcVideoPlayer,
    "formatVideoDuration",
    ()=>formatVideoDuration
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoPlayer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoPlayer() from the server but AigcVideoPlayer is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-player.tsx", "AigcVideoPlayer");
const formatVideoDuration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call formatVideoDuration() from the server but formatVideoDuration is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-player.tsx", "formatVideoDuration");
}),
"[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoPlayer",
    ()=>AigcVideoPlayer,
    "formatVideoDuration",
    ()=>formatVideoDuration
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const AigcVideoPlayer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call AigcVideoPlayer() from the server but AigcVideoPlayer is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-player.tsx <module evaluation>", "AigcVideoPlayer");
const formatVideoDuration = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call formatVideoDuration() from the server but formatVideoDuration is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/components/workspace/aigc/aigc-video-player.tsx <module evaluation>", "formatVideoDuration");
}),
"[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/lib/aigc/definition-migration.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcDefinitionMigrationError",
    ()=>AigcDefinitionMigrationError,
    "migrateAigcDefinitionV2",
    ()=>migrateAigcDefinitionV2,
    "migrateAigcRunSnapshotV2",
    ()=>migrateAigcRunSnapshotV2
]);
const LEGACY_MODALITY_TYPES = new Set([
    "text_input",
    "text_output",
    "image_input",
    "image_output",
    "video_input",
    "video_output",
    "audio_input"
]);
const V2_MODALITY_TYPES = new Set([
    "text",
    "image",
    "video",
    "audio"
]);
const COORDINATE_TAG_PATTERN = /<\/?\s*(?:point|bbox)\b/i;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
class AigcDefinitionMigrationError extends Error {
}
function record(value, field) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new AigcDefinitionMigrationError(`${field} must be an object`);
    }
    return value;
}
function exactKeys(value, allowed) {
    const extra = Object.keys(value).filter((key)=>!allowed.includes(key));
    if (extra.length > 0) {
        throw new AigcDefinitionMigrationError(`node config has unknown fields: ${extra.join(", ")}`);
    }
}
function nullableString(value, field, maxLength) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || value.length === 0 || maxLength !== undefined && value.length > maxLength) {
        throw new AigcDefinitionMigrationError(`${field} is invalid`);
    }
    return value;
}
function normalizeReferences(value) {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 10) {
        throw new AigcDefinitionMigrationError("bbox_references is invalid");
    }
    const references = value.map((candidate)=>{
        const reference = record(candidate, "bbox reference");
        exactKeys(reference, [
            "source_node_id",
            "instruction"
        ]);
        const sourceNodeId = reference.source_node_id;
        const instruction = reference.instruction ?? "";
        if (typeof sourceNodeId !== "string" || sourceNodeId.trim().length === 0 || sourceNodeId.length > 120 || typeof instruction !== "string" || instruction.length > 4000 || COORDINATE_TAG_PATTERN.test(instruction)) {
            throw new AigcDefinitionMigrationError("bbox reference is invalid");
        }
        return {
            source_node_id: sourceNodeId.trim(),
            instruction
        };
    });
    if (new Set(references.map((reference)=>reference.source_node_id)).size !== references.length) {
        throw new AigcDefinitionMigrationError("bbox reference source_node_id values must be unique");
    }
    return references;
}
function normalizeTextConfig(value, title, allowStoredTitle = true) {
    const config = record(value, "node config");
    exactKeys(config, allowStoredTitle ? [
        "text",
        "bbox_references",
        "title",
        "upstream_text_override",
        "generated_by_parser_node_id",
        "generated_item_index",
        "generated_from_run_id"
    ] : [
        "text",
        "bbox_references",
        "upstream_text_override"
    ]);
    const text = config.text ?? "";
    if (typeof text !== "string" || text.length > 20000 || COORDINATE_TAG_PATTERN.test(text)) {
        throw new AigcDefinitionMigrationError("text is invalid");
    }
    const normalized = {
        text,
        bbox_references: normalizeReferences(config.bbox_references),
        title: nullableString(title === undefined ? config.title : title, "title", 120),
        upstream_text_override: nullableText(config.upstream_text_override, "upstream_text_override", 20000)
    };
    const hasParser = config.generated_by_parser_node_id !== undefined;
    const hasIndex = config.generated_item_index !== undefined;
    const hasRun = config.generated_from_run_id !== undefined;
    if (hasParser !== hasIndex || hasRun && !hasParser) {
        throw new AigcDefinitionMigrationError("managed text fields are invalid");
    }
    if (hasParser) {
        const parserId = nullableString(config.generated_by_parser_node_id, "generated_by_parser_node_id", 120);
        const itemIndex = config.generated_item_index;
        const runId = nullableString(config.generated_from_run_id, "generated_from_run_id", 120);
        if (parserId === null || parserId.trim().length === 0 || !Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= 20) {
            throw new AigcDefinitionMigrationError("managed text fields are invalid");
        }
        normalized.generated_by_parser_node_id = parserId.trim();
        normalized.generated_item_index = itemIndex;
        if (runId !== null) {
            if (runId.trim().length === 0) {
                throw new AigcDefinitionMigrationError("managed text fields are invalid");
            }
            normalized.generated_from_run_id = runId.trim();
        }
    }
    return normalized;
}
function normalizeJsonParserConfig(value) {
    const config = record(value, "node config");
    exactKeys(config, [
        "json_path"
    ]);
    const jsonPath = config.json_path ?? "$.items";
    if (typeof jsonPath !== "string" || jsonPath.trim().length === 0 || jsonPath.trim().length > 500) {
        throw new AigcDefinitionMigrationError("json_parser_invalid_path");
    }
    return {
        json_path: jsonPath.trim()
    };
}
function nullableText(value, label, maxLength) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string" || value.length > maxLength || COORDINATE_TAG_PATTERN.test(value)) {
        throw new AigcDefinitionMigrationError(`${label} is invalid`);
    }
    return value;
}
function normalizeBbox(value) {
    if (value === null || value === undefined) return null;
    const bbox = record(value, "bbox");
    exactKeys(bbox, [
        "type",
        "x1",
        "y1",
        "x2",
        "y2"
    ]);
    const coordinates = [
        bbox.x1,
        bbox.y1,
        bbox.x2,
        bbox.y2
    ];
    if (bbox.type !== "bbox" || coordinates.some((coordinate)=>!Number.isInteger(coordinate) || coordinate < 0 || coordinate > 999) || bbox.x1 >= bbox.x2 || bbox.y1 >= bbox.y2) {
        throw new AigcDefinitionMigrationError("bbox is invalid");
    }
    return {
        type: "bbox",
        x1: bbox.x1,
        y1: bbox.y1,
        x2: bbox.x2,
        y2: bbox.y2
    };
}
function normalizeImageConfig(value, title, allowStoredTitle = true) {
    const config = record(value, "node config");
    exactKeys(config, allowStoredTitle ? [
        "asset_id",
        "bbox",
        "bbox_asset_id",
        "title",
        "upstream_bbox",
        "upstream_bbox_asset_id"
    ] : [
        "asset_id",
        "bbox",
        "bbox_asset_id"
    ]);
    const assetId = nullableString(config.asset_id, "asset_id");
    const bbox = normalizeBbox(config.bbox);
    const bboxAssetId = nullableString(config.bbox_asset_id, "bbox_asset_id");
    const upstreamBbox = normalizeBbox(config.upstream_bbox);
    const upstreamBboxAssetId = nullableString(config.upstream_bbox_asset_id, "upstream_bbox_asset_id");
    if (bbox === null !== (bboxAssetId === null) || bbox && bboxAssetId !== assetId) {
        throw new AigcDefinitionMigrationError("bbox_asset_mismatch");
    }
    if (upstreamBbox === null !== (upstreamBboxAssetId === null)) {
        throw new AigcDefinitionMigrationError("upstream_bbox_asset_mismatch");
    }
    return {
        asset_id: assetId,
        bbox,
        bbox_asset_id: bboxAssetId,
        title: nullableString(title === undefined ? config.title : title, "title", 120),
        upstream_bbox: upstreamBbox,
        upstream_bbox_asset_id: upstreamBboxAssetId
    };
}
function normalizeMediaConfig(value, title, allowStoredTitle = true) {
    const config = record(value, "node config");
    exactKeys(config, allowStoredTitle ? [
        "asset_id",
        "title"
    ] : [
        "asset_id"
    ]);
    return {
        asset_id: nullableString(config.asset_id, "asset_id"),
        title: nullableString(title === undefined ? config.title : title, "title", 120)
    };
}
function legacyOutputTitle(value, defaultTitle) {
    const config = record(value, "node config");
    exactKeys(config, [
        "title"
    ]);
    return nullableString(config.title ?? defaultTitle, "title", 120);
}
function normalizeNode(candidate, version) {
    const node = record(candidate, "node");
    const type = node.type;
    const config = node.config ?? {};
    const migrated = structuredClone(node);
    migrated.custom_name = normalizeCustomName(node.custom_name);
    if (version === 2) {
        if (type === "text") migrated.config = normalizeTextConfig(config, undefined);
        if (type === "image") migrated.config = normalizeImageConfig(config, undefined);
        if (type === "video" || type === "audio") {
            migrated.config = normalizeMediaConfig(config, undefined);
        }
        if (type === "json_parser") {
            migrated.config = normalizeJsonParserConfig(config);
        }
        if (type === "multi_track_edit") {
            migrated.config = normalizeMultiTrackFontTypes(config);
        }
        return migrated;
    }
    if (type === "text_input") {
        migrated.type = "text";
        migrated.config = normalizeTextConfig(config, null, false);
    } else if (type === "text_output") {
        migrated.type = "text";
        migrated.config = {
            text: "",
            bbox_references: [],
            title: legacyOutputTitle(config, "文本结果"),
            upstream_text_override: null
        };
    } else if (type === "image_input") {
        migrated.type = "image";
        migrated.config = normalizeImageConfig(config, null, false);
    } else if (type === "image_output") {
        migrated.type = "image";
        migrated.config = {
            asset_id: null,
            bbox: null,
            bbox_asset_id: null,
            title: legacyOutputTitle(config, "图片结果"),
            upstream_bbox: null,
            upstream_bbox_asset_id: null
        };
    } else if (type === "video_input") {
        migrated.type = "video";
        migrated.config = normalizeMediaConfig(config, null, false);
    } else if (type === "video_output") {
        migrated.type = "video";
        migrated.config = {
            asset_id: null,
            title: legacyOutputTitle(config, "视频结果")
        };
    } else if (type === "audio_input") {
        migrated.type = "audio";
        migrated.config = normalizeMediaConfig(config, null, false);
    }
    return migrated;
}
function normalizeMultiTrackFontTypes(value) {
    const config = structuredClone(record(value, "node config"));
    if (!Array.isArray(config.tracks)) return config;
    for (const track of config.tracks){
        if (typeof track !== "object" || track === null || Array.isArray(track)) {
            continue;
        }
        const elements = track.elements;
        if (!Array.isArray(elements)) continue;
        for (const element of elements){
            if (typeof element !== "object" || element === null || Array.isArray(element)) {
                continue;
            }
            const candidate = element;
            if (candidate.type !== "text" && candidate.type !== "subtitle") continue;
            if (typeof candidate.style !== "object" || candidate.style === null || Array.isArray(candidate.style)) {
                continue;
            }
            const style = candidate.style;
            if (style.font_type === undefined) style.font_type = null;
        }
    }
    return config;
}
function normalizeCustomName(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") {
        throw new AigcDefinitionMigrationError("custom_name is invalid");
    }
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > 120 || CONTROL_CHARACTER_PATTERN.test(normalized)) {
        throw new AigcDefinitionMigrationError("custom_name is invalid");
    }
    return normalized;
}
function migrateAigcDefinitionV2(definition) {
    const source = record(definition, "definition");
    const rawVersion = source.schemaVersion ?? 1;
    if (rawVersion !== 1 && rawVersion !== 2) {
        throw new AigcDefinitionMigrationError(`unsupported AIGC definition schemaVersion: ${String(rawVersion)}`);
    }
    const nodes = source.nodes ?? [];
    if (!Array.isArray(nodes)) {
        throw new AigcDefinitionMigrationError("definition nodes must be an array");
    }
    const nodeTypes = new Set(nodes.map((node)=>record(node, "node").type));
    if (rawVersion === 1 && [
        ...nodeTypes
    ].some((type)=>V2_MODALITY_TYPES.has(String(type))) || rawVersion === 2 && [
        ...nodeTypes
    ].some((type)=>LEGACY_MODALITY_TYPES.has(String(type)))) {
        throw new AigcDefinitionMigrationError("mixed_v1_v2_modality_types");
    }
    const normalizedNodes = nodes.map((node)=>normalizeNode(node, rawVersion));
    const managedKeys = normalizedNodes.flatMap((node)=>{
        if (node.type !== "text") return [];
        const config = record(node.config, "node config");
        if (typeof config.generated_by_parser_node_id !== "string" || typeof config.generated_item_index !== "number") {
            return [];
        }
        return [
            `${config.generated_by_parser_node_id}\u0000${config.generated_item_index}`
        ];
    });
    if (new Set(managedKeys).size !== managedKeys.length) {
        throw new AigcDefinitionMigrationError("managed text keys must be unique");
    }
    const migrated = structuredClone(source);
    migrated.schemaVersion = 2;
    migrated.nodes = normalizedNodes;
    migrated.edges ??= [];
    migrated.viewport ??= {
        x: 0,
        y: 0,
        zoom: 1
    };
    return migrated;
}
function migrateAigcRunSnapshotV2(definitionSnapshot) {
    return migrateAigcDefinitionV2(definitionSnapshot);
}
}),
"[project]/lib/aigc/download.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAigcAudioDownload",
    ()=>getAigcAudioDownload,
    "getAigcImageDownload",
    ()=>getAigcImageDownload,
    "getAigcSubtitleDownload",
    ()=>getAigcSubtitleDownload,
    "getAigcVideoDownload",
    ()=>getAigcVideoDownload
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/definition-migration.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-rsc] (ecmascript)");
;
;
;
function getAigcImageDownload(asset, title, definition) {
    return getAigcAssetDownload(asset, title, "图片结果", imageExtension, true, definition);
}
function getAigcVideoDownload(asset, title, definition) {
    return getAigcAssetDownload(asset, title, "视频结果", videoExtension, true, definition);
}
function getAigcAudioDownload(asset, title) {
    return getAigcAssetDownload(asset, title, "音频结果", audioExtension, false);
}
function getAigcSubtitleDownload(asset, title) {
    return getAigcAssetDownload(asset, title, "字幕结果", ()=>"srt", false);
}
function getAigcAssetDownload(asset, title, fallbackTitle, extension, omitFirstOrdinalSuffix, definition) {
    if (!asset?.available || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(asset.download_url) || !asset.asset_id.trim()) {
        return null;
    }
    const fileExtension = extension(asset.mime_type);
    const naming = aigcDownloadNaming(asset, title, fallbackTitle, definition);
    const ordinalSuffix = !naming.applyOrdinal || omitFirstOrdinalSuffix && asset.ordinal === 0 ? "" : `-${asset.ordinal + 1}`;
    const filename = utf8LimitedFilename(naming.basename, `${ordinalSuffix}.${fileExtension}`);
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getAssetDownloadUrlById"])(asset.asset_id, filename);
    if (!url) return null;
    return {
        filename,
        url
    };
}
function aigcDownloadNaming(asset, title, fallbackTitle, definition) {
    const metadataName = metadataText(asset, "name");
    const nameScheme = metadataText(asset, "name_scheme");
    const explicitName = nameScheme === "user_defined_v1" ? metadataName : null;
    const currentNodeName = currentGeneratedNodeName(asset, definition);
    const generatedName = metadataText(asset, "generated_name");
    const candidate = explicitName ?? currentNodeName ?? generatedName;
    if (candidate) {
        return {
            applyOrdinal: explicitName === null,
            basename: sanitizeBasename(candidate, fallbackTitle)
        };
    }
    if (metadataName) {
        return {
            applyOrdinal: false,
            basename: sanitizeBasename(metadataName, fallbackTitle)
        };
    }
    return {
        applyOrdinal: true,
        basename: sanitizeBasename(title || fallbackTitle, fallbackTitle)
    };
}
function currentGeneratedNodeName(asset, definition) {
    const nodeId = metadataText(asset, "node_id");
    if (!definition || !nodeId) return null;
    const migrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(definition);
    const node = migrated.nodes.find((candidate)=>candidate.id === nodeId);
    if (!node || !(node.type === "text_to_image" || node.type === "video_generation" || node.type === "image_to_image" && node.config.operation !== "layer_decomposition")) {
        return null;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(migrated.nodes).get(nodeId)?.displayName ?? null;
}
function metadataText(asset, key) {
    const value = asset.metadata?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}
function sanitizeBasename(value, fallback) {
    let sanitized = value.trim().replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, "-").replace(/[\s-]+/g, "-").replace(/[.\s-]+$/g, "");
    for (const extension of [
        ".jpeg",
        ".mpeg",
        ".webm",
        ".jpg",
        ".mov",
        ".mp4",
        ".png",
        ".webp"
    ]){
        if (sanitized.toLowerCase().endsWith(extension)) {
            sanitized = sanitized.slice(0, -extension.length).replace(/[.\s-]+$/g, "");
            break;
        }
    }
    return sanitized || fallback;
}
function utf8LimitedFilename(basename, suffix) {
    const encoder = new TextEncoder();
    const budget = 180 - encoder.encode(suffix).byteLength;
    let used = 0;
    let truncated = "";
    for (const character of basename){
        const bytes = encoder.encode(character).byteLength;
        if (used + bytes > Math.max(1, budget)) break;
        truncated += character;
        used += bytes;
    }
    return `${truncated.replace(/[.\s-]+$/g, "") || "AIGC节点"}${suffix}`;
}
function imageExtension(mimeType) {
    const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
    if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
    if (normalized === "image/webp") return "webp";
    return "png";
}
function videoExtension(mimeType) {
    const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
    if (normalized === "video/quicktime") return "mov";
    if (normalized === "video/webm") return "webm";
    if (normalized === "video/mpeg") return "mpeg";
    return "mp4";
}
function audioExtension(mimeType) {
    const normalized = mimeType?.split(";", 1)[0]?.trim().toLowerCase();
    if (normalized === "audio/aac") return "aac";
    if (normalized === "audio/mp4" || normalized === "audio/x-m4a") return "m4a";
    if (normalized === "audio/ogg") return "ogg";
    if (normalized === "audio/wav" || normalized === "audio/x-wav") return "wav";
    return "mp3";
}
}),
"[project]/lib/aigc/image-dimensions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SEEDREAM_COMMON_IMAGE_DIMENSIONS",
    ()=>SEEDREAM_COMMON_IMAGE_DIMENSIONS,
    "SEEDREAM_IMAGE_ASPECT_RATIOS",
    ()=>SEEDREAM_IMAGE_ASPECT_RATIOS,
    "SEEDREAM_IMAGE_PRESET_SIZES",
    ()=>SEEDREAM_IMAGE_PRESET_SIZES,
    "SEEDREAM_MAX_ASPECT_RATIO",
    ()=>SEEDREAM_MAX_ASPECT_RATIO,
    "SEEDREAM_MAX_IMAGE_PIXELS",
    ()=>SEEDREAM_MAX_IMAGE_PIXELS,
    "SEEDREAM_MIN_IMAGE_PIXELS",
    ()=>SEEDREAM_MIN_IMAGE_PIXELS,
    "SeedreamImageDimensionError",
    ()=>SeedreamImageDimensionError,
    "isSeedreamCustomImageSize",
    ()=>isSeedreamCustomImageSize,
    "isSeedreamImagePresetSize",
    ()=>isSeedreamImagePresetSize,
    "normalizeSeedreamCustomImageSize",
    ()=>normalizeSeedreamCustomImageSize,
    "normalizeSeedreamImageSize",
    ()=>normalizeSeedreamImageSize,
    "parseSeedreamCustomImageSize",
    ()=>parseSeedreamCustomImageSize
]);
const SEEDREAM_IMAGE_PRESET_SIZES = [
    "1K",
    "1.5K",
    "2K"
];
const SEEDREAM_IMAGE_ASPECT_RATIOS = [
    "1:1",
    "4:3",
    "3:4",
    "16:9",
    "9:16"
];
const SEEDREAM_MIN_IMAGE_PIXELS = 921_600;
const SEEDREAM_MAX_IMAGE_PIXELS = 4_624_220;
const SEEDREAM_MAX_ASPECT_RATIO = 16;
class SeedreamImageDimensionError extends Error {
    code;
    constructor(code, message){
        super(message), this.code = code;
        this.name = "SeedreamImageDimensionError";
    }
}
const CUSTOM_IMAGE_SIZE_PATTERN = /^([0-9]+)x([0-9]+)$/;
const MIN_IMAGE_PIXELS_BIGINT = BigInt(SEEDREAM_MIN_IMAGE_PIXELS);
const MAX_IMAGE_PIXELS_BIGINT = BigInt(SEEDREAM_MAX_IMAGE_PIXELS);
const MAX_ASPECT_RATIO_BIGINT = BigInt(SEEDREAM_MAX_ASPECT_RATIO);
function isSeedreamImagePresetSize(value) {
    return typeof value === "string" && SEEDREAM_IMAGE_PRESET_SIZES.some((preset)=>preset === value);
}
function parseSeedreamCustomImageSize(value) {
    if (typeof value !== "string") {
        throw new SeedreamImageDimensionError("invalid_format", "Image size must use WIDTHxHEIGHT decimal notation");
    }
    const match = CUSTOM_IMAGE_SIZE_PATTERN.exec(value);
    if (!match) {
        throw new SeedreamImageDimensionError("invalid_format", "Image size must use WIDTHxHEIGHT decimal notation");
    }
    const width = BigInt(match[1]);
    const height = BigInt(match[2]);
    if (width === BigInt(0) || height === BigInt(0)) {
        throw new SeedreamImageDimensionError("non_positive", "Image width and height must be positive integers");
    }
    const pixels = width * height;
    if (pixels < MIN_IMAGE_PIXELS_BIGINT || pixels > MAX_IMAGE_PIXELS_BIGINT) {
        throw new SeedreamImageDimensionError("pixel_count_out_of_range", `Image pixel count must be between ${SEEDREAM_MIN_IMAGE_PIXELS} and ${SEEDREAM_MAX_IMAGE_PIXELS}`);
    }
    if (width > MAX_ASPECT_RATIO_BIGINT * height || height > MAX_ASPECT_RATIO_BIGINT * width) {
        throw new SeedreamImageDimensionError("aspect_ratio_out_of_range", "Image aspect ratio must be between 1:16 and 16:1");
    }
    const normalized = `${width}x${height}`;
    return {
        width: Number(width),
        height: Number(height),
        pixels: Number(pixels),
        size: normalized
    };
}
function normalizeSeedreamCustomImageSize(value) {
    return parseSeedreamCustomImageSize(value).size;
}
function isSeedreamCustomImageSize(value) {
    try {
        parseSeedreamCustomImageSize(value);
        return true;
    } catch  {
        return false;
    }
}
function normalizeSeedreamImageSize(value) {
    if (isSeedreamImagePresetSize(value)) return value;
    return normalizeSeedreamCustomImageSize(value);
}
function dimensions(value) {
    return parseSeedreamCustomImageSize(value);
}
const SEEDREAM_COMMON_IMAGE_DIMENSIONS = {
    "1K": {
        "1:1": dimensions("1024x1024"),
        "4:3": dimensions("1152x864"),
        "3:4": dimensions("864x1152"),
        "16:9": dimensions("1424x800"),
        "9:16": dimensions("800x1424")
    },
    "1.5K": {
        "1:1": dimensions("1536x1536"),
        "4:3": dimensions("1792x1344"),
        "3:4": dimensions("1344x1792"),
        "16:9": dimensions("2048x1152"),
        "9:16": dimensions("1152x2048")
    },
    "2K": {
        "1:1": dimensions("2048x2048"),
        "4:3": dimensions("2368x1776"),
        "3:4": dimensions("1776x2368"),
        "16:9": dimensions("2816x1584"),
        "9:16": dimensions("1584x2816")
    }
};
}),
"[project]/lib/aigc/media-validation.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_MEDIA_ACCEPT",
    ()=>AIGC_MEDIA_ACCEPT,
    "aigcMediaCompatibility",
    ()=>aigcMediaCompatibility,
    "layerDecompositionAssetError",
    ()=>layerDecompositionAssetError,
    "layerDecompositionCompatibility",
    ()=>layerDecompositionCompatibility,
    "validateAigcMediaFile",
    ()=>validateAigcMediaFile,
    "validateLayerDecompositionFile",
    ()=>validateLayerDecompositionFile
]);
const MB = 1024 * 1024;
const LAYER_DECOMPOSITION_MAX_BYTES = 30 * MB;
const LAYER_DECOMPOSITION_MIN_PIXELS = 262_144;
const LAYER_DECOMPOSITION_MAX_PIXELS = 36_000_000;
const MEDIA_RULES = {
    image: {
        extensions: new Set([
            "bmp",
            "gif",
            "heic",
            "heif",
            "jpeg",
            "jpg",
            "png",
            "tif",
            "tiff",
            "webp"
        ]),
        maxBytes: 30 * MB,
        mimeTypes: new Set([
            "image/bmp",
            "image/gif",
            "image/heic",
            "image/heif",
            "image/jpeg",
            "image/png",
            "image/tiff",
            "image/webp"
        ]),
        strictMaximum: true
    },
    video: {
        extensions: new Set([
            "mov",
            "mp4"
        ]),
        maxBytes: 200 * MB,
        mimeTypes: new Set([
            "video/mp4",
            "video/quicktime"
        ]),
        strictMaximum: false
    },
    audio: {
        extensions: new Set([
            "mp3",
            "wav"
        ]),
        maxBytes: 15 * MB,
        mimeTypes: new Set([
            "audio/mpeg",
            "audio/wav",
            "audio/x-wav"
        ]),
        strictMaximum: false
    }
};
function validateAigcMediaFile(kind, file) {
    const rule = MEDIA_RULES[kind];
    const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
    const mimeType = file.type.split(";", 1)[0].trim().toLocaleLowerCase();
    if (!rule.extensions.has(extension) || mimeType && !rule.mimeTypes.has(mimeType)) {
        return `${mediaLabel(kind)}格式不支持`;
    }
    const exceeds = rule.strictMaximum ? file.size >= rule.maxBytes : file.size > rule.maxBytes;
    if (exceeds) {
        const qualifier = rule.strictMaximum ? "必须小于" : "不能超过";
        return `${mediaLabel(kind)}大小${qualifier} ${rule.maxBytes / MB} MB`;
    }
    return null;
}
function aigcMediaCompatibility(asset, kind) {
    const rule = MEDIA_RULES[kind];
    const mimeType = asset.mime_type?.split(";", 1)[0].trim().toLocaleLowerCase();
    if (!mimeType || !rule.mimeTypes.has(mimeType)) {
        return {
            state: "incompatible",
            message: `${mediaLabel(kind)}格式不支持`
        };
    }
    if (asset.size_bytes !== null) {
        const exceeds = rule.strictMaximum ? asset.size_bytes >= rule.maxBytes : asset.size_bytes > rule.maxBytes;
        if (exceeds) {
            return {
                state: "incompatible",
                message: `${mediaLabel(kind)}文件过大`
            };
        }
    }
    if (asset.metadata.inspection_version !== 1) {
        return {
            state: "pending",
            message: "执行前检测"
        };
    }
    const intrinsicError = validateInspectedMetadata(asset, kind);
    return intrinsicError ? {
        state: "incompatible",
        message: intrinsicError
    } : {
        state: "available",
        message: "规格可用"
    };
}
function validateLayerDecompositionFile(file) {
    const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
    const mimeType = file.type.split(";", 1)[0].trim().toLocaleLowerCase();
    if (!new Set([
        "jpeg",
        "jpg",
        "png"
    ]).has(extension) || mimeType && mimeType !== "image/jpeg" && mimeType !== "image/png") {
        return "图层拆分仅支持 PNG/JPEG 图片";
    }
    return file.size >= LAYER_DECOMPOSITION_MAX_BYTES ? "图层拆分图片大小必须小于 30 MB" : null;
}
function layerDecompositionCompatibility(asset) {
    const message = layerDecompositionAssetError(asset);
    if (message) return {
        state: "incompatible",
        message
    };
    return asset.metadata.inspection_version === 1 ? {
        state: "available",
        message: "规格可用"
    } : {
        state: "pending",
        message: "执行前检测"
    };
}
function layerDecompositionAssetError(asset) {
    const mimeType = asset.mime_type?.split(";", 1)[0].trim().toLocaleLowerCase();
    if (mimeType !== "image/png" && mimeType !== "image/jpeg") {
        return "图层拆分仅支持 PNG/JPEG 图片";
    }
    if (asset.size_bytes !== null && asset.size_bytes >= LAYER_DECOMPOSITION_MAX_BYTES) {
        return "图层拆分图片大小必须小于 30 MB";
    }
    if (asset.metadata.inspection_version !== 1) return null;
    const width = metadataNumber(asset, "width");
    const height = metadataNumber(asset, "height");
    if (width === null || height === null) {
        return "图层拆分图片缺少尺寸信息";
    }
    const ratio = width / height;
    if (ratio < 1 / 16 || ratio > 16) {
        return "图层拆分图片宽高比需为 1:16-16:1";
    }
    const pixels = width * height;
    if (pixels < LAYER_DECOMPOSITION_MIN_PIXELS || pixels > LAYER_DECOMPOSITION_MAX_PIXELS) {
        return "图层拆分图片总像素需为 262,144-36,000,000";
    }
    return null;
}
function validateInspectedMetadata(asset, kind) {
    const width = metadataNumber(asset, "width");
    const height = metadataNumber(asset, "height");
    if (kind !== "audio") {
        if (!width || !height) return "缺少尺寸信息";
        if (width < 300 || width > 6000 || height < 300 || height > 6000) {
            return "宽高需为 300-6000 px";
        }
        const ratio = width / height;
        if (ratio < 0.4 || ratio > 2.5) return "宽高比需为 0.4-2.5";
    }
    if (kind === "video") {
        const pixels = (width ?? 0) * (height ?? 0);
        if (pixels < 407_696 || pixels > 8_295_044) return "视频像素数不符合要求";
        const fps = metadataNumber(asset, "fps");
        if (!fps || fps < 24 || fps > 60) return "视频帧率需为 24-60 FPS";
    }
    return null;
}
function metadataNumber(asset, key) {
    const value = asset.metadata[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
function mediaLabel(kind) {
    if (kind === "image") return "图片";
    if (kind === "video") return "视频";
    return "音频";
}
const AIGC_MEDIA_ACCEPT = {
    image: ".bmp,.gif,.heic,.heif,.jpeg,.jpg,.png,.tif,.tiff,.webp",
    video: ".mp4,.mov,video/mp4,video/quicktime",
    audio: ".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
};
}),
"[project]/lib/aigc/multitrack-fonts.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MEDIAKIT_FONT_PRESETS",
    ()=>MEDIAKIT_FONT_PRESETS,
    "MULTITRACK_FONT_TYPE_MAX_LENGTH",
    ()=>MULTITRACK_FONT_TYPE_MAX_LENGTH,
    "fontTypeIssue",
    ()=>fontTypeIssue,
    "isCustomFontUrl",
    ()=>isCustomFontUrl,
    "isMediaKitFontPreset",
    ()=>isMediaKitFontPreset
]);
const MEDIAKIT_FONT_PRESETS = [
    {
        id: "1187225",
        label: "站酷意大利体",
        supportsChinese: false
    },
    {
        id: "1187223",
        label: "站酷仓耳渔阳体",
        supportsChinese: true
    },
    {
        id: "1187221",
        label: "站酷高端黑",
        supportsChinese: true
    },
    {
        id: "1187219",
        label: "站酷酷黑体",
        supportsChinese: true
    },
    {
        id: "1187217",
        label: "站酷快乐体",
        supportsChinese: true
    },
    {
        id: "1187213",
        label: "站酷文艺体",
        supportsChinese: true
    },
    {
        id: "1187211",
        label: "站酷小薇 LOGO 体",
        supportsChinese: true
    },
    {
        id: "SY_Black",
        label: "思源黑体",
        supportsChinese: true
    },
    {
        id: "ALi_PuHui",
        label: "阿里巴巴普惠体",
        supportsChinese: true
    },
    {
        id: "PM_ZhengDao",
        label: "庞门正道标题体",
        supportsChinese: true
    }
];
const MEDIAKIT_FONT_PRESET_IDS = new Set(MEDIAKIT_FONT_PRESETS.map((preset)=>preset.id));
const FONT_FILE_PATH_PATTERN = /\.(?:ttf|otf)$/i;
const ASCII_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const IPV4_HOST_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const NUMERIC_HOST_LABEL_PATTERN = /^(?:\d+|0x[0-9a-f]+)$/i;
const LOCAL_HOST_SUFFIXES = [
    ".local",
    ".internal",
    ".lan",
    ".home"
];
const MULTITRACK_FONT_TYPE_MAX_LENGTH = 2048;
function isNumericHostname(hostname) {
    const labels = hostname.replace(/\.$/, "").split(".");
    return labels.length > 0 && labels.every((label)=>NUMERIC_HOST_LABEL_PATTERN.test(label));
}
function isMediaKitFontPreset(value) {
    return MEDIAKIT_FONT_PRESET_IDS.has(value);
}
function isCustomFontUrl(value) {
    if (value.length > MULTITRACK_FONT_TYPE_MAX_LENGTH || value !== value.trim() || value.includes("\\") || ASCII_CONTROL_PATTERN.test(value) || !/^https:\/\//i.test(value)) {
        return false;
    }
    try {
        const url = new URL(value);
        const authority = value.slice(value.indexOf("//") + 2).split(/[/?#]/, 1)[0];
        const rawHostname = (authority.startsWith("[") ? authority.slice(1, authority.indexOf("]")) : authority.split(":", 1)[0]).toLowerCase();
        const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
        const isIpLiteral = hostname.includes(":") || IPV4_HOST_PATTERN.test(hostname);
        const isLocalHostname = hostname === "localhost" || hostname.endsWith(".localhost") || LOCAL_HOST_SUFFIXES.some((suffix)=>hostname.endsWith(suffix));
        return url.protocol === "https:" && Boolean(authority) && Boolean(hostname) && !isIpLiteral && !isNumericHostname(rawHostname) && !isLocalHostname && !authority.includes("@") && url.username === "" && url.password === "" && FONT_FILE_PATH_PATTERN.test(url.pathname);
    } catch  {
        return false;
    }
}
function fontTypeIssue(value) {
    if (value === null || isMediaKitFontPreset(value) || isCustomFontUrl(value)) {
        return null;
    }
    return "invalid_font_type";
}
}),
"[project]/lib/aigc/multitrack.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG",
    ()=>AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG,
    "MULTI_TRACK_CANVAS_MAX_SIZE",
    ()=>MULTI_TRACK_CANVAS_MAX_SIZE,
    "MULTI_TRACK_CANVAS_MIN_SIZE",
    ()=>MULTI_TRACK_CANVAS_MIN_SIZE,
    "MULTI_TRACK_MAX_ELEMENTS",
    ()=>MULTI_TRACK_MAX_ELEMENTS,
    "MULTI_TRACK_MAX_SUBTITLE_TRACKS",
    ()=>MULTI_TRACK_MAX_SUBTITLE_TRACKS,
    "MULTI_TRACK_MAX_TRACKS",
    ()=>MULTI_TRACK_MAX_TRACKS,
    "normalizeMultiTrackEditConfig",
    ()=>normalizeMultiTrackEditConfig,
    "validateMultiTrackEditConfig",
    ()=>validateMultiTrackEditConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2d$fonts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/multitrack-fonts.ts [app-rsc] (ecmascript)");
;
const MULTI_TRACK_MAX_TRACKS = 20;
const MULTI_TRACK_MAX_ELEMENTS = 200;
const MULTI_TRACK_MAX_SUBTITLE_TRACKS = 10;
const MULTI_TRACK_CANVAS_MIN_SIZE = 160;
const MULTI_TRACK_CANVAS_MAX_SIZE = 8192;
const AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG = {
    canvas: {
        mode: "auto",
        width: null,
        height: null,
        background_color: "#000000FF"
    },
    output: {
        format: "mp4",
        fps: 30
    },
    tracks: []
};
const RGBA_PATTERN = /^#[0-9A-Fa-f]{8}$/;
function normalizeMultiTrackEditConfig(config) {
    return {
        canvas: {
            ...config.canvas
        },
        output: {
            ...config.output
        },
        tracks: config.tracks.map((track, trackIndex)=>({
                ...track,
                id: track.id.trim(),
                name: track.name.trim(),
                order: trackIndex,
                elements: track.elements.map(normalizeElement)
            }))
    };
}
function normalizeElement(element) {
    switch(element.type){
        case "video":
            return {
                ...element,
                id: element.id.trim(),
                target_time: normalizeTimeRange(element.target_time),
                source: {
                    ...element.source
                },
                source_trim: element.source_trim ? normalizeTimeRange(element.source_trim) : null,
                transform: {
                    ...element.transform
                },
                fade_in_ms: Math.round(element.fade_in_ms),
                fade_out_ms: Math.round(element.fade_out_ms),
                transition: element.transition ? {
                    ...element.transition,
                    duration_ms: Math.round(element.transition.duration_ms)
                } : null
            };
        case "audio":
            return {
                ...element,
                id: element.id.trim(),
                target_time: normalizeTimeRange(element.target_time),
                source: {
                    ...element.source
                },
                source_trim: element.source_trim ? normalizeTimeRange(element.source_trim) : null,
                fade_in_ms: Math.round(element.fade_in_ms),
                fade_out_ms: Math.round(element.fade_out_ms)
            };
        case "image":
            return {
                ...element,
                id: element.id.trim(),
                target_time: normalizeTimeRange(element.target_time),
                source: {
                    ...element.source
                },
                transform: {
                    ...element.transform
                }
            };
        case "text":
            return {
                ...element,
                id: element.id.trim(),
                target_time: normalizeTimeRange(element.target_time),
                source: element.source ? {
                    ...element.source
                } : null,
                transform: {
                    ...element.transform
                },
                style: {
                    ...element.style,
                    font_type: element.style.font_type ?? null
                }
            };
        case "subtitle":
            return {
                ...element,
                id: element.id.trim(),
                target_time: normalizeTimeRange(element.target_time),
                transform: {
                    ...element.transform
                },
                style: {
                    ...element.style,
                    font_type: element.style.font_type ?? null
                }
            };
    }
}
function normalizeTimeRange(range) {
    return {
        start_ms: Math.round(range.start_ms),
        end_ms: Math.round(range.end_ms)
    };
}
function validateMultiTrackEditConfig(config) {
    const project = normalizeMultiTrackEditConfig(config);
    const issues = [];
    const add = (code, path, message, track, element)=>{
        issues.push({
            code,
            path,
            message,
            track_id: track?.id ?? null,
            element_id: element?.id ?? null
        });
    };
    const { canvas } = project;
    if (canvas.mode === "custom" && (!integerInRange(canvas.width, MULTI_TRACK_CANVAS_MIN_SIZE, MULTI_TRACK_CANVAS_MAX_SIZE) || !integerInRange(canvas.height, MULTI_TRACK_CANVAS_MIN_SIZE, MULTI_TRACK_CANVAS_MAX_SIZE))) {
        add("invalid_canvas_size", "canvas", "自定义画布尺寸无效");
    }
    if (!RGBA_PATTERN.test(canvas.background_color)) {
        add("invalid_background_color", "canvas.background_color", "背景色必须使用 #RRGGBBAA");
    }
    if (project.tracks.length > MULTI_TRACK_MAX_TRACKS) {
        add("track_limit_exceeded", "tracks", "轨道数量不能超过 20");
    }
    const trackIds = project.tracks.map((track)=>track.id);
    if (new Set(trackIds).size !== trackIds.length) {
        add("duplicate_track_id", "tracks", "轨道 ID 必须唯一");
    }
    const allElements = project.tracks.flatMap((track)=>track.elements);
    if (allElements.length > MULTI_TRACK_MAX_ELEMENTS) {
        add("element_limit_exceeded", "tracks", "元素数量不能超过 200");
    }
    const elementIds = allElements.map((element)=>element.id);
    if (new Set(elementIds).size !== elementIds.length) {
        add("duplicate_element_id", "tracks", "元素 ID 必须唯一");
    }
    if (!project.tracks.some((track)=>!track.hidden)) {
        add("visible_track_required", "tracks", "至少需要一条未隐藏轨道");
    }
    if (project.tracks.filter((track)=>track.type === "subtitle").length > MULTI_TRACK_MAX_SUBTITLE_TRACKS) {
        add("subtitle_track_limit_exceeded", "tracks", "字幕轨道数量不能超过 10");
    }
    let validVisibleElements = 0;
    project.tracks.forEach((track, trackIndex)=>{
        const trackPath = `tracks.${trackIndex}`;
        if (track.type === "subtitle" && track.elements.length > 1) {
            add("subtitle_track_element_limit", `${trackPath}.elements`, "字幕轨道只能包含一个元素", track);
        }
        const elementIssueCounts = new Map();
        track.elements.forEach((element, elementIndex)=>{
            const before = issues.length;
            const path = `${trackPath}.elements.${elementIndex}`;
            if (track.type !== element.type) {
                add("track_element_type_mismatch", `${path}.type`, "元素类型必须与轨道类型一致", track, element);
            }
            validateElement(project, track, element, path, add);
            elementIssueCounts.set(element.id, issues.length - before);
        });
        const sorted = [
            ...track.elements
        ].sort((left, right)=>left.target_time.start_ms - right.target_time.start_ms || left.target_time.end_ms - right.target_time.end_ms);
        for(let index = 1; index < sorted.length; index += 1){
            const previous = sorted[index - 1];
            const current = sorted[index];
            const overlap = previous.target_time.end_ms - current.target_time.start_ms;
            if (overlap <= 0) continue;
            if (!hasLegalTransition(previous, current, overlap)) {
                add("track_overlap", `${trackPath}.elements`, "同一轨道元素不能重叠", track, previous);
            }
        }
        if (!track.hidden) {
            validVisibleElements += track.elements.filter((element)=>elementIssueCounts.get(element.id) === 0).length;
        }
    });
    if (validVisibleElements === 0) {
        add("valid_element_required", "tracks", "至少需要一个位于未隐藏轨道的有效元素");
    }
    return issues;
}
function validateElement(project, track, element, path, add) {
    const duration = element.target_time.end_ms - element.target_time.start_ms;
    if (element.target_time.start_ms < 0 || element.target_time.end_ms <= element.target_time.start_ms) {
        add("invalid_target_time", `${path}.target_time`, "目标时间必须是非负递增整数区间", track, element);
    }
    if (element.type === "video" || element.type === "audio") {
        validateMediaElement(track, element, path, duration, add);
    }
    if (element.type === "video" || element.type === "image" || element.type === "text" || element.type === "subtitle") {
        validateTransform(project, track, element, path, add);
    }
    if (element.type === "text") {
        const hasSource = Boolean(element.source?.source_node_id.trim()) && Boolean(element.source?.source_handle.trim());
        if (!hasSource && !element.inline_text?.trim()) {
            add("text_source_required", path, "文字需要上游来源或内联内容", track, element);
        }
        validateTextStyle(track, element, path, add);
    }
    if (element.type === "subtitle") {
        if (!element.asset_id?.trim()) {
            add("subtitle_asset_required", `${path}.asset_id`, "字幕需要 SRT 资产", track, element);
        }
        validateTextStyle(track, element, path, add);
    }
    if (element.type === "video" && element.transition !== null && (element.transition.duration_ms <= 0 || element.transition.duration_ms > duration)) {
        add("invalid_transition", `${path}.transition`, "转场时长必须为正且不超过片段时长", track, element);
    }
}
function validateMediaElement(track, element, path, duration, add) {
    const speedIsValid = Number.isFinite(element.speed) && element.speed >= 0.1 && element.speed <= 4;
    if (!speedIsValid) {
        add("invalid_speed", `${path}.speed`, "倍速必须在 0.1 到 4 之间", track, element);
    }
    if (element.volume < 0) {
        add("invalid_volume", `${path}.volume`, "音量不能为负数", track, element);
    }
    if (element.fade_in_ms < 0 || element.fade_out_ms < 0 || element.fade_in_ms > duration || element.fade_out_ms > duration) {
        add("invalid_fade", path, "淡入淡出不能超过片段时长", track, element);
    }
    const trim = element.source_trim;
    if (trim) {
        const trimDuration = trim.end_ms - trim.start_ms;
        if (trim.start_ms < 0 || trim.end_ms <= trim.start_ms) {
            add("invalid_source_trim", `${path}.source_trim`, "源裁切必须是非负递增区间", track, element);
        } else if (speedIsValid && !element.loop && Math.abs(trimDuration / element.speed - duration) > 1) {
            add("duration_mismatch", path, "裁切时长经倍速换算后必须匹配目标时长", track, element);
        }
    }
}
function validateTransform(project, track, element, path, add) {
    const value = element.transform;
    let invalid = value.width <= 0 || value.height <= 0 || value.x < 0 || value.y < 0;
    if (!invalid && project.canvas.mode === "custom" && project.canvas.width !== null && project.canvas.height !== null) {
        invalid = value.x + value.width > project.canvas.width || value.y + value.height > project.canvas.height;
    }
    if (invalid) {
        add("transform_out_of_canvas", `${path}.transform`, "Transform 必须位于画布内", track, element);
    }
}
function validateTextStyle(track, element, path, add) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2d$fonts$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["fontTypeIssue"])(element.style.font_type ?? null)) {
        add("invalid_font_type", `${path}.style.font_type`, "字体必须是官方预置 ID 或 HTTPS TTF/OTF URL", track, element);
    }
    if (element.style.font_size <= 0 || !RGBA_PATTERN.test(element.style.color) || !RGBA_PATTERN.test(element.style.background_color)) {
        add("invalid_text_style", `${path}.style`, "文字样式无效", track, element);
    }
}
function hasLegalTransition(previous, current, overlap) {
    if (previous.type !== "video" || current.type !== "video" || previous.transition === null) {
        return false;
    }
    const duration = previous.transition.duration_ms;
    return duration >= overlap && duration > 0 && duration <= Math.min(previous.target_time.end_ms - previous.target_time.start_ms, current.target_time.end_ms - current.target_time.start_ms);
}
function integerInRange(value, minimum, maximum) {
    return value !== null && Number.isInteger(value) && value >= minimum && value <= maximum;
}
}),
"[project]/lib/aigc/node-display-name.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aigcNodeBaseDisplayName",
    ()=>aigcNodeBaseDisplayName,
    "deriveAigcNodeDisplayNames",
    ()=>deriveAigcNodeDisplayNames
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-rsc] (ecmascript)");
;
;
const MODALITY_NODE_BASE_NAMES = {
    text: "文本节点",
    image: "图片节点",
    video: "视频节点",
    audio: "音频节点"
};
function aigcNodeBaseDisplayName(node) {
    if (node.type in MODALITY_NODE_BASE_NAMES) {
        return MODALITY_NODE_BASE_NAMES[node.type];
    }
    if (node.type === "image_to_image") {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["seedreamImageTitle"])(node);
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(node.type)?.label ?? node.type;
}
function deriveAigcNodeDisplayNames(nodes, managedLabels = new Map()) {
    const baseNames = nodes.map(aigcNodeBaseDisplayName);
    const counts = new Map();
    for (const baseName of baseNames){
        counts.set(baseName, (counts.get(baseName) ?? 0) + 1);
    }
    const seen = new Map();
    return new Map(nodes.map((node, nodeIndex)=>{
        const baseName = baseNames[nodeIndex];
        const duplicateCount = counts.get(baseName) ?? 1;
        const index = (seen.get(baseName) ?? 0) + 1;
        seen.set(baseName, index);
        const automaticName = duplicateCount === 1 ? baseName : `${baseName}${index}`;
        return [
            node.id,
            {
                baseName,
                duplicateCount,
                index,
                displayName: node.custom_name?.trim() || managedLabels.get(node.id)?.trim() || automaticName
            }
        ];
    }));
}
}),
"[project]/lib/aigc/node-registry.ts [app-rsc] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_DEFAULT_IMAGE_MODEL",
    ()=>AIGC_DEFAULT_IMAGE_MODEL,
    "AIGC_DEFAULT_IMAGE_OPERATION",
    ()=>AIGC_DEFAULT_IMAGE_OPERATION,
    "AIGC_DEFAULT_JSON_PATH",
    ()=>AIGC_DEFAULT_JSON_PATH,
    "AIGC_DEFAULT_TEXT_MODEL",
    ()=>AIGC_DEFAULT_TEXT_MODEL,
    "AIGC_DEFAULT_VIDEO_CONFIG",
    ()=>AIGC_DEFAULT_VIDEO_CONFIG,
    "AIGC_EDITOR_NODE_REGISTRY",
    ()=>AIGC_EDITOR_NODE_REGISTRY,
    "AIGC_EXECUTION_NODE_TYPES",
    ()=>AIGC_EXECUTION_NODE_TYPES,
    "AIGC_NODE_REGISTRY",
    ()=>AIGC_NODE_REGISTRY,
    "AIGC_NODE_REGISTRY_BY_TYPE",
    ()=>AIGC_NODE_REGISTRY_BY_TYPE,
    "AIGC_V2_NODE_REGISTRY",
    ()=>AIGC_V2_NODE_REGISTRY,
    "isAigcExecutionNodeType",
    ()=>isAigcExecutionNodeType
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-enhancement.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-face-blur.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/multitrack.ts [app-rsc] (ecmascript)");
;
;
;
;
const AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving";
const AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
const AIGC_DEFAULT_JSON_PATH = "$.items";
const AIGC_DEFAULT_IMAGE_OPERATION = "image_to_image";
const AIGC_DEFAULT_VIDEO_CONFIG = {
    model: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_MODEL"],
    generation_mode: "text_to_video",
    task_type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_TASK_TYPE"],
    resolution: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_RESOLUTION"],
    aspect_ratio: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_ASPECT_RATIO"],
    duration_seconds: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_DURATION_SECONDS"],
    generate_audio: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_GENERATE_AUDIO"]
};
;
;
;
const AIGC_EXECUTION_NODE_TYPES = [
    "llm",
    "text_to_image",
    "image_to_image",
    "video_generation",
    "video_enhancement",
    "video_face_blur",
    "video_subtitle_extraction",
    "multi_track_edit",
    "json_parser"
];
function isAigcExecutionNodeType(type) {
    return AIGC_EXECUTION_NODE_TYPES.includes(type);
}
function port(id, label, type, options = {}) {
    return {
        id,
        label,
        type,
        required: options.required ?? true,
        multiple: options.multiple ?? false,
        max_connections: options.maxConnections ?? 1,
        system_only: options.systemOnly ?? false,
        modes: options.modes ?? []
    };
}
const AIGC_MODEL_CONTROL_NODE_REGISTRY = [
    {
        type: "llm",
        label: "LLM",
        category: "model",
        executable: true,
        inputs: [
            port("prompt", "提示词", "text"),
            port("image", "图片", "image_asset", {
                required: false
            })
        ],
        outputs: [
            port("text", "文本", "text")
        ],
        models: [
            AIGC_DEFAULT_TEXT_MODEL
        ]
    },
    {
        type: "text_to_image",
        label: "文生图",
        category: "model",
        executable: true,
        inputs: [
            port("prompt", "提示词", "text")
        ],
        outputs: [
            port("image", "图片", "image_asset")
        ],
        models: [
            AIGC_DEFAULT_IMAGE_MODEL
        ]
    },
    {
        type: "image_to_image",
        label: "Seedream 图片模型",
        category: "model",
        executable: true,
        inputs: [
            port("image", "图片", "image_asset", {
                multiple: true,
                maxConnections: 10
            }),
            port("edit_image", "编辑图片", "image_asset", {
                required: false
            }),
            port("edit_layer", "编辑图层", "image_layer", {
                required: false
            }),
            port("prompt", "提示词", "text")
        ],
        outputs: [
            port("image", "图片", "image_asset"),
            port("edited_layer", "编辑图层", "edited_layer"),
            port("layers", "图层集", "layer_set")
        ],
        models: [
            AIGC_DEFAULT_IMAGE_MODEL
        ]
    },
    {
        type: "video_generation",
        label: "生视频",
        category: "model",
        executable: true,
        inputs: [
            port("prompt", "提示词", "text", {
                required: false,
                modes: [
                    "text_to_video",
                    "first_frame",
                    "first_last_frame",
                    "multimodal_reference"
                ]
            }),
            port("first_frame", "首帧", "image_asset", {
                required: false,
                modes: [
                    "first_frame",
                    "first_last_frame"
                ]
            }),
            port("last_frame", "尾帧", "image_asset", {
                required: false,
                modes: [
                    "first_last_frame"
                ]
            }),
            port("reference_images", "参考图片", "image_asset", {
                required: false,
                multiple: true,
                maxConnections: 30,
                modes: [
                    "multimodal_reference"
                ]
            }),
            port("reference_videos", "参考视频", "video_asset", {
                required: false,
                multiple: true,
                maxConnections: 10,
                modes: [
                    "multimodal_reference"
                ]
            }),
            port("reference_audios", "参考音频", "audio_asset", {
                required: false,
                multiple: true,
                maxConnections: 10,
                modes: [
                    "multimodal_reference"
                ]
            })
        ],
        outputs: [
            port("video", "视频", "video_asset")
        ],
        models: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SEEDANCE_MODELS"]
    },
    {
        type: "video_enhancement",
        label: "视频画质增强",
        category: "model",
        executable: true,
        inputs: [
            port("video", "视频", "video_asset")
        ],
        outputs: [
            port("video", "视频", "video_asset")
        ],
        models: []
    },
    {
        type: "video_face_blur",
        label: "视频人脸打码",
        category: "model",
        executable: true,
        inputs: [
            port("video", "视频", "video_asset")
        ],
        outputs: [
            port("video", "视频", "video_asset")
        ],
        models: []
    },
    {
        type: "video_subtitle_extraction",
        label: "视频字幕提取",
        category: "model",
        executable: true,
        inputs: [
            port("video", "视频", "video_asset")
        ],
        outputs: [
            port("subtitle", "字幕", "subtitle_asset")
        ],
        models: []
    },
    {
        type: "multi_track_edit",
        label: "多轨剪辑",
        category: "control",
        executable: true,
        inputs: [
            port("videos", "视频", "video_asset", {
                required: false,
                multiple: true,
                maxConnections: 30
            }),
            port("images", "图片", "image_asset", {
                required: false,
                multiple: true,
                maxConnections: 50
            }),
            port("audios", "音频", "audio_asset", {
                required: false,
                multiple: true,
                maxConnections: 30
            }),
            port("texts", "文本", "text", {
                required: false,
                multiple: true,
                maxConnections: 30
            }),
            port("subtitles", "字幕", "subtitle_asset", {
                required: false,
                multiple: true,
                maxConnections: 10
            })
        ],
        outputs: [
            port("video", "视频", "video_asset")
        ],
        models: []
    },
    {
        type: "json_parser",
        label: "JSON 解析器",
        category: "control",
        executable: true,
        inputs: [
            port("text", "文本", "text")
        ],
        outputs: [
            port("items", "文本项", "text", {
                required: false,
                multiple: true,
                maxConnections: 20,
                systemOnly: true
            })
        ],
        models: []
    },
    {
        type: "layer_canvas",
        label: "图层画布",
        category: "control",
        executable: true,
        inputs: [
            port("layers", "图层集", "layer_set")
        ],
        outputs: [
            port("selected_layer", "选中图层", "image_layer", {
                required: false
            }),
            port("layers", "图层集", "layer_set")
        ],
        models: []
    },
    {
        type: "layer_composite",
        label: "图层合成",
        category: "control",
        executable: true,
        inputs: [
            port("layers", "图层集", "layer_set"),
            port("replacement", "替换图层", "edited_layer", {
                required: false
            })
        ],
        outputs: [
            port("image", "图片", "image_asset"),
            port("layers", "图层集", "layer_set")
        ],
        models: []
    }
];
const AIGC_V2_MODALITY_NODE_REGISTRY = [
    {
        type: "text",
        label: "文本节点",
        category: "modality",
        executable: false,
        inputs: [
            port("text", "文本", "text", {
                required: false
            })
        ],
        outputs: [
            port("text", "文本", "text")
        ],
        models: []
    },
    {
        type: "image",
        label: "图片节点",
        category: "modality",
        executable: false,
        inputs: [
            port("image", "图片", "image_asset", {
                required: false
            })
        ],
        outputs: [
            port("image", "图片", "image_asset")
        ],
        models: []
    },
    {
        type: "video",
        label: "视频节点",
        category: "modality",
        executable: false,
        inputs: [
            port("video", "视频", "video_asset", {
                required: false
            })
        ],
        outputs: [
            port("video", "视频", "video_asset")
        ],
        models: []
    },
    {
        type: "audio",
        label: "音频节点",
        category: "modality",
        executable: false,
        inputs: [
            port("audio", "音频", "audio_asset", {
                required: false
            })
        ],
        outputs: [
            port("audio", "音频", "audio_asset")
        ],
        models: []
    }
];
const AIGC_V2_NODE_REGISTRY = [
    ...AIGC_V2_MODALITY_NODE_REGISTRY,
    ...AIGC_MODEL_CONTROL_NODE_REGISTRY
];
const AIGC_NODE_REGISTRY = AIGC_V2_NODE_REGISTRY;
const AIGC_EDITOR_NODE_REGISTRY = AIGC_V2_NODE_REGISTRY;
const AIGC_NODE_REGISTRY_BY_TYPE = new Map(AIGC_V2_NODE_REGISTRY.map((entry)=>[
        entry.type,
        entry
    ]));
}),
"[project]/lib/aigc/seedream-image.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isSeedreamImageEdgeIncompatible",
    ()=>isSeedreamImageEdgeIncompatible,
    "isSeedreamImageInputActive",
    ()=>isSeedreamImageInputActive,
    "isSeedreamImageOutputActive",
    ()=>isSeedreamImageOutputActive,
    "normalizeSeedreamImageConfig",
    ()=>normalizeSeedreamImageConfig,
    "normalizeSeedreamImageSizeForStorage",
    ()=>normalizeSeedreamImageSizeForStorage,
    "seedreamImageEditTarget",
    ()=>seedreamImageEditTarget,
    "seedreamImageInputCount",
    ()=>seedreamImageInputCount,
    "seedreamImageInputLimit",
    ()=>seedreamImageInputLimit,
    "seedreamImageOperation",
    ()=>seedreamImageOperation,
    "seedreamImageTitle",
    ()=>seedreamImageTitle,
    "validateLayerDecompositionAssets",
    ()=>validateLayerDecompositionAssets,
    "validateSeedreamImageDefinition",
    ()=>validateSeedreamImageDefinition
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/image-dimensions.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/media-validation.ts [app-rsc] (ecmascript)");
;
;
;
const OPERATION_LABELS = {
    image_to_image: "图生图",
    image_edit: "图片编辑",
    layer_decomposition: "图层拆分"
};
function seedreamImageOperation(node) {
    return node.config.operation ?? "image_to_image";
}
function seedreamImageTitle(node) {
    return OPERATION_LABELS[seedreamImageOperation(node)];
}
function normalizeSeedreamImageSizeForStorage(size) {
    try {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSeedreamImageSize"])(size);
    } catch  {
        return size;
    }
}
function normalizeSeedreamImageConfig(config, previousOperation) {
    const operation = config.operation ?? "image_to_image";
    let size = config.size;
    if (operation === "layer_decomposition" && previousOperation !== undefined && previousOperation !== operation) {
        size = "auto";
    } else if (operation === "image_edit" && previousOperation !== undefined && previousOperation !== operation && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size)) {
        size = "2K";
    } else if (operation === "image_to_image") {
        size = size === "auto" ? "2K" : normalizeSeedreamImageSizeForStorage(size);
    }
    return {
        ...config,
        operation,
        size
    };
}
function seedreamImageInputCount(edges, nodeId, handleId) {
    return edges.filter((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === handleId).length;
}
function seedreamImageEditTarget(node, edges) {
    if (seedreamImageOperation(node) !== "image_edit") return null;
    const imageCount = seedreamImageInputCount(edges, node.id, "edit_image");
    const layerCount = seedreamImageInputCount(edges, node.id, "edit_layer");
    if (imageCount > 0 && layerCount === 0) return "image";
    if (layerCount > 0 && imageCount === 0) return "layer";
    return null;
}
function isSeedreamImageInputActive(node, portId, edges) {
    const operation = seedreamImageOperation(node);
    if (operation === "image_to_image") {
        return portId === "image" || portId === "prompt";
    }
    if (operation === "layer_decomposition") {
        return portId === "image" || portId === "prompt";
    }
    if (portId === "prompt") return true;
    if (portId !== "edit_image" && portId !== "edit_layer") return false;
    const imageCount = seedreamImageInputCount(edges, node.id, "edit_image");
    const layerCount = seedreamImageInputCount(edges, node.id, "edit_layer");
    if (imageCount > 0 && layerCount > 0) return false;
    const target = seedreamImageEditTarget(node, edges);
    return target === null || target === "image" && portId === "edit_image" || target === "layer" && portId === "edit_layer";
}
function isSeedreamImageOutputActive(node, portId, edges) {
    const operation = seedreamImageOperation(node);
    if (operation === "image_to_image") return portId === "image";
    if (operation === "layer_decomposition") return portId === "layers";
    const target = seedreamImageEditTarget(node, edges);
    return target === "image" && portId === "image" || target === "layer" && portId === "edited_layer";
}
function seedreamImageInputLimit(node, port) {
    if (port.id === "image" && seedreamImageOperation(node) === "layer_decomposition") {
        return 1;
    }
    return port.max_connections;
}
function isSeedreamImageEdgeIncompatible(edge, nodes, edges) {
    const source = nodes.find((node)=>node.id === edge.sourceNodeId);
    if (source?.type === "image_to_image" && !isSeedreamImageOutputActive(source, edge.sourceHandle, edges)) {
        return true;
    }
    const target = nodes.find((node)=>node.id === edge.targetNodeId);
    return Boolean(target?.type === "image_to_image" && !isSeedreamImageInputActive(target, edge.targetHandle, edges));
}
function validateSeedreamImageDefinition(definition) {
    return definition.nodes.flatMap((node)=>{
        const sizeIssue = validateSeedreamImageNodeSize(node);
        if (sizeIssue) return [
            sizeIssue
        ];
        return node.type === "image_to_image" ? validateSeedreamImageNode(node, definition.edges) : [];
    });
}
function validateLayerDecompositionAssets(definition, nodeId, assets) {
    const node = definition.nodes.find((candidate)=>candidate.id === nodeId);
    if (node?.type !== "image_to_image" || seedreamImageOperation(node) !== "layer_decomposition") {
        return [];
    }
    const assetById = new Map(assets.map((asset)=>[
            asset.id,
            asset
        ]));
    const connectedAssets = definition.edges.filter((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === "image" && edge.sourceHandle === "image").flatMap((edge)=>{
        const source = definition.nodes.find((candidate)=>candidate.id === edge.sourceNodeId);
        if (source?.type !== "image" || !source.config.asset_id) return [];
        const asset = assetById.get(source.config.asset_id);
        return asset ? [
            asset
        ] : [];
    });
    for (const asset of connectedAssets){
        const message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["layerDecompositionAssetError"])(asset);
        if (message) {
            return [
                {
                    code: "invalid_media_input",
                    message,
                    nodeId
                }
            ];
        }
    }
    return [];
}
function validateSeedreamImageNode(node, edges) {
    const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get("image_to_image");
    if (!registration) return [];
    const issue = (code, message)=>({
            code,
            message,
            nodeId: node.id
        });
    const counts = Object.fromEntries(registration.inputs.map((port)=>[
            port.id,
            seedreamImageInputCount(edges, node.id, port.id)
        ]));
    if (counts.edit_image > 0 && counts.edit_layer > 0) {
        return [
            issue("edit_target_conflict", "图片编辑只能连接编辑图片或编辑图层中的一个，请断开多余连线")
        ];
    }
    for (const port of registration.inputs){
        if (counts[port.id] > 0 && !isSeedreamImageInputActive(node, port.id, edges)) {
            return [
                issue("input_not_allowed_for_mode", `${port.label}输入不适用于${seedreamImageTitle(node)}模式，请断开对应连线`)
            ];
        }
        const limit = seedreamImageInputLimit(node, port);
        if (counts[port.id] > limit) {
            return [
                issue("input_connection_limit_exceeded", `${port.label}输入最多连接 ${limit} 个，当前为 ${counts[port.id]} 个`)
            ];
        }
    }
    const incompatibleOutput = edges.find((edge)=>edge.sourceNodeId === node.id && !isSeedreamImageOutputActive(node, edge.sourceHandle, edges));
    if (incompatibleOutput) {
        const port = registration.outputs.find((candidate)=>candidate.id === incompatibleOutput.sourceHandle);
        return [
            issue("output_not_allowed_for_mode", `${port?.label ?? incompatibleOutput.sourceHandle}输出不适用于当前编辑目标或模式，请断开对应连线`)
        ];
    }
    const operation = seedreamImageOperation(node);
    if (operation === "image_to_image") {
        if (counts.image === 0) {
            return [
                issue("required_input_missing", "图生图模式必须连接至少一张图片")
            ];
        }
        if (counts.prompt === 0) {
            return [
                issue("required_input_missing", "图生图模式必须连接提示词")
            ];
        }
        return [];
    }
    if (operation === "layer_decomposition") {
        return counts.image === 0 ? [
            issue("required_input_missing", "图层拆分模式必须连接一张图片")
        ] : [];
    }
    if (counts.edit_image + counts.edit_layer === 0) {
        return [
            issue("required_input_missing", "图片编辑模式必须连接一张编辑图片或一个编辑图层")
        ];
    }
    if (counts.prompt === 0) {
        return [
            issue("required_input_missing", "图片编辑模式必须连接提示词")
        ];
    }
    return [];
}
function validateSeedreamImageNodeSize(node) {
    if (node.type !== "text_to_image" && node.type !== "image_to_image") {
        return null;
    }
    const issue = (code, message)=>({
            code,
            message,
            nodeId: node.id
        });
    const size = node.config.size;
    if (node.type === "image_to_image") {
        const operation = seedreamImageOperation(node);
        if (operation === "image_to_image" && size === "auto" || operation === "image_edit" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size) || operation === "layer_decomposition" && size !== "auto" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size)) {
            return issue("size_not_allowed_for_mode", `${seedreamImageTitle(node)}模式不支持尺寸 ${String(size)}`);
        }
    }
    if (size === "auto") return null;
    try {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["normalizeSeedreamImageSize"])(size);
        return null;
    } catch (error) {
        return issue("invalid_image_size", seedreamImageDimensionErrorMessage(error));
    }
}
function seedreamImageDimensionErrorMessage(error) {
    if (!(error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["SeedreamImageDimensionError"])) {
        return "图片尺寸无效";
    }
    if (error.code === "invalid_format") {
        return "图片尺寸格式必须为 WIDTHxHEIGHT";
    }
    if (error.code === "non_positive") {
        return "图片宽度和高度必须为正整数";
    }
    if (error.code === "pixel_count_out_of_range") {
        return "图片总像素必须在 921,600–4,624,220 之间";
    }
    return "图片宽高比必须在 1:16–16:1 之间";
}
}),
"[project]/lib/aigc/video-enhancement.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG",
    ()=>AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG,
    "VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS",
    ()=>VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS,
    "VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT",
    ()=>VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT,
    "VIDEO_ENHANCEMENT_BITRATE_LEVELS",
    ()=>VIDEO_ENHANCEMENT_BITRATE_LEVELS,
    "VIDEO_ENHANCEMENT_BITRATE_RANGE",
    ()=>VIDEO_ENHANCEMENT_BITRATE_RANGE,
    "VIDEO_ENHANCEMENT_BIT_DEPTHS",
    ()=>VIDEO_ENHANCEMENT_BIT_DEPTHS,
    "VIDEO_ENHANCEMENT_FPS_RANGE",
    ()=>VIDEO_ENHANCEMENT_FPS_RANGE,
    "VIDEO_ENHANCEMENT_RESOLUTIONS",
    ()=>VIDEO_ENHANCEMENT_RESOLUTIONS,
    "VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE",
    ()=>VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE,
    "VIDEO_ENHANCEMENT_SCENES",
    ()=>VIDEO_ENHANCEMENT_SCENES,
    "VIDEO_ENHANCEMENT_STYLES",
    ()=>VIDEO_ENHANCEMENT_STYLES,
    "VIDEO_ENHANCEMENT_TOOL_VERSIONS",
    ()=>VIDEO_ENHANCEMENT_TOOL_VERSIONS,
    "normalizeVideoEnhancementConfig",
    ()=>normalizeVideoEnhancementConfig,
    "validateVideoEnhancementConfig",
    ()=>validateVideoEnhancementConfig
]);
const VIDEO_ENHANCEMENT_TOOL_VERSIONS = [
    "standard",
    "professional"
];
const VIDEO_ENHANCEMENT_SCENES = [
    "common",
    "ugc",
    "short_series",
    "aigc",
    "old_film"
];
const VIDEO_ENHANCEMENT_STYLES = [
    "hd",
    "natural"
];
const VIDEO_ENHANCEMENT_RESOLUTIONS = [
    "240p",
    "360p",
    "480p",
    "540p",
    "720p",
    "1080p",
    "2k",
    "4k",
    "8k"
];
const VIDEO_ENHANCEMENT_BITRATE_LEVELS = [
    "low",
    "medium",
    "high"
];
const VIDEO_ENHANCEMENT_BIT_DEPTHS = [
    8,
    10,
    12,
    16
];
const VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE = {
    minimum: 128,
    maximum: 4320
};
const VIDEO_ENHANCEMENT_FPS_RANGE = {
    minimum: 15,
    maximum: 120
};
const VIDEO_ENHANCEMENT_BITRATE_RANGE = {
    minimum: 10,
    maximum: 150000
};
const VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS = 40;
const VIDEO_ENHANCEMENT_16_BIT_OUTPUT_FORMAT = "mov";
const AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG = {
    tool_version: "standard",
    scene: "aigc",
    enhance_style: "hd",
    resolution_mode: "preset",
    resolution: "1080p",
    resolution_limit: null,
    fps: null,
    bitrate_mode: "level",
    bitrate_level: "medium",
    bitrate: null,
    bit_depth: 8
};
function validateVideoEnhancementConfig(config, inputDurationSeconds) {
    const errors = [];
    if (config.resolution_mode === "preset") {
        if (config.resolution === null || !VIDEO_ENHANCEMENT_RESOLUTIONS.includes(config.resolution) || config.resolution_limit !== null) {
            errors.push("invalid_resolution");
        }
    } else if (!isIntegerInRange(config.resolution_limit, VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE) || config.resolution !== null) {
        errors.push("invalid_resolution_limit");
    }
    if (config.fps !== null && !isIntegerInRange(config.fps, VIDEO_ENHANCEMENT_FPS_RANGE)) {
        errors.push("invalid_fps");
    }
    if (config.tool_version === "standard") {
        if (config.scene === null || !VIDEO_ENHANCEMENT_SCENES.includes(config.scene)) {
            errors.push("scene_required");
        }
        if (config.bit_depth !== 8) {
            errors.push("professional_bit_depth_required");
        }
    } else if (config.scene !== null) {
        errors.push("professional_scene_forbidden");
    }
    if (config.bit_depth === 16) {
        if (config.tool_version !== "professional") {
            errors.push("professional_16_bit_required");
        }
        if (config.bitrate_mode !== null || config.bitrate_level !== null || config.bitrate !== null) {
            errors.push("bitrate_forbidden_for_16_bit");
        }
        if (inputDurationSeconds !== undefined && inputDurationSeconds > VIDEO_ENHANCEMENT_16_BIT_MAX_DURATION_SECONDS) {
            errors.push("input_duration_exceeds_16_bit_limit");
        }
    } else if (config.bitrate_mode === "level") {
        if (config.bitrate_level === null || !VIDEO_ENHANCEMENT_BITRATE_LEVELS.includes(config.bitrate_level) || config.bitrate !== null) {
            errors.push("invalid_bitrate_level");
        }
    } else if (config.bitrate_mode !== "custom" || config.bitrate_level !== null || !isIntegerInRange(config.bitrate, VIDEO_ENHANCEMENT_BITRATE_RANGE)) {
        errors.push("invalid_bitrate");
    }
    return errors;
}
function normalizeVideoEnhancementConfig(config) {
    const toolVersion = VIDEO_ENHANCEMENT_TOOL_VERSIONS.includes(config.tool_version) ? config.tool_version : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.tool_version;
    const resolutionMode = config.resolution_mode === "short_edge" ? "short_edge" : "preset";
    const resolution = VIDEO_ENHANCEMENT_RESOLUTIONS.includes(config.resolution) ? config.resolution : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.resolution;
    const fps = config.fps === null || config.fps === undefined ? null : normalizeInteger(config.fps, VIDEO_ENHANCEMENT_FPS_RANGE, VIDEO_ENHANCEMENT_FPS_RANGE.minimum);
    const bitDepth = toolVersion === "professional" && VIDEO_ENHANCEMENT_BIT_DEPTHS.includes(config.bit_depth) ? config.bit_depth : 8;
    const common = {
        tool_version: toolVersion,
        scene: toolVersion === "standard" && VIDEO_ENHANCEMENT_SCENES.includes(config.scene) ? config.scene : toolVersion === "standard" ? AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.scene : null,
        enhance_style: VIDEO_ENHANCEMENT_STYLES.includes(config.enhance_style) ? config.enhance_style : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.enhance_style,
        fps,
        bit_depth: bitDepth
    };
    const dimensions = resolutionMode === "short_edge" ? {
        resolution_mode: "short_edge",
        resolution: null,
        resolution_limit: normalizeInteger(config.resolution_limit, VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE, 1080)
    } : {
        resolution_mode: "preset",
        resolution,
        resolution_limit: null
    };
    if (bitDepth === 16) {
        return {
            ...common,
            ...dimensions,
            tool_version: "professional",
            scene: null,
            bit_depth: 16,
            bitrate_mode: null,
            bitrate_level: null,
            bitrate: null
        };
    }
    const bitrate = config.bitrate_mode === "custom" ? {
        bitrate_mode: "custom",
        bitrate_level: null,
        bitrate: normalizeInteger(config.bitrate, VIDEO_ENHANCEMENT_BITRATE_RANGE, 8000)
    } : {
        bitrate_mode: "level",
        bitrate_level: VIDEO_ENHANCEMENT_BITRATE_LEVELS.includes(config.bitrate_level) ? config.bitrate_level : AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG.bitrate_level,
        bitrate: null
    };
    return {
        ...common,
        ...dimensions,
        ...bitrate,
        bit_depth: bitDepth
    };
}
function isIntegerInRange(value, range) {
    return value !== null && Number.isInteger(value) && value >= range.minimum && value <= range.maximum;
}
function normalizeInteger(value, range, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
    return Math.min(range.maximum, Math.max(range.minimum, Math.round(value)));
}
}),
"[project]/lib/aigc/video-face-blur.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG",
    ()=>AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG,
    "VIDEO_FACE_BLUR_MASK_MODES",
    ()=>VIDEO_FACE_BLUR_MASK_MODES,
    "VIDEO_FACE_BLUR_MASK_STRENGTHS",
    ()=>VIDEO_FACE_BLUR_MASK_STRENGTHS,
    "validateVideoFaceBlurConfig",
    ()=>validateVideoFaceBlurConfig,
    "validateVideoFaceBlurDefinition",
    ()=>validateVideoFaceBlurDefinition,
    "videoFaceBlurModeLabel",
    ()=>videoFaceBlurModeLabel,
    "videoFaceBlurStrengthLabel",
    ()=>videoFaceBlurStrengthLabel
]);
const VIDEO_FACE_BLUR_MASK_MODES = [
    "mosaic",
    "blur"
];
const VIDEO_FACE_BLUR_MASK_STRENGTHS = [
    "low",
    "medium",
    "high"
];
const AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG = {
    mask_mode: "mosaic",
    mask_strength: "medium"
};
function videoFaceBlurModeLabel(value) {
    return value === "mosaic" ? "马赛克" : "高斯模糊";
}
function videoFaceBlurStrengthLabel(value) {
    return ({
        low: "低强度",
        medium: "中等强度",
        high: "高强度"
    })[value];
}
function validateVideoFaceBlurConfig(config) {
    if (!config || typeof config !== "object") {
        return [
            "invalid_mask_mode",
            "invalid_mask_strength"
        ];
    }
    const candidate = config;
    const issues = [];
    if (!VIDEO_FACE_BLUR_MASK_MODES.includes(candidate.mask_mode)) {
        issues.push("invalid_mask_mode");
    }
    if (!VIDEO_FACE_BLUR_MASK_STRENGTHS.includes(candidate.mask_strength)) {
        issues.push("invalid_mask_strength");
    }
    return issues;
}
function validateVideoFaceBlurDefinition(definition) {
    return definition.nodes.flatMap((node)=>{
        if (node.type !== "video_face_blur") return [];
        return validateVideoFaceBlurConfig(node.config).map((code)=>({
                code,
                message: code === "invalid_mask_mode" ? "打码方式无效" : "打码强度无效",
                nodeId: node.id
            }));
    });
}
}),
"[project]/lib/api-client.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ApiError",
    ()=>ApiError,
    "apiClient",
    ()=>apiClient,
    "createApiClient",
    ()=>createApiClient,
    "getBackendBaseUrl",
    ()=>getBackendBaseUrl,
    "getSafeProviderErrorSummary",
    ()=>getSafeProviderErrorSummary,
    "getUserFacingErrorMessage",
    ()=>getUserFacingErrorMessage,
    "isApiError",
    ()=>isApiError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-types.ts [app-rsc] (ecmascript)");
;
const DEFAULT_BACKEND_BASE_URL = "http://localhost:8000";
const STAGE_ENDPOINTS = {
    story: "story",
    character: "characters",
    script: "script",
    storyboard: "storyboard",
    image: "images",
    video: "videos",
    compose: "compose"
};
const TEXT_ARTIFACT_ENDPOINTS = {
    script: "script",
    story: "story",
    storyboard: "storyboard"
};
class ApiError extends Error {
    code;
    detail;
    responseBody;
    status;
    constructor({ code, detail, message, responseBody, status }){
        super(message);
        this.name = "ApiError";
        this.code = code;
        this.detail = detail;
        this.responseBody = responseBody;
        this.status = status;
    }
}
function isApiError(error) {
    return error instanceof ApiError;
}
function getSafeProviderErrorSummary(detail) {
    if (!detail) {
        return null;
    }
    const fields = new Map();
    for (const part of detail.split(";")){
        const separator = part.indexOf("=");
        if (separator < 1) continue;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if ([
            "provider_code",
            "request_id",
            "provider_task_id",
            "phase"
        ].includes(key) && /^[A-Za-z0-9._:/-]{1,200}$/.test(value)) {
            fields.set(key, value);
        }
    }
    const providerCode = fields.get("provider_code");
    if (!providerCode) {
        return null;
    }
    return [
        `方舟错误码：${providerCode}`,
        fields.get("request_id") ? `Request ID：${fields.get("request_id")}` : null,
        fields.get("provider_task_id") ? `任务 ID：${fields.get("provider_task_id")}` : null
    ].filter(Boolean).join(" · ");
}
function getSafeExternalServiceMessage(message) {
    if (!message || message === "external provider error was redacted") {
        return null;
    }
    if (!/^[\w\s.,:/()_-]{1,160}$/.test(message)) {
        return null;
    }
    return message;
}
function getSafeExternalServiceErrorSummary(detail) {
    if (!detail) {
        return null;
    }
    const labels = {
        asset_id: "资产",
        phase: "阶段",
        provider: "服务",
        reason: "原因",
        returncode: "返回码",
        shot_id: "镜头"
    };
    const fields = new Map();
    for (const part of detail.split(";")){
        const separator = part.indexOf("=");
        if (separator < 1) continue;
        const key = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (key in labels && /^[A-Za-z0-9._:/-]{1,200}$/.test(value)) {
            fields.set(key, value);
        }
    }
    return [
        "provider",
        "phase",
        "reason",
        "returncode",
        "shot_id",
        "asset_id"
    ].map((key)=>{
        const value = fields.get(key);
        return value ? `${labels[key]}：${value}` : null;
    }).filter(Boolean).join(" · ") || null;
}
function getUserFacingErrorMessage(error) {
    if (isApiError(error)) {
        if (error.code === "validation_error" && error.detail) {
            return error.detail;
        }
        if (error.status >= 500) {
            if (error.code === "external_service_error") {
                const externalMessage = getSafeExternalServiceMessage(error.message);
                const externalSummary = getSafeExternalServiceErrorSummary(error.detail);
                const parts = [
                    externalMessage,
                    externalSummary
                ].filter(Boolean);
                if (parts.length > 0) {
                    return `服务暂时不可用。${parts.join(" · ")}`;
                }
            }
            const providerSummary = getSafeProviderErrorSummary(error.detail);
            return providerSummary ? `服务暂时不可用。${providerSummary}` : "服务暂时不可用，请稍后重试。";
        }
        return error.message || "请求未完成，请检查输入后重试。";
    }
    return "请求未完成，请检查网络连接后重试。";
}
function getBackendBaseUrl() {
    return ("TURBOPACK compile-time value", "http://127.0.0.1:8001")?.trim() || DEFAULT_BACKEND_BASE_URL;
}
function createApiClient(options = {}) {
    const baseUrl = normalizeBaseUrl(options.baseUrl ?? getBackendBaseUrl());
    const fetcher = options.fetcher ?? fetch;
    const defaultHeaders = options.headers;
    return {
        listProjects (keywordOrOptions, options) {
            const keyword = typeof keywordOrOptions === "string" ? keywordOrOptions : undefined;
            const requestOptions = typeof keywordOrOptions === "string" ? options : keywordOrOptions;
            const searchParams = new URLSearchParams();
            if (keyword) {
                searchParams.set("q", keyword);
            }
            const query = searchParams.toString();
            return request(fetcher, baseUrl, `/api/projects${query ? `?${query}` : ""}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        createProject (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/projects", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        getProject (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        deleteProject (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        updateProject (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        listImagePromptVersions (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getImagePromptVersion (projectId, versionId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions/${encodeURIComponent(versionId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        saveImagePromptVersion (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-prompt-versions`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        generateImagePrompt (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-prompts/generate`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        uploadImageProjectReference (projectId, file, options = {}) {
            const searchParams = new URLSearchParams();
            if (options.filename) searchParams.set("filename", options.filename);
            if (options.mimeType) searchParams.set("mime_type", options.mimeType);
            const query = searchParams.toString();
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-references/upload${query ? `?${query}` : ""}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": "application/octet-stream"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        setImageProjectReferenceSelection (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-reference-selection`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PUT"
            });
        },
        generateProjectImage (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-generations`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        editProjectImage (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-generations`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        decomposeImageLayers (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        listImageLayerSets (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getImageLayerSet (projectId, setId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets/${encodeURIComponent(setId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        updateImageLayerSet (projectId, setId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets/${encodeURIComponent(setId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        getCanvasLayout (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/canvas-layout`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        saveCanvasLayout (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/canvas-layout`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PUT"
            });
        },
        composeImageLayers (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-compositions`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        editImageLayerContent (projectId, setId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/image-layer-sets/${encodeURIComponent(setId)}/content-edits`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        selectCurrentImage (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/current-image`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        updateTextArtifact (projectId, stage, payload, requestOptions) {
            const endpoint = TEXT_ARTIFACT_ENDPOINTS[stage];
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        deleteTextArtifact (projectId, artifactId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/text-artifacts/${encodeURIComponent(artifactId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        listProjectAssets (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/assets`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        listAssets (filters = {}, requestOptions) {
            const searchParams = new URLSearchParams();
            if (filters.projectId) {
                searchParams.set("project_id", filters.projectId);
            }
            if (filters.category) {
                searchParams.set("category", filters.category);
            }
            if (filters.status) {
                searchParams.set("status", filters.status);
            }
            const query = searchParams.toString();
            return request(fetcher, baseUrl, `/api/assets${query ? `?${query}` : ""}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        listToolAssets (requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/assets", {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        listToolTasks (requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/tasks", {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getToolTask (taskId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tools/tasks/${encodeURIComponent(taskId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        deleteToolTask (taskId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tools/tasks/${encodeURIComponent(taskId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        createToolTask (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/tasks", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        uploadToolAsset (kind, file, options = {}) {
            const searchParams = new URLSearchParams({
                kind
            });
            if (options.filename) searchParams.set("filename", options.filename);
            if (options.mimeType) searchParams.set("mime_type", options.mimeType);
            return request(fetcher, baseUrl, `/api/tools/assets/upload?${searchParams.toString()}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": options.mimeType || file.type || "application/octet-stream"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        submitFaceBlurVideo (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/face-blur-video", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        generateToolVideo (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/videos", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        optimizeToolVideoPrompt (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/tools/videos/optimize-prompt", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        retryToolTask (taskId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tools/tasks/${encodeURIComponent(taskId)}/retry`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        getAsset (assetId, requestOptions) {
            return request(fetcher, baseUrl, `/api/assets/${encodeURIComponent(assetId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        renameAsset (assetId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/assets/${encodeURIComponent(assetId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        deleteAsset (projectId, assetId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        deleteToolAsset (assetId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tools/assets/${encodeURIComponent(assetId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        generateStage (projectId, stage, requestOptions) {
            const endpoint = STAGE_ENDPOINTS[stage];
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        streamGenerationStage (projectId, stage, onEvent, requestOptions) {
            const endpoint = STAGE_ENDPOINTS[stage];
            return requestEventStream(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/${endpoint}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            }, parseGenerationStreamEvent, onEvent);
        },
        skipCharacters (projectId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/characters/skip`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        iterateCharacterAsset (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/character-assets/iterations`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        updateCharacterCard (projectId, cardId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        deleteCharacterCard (projectId, cardId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        generateCharacterCardImage (projectId, cardId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/character-cards/${encodeURIComponent(cardId)}/generate-image`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        getStoryboardShotVideoConfig (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/video-config`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        updateStoryboardShotVideoConfig (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/video-config`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PATCH"
            });
        },
        optimizeStoryboardShotVideoPrompt (projectId, shotId, videoPrompt, onEvent = ()=>{}, requestOptions) {
            let completed = null;
            return requestEventStream(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/optimize-video-prompt`, {
                ...requestOptions,
                body: {
                    video_prompt: videoPrompt
                },
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            }, parsePromptOptimizationStreamEvent, (event)=>{
                onEvent(event);
                if (event.type === "complete") {
                    completed = {
                        optimized_prompt: event.optimized_prompt
                    };
                }
            }).then(()=>{
                if (completed === null) {
                    throw new ApiError({
                        code: "generation_failed",
                        message: "optimization stream ended without a result",
                        responseBody: null,
                        status: 500
                    });
                }
                return completed;
            });
        },
        setStoryboardShotFirstFrame (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        clearStoryboardShotFirstFrame (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        uploadStoryboardShotFirstFrame (projectId, shotId, file, options = {}) {
            const searchParams = new URLSearchParams();
            if (options.filename) searchParams.set("filename", options.filename);
            if (options.mimeType) searchParams.set("mime_type", options.mimeType);
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/first-frame/upload?${searchParams.toString()}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": options.mimeType || file.type || "application/octet-stream"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        attachStoryboardShotReference (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        removeStoryboardShotReference (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        applyStoryboardShotLastFrameReference (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/last-frame-reference`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        ensureStoryboardShotLastFrameReferenceAsset (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/last-frame-reference-asset`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        deleteStoryboardShot (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        mergeStoryboardShots (projectId, shotIds, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/merge`, {
                ...requestOptions,
                body: {
                    shot_ids: shotIds
                },
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        splitStoryboardShot (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/split`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        uploadStoryboardShotReference (projectId, shotId, kind, file, options = {}) {
            const searchParams = new URLSearchParams({
                kind
            });
            if (options.filename) {
                searchParams.set("filename", options.filename);
            }
            if (options.mimeType) {
                searchParams.set("mime_type", options.mimeType);
            }
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/references/upload?${searchParams.toString()}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": options.mimeType || file.type || "application/octet-stream"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        generateStoryboardShotVideo (projectId, shotId, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/generate-video`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        editStoryboardShotVideo (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/edit-video`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        selectStoryboardShotVideo (projectId, shotId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/shots/${encodeURIComponent(shotId)}/select-video`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        generateStoryboardShotVideoByLocator (projectId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/projects/${encodeURIComponent(projectId)}/storyboard/generate-video`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        listAigcTemplates (filters = {}, requestOptions) {
            return request(fetcher, baseUrl, withAigcListQuery("/api/aigc/templates", filters), {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getAigcTemplate (templateId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/templates/${encodeURIComponent(templateId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        deleteAigcTemplate (templateId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/templates/${encodeURIComponent(templateId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        updateAigcTemplate (templateId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/templates/${encodeURIComponent(templateId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PUT"
            });
        },
        instantiateAigcTemplate (templateId, payload = {}, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/templates/${encodeURIComponent(templateId)}/instantiate`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        listAigcPipelines (filters = {}, requestOptions) {
            return request(fetcher, baseUrl, withAigcListQuery("/api/aigc/pipelines", filters), {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getAigcPipeline (pipelineId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        listAigcPipelineThumbnailCandidates (pipelineId, filters = {}, requestOptions) {
            return request(fetcher, baseUrl, withAigcListQuery(`/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/thumbnail-candidates`, filters), {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        updateAigcPipelineThumbnail (pipelineId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/thumbnail`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PUT"
            });
        },
        deleteAigcPipeline (pipelineId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "DELETE"
            });
        },
        updateAigcPipeline (pipelineId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "PUT"
            });
        },
        saveAigcPipelineAsTemplate (pipelineId, payload, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/templates`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        optimizeAigcPrompt (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/aigc/prompts/optimize", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        createAigcRun (pipelineId, payload, idempotencyKey, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/runs`, {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, {
                    "Idempotency-Key": idempotencyKey
                }, requestOptions?.headers),
                method: "POST"
            });
        },
        listAigcRuns (pipelineId, filters = {}, requestOptions) {
            return request(fetcher, baseUrl, withAigcListQuery(`/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/runs`, filters), {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getAigcRun (runId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/runs/${encodeURIComponent(runId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        getAigcInternalRunAsset (pipelineId, runId, assetId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/pipelines/${encodeURIComponent(pipelineId)}/runs/${encodeURIComponent(runId)}/assets/${encodeURIComponent(assetId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        retryAigcRunNode (runId, nodeId, idempotencyKey, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/runs/${encodeURIComponent(runId)}/nodes/${encodeURIComponent(nodeId)}/retry`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, {
                    "Idempotency-Key": idempotencyKey
                }, requestOptions?.headers),
                method: "POST"
            });
        },
        cancelAigcRun (runId, requestOptions) {
            return request(fetcher, baseUrl, `/api/aigc/runs/${encodeURIComponent(runId)}/cancel`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        createAigcPipeline (payload, requestOptions) {
            return request(fetcher, baseUrl, "/api/aigc/pipelines", {
                ...requestOptions,
                body: payload,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        uploadAigcMedia (kind, file, options = {}) {
            const searchParams = new URLSearchParams();
            if (options.filename) searchParams.set("filename", options.filename);
            if (options.mimeType) searchParams.set("mime_type", options.mimeType);
            const query = searchParams.toString();
            return request(fetcher, baseUrl, `/api/aigc/assets/${kind}s${query ? `?${query}` : ""}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": options.mimeType || file.type || "application/octet-stream"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        uploadAigcSubtitle (file, options = {}) {
            const searchParams = new URLSearchParams();
            if (options.filename) searchParams.set("filename", options.filename);
            searchParams.set("mime_type", options.mimeType || file.type || "application/x-subrip");
            return request(fetcher, baseUrl, `/api/aigc/assets/subtitles?${searchParams.toString()}`, {
                ...options,
                body: file,
                headers: mergeHeaders(defaultHeaders, {
                    "Content-Type": options.mimeType || file.type || "application/x-subrip"
                }, options.headers),
                json: false,
                method: "POST"
            });
        },
        uploadAigcImage (file, options = {}) {
            return this.uploadAigcMedia("image", file, options);
        },
        getTask (taskId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tasks/${encodeURIComponent(taskId)}`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers)
            });
        },
        retryTask (taskId, requestOptions) {
            return request(fetcher, baseUrl, `/api/tasks/${encodeURIComponent(taskId)}/retry`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            });
        },
        retryTextTask (taskId, onEvent, requestOptions) {
            return requestEventStream(fetcher, baseUrl, `/api/tasks/${encodeURIComponent(taskId)}/retry`, {
                ...requestOptions,
                headers: mergeHeaders(defaultHeaders, requestOptions?.headers),
                method: "POST"
            }, parseGenerationStreamEvent, onEvent);
        }
    };
}
function withAigcListQuery(path, filters) {
    const searchParams = new URLSearchParams();
    const query = filters.query?.trim();
    if (query) searchParams.set("q", query);
    if (filters.page !== undefined) searchParams.set("page", String(filters.page));
    if (filters.pageSize !== undefined) {
        searchParams.set("page_size", String(filters.pageSize));
    }
    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
}
const apiClient = createApiClient();
async function requestEventStream(fetcher, baseUrl, path, config, parseEvent, onEvent) {
    const { body, headers, json = true, method = "POST", ...requestOptions } = config;
    const response = await fetcher(buildUrl(baseUrl, path), {
        ...requestOptions,
        body: body === undefined ? undefined : json ? JSON.stringify(body) : body,
        headers: mergeHeaders({
            Accept: "text/event-stream"
        }, body === undefined || !json ? undefined : {
            "Content-Type": "application/json"
        }, headers),
        method
    });
    if (!response.ok) {
        throw await parseApiError(response);
    }
    if (!response.body) {
        throw streamProtocolError("stream response has no body");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    async function dispatch(block) {
        const parsed = parseSseBlock(block);
        if (!parsed) return;
        const data = parsed.data.length > 0 ? JSON.parse(parsed.data) : null;
        const event = parseEvent(parsed.event, data);
        onEvent(event);
        if (parsed.event === "error" && isApiErrorPayload(data)) {
            const payload = sanitizeApiErrorPayload(data);
            throw new ApiError({
                ...payload,
                responseBody: data,
                status: 500
            });
        }
    }
    while(true){
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, {
            stream: !done
        });
        let match = /\r?\n\r?\n/.exec(buffer);
        while(match){
            const block = buffer.slice(0, match.index);
            buffer = buffer.slice(match.index + match[0].length);
            await dispatch(block);
            match = /\r?\n\r?\n/.exec(buffer);
        }
        if (done) break;
    }
    if (buffer.trim().length > 0) {
        await dispatch(buffer);
    }
}
function parseSseBlock(block) {
    let event = "message";
    const data = [];
    for (const line of block.split(/\r?\n/)){
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) {
            event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
            data.push(line.slice(5).trimStart());
        }
    }
    return data.length > 0 ? {
        event,
        data: data.join("\n")
    } : null;
}
function parseGenerationStreamEvent(eventName, data) {
    if (!isObject(data)) throw streamProtocolError("invalid generation stream event");
    if (eventName === "delta" && typeof data.text === "string") {
        return {
            type: "delta",
            text: data.text
        };
    }
    if ((eventName === "task" || eventName === "complete") && isObject(data.task)) {
        return {
            type: eventName,
            task: data.task
        };
    }
    if (eventName === "error" && isApiErrorPayload(data)) {
        return {
            type: "error",
            error: sanitizeApiErrorPayload(data)
        };
    }
    throw streamProtocolError(`unsupported generation stream event: ${eventName}`);
}
function parsePromptOptimizationStreamEvent(eventName, data) {
    if (!isObject(data)) throw streamProtocolError("invalid optimization stream event");
    if (eventName === "delta" && typeof data.text === "string") {
        return {
            type: "delta",
            text: data.text
        };
    }
    if (eventName === "complete" && typeof data.optimized_prompt === "string") {
        return {
            type: "complete",
            optimized_prompt: data.optimized_prompt
        };
    }
    if (eventName === "error" && isApiErrorPayload(data)) {
        return {
            type: "error",
            error: sanitizeApiErrorPayload(data)
        };
    }
    throw streamProtocolError(`unsupported optimization stream event: ${eventName}`);
}
function streamProtocolError(message) {
    return new ApiError({
        code: "generation_failed",
        message,
        responseBody: null,
        status: 500
    });
}
async function request(fetcher, baseUrl, path, config = {}) {
    const { body, headers, json = true, method = "GET", ...requestOptions } = config;
    const response = await fetcher(buildUrl(baseUrl, path), {
        ...requestOptions,
        body: body === undefined ? undefined : json ? JSON.stringify(body) : body,
        headers: mergeHeaders(body === undefined || !json ? undefined : {
            "Content-Type": "application/json"
        }, headers),
        method
    });
    if (!response.ok) {
        throw await parseApiError(response);
    }
    if (response.status === 204) {
        return undefined;
    }
    return await response.json();
}
async function parseApiError(response) {
    const responseBody = sanitizeErrorBody(await readResponseBody(response));
    const payload = sanitizeApiErrorPayload(toApiErrorPayload(response.status, responseBody));
    return new ApiError({
        ...payload,
        responseBody,
        status: response.status
    });
}
function toApiErrorPayload(status, body) {
    if (isObject(body)) {
        const detail = body.detail;
        if (isApiErrorPayload(detail)) {
            return detail;
        }
        if (Array.isArray(detail)) {
            return {
                code: "validation_error",
                detail: formatValidationDetail(detail),
                message: "request validation failed"
            };
        }
        if (typeof detail === "string" && detail.length > 0) {
            return {
                code: "unknown",
                detail,
                message: detail
            };
        }
        if (isApiErrorPayload(body)) {
            return body;
        }
    }
    return {
        code: "unknown",
        detail: typeof body === "string" && body.length > 0 ? body : undefined,
        message: `request failed with status ${status}`
    };
}
function sanitizeApiErrorPayload(payload) {
    return {
        ...payload,
        detail: payload.detail ? sanitizeErrorText(payload.detail) : undefined,
        message: sanitizeErrorText(payload.message)
    };
}
function sanitizeErrorBody(value) {
    if (typeof value === "string") {
        return sanitizeErrorText(value);
    }
    if (Array.isArray(value)) {
        return value.map((item)=>sanitizeErrorBody(item));
    }
    if (isObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item])=>[
                key,
                sanitizeErrorBody(item)
            ]));
    }
    return value;
}
function sanitizeErrorText(value) {
    let sanitized = value.replace(/https?:\/\/[^\s"'<>]+/gi, (url)=>{
        try {
            const parsed = new URL(url);
            if (/(^|&)(x-tos-|signature|x-amz-|expires|token)/i.test(parsed.search.slice(1))) {
                parsed.search = "";
            }
            return parsed.toString();
        } catch  {
            return url;
        }
    });
    sanitized = sanitized.replace(/\b(ark[_-]?(?:api[_-]?)?key|tos[_-]?(?:ak|sk|access[_-]?key|secret[_-]?key)|password|passwd|pwd|secret|token|signature)\b\s*[:=]\s*[^,\s;]+/gi, "$1=[redacted]");
    sanitized = sanitized.replace(/\b(sk-[a-z0-9][a-z0-9._-]{8,}|ak-[a-z0-9][a-z0-9._-]{8,}|ark-[a-z0-9][a-z0-9._-]{8,})\b/gi, "[redacted-key]");
    sanitized = sanitized.replace(/\b((?:mysql|postgres(?:ql)?):\/\/[^:\s/@]+):([^@\s]+)@/gi, "$1:[redacted]@");
    if (/\b(provider|vendor|upstream)\b/i.test(sanitized) && /\b(sensitive|secret|signature|token|password|sk-|ark[_-]?key|tos[_-]?(?:ak|sk))\b/i.test(sanitized)) {
        return "external provider error was redacted";
    }
    return sanitized;
}
async function readResponseBody(response) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        try {
            return await response.json();
        } catch  {
            return null;
        }
    }
    try {
        return await response.text();
    } catch  {
        return null;
    }
}
function buildUrl(baseUrl, path) {
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
function normalizeBaseUrl(baseUrl) {
    return baseUrl.replace(/\/+$/, "");
}
function mergeHeaders(...headersList) {
    const headers = new Headers();
    for (const headersInit of headersList){
        if (headersInit === undefined) {
            continue;
        }
        new Headers(headersInit).forEach((value, key)=>{
            headers.set(key, value);
        });
    }
    return headers;
}
function isApiErrorPayload(value) {
    return isObject(value) && isErrorCode(value.code) && typeof value.message === "string";
}
function isErrorCode(value) {
    return typeof value === "string" && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$types$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ERROR_CODES"].includes(value);
}
function isObject(value) {
    return typeof value === "object" && value !== null;
}
function formatValidationDetail(detail) {
    return detail.map((item)=>{
        const path = item.loc?.join(".");
        return path ? `${path}: ${item.msg ?? item.type ?? "invalid"}` : item.msg;
    }).filter(Boolean).join("; ");
}
}),
"[project]/lib/api-types.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ASSET_CATEGORIES",
    ()=>ASSET_CATEGORIES,
    "ASSET_TYPES",
    ()=>ASSET_TYPES,
    "CHARACTER_ASSET_ITERATION_OPERATIONS",
    ()=>CHARACTER_ASSET_ITERATION_OPERATIONS,
    "ERROR_CODES",
    ()=>ERROR_CODES,
    "REFERENCE_ASSET_KINDS",
    ()=>REFERENCE_ASSET_KINDS,
    "STAGES",
    ()=>STAGES,
    "STATUSES",
    ()=>STATUSES
]);
const STATUSES = [
    "draft",
    "queued",
    "running",
    "succeeded",
    "skipped",
    "failed",
    "cancelled",
    "expired",
    "stale"
];
const STAGES = [
    "brief",
    "story",
    "character",
    "script",
    "storyboard",
    "image",
    "video",
    "compose"
];
const ASSET_TYPES = [
    "uploaded_image",
    "uploaded_video",
    "uploaded_audio",
    "generated_image",
    "storyboard_video",
    "final_video",
    "subtitle"
];
const ASSET_CATEGORIES = [
    "character",
    "scene",
    "reference"
];
const REFERENCE_ASSET_KINDS = [
    "image",
    "video",
    "audio"
];
const CHARACTER_ASSET_ITERATION_OPERATIONS = [
    "edit",
    "regenerate"
];
const ERROR_CODES = [
    "validation_error",
    "not_found",
    "dependency_missing",
    "task_conflict",
    "invalid_state",
    "generation_failed",
    "external_service_error",
    "unknown"
];
}),
"[project]/lib/asset-display.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ASSET_SECTIONS",
    ()=>ASSET_SECTIONS,
    "ASSET_SIDEBAR_OPTIONS",
    ()=>ASSET_SIDEBAR_OPTIONS,
    "artifactMatchesKeyword",
    ()=>artifactMatchesKeyword,
    "assetMatchesKeyword",
    ()=>assetMatchesKeyword,
    "buildArtifactItems",
    ()=>buildArtifactItems,
    "getArtifactKindLabel",
    ()=>getArtifactKindLabel,
    "getArtifactKindTypeLabel",
    ()=>getArtifactKindTypeLabel,
    "getAssetCategoryLabel",
    ()=>getAssetCategoryLabel,
    "getAssetContentUrlById",
    ()=>getAssetContentUrlById,
    "getAssetDownloadUrl",
    ()=>getAssetDownloadUrl,
    "getAssetDownloadUrlById",
    ()=>getAssetDownloadUrlById,
    "getAssetSectionDescription",
    ()=>getAssetSectionDescription,
    "getAssetSectionLabel",
    ()=>getAssetSectionLabel,
    "getAssetSidebarLabel",
    ()=>getAssetSidebarLabel,
    "getImageOperationLabel",
    ()=>getImageOperationLabel,
    "getSafeAssetContentUrl",
    ()=>getSafeAssetContentUrl,
    "getSafeLastFrameUrl",
    ()=>getSafeLastFrameUrl,
    "getSafePreviewUrl",
    ()=>getSafePreviewUrl,
    "getStatusLabel",
    ()=>getStatusLabel,
    "getWorkspaceAssetDescription",
    ()=>getWorkspaceAssetDescription,
    "getWorkspaceAssetSourceGroup",
    ()=>getWorkspaceAssetSourceGroup,
    "isArtifactAsset",
    ()=>isArtifactAsset,
    "isImageProductAsset",
    ()=>isImageProductAsset,
    "partitionWorkspaceAssets",
    ()=>partitionWorkspaceAssets,
    "validateAssetDisplayName",
    ()=>validateAssetDisplayName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-rsc] (ecmascript)");
;
const CATEGORY_LABELS = {
    character: "角色",
    reference: "参考素材",
    scene: "场景"
};
const ASSET_SECTIONS = [
    "character",
    "scene",
    "product",
    "artifacts"
];
const ASSET_SIDEBAR_OPTIONS = [
    "all",
    "character",
    "scene",
    "product",
    "artifacts"
];
const SECTION_LABELS = {
    artifacts: "产物",
    character: "角色",
    product: "图片",
    scene: "场景"
};
const SECTION_DESCRIPTIONS = {
    artifacts: "分镜视频片段、尾帧图与视频编辑结果等创作产物。",
    character: "项目中的角色形象资产。",
    product: "文生图、图片编辑与图层合成的公开图片成品。",
    scene: "项目中的场景视觉资产。"
};
const ARTIFACT_KIND_LABELS = {
    final_video: "视频编辑结果",
    last_frame: "尾帧图",
    storyboard_video: "分镜视频片段"
};
/** Short "资产类型" tags that distinguish artifact subtypes on cards. */ const ARTIFACT_KIND_TYPE_LABELS = {
    final_video: "产物-视频编辑",
    last_frame: "产物-尾帧",
    storyboard_video: "产物-分镜视频"
};
const ARTIFACT_ASSET_TYPES = new Set([
    "storyboard_video",
    "final_video"
]);
const IMAGE_PRODUCT_OPERATIONS = new Set([
    "text_to_image",
    "image_to_image",
    "layer_composite"
]);
const STATUS_LABELS = {
    cancelled: "已取消",
    draft: "草稿",
    expired: "已过期",
    failed: "失败",
    queued: "排队中",
    running: "生成中",
    skipped: "已跳过",
    stale: "需更新",
    succeeded: "已完成"
};
const DEFAULT_DESCRIPTIONS = {
    character: "角色形象资产",
    reference: "分镜视频参考素材",
    scene: "场景视觉资产"
};
function getAssetCategoryLabel(category) {
    return CATEGORY_LABELS[category];
}
function getAssetSectionLabel(section) {
    return SECTION_LABELS[section];
}
function getAssetSidebarLabel(option) {
    return option === "all" ? "全部" : SECTION_LABELS[option];
}
function getAssetSectionDescription(section) {
    return SECTION_DESCRIPTIONS[section];
}
function getArtifactKindLabel(kind) {
    return ARTIFACT_KIND_LABELS[kind];
}
function getArtifactKindTypeLabel(kind) {
    return ARTIFACT_KIND_TYPE_LABELS[kind];
}
function isArtifactAsset(asset) {
    return ARTIFACT_ASSET_TYPES.has(asset.type);
}
function isImageProductAsset(asset) {
    return asset.type === "generated_image" && asset.asset_role !== "internal_base" && asset.asset_role !== "internal_layer" && typeof asset.metadata.operation === "string" && IMAGE_PRODUCT_OPERATIONS.has(asset.metadata.operation);
}
function getImageOperationLabel(asset) {
    const operation = asset.metadata.operation;
    if (operation === "text_to_image") return "文生图";
    if (operation === "image_to_image") return "图片编辑";
    if (operation === "layer_composite") return "图层合成";
    return "图片产物";
}
function hasAvailableLastFrame(asset) {
    return asset.type === "storyboard_video" && asset.metadata.last_frame_status === "available" && getSafeLastFrameUrl(asset) !== null;
}
function buildArtifactItems(assets) {
    const items = [];
    for (const asset of assets){
        if (asset.type === "storyboard_video") {
            items.push({
                asset,
                isLastFrame: false,
                key: asset.id,
                kind: "storyboard_video"
            });
            if (hasAvailableLastFrame(asset)) {
                items.push({
                    asset,
                    isLastFrame: true,
                    key: `${asset.id}:last-frame`,
                    kind: "last_frame"
                });
            }
        } else if (asset.type === "final_video") {
            items.push({
                asset,
                isLastFrame: false,
                key: asset.id,
                kind: "final_video"
            });
        }
    }
    return items;
}
function getStatusLabel(status) {
    return STATUS_LABELS[status];
}
function getWorkspaceAssetSourceGroup(asset) {
    if (asset.asset_role === "internal_base" || asset.asset_role === "internal_layer") {
        return null;
    }
    if (asset.project_id !== null) {
        return "projects";
    }
    if (asset.tool_asset_role == null) {
        return null;
    }
    return getMetadataText(asset.metadata.origin) === "aigc" ? "aigc" : "tools";
}
function partitionWorkspaceAssets(assets) {
    const assetsById = new Map();
    const sourcePriority = {
        aigc: 2,
        tools: 1,
        projects: 3
    };
    for (const asset of assets){
        const source = getWorkspaceAssetSourceGroup(asset);
        if (!source) continue;
        const existing = assetsById.get(asset.id);
        if (!existing || sourcePriority[source] > sourcePriority[existing.source]) {
            assetsById.set(asset.id, {
                asset,
                source
            });
        }
    }
    const partition = {
        aigc: [],
        projects: [],
        tools: []
    };
    for (const { asset, source } of assetsById.values()){
        partition[source].push(asset);
    }
    return partition;
}
function getWorkspaceAssetDescription(asset) {
    const metadata = asset.metadata;
    const userDefinedName = getMetadataText(metadata.name_scheme) === "user_defined_v1" ? getMetadataText(metadata.name) : null;
    const unifiedAigcName = getMetadataText(metadata.name_scheme) === "aigc_canvas_node_v1" ? getMetadataText(metadata.name) : null;
    return userDefinedName ?? unifiedAigcName ?? getMetadataText(metadata.description) ?? getMetadataText(metadata.name) ?? getMetadataText(metadata.prompt_summary) ?? getMetadataText(metadata.prompt) ?? (asset.category ? DEFAULT_DESCRIPTIONS[asset.category] : "创意资产");
}
function validateAssetDisplayName(value) {
    const name = value.trim();
    if (name.length === 0) {
        return {
            error: "请输入资产名称。"
        };
    }
    if (/[\u0000-\u001f\u007f]/.test(name)) {
        return {
            error: "名称不能包含控制字符。"
        };
    }
    if (Array.from(name).length > 120) {
        return {
            error: "名称不能超过 120 个字符。"
        };
    }
    return {
        name
    };
}
/** Case-insensitive substring match; an empty keyword matches everything. */ function matchesKeyword(text, keyword) {
    const needle = keyword.trim().toLowerCase();
    if (needle.length === 0) {
        return true;
    }
    return text.toLowerCase().includes(needle);
}
function assetMatchesKeyword(asset, keyword) {
    return matchesKeyword(getWorkspaceAssetDescription(asset), keyword);
}
function artifactMatchesKeyword(item, keyword) {
    return matchesKeyword(getArtifactKindLabel(item.kind), keyword) || matchesKeyword(getWorkspaceAssetDescription(item.asset), keyword);
}
function getSafePreviewUrl(asset) {
    return getSafeAssetContentUrl(asset.url);
}
function getAssetContentUrlById(assetId) {
    const normalizedId = assetId.trim();
    if (!normalizedId) return null;
    const baseUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "");
    return `${baseUrl}/api/assets/${encodeURIComponent(normalizedId)}/content`;
}
function getSafeAssetContentUrl(value) {
    return getSafeMediaUrl(value, "/content");
}
function getAssetDownloadUrl(asset) {
    const nameScheme = getMetadataText(asset.metadata.name_scheme);
    const filename = nameScheme === "user_defined_v1" ? getMetadataText(asset.metadata.name) ?? undefined : undefined;
    return getAssetDownloadUrlById(asset.id, filename);
}
function getAssetDownloadUrlById(assetId, filename) {
    const normalizedId = assetId.trim();
    if (!normalizedId) return null;
    const baseUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "");
    const params = new URLSearchParams({
        download: "1"
    });
    if (filename?.trim()) params.set("filename", filename.trim());
    return `${baseUrl}/api/assets/${encodeURIComponent(normalizedId)}/content?${params.toString()}`;
}
function getSafeLastFrameUrl(asset) {
    const value = asset.metadata.last_frame_url;
    return getSafeMediaUrl(typeof value === "string" ? value : null, "/last-frame");
}
function getSafeMediaUrl(value, expectedApiSuffix) {
    if (!value) {
        return null;
    }
    if (value.startsWith("/api/assets/") && value.endsWith(expectedApiSuffix)) {
        return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "")}${value}`;
    }
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch  {
        return null;
    }
}
function getMetadataText(value) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
}),
"[project]/lib/seedance.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SEEDANCE_ASPECT_RATIOS",
    ()=>SEEDANCE_ASPECT_RATIOS,
    "SEEDANCE_CAPABILITIES",
    ()=>SEEDANCE_CAPABILITIES,
    "SEEDANCE_DEFAULT_ASPECT_RATIO",
    ()=>SEEDANCE_DEFAULT_ASPECT_RATIO,
    "SEEDANCE_DEFAULT_DURATION_SECONDS",
    ()=>SEEDANCE_DEFAULT_DURATION_SECONDS,
    "SEEDANCE_DEFAULT_GENERATE_AUDIO",
    ()=>SEEDANCE_DEFAULT_GENERATE_AUDIO,
    "SEEDANCE_DEFAULT_MODEL",
    ()=>SEEDANCE_DEFAULT_MODEL,
    "SEEDANCE_DEFAULT_RESOLUTION",
    ()=>SEEDANCE_DEFAULT_RESOLUTION,
    "SEEDANCE_DEFAULT_TASK_TYPE",
    ()=>SEEDANCE_DEFAULT_TASK_TYPE,
    "SEEDANCE_MODELS",
    ()=>SEEDANCE_MODELS,
    "isSeedanceDurationValid",
    ()=>isSeedanceDurationValid,
    "normalizeSeedanceVideoParameters",
    ()=>normalizeSeedanceVideoParameters,
    "seedanceInputDurationLimit",
    ()=>seedanceInputDurationLimit,
    "seedanceVideoInputMinimum",
    ()=>seedanceVideoInputMinimum,
    "validateSeedanceReferenceCounts",
    ()=>validateSeedanceReferenceCounts
]);
const SEEDANCE_ASPECT_RATIOS = [
    "16:9",
    "4:3",
    "1:1",
    "3:4",
    "9:16",
    "21:9",
    "adaptive"
];
const SEEDANCE_CAPABILITIES = {
    "doubao-seedance-2-5-260628": {
        displayName: "Seedance 2.5",
        maxReferenceImages: 30,
        maxReferenceVideos: 10,
        maxReferenceAudios: 10,
        maxInputDurationSeconds: 30,
        promptLanguages: [
            "中",
            "英",
            "西",
            "印尼",
            "葡",
            "日",
            "马来",
            "泰",
            "阿",
            "越",
            "韩"
        ],
        resolutions: [
            "480p",
            "720p",
            "1080p"
        ],
        duration: {
            minimum: 4,
            maximum: 30
        }
    },
    "doubao-seedance-2-0-260128": {
        displayName: "Seedance 2.0",
        maxReferenceImages: 9,
        maxReferenceVideos: 3,
        maxReferenceAudios: 3,
        maxInputDurationSeconds: 15,
        promptLanguages: [
            "中",
            "英",
            "西",
            "印尼",
            "葡",
            "日"
        ],
        resolutions: [
            "480p",
            "720p",
            "1080p",
            "4k"
        ],
        duration: {
            minimum: 4,
            maximum: 15
        }
    },
    "doubao-seedance-2-0-fast-260128": {
        displayName: "Seedance 2.0 Fast",
        maxReferenceImages: 9,
        maxReferenceVideos: 3,
        maxReferenceAudios: 3,
        maxInputDurationSeconds: 15,
        promptLanguages: [
            "中",
            "英",
            "西",
            "印尼",
            "葡",
            "日"
        ],
        resolutions: [
            "480p",
            "720p"
        ],
        duration: {
            minimum: 4,
            maximum: 15
        }
    },
    "doubao-seedance-2-0-mini-260615": {
        displayName: "Seedance 2.0 Mini",
        maxReferenceImages: 9,
        maxReferenceVideos: 3,
        maxReferenceAudios: 3,
        maxInputDurationSeconds: 15,
        promptLanguages: [
            "中",
            "英",
            "西",
            "印尼",
            "葡",
            "日"
        ],
        resolutions: [
            "480p",
            "720p"
        ],
        duration: {
            minimum: 4,
            maximum: 15
        }
    }
};
const SEEDANCE_MODELS = Object.keys(SEEDANCE_CAPABILITIES);
const SEEDANCE_DEFAULT_MODEL = "doubao-seedance-2-5-260628";
const SEEDANCE_DEFAULT_RESOLUTION = "720p";
const SEEDANCE_DEFAULT_ASPECT_RATIO = "adaptive";
const SEEDANCE_DEFAULT_DURATION_SECONDS = -1;
const SEEDANCE_DEFAULT_GENERATE_AUDIO = true;
const SEEDANCE_DEFAULT_TASK_TYPE = "generate";
function seedanceInputDurationLimit(model) {
    return model === SEEDANCE_DEFAULT_MODEL ? 30 : 15;
}
function seedanceVideoInputMinimum(model, taskType) {
    return model === SEEDANCE_DEFAULT_MODEL && (taskType === "edit" || taskType === "extend") ? 4 : 2;
}
function isSeedanceDurationValid(model, durationSeconds) {
    if (durationSeconds === SEEDANCE_DEFAULT_DURATION_SECONDS) return true;
    const { minimum, maximum } = SEEDANCE_CAPABILITIES[model].duration;
    return Number.isInteger(durationSeconds) && durationSeconds >= minimum && durationSeconds <= maximum;
}
function normalizeSeedanceVideoParameters(model, parameters) {
    const capabilities = SEEDANCE_CAPABILITIES[model];
    const resolutions = capabilities.resolutions;
    return {
        duration_seconds: isSeedanceDurationValid(model, parameters.duration_seconds) ? parameters.duration_seconds : SEEDANCE_DEFAULT_DURATION_SECONDS,
        resolution: resolutions.includes(parameters.resolution) ? parameters.resolution : SEEDANCE_DEFAULT_RESOLUTION
    };
}
function validateSeedanceReferenceCounts(model, counts) {
    const capabilities = SEEDANCE_CAPABILITIES[model];
    return counts.images <= capabilities.maxReferenceImages && counts.videos <= capabilities.maxReferenceVideos && counts.audios <= capabilities.maxReferenceAudios;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0eotmpw._.js.map