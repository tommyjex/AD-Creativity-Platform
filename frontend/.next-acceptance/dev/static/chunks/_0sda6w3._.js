(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/ui/badge.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Badge",
    ()=>Badge,
    "badgeVariants",
    ()=>badgeVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const badgeVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] transition-colors focus:outline-none focus:ring-1 focus:ring-ring", {
    variants: {
        variant: {
            default: "border-primary/20 bg-primary/[0.08] text-primary hover:bg-primary/[0.12]",
            secondary: "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
            destructive: "border-destructive/30 bg-destructive/[0.12] text-destructive shadow hover:bg-destructive/[0.16]",
            outline: "border-border bg-card text-foreground",
            signal: "border-primary/20 bg-primary/[0.07] text-primary",
            success: "border-success/30 bg-success/10 text-success",
            warning: "border-warning/[0.35] bg-warning/10 text-warning",
            info: "border-info/[0.35] bg-info/10 text-info"
        }
    },
    defaultVariants: {
        variant: "default"
    }
});
function Badge({ className, variant, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(badgeVariants({
            variant
        }), className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/badge.tsx",
        lineNumber: 36,
        columnNumber: 10
    }, this);
}
_c = Badge;
;
var _c;
__turbopack_context__.k.register(_c, "Badge");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/button.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button,
    "buttonVariants",
    ()=>buttonVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-slot/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
;
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold tracking-[-0.01em] transition-all duration-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50", {
    variants: {
        variant: {
            default: "bg-primary text-primary-foreground shadow-[0_8px_20px_hsl(var(--primary)/0.18)] hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-[0_12px_26px_hsl(var(--primary)/0.22)]",
            destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
            outline: "border border-border bg-card text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 hover:text-primary",
            secondary: "bg-secondary/[0.82] text-secondary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-secondary",
            ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
            signal: "border border-primary/20 bg-primary/[0.07] text-primary hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/10",
            cinematic: "bg-primary text-primary-foreground shadow-[0_10px_28px_hsl(var(--primary)/0.20)] hover:-translate-y-0.5 hover:bg-primary/90",
            link: "text-primary underline-offset-4 hover:underline"
        },
        size: {
            default: "h-9 px-4 py-2",
            sm: "h-8 rounded-md px-3 text-xs",
            lg: "h-11 rounded-xl px-8",
            icon: "h-9 w-9"
        }
    },
    defaultVariants: {
        variant: "default",
        size: "default"
    }
});
const Button = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = ({ className, variant, size, asChild = false, ...props }, ref)=>{
    const Comp = asChild ? __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$slot$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Slot"] : "button";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Comp, {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(buttonVariants({
            variant,
            size,
            className
        })),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/button.tsx",
        lineNumber: 52,
        columnNumber: 7
    }, ("TURBOPACK compile-time value", void 0));
});
_c1 = Button;
Button.displayName = "Button";
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Button$React.forwardRef");
__turbopack_context__.k.register(_c1, "Button");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Dialog",
    ()=>Dialog,
    "DialogClose",
    ()=>DialogClose,
    "DialogContent",
    ()=>DialogContent,
    "DialogDescription",
    ()=>DialogDescription,
    "DialogFooter",
    ()=>DialogFooter,
    "DialogHeader",
    ()=>DialogHeader,
    "DialogOverlay",
    ()=>DialogOverlay,
    "DialogPortal",
    ()=>DialogPortal,
    "DialogTitle",
    ()=>DialogTitle,
    "DialogTrigger",
    ()=>DialogTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-dialog/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
const Dialog = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"];
const DialogTrigger = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"];
const DialogPortal = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"];
const DialogClose = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"];
const DialogOverlay = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"], {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-[2px]", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 18,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c = DialogOverlay;
DialogOverlay.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Overlay"].displayName;
const DialogContent = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c1 = ({ children, className, closeButtonClassName, hideCloseButton = false, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogPortal, {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DialogOverlay, {}, void 0, false, {
                fileName: "[project]/components/ui/dialog.tsx",
                lineNumber: 52,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-border bg-card shadow-2xl outline-none", "rounded-2xl sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:rounded-3xl", "data-[state=open]:animate-in data-[state=closed]:animate-out", "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95", className),
                ref: ref,
                ...props,
                children: [
                    children,
                    hideCloseButton ? null : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Close"], {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:pointer-events-none", closeButtonClassName),
                        "aria-label": "关闭",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                            "aria-hidden": "true",
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/ui/dialog.tsx",
                            lineNumber: 74,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/components/ui/dialog.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/components/ui/dialog.tsx",
                lineNumber: 53,
                columnNumber: 5
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 51,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c2 = DialogContent;
DialogContent.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"].displayName;
function DialogHeader({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col gap-1.5 text-left", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 88,
        columnNumber: 5
    }, this);
}
_c3 = DialogHeader;
function DialogFooter({ className, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className),
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 100,
        columnNumber: 5
    }, this);
}
_c4 = DialogFooter;
const DialogTitle = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c5 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"], {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-lg font-semibold tracking-[-0.025em] text-foreground", className),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 114,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c6 = DialogTitle;
DialogTitle.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Title"].displayName;
const DialogDescription = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c7 = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"], {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-sm leading-6 text-muted-foreground", className),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/dialog.tsx",
        lineNumber: 129,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c8 = DialogDescription;
DialogDescription.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$dialog$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Description"].displayName;
;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8;
__turbopack_context__.k.register(_c, "DialogOverlay");
__turbopack_context__.k.register(_c1, "DialogContent$React.forwardRef");
__turbopack_context__.k.register(_c2, "DialogContent");
__turbopack_context__.k.register(_c3, "DialogHeader");
__turbopack_context__.k.register(_c4, "DialogFooter");
__turbopack_context__.k.register(_c5, "DialogTitle$React.forwardRef");
__turbopack_context__.k.register(_c6, "DialogTitle");
__turbopack_context__.k.register(_c7, "DialogDescription$React.forwardRef");
__turbopack_context__.k.register(_c8, "DialogDescription");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/input.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Input",
    ()=>Input
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const Input = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = ({ className, type, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-base shadow-sm transition-all file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
        ref: ref,
        type: type,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/input.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0)));
_c1 = Input;
Input.displayName = "Input";
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Input$React.forwardRef");
__turbopack_context__.k.register(_c1, "Input");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/ui/label.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Label",
    ()=>Label
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const Label = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/label.tsx",
        lineNumber: 9,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c1 = Label;
Label.displayName = "Label";
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Label$React.forwardRef");
__turbopack_context__.k.register(_c1, "Label");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcThumbnailDialog",
    ()=>AigcThumbnailDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useMutation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-client] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function AigcThumbnailDialog({ onOpenChange, onUpdated, open, pipeline }) {
    _s();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedAssetId, setSelectedAssetId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const candidatesQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            "aigc",
            "pipeline-thumbnail-candidates",
            pipeline?.id
        ],
        queryFn: {
            "AigcThumbnailDialog.useQuery[candidatesQuery]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAigcPipelineThumbnailCandidates(pipeline.id, {
                    page: 1,
                    pageSize: 50
                })
        }["AigcThumbnailDialog.useQuery[candidatesQuery]"],
        enabled: open && pipeline !== null
    });
    const updateMutation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "AigcThumbnailDialog.useMutation[updateMutation]": (assetId)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].updateAigcPipelineThumbnail(pipeline.id, {
                    asset_id: assetId
                })
        }["AigcThumbnailDialog.useMutation[updateMutation]"],
        onError: {
            "AigcThumbnailDialog.useMutation[updateMutation]": (mutationError)=>setError((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(mutationError))
        }["AigcThumbnailDialog.useMutation[updateMutation]"],
        onSuccess: {
            "AigcThumbnailDialog.useMutation[updateMutation]": (updated)=>{
                void queryClient.invalidateQueries({
                    queryKey: [
                        "aigc",
                        "pipelines"
                    ]
                });
                setError(null);
                setSelectedAssetId(null);
                onUpdated(updated);
                onOpenChange(false);
            }
        }["AigcThumbnailDialog.useMutation[updateMutation]"]
    });
    function close(nextOpen) {
        if (!nextOpen && !updateMutation.isPending) {
            setError(null);
            setSelectedAssetId(null);
            onOpenChange(false);
        }
    }
    const candidates = candidatesQuery.data?.items ?? [];
    const selected = candidates.find((candidate)=>candidate.asset_id === selectedAssetId) ?? null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
        onOpenChange: close,
        open: open,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "max-w-3xl p-6 sm:p-7",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                            children: "选择缩略图"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 78,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                            children: "仅展示该画布成功运行产生的图片和视频结果。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 79,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 77,
                    columnNumber: 9
                }, this),
                candidatesQuery.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid min-h-48 place-items-center text-sm text-muted-foreground",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                        className: "h-4 w-4 animate-spin"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                        lineNumber: 85,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 84,
                    columnNumber: 11
                }, this) : candidatesQuery.error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                    children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(candidatesQuery.error)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 88,
                    columnNumber: 11
                }, this) : candidates.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border border-dashed px-3 py-8 text-center text-sm text-muted-foreground",
                    children: "尚无可用的图片或视频产物。"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 92,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    "aria-label": "缩略图候选",
                    className: "grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3",
                    role: "radiogroup",
                    children: candidates.map((candidate)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ThumbnailCandidate, {
                            candidate: candidate,
                            onSelect: setSelectedAssetId,
                            selected: selectedAssetId === candidate.asset_id
                        }, candidate.asset_id, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 102,
                            columnNumber: 15
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 96,
                    columnNumber: 11
                }, this),
                error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive",
                    role: "alert",
                    children: error
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 112,
                    columnNumber: 11
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                    className: "mt-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            disabled: updateMutation.isPending,
                            onClick: ()=>close(false),
                            type: "button",
                            variant: "ghost",
                            children: "取消"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 117,
                            columnNumber: 11
                        }, this),
                        pipeline?.thumbnail_asset_id ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            disabled: updateMutation.isPending,
                            onClick: ()=>updateMutation.mutate(null),
                            type: "button",
                            variant: "outline",
                            children: "清除缩略图"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 126,
                            columnNumber: 13
                        }, this) : null,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            disabled: !selected || updateMutation.isPending,
                            onClick: ()=>{
                                if (selected) updateMutation.mutate(selected.asset_id);
                            },
                            type: "button",
                            children: [
                                updateMutation.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                    className: "h-4 w-4 animate-spin"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                                    lineNumber: 143,
                                    columnNumber: 15
                                }, this) : null,
                                "使用所选缩略图"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                            lineNumber: 135,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 116,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
            lineNumber: 76,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
        lineNumber: 75,
        columnNumber: 5
    }, this);
}
_s(AigcThumbnailDialog, "R3tIpjeSfylSUj3dnvIrW2Yu6Ac=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"]
    ];
});
_c = AigcThumbnailDialog;
function ThumbnailCandidate({ candidate, onSelect, selected }) {
    const isImage = candidate.kind === "image";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        "aria-checked": selected,
        className: `overflow-hidden border text-left transition ${selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"}`,
        onClick: ()=>onSelect(candidate.asset_id),
        role: "radio",
        type: "button",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "aspect-[4/3] bg-muted",
                children: isImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        alt: "",
                        className: "h-full w-full object-contain",
                        src: candidate.url
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                        lineNumber: 181,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 178,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                    className: "h-full w-full object-contain",
                    muted: true,
                    playsInline: true,
                    preload: "metadata",
                    src: candidate.url
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                    lineNumber: 188,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                lineNumber: 176,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "flex items-center gap-1 px-2 py-1.5 text-xs",
                children: [
                    isImage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"], {
                        className: "h-3.5 w-3.5"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                        lineNumber: 199,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
                        className: "h-3.5 w-3.5"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                        lineNumber: 201,
                        columnNumber: 11
                    }, this),
                    isImage ? "图片" : "视频",
                    " · ",
                    candidate.node_id
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
                lineNumber: 197,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx",
        lineNumber: 165,
        columnNumber: 5
    }, this);
}
_c1 = ThumbnailCandidate;
var _c, _c1;
__turbopack_context__.k.register(_c, "AigcThumbnailDialog");
__turbopack_context__.k.register(_c1, "ThumbnailCandidate");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-workspace.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcWorkspace",
    ()=>AigcWorkspace
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useMutation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-right.js [app-client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-left.js [app-client] (ecmascript) <export default as ChevronLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chevron-right.js [app-client] (ecmascript) <export default as ChevronRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CirclePlus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-plus.js [app-client] (ecmascript) <export default as CirclePlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eraser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eraser$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eraser.js [app-client] (ecmascript) <export default as Eraser>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$stack$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileStack$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-stack.js [app-client] (ecmascript) <export default as FileStack>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$git$2d$fork$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__GitFork$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/git-fork.js [app-client] (ecmascript) <export default as GitFork>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pencil.js [app-client] (ecmascript) <export default as Pencil>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/plus.js [app-client] (ecmascript) <export default as Plus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/workflow.js [app-client] (ecmascript) <export default as Workflow>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$thumbnail$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-thumbnail-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/definition-migration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$workspace$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/workspace-preview.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$project$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/project-display.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
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
;
;
;
;
const PAGE_SIZE = 20;
const EMPTY_DEFINITION = {
    schemaVersion: 2,
    nodes: [],
    edges: [],
    viewport: {
        x: 0,
        y: 0,
        zoom: 1
    }
};
function pipelineRoute(pipelineId) {
    return `/workspace/aigc/pipelines/${pipelineId}`;
}
function AigcWorkspace({ initialError, initialPipelines, initialTemplates, initialView = "templates" }) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    const [view, setView] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialView);
    const [draftQuery, setDraftQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [page, setPage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(1);
    const [feedback, setFeedback] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialError ?? null);
    const [isCreateOpen, setIsCreateOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [newPipelineName, setNewPipelineName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [deleteTarget, setDeleteTarget] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [deleteError, setDeleteError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [thumbnailPipeline, setThumbnailPipeline] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const templatesQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        initialData: !initialError && page === 1 && query === "" ? initialTemplates : undefined,
        placeholderData: {
            "AigcWorkspace.useQuery[templatesQuery]": (previous)=>previous
        }["AigcWorkspace.useQuery[templatesQuery]"],
        queryFn: {
            "AigcWorkspace.useQuery[templatesQuery]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAigcTemplates({
                    page,
                    pageSize: PAGE_SIZE,
                    query
                })
        }["AigcWorkspace.useQuery[templatesQuery]"],
        queryKey: [
            "aigc",
            "templates",
            query,
            page
        ],
        enabled: view === "templates"
    });
    const pipelinesQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        initialData: !initialError && page === 1 && query === "" ? initialPipelines : undefined,
        placeholderData: {
            "AigcWorkspace.useQuery[pipelinesQuery]": (previous)=>previous
        }["AigcWorkspace.useQuery[pipelinesQuery]"],
        queryFn: {
            "AigcWorkspace.useQuery[pipelinesQuery]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAigcPipelines({
                    page,
                    pageSize: PAGE_SIZE,
                    query
                })
        }["AigcWorkspace.useQuery[pipelinesQuery]"],
        queryKey: [
            "aigc",
            "pipelines",
            query,
            page
        ],
        enabled: view === "pipelines"
    });
    const activeQuery = view === "templates" ? templatesQuery : pipelinesQuery;
    const activeData = activeQuery.data;
    const instantiateMutation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "AigcWorkspace.useMutation[instantiateMutation]": (template)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].instantiateAigcTemplate(template.id)
        }["AigcWorkspace.useMutation[instantiateMutation]"],
        onError: {
            "AigcWorkspace.useMutation[instantiateMutation]": (error)=>setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error))
        }["AigcWorkspace.useMutation[instantiateMutation]"],
        onSuccess: {
            "AigcWorkspace.useMutation[instantiateMutation]": (pipeline)=>{
                void queryClient.invalidateQueries({
                    queryKey: [
                        "aigc",
                        "pipelines"
                    ]
                });
                router.push(pipelineRoute(pipeline.id));
            }
        }["AigcWorkspace.useMutation[instantiateMutation]"]
    });
    const createMutation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "AigcWorkspace.useMutation[createMutation]": (name)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].createAigcPipeline({
                    name,
                    description: "",
                    definition: structuredClone(EMPTY_DEFINITION),
                    source_template_id: null,
                    source_template_revision: null
                })
        }["AigcWorkspace.useMutation[createMutation]"],
        onError: {
            "AigcWorkspace.useMutation[createMutation]": (error)=>setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error))
        }["AigcWorkspace.useMutation[createMutation]"],
        onSuccess: {
            "AigcWorkspace.useMutation[createMutation]": (pipeline)=>{
                void queryClient.invalidateQueries({
                    queryKey: [
                        "aigc",
                        "pipelines"
                    ]
                });
                setIsCreateOpen(false);
                setNewPipelineName("");
                router.push(pipelineRoute(pipeline.id));
            }
        }["AigcWorkspace.useMutation[createMutation]"]
    });
    const deleteMutation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "AigcWorkspace.useMutation[deleteMutation]": (target)=>target.kind === "template" ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].deleteAigcTemplate(target.id) : __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].deleteAigcPipeline(target.id)
        }["AigcWorkspace.useMutation[deleteMutation]"],
        onError: {
            "AigcWorkspace.useMutation[deleteMutation]": (error)=>setDeleteError((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error))
        }["AigcWorkspace.useMutation[deleteMutation]"],
        onSuccess: {
            "AigcWorkspace.useMutation[deleteMutation]": (_result, target)=>{
                setDeleteTarget(null);
                setDeleteError(null);
                void queryClient.invalidateQueries({
                    queryKey: [
                        "aigc",
                        target.kind === "template" ? "templates" : "pipelines"
                    ]
                });
            }
        }["AigcWorkspace.useMutation[deleteMutation]"]
    });
    const totalPages = Math.max(1, Math.ceil((activeData?.total ?? 0) / PAGE_SIZE));
    const errorMessage = activeQuery.error ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(activeQuery.error) : feedback;
    function changeView(nextView) {
        setView(nextView);
        setPage(1);
        setFeedback(null);
    }
    function submitSearch(event) {
        event.preventDefault();
        setQuery(draftQuery.trim());
        setPage(1);
        setFeedback(null);
    }
    function clearSearch() {
        setDraftQuery("");
        setQuery("");
        setPage(1);
    }
    function submitNewPipeline(event) {
        event.preventDefault();
        const name = newPipelineName.trim();
        if (name) createMutation.mutate(name);
    }
    function changeDeleteDialog(open) {
        if (!open && !deleteMutation.isPending) {
            setDeleteTarget(null);
            setDeleteError(null);
        }
    }
    function requestDelete(target) {
        setDeleteError(null);
        setDeleteTarget(target);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "w-full max-w-none bg-[#0b0f14] bg-[radial-gradient(circle_at_12%_14%,rgba(66,153,255,0.18)_0_1px,transparent_1.5px),radial-gradient(circle_at_83%_20%,rgba(255,130,73,0.15)_0_1px,transparent_1.5px),linear-gradient(rgba(116,142,171,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(116,142,171,0.08)_1px,transparent_1px)] bg-[size:auto,auto,36px_36px,36px_36px] px-3 py-6 text-slate-100 sm:px-4 sm:py-8 lg:px-5",
        "data-testid": "aigc-workspace",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "border-b border-slate-700/80 pb-5",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "font-mono text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-sky-400",
                                    children: "DAG creation workspace"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 230,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "mt-2 text-3xl font-semibold text-slate-50",
                                    children: "星图创作台"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 233,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-2 max-w-2xl text-sm leading-6 text-slate-400",
                                    children: "从模板快速建立生成流程，或维护可重复执行的节点画布。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 236,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 229,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-wrap items-center gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "border border-slate-700 bg-slate-900/80 px-3 py-1.5 font-mono text-xs text-slate-300",
                                    children: [
                                        activeData?.total ?? 0,
                                        " 个",
                                        view === "templates" ? "模板" : "画布"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 241,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    className: "bg-sky-500 text-slate-950 hover:bg-sky-400",
                                    onClick: ()=>setIsCreateOpen(true),
                                    type: "button",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                            lineNumber: 249,
                                            columnNumber: 15
                                        }, this),
                                        "新建空白画布"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 244,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 240,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 228,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 227,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mt-5 flex flex-col gap-3 border-b border-slate-700/80 pb-5 lg:flex-row lg:items-center lg:justify-between",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-label": "AIGC 视图",
                        className: "flex w-full gap-1 border border-slate-700 bg-slate-950/60 p-1 sm:w-fit",
                        role: "tablist",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ViewButton, {
                                active: view === "templates",
                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$stack$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileStack$3e$__["FileStack"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 264,
                                    columnNumber: 19
                                }, this),
                                label: "画布模板",
                                onClick: ()=>changeView("templates")
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 262,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ViewButton, {
                                active: view === "pipelines",
                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 270,
                                    columnNumber: 19
                                }, this),
                                label: "我的画布",
                                onClick: ()=>changeView("pipelines")
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 268,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 257,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        className: "flex w-full gap-2 lg:max-w-md",
                        onSubmit: submitSearch,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative min-w-0 flex-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                        className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 278,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        "aria-label": "按名称筛选",
                                        className: "border-slate-700 bg-slate-950/70 pl-9 text-slate-100 placeholder:text-slate-500",
                                        onChange: (event)=>setDraftQuery(event.target.value),
                                        placeholder: "按名称筛选",
                                        value: draftQuery
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 279,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 277,
                                columnNumber: 11
                            }, this),
                            draftQuery || query ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                "aria-label": "清空筛选",
                                onClick: clearSearch,
                                size: "icon",
                                title: "清空筛选",
                                type: "button",
                                variant: "ghost",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eraser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eraser$3e$__["Eraser"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 296,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 288,
                                columnNumber: 13
                            }, this) : null,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                className: "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white",
                                type: "submit",
                                variant: "outline",
                                children: "筛选"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 299,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 276,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 256,
                columnNumber: 7
            }, this),
            errorMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-5 flex items-center justify-between gap-4 border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-300",
                role: "alert",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                className: "h-4 w-4 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 315,
                                columnNumber: 13
                            }, this),
                            errorMessage
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 314,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        onClick: ()=>{
                            setFeedback(null);
                            void activeQuery.refetch();
                        },
                        size: "sm",
                        type: "button",
                        variant: "outline",
                        children: "重试"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 318,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 310,
                columnNumber: 9
            }, this) : null,
            activeQuery.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LoadingState, {}, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 333,
                columnNumber: 9
            }, this) : activeData && activeData.items.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5",
                        "data-testid": "aigc-card-grid",
                        children: activeData.items.map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AigcCard, {
                                busy: view === "templates" && instantiateMutation.isPending && instantiateMutation.variables?.id === item.id,
                                item: item,
                                kind: view === "templates" ? "template" : "pipeline",
                                onDelete: requestDelete,
                                onSelectThumbnail: (pipeline)=>setThumbnailPipeline(pipeline),
                                onOpen: ()=>{
                                    setFeedback(null);
                                    if (view === "templates") {
                                        instantiateMutation.mutate(item);
                                    } else {
                                        router.push(pipelineRoute(item.id));
                                    }
                                }
                            }, item.id, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 341,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 336,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Pagination, {
                        onPageChange: setPage,
                        page: activeData.page,
                        total: activeData.total,
                        totalPages: totalPages
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 363,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 335,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(EmptyState, {
                hasQuery: query.length > 0,
                onCreate: ()=>setIsCreateOpen(true),
                onReset: clearSearch,
                view: view
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 371,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: setIsCreateOpen,
                open: isCreateOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-lg p-6 sm:p-7",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: submitNewPipeline,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                        children: "新建空白画布"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 383,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                        children: "创建后将进入独立画布页面，可继续添加输入、模型与输出节点。"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 384,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 382,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "py-5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                        htmlFor: "aigc-pipeline-name",
                                        children: "画布名称"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 389,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        autoFocus: true,
                                        className: "mt-2",
                                        id: "aigc-pipeline-name",
                                        maxLength: 120,
                                        onChange: (event)=>setNewPipelineName(event.target.value),
                                        placeholder: "例如：商品主图生成流程",
                                        value: newPipelineName
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 390,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 388,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        onClick: ()=>setIsCreateOpen(false),
                                        type: "button",
                                        variant: "ghost",
                                        children: "取消"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 401,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        disabled: !newPipelineName.trim() || createMutation.isPending,
                                        type: "submit",
                                        children: [
                                            createMutation.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                                className: "h-4 w-4 animate-spin"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                lineNumber: 413,
                                                columnNumber: 19
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CirclePlus$3e$__["CirclePlus"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                lineNumber: 415,
                                                columnNumber: 19
                                            }, this),
                                            "创建画布"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 408,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 400,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 381,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 380,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 379,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: changeDeleteDialog,
                open: deleteTarget !== null,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md p-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    children: [
                                        "删除",
                                        deleteTarget?.kind === "template" ? "画布模板" : "画布",
                                        "？"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 430,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    children: [
                                        "即将删除",
                                        deleteTarget?.kind === "template" ? "模板" : "画布",
                                        "“",
                                        deleteTarget?.name,
                                        "”。此操作无法撤销。"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 433,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 429,
                            columnNumber: 11
                        }, this),
                        deleteError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mt-4 flex items-start gap-2 border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-300",
                            role: "alert",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                                    className: "mt-0.5 h-4 w-4 shrink-0"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 444,
                                    columnNumber: 15
                                }, this),
                                deleteError
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 440,
                            columnNumber: 13
                        }, this) : null,
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            className: "mt-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    disabled: deleteMutation.isPending,
                                    onClick: ()=>changeDeleteDialog(false),
                                    type: "button",
                                    variant: "ghost",
                                    children: "取消"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 449,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    disabled: !deleteTarget || deleteMutation.isPending,
                                    onClick: ()=>{
                                        if (deleteTarget) deleteMutation.mutate(deleteTarget);
                                    },
                                    type: "button",
                                    variant: "destructive",
                                    children: [
                                        deleteMutation.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                            className: "h-4 w-4 animate-spin"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                            lineNumber: 466,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                            lineNumber: 468,
                                            columnNumber: 17
                                        }, this),
                                        "确认删除"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 457,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 448,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 428,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 424,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$thumbnail$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcThumbnailDialog"], {
                onOpenChange: (open)=>{
                    if (!open) setThumbnailPipeline(null);
                },
                onUpdated: ()=>undefined,
                open: thumbnailPipeline !== null,
                pipeline: thumbnailPipeline
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 476,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 223,
        columnNumber: 5
    }, this);
}
_s(AigcWorkspace, "5WHsiaC6BeWoc9+qM1r8gr72STY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"]
    ];
});
_c = AigcWorkspace;
function ViewButton({ active, icon, label, onClick }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        "aria-selected": active,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex min-h-9 flex-1 items-center justify-center gap-2 rounded px-4 text-sm font-semibold transition sm:flex-none", active ? "bg-slate-800 text-sky-300 shadow-sm" : "text-slate-400 hover:bg-slate-900 hover:text-slate-100"),
        onClick: onClick,
        role: "tab",
        type: "button",
        children: [
            icon,
            label
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 500,
        columnNumber: 5
    }, this);
}
_c1 = ViewButton;
function AigcCard({ busy, item, kind, onDelete, onSelectThumbnail, onOpen }) {
    _s1();
    const pipeline = kind === "pipeline" ? item : null;
    const [failedThumbnailUrl, setFailedThumbnailUrl] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const normalizedDefinition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcCard.useMemo[normalizedDefinition]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcDefinitionV2"])(item.definition)
    }["AigcCard.useMemo[normalizedDefinition]"], [
        item.definition
    ]);
    const modelCount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$workspace$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["countWorkspacePreviewModels"])(normalizedDefinition.nodes);
    const typeLabel = kind === "template" ? "模板" : "画布";
    function handleDelete(event) {
        event.preventDefault();
        event.stopPropagation();
        onDelete({
            id: item.id,
            kind,
            name: item.name
        });
    }
    function handleThumbnail(event) {
        event.preventDefault();
        event.stopPropagation();
        if (pipeline) onSelectThumbnail(pipeline);
    }
    const thumbnail = pipeline?.thumbnail ?? null;
    const shouldUseTopology = thumbnail === null || failedThumbnailUrl === thumbnail.url;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "group min-w-0 overflow-hidden border border-slate-700 bg-slate-950/90 shadow-[0_12px_28px_rgba(0,0,0,0.2)] transition hover:border-sky-400/65 hover:shadow-[0_16px_36px_rgba(14,165,233,0.16)] focus-within:border-sky-400/65",
        "data-testid": "aigc-card",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                "aria-label": `${kind === "template" ? "使用模板" : "打开画布"}：${item.name}`,
                className: "block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400",
                disabled: busy,
                onClick: onOpen,
                type: "button",
                children: shouldUseTopology ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TopologyPreview, {
                    definition: normalizedDefinition
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 573,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PipelineThumbnailPreview, {
                    onError: ()=>setFailedThumbnailUrl(thumbnail.url),
                    thumbnail: thumbnail
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 575,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 565,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-t border-slate-700 px-3 py-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex min-w-0 items-start justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                className: "min-w-0 text-left",
                                disabled: busy,
                                onClick: onOpen,
                                type: "button",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                    className: "block truncate text-sm font-semibold text-slate-100 group-hover:text-sky-300",
                                    children: item.name
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                    lineNumber: 589,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 583,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex shrink-0 items-center gap-1",
                                children: [
                                    kind === "template" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        asChild: true,
                                        "aria-label": `编辑模板：${item.name}`,
                                        size: "icon",
                                        title: "编辑模板",
                                        variant: "ghost",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                            href: `/workspace/aigc/templates/${item.id}`,
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__["Pencil"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                lineNumber: 603,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                            lineNumber: 602,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 595,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(StatusBadge, {
                                                status: pipeline?.latest_run_status ?? null
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                lineNumber: 608,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                "aria-label": `选择缩略图：${item.name}`,
                                                disabled: busy,
                                                onClick: handleThumbnail,
                                                size: "icon",
                                                title: "选择缩略图",
                                                type: "button",
                                                variant: "ghost",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"], {
                                                    className: "h-4 w-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                    lineNumber: 618,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                                lineNumber: 609,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 607,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        "aria-label": `删除${typeLabel}：${item.name}`,
                                        className: "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                                        disabled: busy,
                                        onClick: handleDelete,
                                        size: "icon",
                                        title: `删除${typeLabel}`,
                                        type: "button",
                                        variant: "ghost",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                            lineNumber: 632,
                                            columnNumber: 15
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 622,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 593,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 582,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400",
                        children: item.description || "未填写说明"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 636,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-3 flex flex-col gap-1 border-t border-slate-800 pt-2 text-[0.68rem] text-slate-500 sm:flex-row sm:items-center sm:justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "flex items-center gap-1 whitespace-nowrap",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$git$2d$fork$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__GitFork$3e$__["GitFork"], {
                                        className: "h-3.5 w-3.5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                        lineNumber: 641,
                                        columnNumber: 13
                                    }, this),
                                    item.definition.nodes.length,
                                    " 节点 · ",
                                    modelCount,
                                    " 模型"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 640,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("time", {
                                className: "whitespace-nowrap",
                                dateTime: item.updated_at,
                                suppressHydrationWarning: true,
                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$project$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatDate"])(item.updated_at)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 644,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 639,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-3 w-full", kind === "template" ? "bg-sky-500 text-slate-950 hover:bg-sky-400" : "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"),
                        disabled: busy,
                        onClick: onOpen,
                        size: "sm",
                        type: "button",
                        variant: kind === "template" ? "signal" : "outline",
                        children: [
                            busy ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                className: "h-4 w-4 animate-spin"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 665,
                                columnNumber: 19
                            }, this) : null,
                            kind === "template" ? "使用模板" : "打开画布",
                            !busy ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 667,
                                columnNumber: 20
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 652,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 581,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 561,
        columnNumber: 5
    }, this);
}
_s1(AigcCard, "UKvc7AI4R7kuDoFQzjTETX8IXKI=");
_c2 = AigcCard;
function PipelineThumbnailPreview({ onError, thumbnail }) {
    if (thumbnail.kind === "video") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
            "aria-label": "画布缩略图视频",
            className: "aspect-[16/10] w-full bg-[#101821] object-contain",
            muted: true,
            onError: onError,
            playsInline: true,
            preload: "metadata",
            src: thumbnail.url
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
            lineNumber: 683,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
            alt: "画布缩略图",
            className: "aspect-[16/10] w-full bg-[#101821] object-contain",
            onError: onError,
            src: thumbnail.url
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
            lineNumber: 698,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 695,
        columnNumber: 5
    }, this);
}
_c3 = PipelineThumbnailPreview;
function TopologyPreview({ definition }) {
    _s2();
    const layout = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "TopologyPreview.useMemo[layout]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$workspace$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeWorkspaceTopology"])(definition.nodes)
    }["TopologyPreview.useMemo[layout]"], [
        definition.nodes
    ]);
    const points = new Map(layout.map((entry)=>[
            entry.node.id,
            entry
        ]));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative aspect-[16/10] overflow-hidden bg-[#101821]",
        "data-testid": "aigc-topology-preview",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-hidden": "true",
                className: "absolute inset-0 bg-[linear-gradient(to_right,rgba(100,145,185,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(100,145,185,0.14)_1px,transparent_1px)] bg-[size:20px_20px]"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 723,
                columnNumber: 7
            }, this),
            definition.nodes.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 grid place-items-center text-slate-500",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "flex items-center gap-2 text-xs",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 730,
                            columnNumber: 13
                        }, this),
                        "空白画布"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 729,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 728,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("svg", {
                        "aria-hidden": "true",
                        className: "absolute inset-0 h-full w-full",
                        children: definition.edges.map((edge)=>{
                            const source = points.get(edge.sourceNodeId);
                            const target = points.get(edge.targetNodeId);
                            if (!source || !target) return null;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("line", {
                                className: "stroke-sky-400/35",
                                strokeWidth: "1.5",
                                x1: `${source.x}%`,
                                x2: `${target.x}%`,
                                y1: `${source.y}%`,
                                y2: `${target.y}%`
                            }, edge.id, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                                lineNumber: 742,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 736,
                        columnNumber: 11
                    }, this),
                    layout.map(({ node, x, y })=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TopologyNode, {
                            node: node,
                            x: x,
                            y: y
                        }, node.id, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 755,
                            columnNumber: 13
                        }, this))
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 735,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 719,
        columnNumber: 5
    }, this);
}
_s2(TopologyPreview, "+2d9UzJKyVI8Oz6qM0bBqRGtqrQ=");
_c4 = TopologyPreview;
const previewToneClasses = {
    audio: "border-pink-400/60 bg-pink-400/25 shadow-[0_0_14px_rgba(244,114,182,0.22)]",
    image: "border-emerald-400/60 bg-emerald-400/25 shadow-[0_0_14px_rgba(52,211,153,0.22)]",
    neutral: "border-slate-500/60 bg-slate-500/25",
    text: "border-sky-400/60 bg-sky-400/25 shadow-[0_0_14px_rgba(56,189,248,0.22)]",
    video: "border-orange-400/60 bg-orange-400/25 shadow-[0_0_14px_rgba(251,146,60,0.22)]"
};
function TopologyNode({ node, x, y }) {
    const tone = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$workspace$2d$preview$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getWorkspacePreviewNodeTone"])(node);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 border", previewToneClasses[tone]),
        "data-testid": `aigc-preview-node-${tone}`,
        style: {
            left: `${x}%`,
            top: `${y}%`
        },
        title: node.type
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 786,
        columnNumber: 5
    }, this);
}
_c5 = TopologyNode;
function StatusBadge({ status }) {
    if (!status) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
            variant: "secondary",
            children: "未运行"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
            lineNumber: 800,
            columnNumber: 12
        }, this);
    }
    const labels = {
        canceled: "已取消",
        failed: "失败",
        queued: "排队中",
        running: "运行中",
        succeeded: "已完成"
    };
    const variant = status === "succeeded" ? "success" : status === "failed" || status === "canceled" ? "destructive" : "info";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
        variant: variant,
        children: labels[status]
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 815,
        columnNumber: 10
    }, this);
}
_c6 = StatusBadge;
function LoadingState() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-5 grid min-h-64 place-items-center border border-slate-700 bg-slate-950/70",
        role: "status",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "flex items-center gap-2 text-sm text-slate-400",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                    className: "h-4 w-4 animate-spin"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 825,
                    columnNumber: 9
                }, this),
                "正在加载画布"
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
            lineNumber: 824,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 820,
        columnNumber: 5
    }, this);
}
_c7 = LoadingState;
function EmptyState({ hasQuery, onCreate, onReset, view }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mt-5 grid min-h-72 place-items-center border border-dashed border-slate-700 bg-slate-950/70 px-6 text-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"], {
                    className: "mx-auto h-8 w-8 text-sky-400"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 846,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                    className: "mt-4 text-base font-semibold text-slate-100",
                    children: hasQuery ? "没有匹配的画布" : view === "templates" ? "暂无画布模板" : "还没有我的画布"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 847,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mt-2 text-sm text-slate-400",
                    children: hasQuery ? "调整名称关键词后重新筛选。" : "从空白画布开始建立生成流程。"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 854,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    className: "mt-5 border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800",
                    onClick: hasQuery ? onReset : onCreate,
                    type: "button",
                    variant: "outline",
                    children: [
                        hasQuery ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eraser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eraser$3e$__["Eraser"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 863,
                            columnNumber: 23
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Plus$3e$__["Plus"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 863,
                            columnNumber: 56
                        }, this),
                        hasQuery ? "清空筛选" : "新建空白画布"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                    lineNumber: 857,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
            lineNumber: 845,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 844,
        columnNumber: 5
    }, this);
}
_c8 = EmptyState;
function Pagination({ onPageChange, page, total, totalPages }) {
    if (totalPages <= 1) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
        "aria-label": "画布分页",
        className: "mt-5 flex items-center justify-between border-t border-slate-700 pt-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-xs text-slate-400",
                children: [
                    "共 ",
                    total,
                    " 项"
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 888,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        "aria-label": "上一页",
                        disabled: page <= 1,
                        onClick: ()=>onPageChange(page - 1),
                        size: "icon",
                        type: "button",
                        variant: "outline",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronLeft$3e$__["ChevronLeft"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 898,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 890,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "min-w-16 text-center text-xs text-slate-400",
                        children: [
                            page,
                            " / ",
                            totalPages
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 900,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        "aria-label": "下一页",
                        disabled: page >= totalPages,
                        onClick: ()=>onPageChange(page + 1),
                        size: "icon",
                        type: "button",
                        variant: "outline",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chevron$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ChevronRight$3e$__["ChevronRight"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                            lineNumber: 911,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                        lineNumber: 903,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
                lineNumber: 889,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-workspace.tsx",
        lineNumber: 884,
        columnNumber: 5
    }, this);
}
_c9 = Pagination;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9;
__turbopack_context__.k.register(_c, "AigcWorkspace");
__turbopack_context__.k.register(_c1, "ViewButton");
__turbopack_context__.k.register(_c2, "AigcCard");
__turbopack_context__.k.register(_c3, "PipelineThumbnailPreview");
__turbopack_context__.k.register(_c4, "TopologyPreview");
__turbopack_context__.k.register(_c5, "TopologyNode");
__turbopack_context__.k.register(_c6, "StatusBadge");
__turbopack_context__.k.register(_c7, "LoadingState");
__turbopack_context__.k.register(_c8, "EmptyState");
__turbopack_context__.k.register(_c9, "Pagination");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/definition-migration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/multitrack-fonts.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/multitrack.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2d$fonts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/multitrack-fonts.ts [app-client] (ecmascript)");
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
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2d$fonts$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fontTypeIssue"])(element.style.font_type ?? null)) {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-enhancement.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-face-blur.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/multitrack.ts [app-client] (ecmascript)");
;
;
;
;
const AIGC_DEFAULT_TEXT_MODEL = "doubao-seed-evolving";
const AIGC_DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
const AIGC_DEFAULT_JSON_PATH = "$.items";
const AIGC_DEFAULT_IMAGE_OPERATION = "image_to_image";
const AIGC_DEFAULT_VIDEO_CONFIG = {
    model: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_MODEL"],
    generation_mode: "text_to_video",
    task_type: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_TASK_TYPE"],
    resolution: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_RESOLUTION"],
    aspect_ratio: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_ASPECT_RATIO"],
    duration_seconds: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_DURATION_SECONDS"],
    generate_audio: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_GENERATE_AUDIO"]
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
        models: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_MODELS"]
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/video-enhancement.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/video-face-blur.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/workspace-preview.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "countWorkspacePreviewModels",
    ()=>countWorkspacePreviewModels,
    "getWorkspacePreviewNodeTone",
    ()=>getWorkspacePreviewNodeTone,
    "normalizeWorkspaceTopology",
    ()=>normalizeWorkspaceTopology
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
;
const TONE_BY_PORT_TYPE = {
    audio_asset: "audio",
    edited_layer: "image",
    image_asset: "image",
    image_layer: "image",
    layer_set: "image",
    subtitle_asset: "video",
    text: "text",
    video_asset: "video"
};
function getWorkspacePreviewNodeTone(node) {
    const outputType = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(node.type)?.outputs[0]?.type;
    return outputType ? TONE_BY_PORT_TYPE[outputType] ?? "neutral" : "neutral";
}
function countWorkspacePreviewModels(nodes) {
    return nodes.filter((node)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(node.type)?.category === "model").length;
}
function normalizeWorkspaceTopology(nodes) {
    if (nodes.length === 0) return [];
    if (nodes.length === 1) {
        return [
            {
                id: nodes[0].id,
                node: nodes[0],
                x: 50,
                y: 50
            }
        ];
    }
    const xs = nodes.map((node)=>node.position.x);
    const ys = nodes.map((node)=>node.position.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(Math.max(...xs) - minX, 1);
    const height = Math.max(Math.max(...ys) - minY, 1);
    return nodes.map((node)=>({
            id: node.id,
            node,
            x: 12 + (node.position.x - minX) / width * 76,
            y: 16 + (node.position.y - minY) / height * 68
        }));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/api-client.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-types.ts [app-client] (ecmascript)");
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
    return typeof value === "string" && __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$types$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ERROR_CODES"].includes(value);
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/api-types.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/project-display.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatBytes",
    ()=>formatBytes,
    "formatDate",
    ()=>formatDate,
    "getAssetTypeLabel",
    ()=>getAssetTypeLabel,
    "getStageLabel",
    ()=>getStageLabel,
    "statusVariant",
    ()=>statusVariant,
    "summarizeAssets",
    ()=>summarizeAssets
]);
function summarizeAssets(assets) {
    return assets.reduce((summary, asset)=>{
        if (asset.type === "generated_image" || asset.type === "uploaded_image") {
            summary.images += 1;
        }
        if (asset.type === "storyboard_video" || asset.type === "uploaded_video") {
            summary.videos += 1;
        }
        if (asset.type === "final_video") {
            summary.finalVideos += 1;
        }
        return summary;
    }, {
        finalVideos: 0,
        images: 0,
        videos: 0
    });
}
function getStageLabel(stage) {
    return ({
        brief: "Brief",
        character: "角色",
        compose: "剪辑",
        image: "生图",
        script: "剧本",
        story: "故事",
        storyboard: "分镜",
        video: "生视频"
    })[stage];
}
function getAssetTypeLabel(type) {
    return ({
        final_video: "最终成片",
        generated_image: "生成图片",
        storyboard_video: "分镜视频",
        subtitle: "字幕文件",
        uploaded_audio: "上传音频",
        uploaded_video: "上传视频",
        uploaded_image: "上传图片"
    })[type];
}
function statusVariant(status) {
    if (status === "succeeded" || status === "skipped") {
        return "success";
    }
    if (status === "failed" || status === "cancelled" || status === "expired") {
        return "destructive";
    }
    if (status === "queued" || status === "running") {
        return "signal";
    }
    if (status === "stale") {
        return "warning";
    }
    return "secondary";
}
function formatDate(value) {
    const normalizedValue = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
    return new Intl.DateTimeFormat("zh-CN", {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        timeZone: "Asia/Shanghai"
    }).format(new Date(normalizedValue));
}
function formatBytes(value) {
    if (value === null) {
        return "未知大小";
    }
    if (value < 1024) {
        return `${value} B`;
    }
    const units = [
        "KB",
        "MB",
        "GB",
        "TB"
    ];
    let size = value / 1024;
    let unitIndex = 0;
    while(size >= 1024 && unitIndex < units.length - 1){
        size /= 1024;
        unitIndex += 1;
    }
    return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/seedance.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
_c = SEEDANCE_MODELS;
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
var _c;
__turbopack_context__.k.register(_c, "SEEDANCE_MODELS");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_0sda6w3._.js.map