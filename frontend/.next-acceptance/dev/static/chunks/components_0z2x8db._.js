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
"[project]/components/ui/textarea.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Textarea",
    ()=>Textarea
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
;
;
const Textarea = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c = ({ className, ...props }, ref)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("textarea", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex min-h-28 w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-sm transition-all placeholder:text-muted-foreground focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", className),
        ref: ref,
        ...props
    }, void 0, false, {
        fileName: "[project]/components/ui/textarea.tsx",
        lineNumber: 9,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0)));
_c1 = Textarea;
Textarea.displayName = "Textarea";
;
var _c, _c1;
__turbopack_context__.k.register(_c, "Textarea$React.forwardRef");
__turbopack_context__.k.register(_c1, "Textarea");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-audio-player.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcAudioPlayer",
    ()=>AigcAudioPlayer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function AigcAudioPlayer({ className, duration = null, mimeType, name, unavailableText = "音频结果不可用", url, variant = "node" }) {
    _s();
    const [loadedDuration, setLoadedDuration] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const resolvedDuration = loadedDuration ?? duration;
    if (!url) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("grid place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300", variant === "node" ? "min-h-0 flex-1" : "h-24", className),
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: unavailableText
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-[9px] text-amber-300",
                        children: "播放和下载已禁用"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                        lineNumber: 38,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                lineNumber: 36,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this);
    }
    const details = [
        resolvedDuration === null ? null : (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatVideoDuration"])(resolvedDuration),
        mimeType
    ].filter((value)=>Boolean(value));
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex flex-col justify-center gap-2 overflow-hidden bg-slate-950 p-3 text-white", variant === "node" ? "min-h-0 flex-1" : "rounded border border-slate-800", className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "truncate text-[10px] font-medium",
                title: name,
                children: name
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("audio", {
                "aria-label": `播放音频：${name}`,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 w-full", variant === "node" && "nodrag nowheel"),
                controls: true,
                onLoadedMetadata: (event)=>{
                    const nextDuration = event.currentTarget.duration;
                    setLoadedDuration(Number.isFinite(nextDuration) ? nextDuration : null);
                },
                preload: "metadata",
                src: url
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                lineNumber: 66,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                "aria-label": `音频信息：${name}`,
                className: "truncate font-mono text-[9px] text-slate-300",
                children: details.join(" · ") || "元数据读取中"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
                lineNumber: 82,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-audio-player.tsx",
        lineNumber: 54,
        columnNumber: 5
    }, this);
}
_s(AigcAudioPlayer, "Vd4p9GuWSrsBa7C+UxPooip9Trk=");
_c = AigcAudioPlayer;
var _c;
__turbopack_context__.k.register(_c, "AigcAudioPlayer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcCanvasNodePicker",
    ()=>AigcCanvasNodePicker,
    "AigcNodeContextMenu",
    ()=>AigcNodeContextMenu
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/audio-lines.js [app-client] (ecmascript) <export default as AudioLines>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pencil.js [app-client] (ecmascript) <export default as Pencil>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$type$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Type$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/type.js [app-client] (ecmascript) <export default as Type>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-client] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const CATEGORY_ORDER = [
    "modality",
    "model",
    "control"
];
const CATEGORY_LABELS = {
    modality: "模态",
    model: "模型",
    control: "控制"
};
function AigcCanvasNodePicker({ onAdd, onClose, position }) {
    _s();
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [highlightedIndex, setHighlightedIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const filtered = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcCanvasNodePicker.useMemo[filtered]": ()=>{
            const normalized = query.trim().toLocaleLowerCase();
            if (!normalized) return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_EDITOR_NODE_REGISTRY"];
            return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_EDITOR_NODE_REGISTRY"].filter({
                "AigcCanvasNodePicker.useMemo[filtered]": (item)=>item.label.toLocaleLowerCase().includes(normalized) || item.type.toLocaleLowerCase().includes(normalized)
            }["AigcCanvasNodePicker.useMemo[filtered]"]);
        }
    }["AigcCanvasNodePicker.useMemo[filtered]"], [
        query
    ]);
    const safeIndex = filtered.length === 0 ? 0 : Math.min(highlightedIndex, filtered.length - 1);
    function handleKeyDown(event) {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
            return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (filtered.length === 0) return;
            const direction = event.key === "ArrowDown" ? 1 : -1;
            setHighlightedIndex((safeIndex + direction + filtered.length) % filtered.length);
            return;
        }
        if (event.key === "Enter" && filtered[safeIndex]) {
            event.preventDefault();
            onAdd(filtered[safeIndex].type);
        }
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-label": "添加节点",
        className: "absolute z-50 flex max-h-[min(420px,calc(100%-16px))] w-72 flex-col overflow-hidden border border-[#3f4650] bg-[#20242a] shadow-2xl shadow-black/60",
        "data-testid": "aigc-canvas-node-picker",
        onContextMenu: (event)=>event.preventDefault(),
        onMouseDown: (event)=>event.stopPropagation(),
        role: "dialog",
        style: position,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative border-b border-[#343a43] p-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                        className: "pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                        "aria-controls": "aigc-node-picker-options",
                        "aria-label": "搜索节点",
                        autoFocus: true,
                        className: "h-8 border-[#3f4650] bg-[#15181d] pl-8 text-xs",
                        onChange: (event)=>{
                            setQuery(event.target.value);
                            setHighlightedIndex(0);
                        },
                        onKeyDown: handleKeyDown,
                        placeholder: "搜索节点",
                        value: query
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                        lineNumber: 94,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                lineNumber: 92,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-0 overflow-y-auto p-1.5",
                id: "aigc-node-picker-options",
                role: "listbox",
                children: filtered.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "px-3 py-8 text-center text-xs text-zinc-500",
                    children: "未找到匹配节点"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                    lineNumber: 114,
                    columnNumber: 11
                }, this) : CATEGORY_ORDER.map((category)=>{
                    const items = filtered.filter((item)=>item.category === category);
                    if (items.length === 0) return null;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mb-1.5 last:mb-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "px-2 py-1 font-mono text-[10px] uppercase text-zinc-500",
                                children: CATEGORY_LABELS[category]
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                                lineNumber: 125,
                                columnNumber: 17
                            }, this),
                            items.map((item)=>{
                                const index = filtered.indexOf(item);
                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    "aria-selected": index === safeIndex,
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-9 w-full items-center gap-2 px-2 text-left text-xs text-zinc-200", index === safeIndex ? "bg-[#303640] text-white" : "hover:bg-[#292e36]"),
                                    onClick: ()=>onAdd(item.type),
                                    onMouseEnter: ()=>setHighlightedIndex(index),
                                    role: "option",
                                    type: "button",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeTypeIcon, {
                                            item: item
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                                            lineNumber: 145,
                                            columnNumber: 23
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "min-w-0 flex-1 truncate",
                                            children: item.label
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                                            lineNumber: 146,
                                            columnNumber: 23
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "font-mono text-[9px] text-zinc-600",
                                            children: item.type
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                                            lineNumber: 149,
                                            columnNumber: 23
                                        }, this)
                                    ]
                                }, item.type, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                                    lineNumber: 131,
                                    columnNumber: 21
                                }, this);
                            })
                        ]
                    }, category, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                        lineNumber: 124,
                        columnNumber: 15
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                lineNumber: 108,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
        lineNumber: 83,
        columnNumber: 5
    }, this);
}
_s(AigcCanvasNodePicker, "zHw7zqb0uZ8W1nkuRdnzVzJqfkw=");
_c = AigcCanvasNodePicker;
function AigcNodeContextMenu({ onClose, onRename, position }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-label": "节点操作",
        className: "absolute z-50 w-40 border border-[#3f4650] bg-[#20242a] p-1 shadow-xl shadow-black/50",
        "data-testid": "aigc-node-context-menu",
        onContextMenu: (event)=>event.preventDefault(),
        onKeyDown: (event)=>{
            if (event.key === "Escape") onClose();
        },
        onMouseDown: (event)=>event.stopPropagation(),
        role: "menu",
        style: position,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            autoFocus: true,
            className: "flex h-8 w-full items-center gap-2 px-2 text-left text-xs text-zinc-200 hover:bg-[#303640]",
            onClick: onRename,
            role: "menuitem",
            type: "button",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__["Pencil"], {
                    className: "h-3.5 w-3.5"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
                    lineNumber: 193,
                    columnNumber: 9
                }, this),
                "重命名"
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
            lineNumber: 186,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
        lineNumber: 174,
        columnNumber: 5
    }, this);
}
_c1 = AigcNodeContextMenu;
function NodeTypeIcon({ item }) {
    const className = item.category === "control" ? "h-4 w-4 text-amber-400" : "h-4 w-4 text-blue-400";
    if (item.type.includes("image")) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"], {
            className: "h-4 w-4 text-emerald-400"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
            lineNumber: 206,
            columnNumber: 12
        }, this);
    }
    if (item.type.includes("video")) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
            className: "h-4 w-4 text-orange-400"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
            lineNumber: 209,
            columnNumber: 12
        }, this);
    }
    if (item.type.includes("audio")) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__["AudioLines"], {
            className: "h-4 w-4 text-pink-400"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
            lineNumber: 212,
            columnNumber: 12
        }, this);
    }
    if (item.type.includes("text")) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$type$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Type$3e$__["Type"], {
            className: "h-4 w-4 text-blue-400"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
            lineNumber: 215,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
        className: className
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx",
        lineNumber: 217,
        columnNumber: 10
    }, this);
}
_c2 = NodeTypeIcon;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "AigcCanvasNodePicker");
__turbopack_context__.k.register(_c1, "AigcNodeContextMenu");
__turbopack_context__.k.register(_c2, "NodeTypeIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcEditor",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AigcEditor"],
    "connectionValidationFeedback",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectionValidationFeedback"],
    "getAigcConnectionValidationError",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcConnectionValidationError"],
    "isValidAigcConnection",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isValidAigcConnection"],
    "toFlowEdge",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["toFlowEdge"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-editor.tsx [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/connection-validation.ts [app-client] (ecmascript)");
}),
"[project]/components/workspace/aigc/aigc-editor.tsx [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcEditor",
    ()=>AigcEditor,
    "toFlowEdge",
    ()=>toFlowEdge
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/react/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/audio-lines.js [app-client] (ecmascript) <export default as AudioLines>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$ban$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Ban$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/ban.js [app-client] (ecmascript) <export default as Ban>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/copy.js [app-client] (ecmascript) <export default as Copy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$files$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Files$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/files.js [app-client] (ecmascript) <export default as Files>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/panel-left.js [app-client] (ecmascript) <export default as PanelLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2d$close$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeftClose$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/panel-left-close.js [app-client] (ecmascript) <export default as PanelLeftClose>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/panel-right.js [app-client] (ecmascript) <export default as PanelRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2d$close$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRightClose$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/panel-right-close.js [app-client] (ecmascript) <export default as PanelRightClose>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings-2.js [app-client] (ecmascript) <export default as Settings2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$type$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Type$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/type.js [app-client] (ecmascript) <export default as Type>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-client] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/upload.js [app-client] (ecmascript) <export default as Upload>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$flow$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-flow-node.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$canvas$2d$context$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-canvas-context-menu.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$image$2d$dimensions$2d$field$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$media$2d$asset$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$prompt$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-prompt-editor.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-run-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$audio$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-audio-player.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$node$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/node-canvas.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$autosave$2d$coordinator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/autosave-coordinator.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/editor-store.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/connection-validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/json-parser-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$llm$2d$image$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/llm-image-input.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/download.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/media-assets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/media-validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/modality-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/result-projection.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-generation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-enhancement.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-face-blur.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/queries.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/run-scope.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/run-log.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature(), _s7 = __turbopack_context__.k.signature(), _s8 = __turbopack_context__.k.signature(), _s9 = __turbopack_context__.k.signature(), _s10 = __turbopack_context__.k.signature(), _s11 = __turbopack_context__.k.signature(), _s12 = __turbopack_context__.k.signature(), _s13 = __turbopack_context__.k.signature(), _s14 = __turbopack_context__.k.signature(), _s15 = __turbopack_context__.k.signature();
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
;
const AIGC_NODE_TYPES = Object.fromEntries(_c1 = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_EDITOR_NODE_REGISTRY"].map(_c = (item)=>[
        item.type,
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$flow$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcFlowNodeCard"]
    ]));
_c2 = AIGC_NODE_TYPES;
const subscribeToHydration = ()=>()=>undefined;
const NODE_PALETTE_VISIBILITY_KEY = "aigc.node-palette.visible.v1";
const FULL_RUN_PENDING = "__full__";
function AigcEditor({ allowExecution = true, entity, mode, store }) {
    _s();
    const initialState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditor.useMemo[initialState]": ()=>({
                definition: entity.definition,
                description: entity.description,
                entityId: entity.id,
                mode,
                name: entity.name,
                revision: entity.revision
            })
    }["AigcEditor.useMemo[initialState]"], [
        entity,
        mode
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcEditorStoreProvider"], {
        initialState: initialState,
        store: store,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AigcEditorContent, {
            allowExecution: allowExecution,
            entity: entity,
            mode: mode
        }, `${mode}:${entity.id}:${entity.revision}`, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 298,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 297,
        columnNumber: 5
    }, this);
}
_s(AigcEditor, "3yWa1W5Cr8haIoiTMcGymjPdwao=");
_c3 = AigcEditor;
function AigcEditorContent({ allowExecution, entity, mode }) {
    _s1();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const editorStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStoreApi"])();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[definition]": (state)=>state.definition
    }["AigcEditorContent.useAigcEditorStore[definition]"]);
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[name]": (state)=>state.name
    }["AigcEditorContent.useAigcEditorStore[name]"]);
    const selectedNodeId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[selectedNodeId]": (state)=>state.selectedNodeId
    }["AigcEditorContent.useAigcEditorStore[selectedNodeId]"]);
    const addNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[addNode]": (state)=>state.addNode
    }["AigcEditorContent.useAigcEditorStore[addNode]"]);
    const connect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[connect]": (state)=>state.connect
    }["AigcEditorContent.useAigcEditorStore[connect]"]);
    const applyServerRevision = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[applyServerRevision]": (state)=>state.applyServerRevision
    }["AigcEditorContent.useAigcEditorStore[applyServerRevision]"]);
    const applyGeneratedNodeNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[applyGeneratedNodeNames]": (state)=>state.applyGeneratedNodeNames
    }["AigcEditorContent.useAigcEditorStore[applyGeneratedNodeNames]"]);
    const markSaved = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[markSaved]": (state)=>state.markSaved
    }["AigcEditorContent.useAigcEditorStore[markSaved]"]);
    const moveNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[moveNode]": (state)=>state.moveNode
    }["AigcEditorContent.useAigcEditorStore[moveNode]"]);
    const removeEdge = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[removeEdge]": (state)=>state.removeEdge
    }["AigcEditorContent.useAigcEditorStore[removeEdge]"]);
    const removeNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[removeNode]": (state)=>state.removeNode
    }["AigcEditorContent.useAigcEditorStore[removeNode]"]);
    const selectNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[selectNode]": (state)=>state.selectNode
    }["AigcEditorContent.useAigcEditorStore[selectNode]"]);
    const setRenamingNodeId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[setRenamingNodeId]": (state)=>state.setRenamingNodeId
    }["AigcEditorContent.useAigcEditorStore[setRenamingNodeId]"]);
    const setDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[setDescription]": (state)=>state.setDescription
    }["AigcEditorContent.useAigcEditorStore[setDescription]"]);
    const setName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[setName]": (state)=>state.setName
    }["AigcEditorContent.useAigcEditorStore[setName]"]);
    const setViewport = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcEditorContent.useAigcEditorStore[setViewport]": (state)=>state.setViewport
    }["AigcEditorContent.useAigcEditorStore[setViewport]"]);
    const [nodes, setNodes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AigcEditorContent.useState": ()=>editorStore.getState().definition.nodes.map(toFlowNode)
    }["AigcEditorContent.useState"]);
    const [edges, setEdges] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AigcEditorContent.useState": ()=>{
            const initialDefinition = editorStore.getState().definition;
            return initialDefinition.edges.map({
                "AigcEditorContent.useState": (edge)=>toFlowEdge(edge, initialDefinition.nodes, initialDefinition.edges)
            }["AigcEditorContent.useState"]);
        }
    }["AigcEditorContent.useState"]);
    const [autosaveCoordinator] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AigcEditorContent.useState": ()=>new __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$autosave$2d$coordinator$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AutosaveCoordinator"]({
                initialSnapshot: editorStore.getState().dirty ? editorDraftFromEntity(entity) : editorDraftFromState(editorStore.getState()),
                initialRevision: entity.revision,
                equals: editorDraftsEqual,
                getErrorMessage: autosaveErrorMessage,
                save: {
                    "AigcEditorContent.useState": async ({ expectedRevision, snapshot })=>{
                        // #region debug-point C:autosave-payload
                        void fetch("http://127.0.0.1:7777/event", {
                            method: "POST",
                            body: JSON.stringify({
                                sessionId: "pipeline-nodes-missing",
                                runId: "post-fix",
                                hypothesisId: "C",
                                location: "frontend/components/workspace/aigc/aigc-editor.tsx:autosave",
                                msg: "[DEBUG] Autosave pipeline payload",
                                data: {
                                    entityId: entity.id,
                                    expectedRevision,
                                    nodeIds: snapshot.definition.nodes.map({
                                        "AigcEditorContent.useState": (node)=>node.id
                                    }["AigcEditorContent.useState"])
                                },
                                ts: Date.now()
                            })
                        }).catch({
                            "AigcEditorContent.useState": ()=>{}
                        }["AigcEditorContent.useState"]);
                        // #endregion
                        const saved = mode === "template" ? await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].updateAigcTemplate(entity.id, {
                            expected_revision: expectedRevision,
                            name: snapshot.name.trim(),
                            description: snapshot.description.trim(),
                            definition: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serializeAigcEditorDefinition"])(snapshot.definition)
                        }) : await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].updateAigcPipeline(entity.id, {
                            expected_revision: expectedRevision,
                            name: snapshot.name.trim(),
                            description: snapshot.description.trim(),
                            definition: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serializeAigcEditorDefinition"])(snapshot.definition)
                        });
                        return {
                            revision: saved.revision
                        };
                    }
                }["AigcEditorContent.useState"],
                validate: validateEditorDraft
            })
    }["AigcEditorContent.useState"]);
    const subscribeToAutosave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[subscribeToAutosave]": (listener)=>autosaveCoordinator.subscribe(listener)
    }["AigcEditorContent.useCallback[subscribeToAutosave]"], [
        autosaveCoordinator
    ]);
    const getAutosaveState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[getAutosaveState]": ()=>autosaveCoordinator.getState()
    }["AigcEditorContent.useCallback[getAutosaveState]"], [
        autosaveCoordinator
    ]);
    const autosaveState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribeToAutosave, getAutosaveState, getAutosaveState);
    const [inspectorTab, setInspectorTab] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("config");
    const [isSavingTemplate, setIsSavingTemplate] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [saveTemplateOpen, setSaveTemplateOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [templateName, setTemplateName] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(entity.name);
    const [templateError, setTemplateError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [feedback, setFeedback] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [contextMenu, setContextMenu] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const canvasContainerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const reactFlowRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [selectedRunId, setSelectedRunId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [pendingRunStarts, setPendingRunStarts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        "AigcEditorContent.useState": ()=>new Set()
    }["AigcEditorContent.useState"]);
    const pendingRunStartsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(pendingRunStarts);
    const [openPanel, setOpenPanel] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [desktopNodePaletteVisible, setDesktopNodePaletteVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(readNodePaletteVisibility);
    const hydrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])(subscribeToHydration, {
        "AigcEditorContent.useSyncExternalStore[hydrated]": ()=>true
    }["AigcEditorContent.useSyncExternalStore[hydrated]"], {
        "AigcEditorContent.useSyncExternalStore[hydrated]": ()=>false
    }["AigcEditorContent.useSyncExternalStore[hydrated]"]);
    const isDesktop = useDesktopLayout();
    const runsQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRuns"])(entity.id, undefined, mode === "pipeline");
    const pipelineQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: mode === "pipeline",
        initialData: mode === "pipeline" ? entity : undefined,
        queryFn: {
            "AigcEditorContent.useQuery[pipelineQuery]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAigcPipeline(entity.id)
        }["AigcEditorContent.useQuery[pipelineQuery]"],
        queryKey: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcQueryKeys"].pipeline(entity.id),
        staleTime: Number.POSITIVE_INFINITY
    });
    const validationAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: mode === "pipeline",
        queryKey: [
            "aigc",
            "media-validation-assets"
        ],
        queryFn: loadAigcMediaAssets
    });
    const runs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[runs]": ()=>runsQuery.data?.items ?? []
    }["AigcEditorContent.useMemo[runs]"], [
        runsQuery.data?.items
    ]);
    const projectionRunIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[projectionRunIds]": ()=>mode === "pipeline" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["selectAigcProjectionRunIds"])(definition, runs, selectedRunId) : []
    }["AigcEditorContent.useMemo[projectionRunIds]"], [
        definition,
        mode,
        runs,
        selectedRunId
    ]);
    const projectionRunSummaries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[projectionRunSummaries]": ()=>{
            const runsById = new Map(runs.map({
                "AigcEditorContent.useMemo[projectionRunSummaries]": (run)=>[
                        run.id,
                        run
                    ]
            }["AigcEditorContent.useMemo[projectionRunSummaries]"]));
            return projectionRunIds.flatMap({
                "AigcEditorContent.useMemo[projectionRunSummaries]": (runId)=>{
                    const run = runsById.get(runId);
                    return run ? [
                        run
                    ] : [];
                }
            }["AigcEditorContent.useMemo[projectionRunSummaries]"]);
        }
    }["AigcEditorContent.useMemo[projectionRunSummaries]"], [
        projectionRunIds,
        runs
    ]);
    const runDetailQueries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunDetails"])(projectionRunSummaries);
    const runDetails = runDetailQueries.details;
    const projectionRuns = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[projectionRuns]": ()=>{
            const byId = new Map(runs.map({
                "AigcEditorContent.useMemo[projectionRuns]": (run)=>[
                        run.id,
                        runDetails.get(run.id)?.run ?? run
                    ]
            }["AigcEditorContent.useMemo[projectionRuns]"]));
            for (const detail of runDetails.values()){
                if (!byId.has(detail.run.id)) byId.set(detail.run.id, detail.run);
            }
            return [
                ...byId.values()
            ];
        }
    }["AigcEditorContent.useMemo[projectionRuns]"], [
        runDetails,
        runs
    ]);
    const runProjection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[runProjection]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createAigcRunProjection"])(definition, projectionRuns, runDetails, selectedRunId)
    }["AigcEditorContent.useMemo[runProjection]"], [
        definition,
        projectionRuns,
        runDetails,
        selectedRunId
    ]);
    const selectedPanelRunId = selectedRunId ?? runs[0]?.id ?? null;
    const selectedRunDetail = selectedPanelRunId === null ? undefined : runDetails.get(selectedPanelRunId);
    const selectedRunDetailState = selectedPanelRunId === null ? undefined : runDetailQueries.states.get(selectedPanelRunId);
    const createRun = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCreateAigcRun"])(entity.id);
    const retryNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRetryAigcNode"])(entity.id);
    const cancelRun = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCancelAigcRun"])(entity.id);
    const refreshedPipelineRunsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Set());
    const authoritativeNodeNamesRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(new Map());
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            autosaveCoordinator.activate();
            autosaveCoordinator.update(editorDraftFromState(editorStore.getState()));
            return editorStore.subscribe({
                "AigcEditorContent.useEffect": (state, previous)=>{
                    if (state.definition.nodes !== previous.definition.nodes) {
                        setNodes(state.definition.nodes.map(toFlowNode));
                        setEdges(state.definition.edges.map({
                            "AigcEditorContent.useEffect": (edge)=>toFlowEdge(edge, state.definition.nodes, state.definition.edges)
                        }["AigcEditorContent.useEffect"]));
                    }
                    if (state.definition.edges !== previous.definition.edges) {
                        setEdges(state.definition.edges.map({
                            "AigcEditorContent.useEffect": (edge)=>toFlowEdge(edge, state.definition.nodes, state.definition.edges)
                        }["AigcEditorContent.useEffect"]));
                    }
                    autosaveCoordinator.update(editorDraftFromState(state));
                }
            }["AigcEditorContent.useEffect"]);
        }
    }["AigcEditorContent.useEffect"], [
        autosaveCoordinator,
        editorStore
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            if (mode !== "pipeline") return;
            const parserNodeIds = new Set(definition.nodes.flatMap({
                "AigcEditorContent.useEffect": (node)=>node.type === "json_parser" ? [
                        node.id
                    ] : []
            }["AigcEditorContent.useEffect"]));
            const completedMutations = [
                ...runDetails.values()
            ].sort({
                "AigcEditorContent.useEffect.completedMutations": (left, right)=>left.run.run_number - right.run.run_number
            }["AigcEditorContent.useEffect.completedMutations"]).flatMap({
                "AigcEditorContent.useEffect.completedMutations": (detail)=>{
                    const hasParserMutation = detail.nodes.some({
                        "AigcEditorContent.useEffect.completedMutations.hasParserMutation": (node)=>parserNodeIds.has(node.node_id) && (node.status === "succeeded" || node.status === "reused")
                    }["AigcEditorContent.useEffect.completedMutations.hasParserMutation"]);
                    const namedNodes = new Map(detail.nodes.flatMap({
                        "AigcEditorContent.useEffect.completedMutations": (node)=>{
                            const generatedName = node.status === "succeeded" && node.result.naming?.status === "succeeded" ? node.result.naming.name : null;
                            if (!generatedName) return [];
                            return generatedMediaNameTargetNodeIds(definition, node.node_id).map({
                                "AigcEditorContent.useEffect.completedMutations": (nodeId)=>[
                                        nodeId,
                                        generatedName
                                    ]
                            }["AigcEditorContent.useEffect.completedMutations"]);
                        }
                    }["AigcEditorContent.useEffect.completedMutations"]));
                    return hasParserMutation || namedNodes.size > 0 ? [
                        {
                            runId: detail.run.id,
                            namedNodes
                        }
                    ] : [];
                }
            }["AigcEditorContent.useEffect.completedMutations"]);
            const unseen = completedMutations.filter({
                "AigcEditorContent.useEffect.unseen": ({ runId })=>!refreshedPipelineRunsRef.current.has(runId)
            }["AigcEditorContent.useEffect.unseen"]);
            if (unseen.length === 0) return;
            const immediateNodeNames = new Map();
            unseen.forEach({
                "AigcEditorContent.useEffect": ({ runId, namedNodes })=>{
                    refreshedPipelineRunsRef.current.add(runId);
                    namedNodes.forEach({
                        "AigcEditorContent.useEffect": (name, nodeId)=>{
                            authoritativeNodeNamesRef.current.set(nodeId, name);
                            immediateNodeNames.set(nodeId, name);
                        }
                    }["AigcEditorContent.useEffect"]);
                }
            }["AigcEditorContent.useEffect"]);
            applyGeneratedNodeNames(immediateNodeNames);
            void queryClient.invalidateQueries({
                queryKey: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcQueryKeys"].pipeline(entity.id)
            });
        }
    }["AigcEditorContent.useEffect"], [
        applyGeneratedNodeNames,
        definition,
        entity.id,
        mode,
        queryClient,
        runDetails
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            const server = pipelineQuery.data;
            if (mode !== "pipeline" || !server) return;
            // #region debug-point B-C:server-rebase
            void fetch("http://127.0.0.1:7777/event", {
                method: "POST",
                body: JSON.stringify({
                    sessionId: "pipeline-nodes-missing",
                    runId: "post-fix",
                    hypothesisId: "B-C",
                    location: "frontend/components/workspace/aigc/aigc-editor.tsx:server-rebase",
                    msg: "[DEBUG] Rebase server revision into editor",
                    data: {
                        entityId: entity.id,
                        editorRevision: editorStore.getState().revision,
                        serverRevision: server.revision,
                        editorDirty: editorStore.getState().dirty,
                        editorNodeIds: editorStore.getState().definition.nodes.map({
                            "AigcEditorContent.useEffect": (node)=>node.id
                        }["AigcEditorContent.useEffect"]),
                        serverNodeIds: server.definition.nodes.map({
                            "AigcEditorContent.useEffect": (node)=>node.id
                        }["AigcEditorContent.useEffect"])
                    },
                    ts: Date.now()
                })
            }).catch({
                "AigcEditorContent.useEffect": ()=>{}
            }["AigcEditorContent.useEffect"]);
            // #endregion
            const authoritativeNodeNames = new Map(authoritativeNodeNamesRef.current);
            void autosaveCoordinator.rebase({
                merge: {
                    "AigcEditorContent.useEffect": (base, local, remote)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["mergeAigcServerRevision"])(base, local, remote, authoritativeNodeNames)
                }["AigcEditorContent.useEffect"],
                revision: server.revision,
                snapshot: editorDraftFromEntity(server)
            }).then({
                "AigcEditorContent.useEffect": (result)=>{
                    if (!result.applied) return;
                    applyServerRevision({
                        definition: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serializeAigcEditorDefinition"])(server.definition),
                        description: server.description,
                        name: server.name,
                        revision: result.revision
                    }, {
                        draft: structuredClone(result.snapshot),
                        dirty: result.dirty,
                        authoritativeNodeNames
                    });
                    authoritativeNodeNames.forEach({
                        "AigcEditorContent.useEffect": (_, nodeId)=>authoritativeNodeNamesRef.current.delete(nodeId)
                    }["AigcEditorContent.useEffect"]);
                }
            }["AigcEditorContent.useEffect"]).catch({
                "AigcEditorContent.useEffect": (error)=>{
                    setFeedback(`Pipeline 刷新失败：${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error)}`);
                }
            }["AigcEditorContent.useEffect"]);
        }
    }["AigcEditorContent.useEffect"], [
        applyServerRevision,
        autosaveCoordinator,
        editorStore,
        entity.id,
        mode,
        pipelineQuery.data
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            if (!autosaveState.dirty && editorStore.getState().revision !== autosaveState.revision) {
                markSaved(autosaveState.revision);
            }
        }
    }["AigcEditorContent.useEffect"], [
        autosaveState.dirty,
        autosaveState.revision,
        editorStore,
        markSaved
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            autosaveCoordinator.activate();
            return ({
                "AigcEditorContent.useEffect": ()=>autosaveCoordinator.dispose()
            })["AigcEditorContent.useEffect"];
        }
    }["AigcEditorContent.useEffect"], [
        autosaveCoordinator
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            function warnBeforeUnload(event) {
                if (!autosaveCoordinator.getState().dirty) return;
                event.preventDefault();
                event.returnValue = "";
            }
            window.addEventListener("beforeunload", warnBeforeUnload);
            return ({
                "AigcEditorContent.useEffect": ()=>window.removeEventListener("beforeunload", warnBeforeUnload)
            })["AigcEditorContent.useEffect"];
        }
    }["AigcEditorContent.useEffect"], [
        autosaveCoordinator
    ]);
    const selectedNode = definition.nodes.find((node)=>node.id === selectedNodeId) ?? null;
    const selectedNodeRunDetail = selectedNode ? runProjection.displayRunForNode(selectedNode.id) ?? undefined : selectedRunDetail;
    const selectedNodeIsActive = selectedNode ? runProjection.isNodeActive(selectedNode.id) : false;
    const runListUnavailable = mode === "pipeline" && !runsQuery.isSuccess;
    const submissionPendingForNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[submissionPendingForNode]": (nodeId, pendingStarts = pendingRunStarts)=>{
            if (pendingStarts.has(FULL_RUN_PENDING)) return true;
            const nodeScope = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDownstreamAigcNodeIds"])(definition, nodeId);
            return [
                ...pendingStarts
            ].some({
                "AigcEditorContent.useCallback[submissionPendingForNode]": (startNodeId)=>{
                    const pendingScope = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getDownstreamAigcNodeIds"])(definition, startNodeId);
                    return setsOverlap(nodeScope, pendingScope);
                }
            }["AigcEditorContent.useCallback[submissionPendingForNode]"]);
        }
    }["AigcEditorContent.useCallback[submissionPendingForNode]"], [
        definition,
        pendingRunStarts
    ]);
    const pendingForNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[pendingForNode]": (nodeId)=>runListUnavailable || runProjection.isNodeActive(nodeId) || submissionPendingForNode(nodeId)
    }["AigcEditorContent.useCallback[pendingForNode]"], [
        runListUnavailable,
        runProjection,
        submissionPendingForNode
    ]);
    function updatePendingRunStart(key, pending) {
        const next = new Set(pendingRunStartsRef.current);
        if (pending) next.add(key);
        else next.delete(key);
        pendingRunStartsRef.current = next;
        setPendingRunStarts(next);
    }
    const hasPendingRun = pendingRunStarts.size > 0;
    const fullExecutionInProgress = runProjection.hasAnyActiveRun || hasPendingRun;
    const fullExecutionBlocked = runListUnavailable || fullExecutionInProgress;
    const selectedNodePending = selectedNode ? runListUnavailable || submissionPendingForNode(selectedNode.id) : false;
    const openInspector = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[openInspector]": (tab)=>{
            setInspectorTab(tab);
            setOpenPanel("inspector");
        }
    }["AigcEditorContent.useCallback[openInspector]"], [
        setInspectorTab,
        setOpenPanel
    ]);
    const selectNodeAndInspect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[selectNodeAndInspect]": (nodeId)=>{
            selectNode(nodeId);
            openInspector("config");
        }
    }["AigcEditorContent.useCallback[selectNodeAndInspect]"], [
        openInspector,
        selectNode
    ]);
    const dismissInspectorFromPane = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[dismissInspectorFromPane]": ()=>{
            selectNode(null);
            setContextMenu(null);
            setOpenPanel(null);
        }
    }["AigcEditorContent.useCallback[dismissInspectorFromPane]"], [
        selectNode,
        setOpenPanel
    ]);
    const contextPosition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[contextPosition]": (event, width, height)=>{
            const bounds = canvasContainerRef.current?.getBoundingClientRect();
            if (!bounds) return {
                left: 8,
                top: 8
            };
            return {
                left: Math.max(8, Math.min(event.clientX - bounds.left, bounds.width - width - 8)),
                top: Math.max(8, Math.min(event.clientY - bounds.top, bounds.height - height - 8))
            };
        }
    }["AigcEditorContent.useCallback[contextPosition]"], []);
    const openNodePicker = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[openNodePicker]": (event)=>{
            event.preventDefault();
            const instance = reactFlowRef.current;
            if (!instance) return;
            const flowPosition = instance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
            });
            if (!Number.isFinite(flowPosition.x) || !Number.isFinite(flowPosition.y)) {
                return;
            }
            setRenamingNodeId(null);
            setContextMenu({
                kind: "picker",
                flowPosition,
                position: contextPosition(event, 288, 420)
            });
        }
    }["AigcEditorContent.useCallback[openNodePicker]"], [
        contextPosition,
        setRenamingNodeId
    ]);
    const openNodeMenu = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[openNodeMenu]": (event, node)=>{
            event.preventDefault();
            event.stopPropagation();
            selectNode(node.id);
            setRenamingNodeId(null);
            setContextMenu({
                kind: "node",
                nodeId: node.id,
                position: contextPosition(event, 160, 42)
            });
        }
    }["AigcEditorContent.useCallback[openNodeMenu]"], [
        contextPosition,
        selectNode,
        setRenamingNodeId
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            if (!contextMenu) return;
            const close = {
                "AigcEditorContent.useEffect.close": (event)=>{
                    const target = event.target;
                    if (target instanceof Element && target.closest("[data-testid='aigc-canvas-node-picker'], [data-testid='aigc-node-context-menu']")) {
                        return;
                    }
                    setContextMenu(null);
                }
            }["AigcEditorContent.useEffect.close"];
            document.addEventListener("mousedown", close);
            return ({
                "AigcEditorContent.useEffect": ()=>document.removeEventListener("mousedown", close)
            })["AigcEditorContent.useEffect"];
        }
    }["AigcEditorContent.useEffect"], [
        contextMenu
    ]);
    const setDesktopNodePalettePreference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[setDesktopNodePalettePreference]": (visible)=>{
            setDesktopNodePaletteVisible(visible);
            writeNodePaletteVisibility(visible);
        }
    }["AigcEditorContent.useCallback[setDesktopNodePalettePreference]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcEditorContent.useEffect": ()=>{
            const media = window.matchMedia("(min-width: 1024px)");
            function clearNarrowNodePanel(event) {
                if (event.matches) {
                    setOpenPanel({
                        "AigcEditorContent.useEffect.clearNarrowNodePanel": (current)=>current === "nodes" ? null : current
                    }["AigcEditorContent.useEffect.clearNarrowNodePanel"]);
                }
            }
            media.addEventListener("change", clearNarrowNodePanel);
            return ({
                "AigcEditorContent.useEffect": ()=>media.removeEventListener("change", clearNarrowNodePanel)
            })["AigcEditorContent.useEffect"];
        }
    }["AigcEditorContent.useEffect"], []);
    const onNodesChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[onNodesChange]": (changes)=>{
            for (const change of changes){
                if (change.type === "remove") removeNode(change.id);
                if (change.type === "select" && change.selected) {
                    selectNodeAndInspect(change.id);
                }
            }
            setNodes({
                "AigcEditorContent.useCallback[onNodesChange]": (current)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyNodeChanges"])(changes, current)
            }["AigcEditorContent.useCallback[onNodesChange]"]);
        }
    }["AigcEditorContent.useCallback[onNodesChange]"], [
        removeNode,
        selectNodeAndInspect
    ]);
    const onEdgesChange = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[onEdgesChange]": (changes)=>{
            for (const change of changes){
                if (change.type === "remove") removeEdge(change.id);
            }
            setEdges({
                "AigcEditorContent.useCallback[onEdgesChange]": (current)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["applyEdgeChanges"])(changes, current)
            }["AigcEditorContent.useCallback[onEdgesChange]"]);
        }
    }["AigcEditorContent.useCallback[onEdgesChange]"], [
        removeEdge
    ]);
    const onConnect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[onConnect]": (connection)=>{
            const validationError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcConnectionValidationError"])(connection, definition.nodes, definition.edges);
            if (validationError) {
                setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectionValidationFeedback"])(validationError, connection, definition.nodes));
                return;
            }
            const edge = connectionToDomainEdge(connection);
            connect(edge);
            setEdges({
                "AigcEditorContent.useCallback[onConnect]": (current)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["addEdge"])(toFlowEdge(edge, definition.nodes, [
                        ...definition.edges,
                        edge
                    ]), current)
            }["AigcEditorContent.useCallback[onConnect]"]);
            setFeedback(null);
        }
    }["AigcEditorContent.useCallback[onConnect]"], [
        connect,
        definition.edges,
        definition.nodes
    ]);
    const validateConnection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "AigcEditorContent.useCallback[validateConnection]": (connection)=>{
            const validationError = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcConnectionValidationError"])(connection, definition.nodes, definition.edges);
            if (validationError === "target_connection_limit" || validationError === "bbox_reference_conflict" || validationError === "input_not_allowed_for_mode" || validationError === "output_not_allowed_for_mode" || validationError === "port_type_mismatch" || validationError === "system_only_output") {
                setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectionValidationFeedback"])(validationError, connection, definition.nodes));
            }
            return validationError === null;
        }
    }["AigcEditorContent.useCallback[validateConnection]"], [
        definition.edges,
        definition.nodes
    ]);
    async function flushLatestDraft(startNodeId) {
        const result = await autosaveCoordinator.flush(startNodeId ? {
            validate: (draft)=>validateEditorDraft(draft, startNodeId)
        } : undefined);
        if (!result.ok) {
            setFeedback(result.message);
            return result;
        }
        setFeedback(null);
        return result;
    }
    async function navigateAfterFlush(href) {
        const result = await flushLatestDraft();
        if (!result.ok) return;
        router.push(href);
    }
    async function saveAsTemplate() {
        if (mode !== "pipeline") return;
        const normalizedName = templateName.trim();
        if (!normalizedName) {
            setTemplateError("请输入模板名称。");
            return;
        }
        setTemplateError(null);
        const flushResult = await flushLatestDraft();
        if (!flushResult.ok) {
            setTemplateError(flushResult.message);
            return;
        }
        setIsSavingTemplate(true);
        try {
            const state = editorStore.getState();
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].saveAigcPipelineAsTemplate(entity.id, {
                name: normalizedName,
                description: state.description.trim()
            });
            setFeedback(`已保存为模板：${normalizedName}`);
            setSaveTemplateOpen(false);
        } catch (error) {
            setTemplateError((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error));
        } finally{
            setIsSavingTemplate(false);
        }
    }
    async function execute(startNodeId) {
        if (!allowExecution || mode !== "pipeline") return;
        if (runListUnavailable) return;
        if (startNodeId) {
            if (runProjection.isNodeActive(startNodeId) || submissionPendingForNode(startNodeId, pendingRunStartsRef.current)) {
                return;
            }
        } else if (runProjection.hasAnyActiveRun || pendingRunStartsRef.current.size > 0) {
            return;
        }
        const pendingKey = startNodeId ?? FULL_RUN_PENDING;
        updatePendingRunStart(pendingKey, true);
        try {
            const currentDefinition = editorStore.getState().definition;
            const validationDefinition = startNodeId ? definitionForNodeScope(currentDefinition, startNodeId) : currentDefinition;
            const validationIssue = definitionValidationIssue(validationDefinition);
            if (validationIssue) {
                setFeedback(validationIssue);
                return;
            }
            let validationAssetData = validationAssets.data;
            if (validationAssetData === undefined) {
                const result = await validationAssets.refetch();
                validationAssetData = result.data;
                if (validationAssetData === undefined) {
                    setFeedback("媒体资产预检加载失败，请重试。");
                    return;
                }
            }
            const assetValidationIssue = validationDefinition.nodes.flatMap((node)=>node.type === "video_generation" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVideoGenerationAssets"])(validationDefinition, node.id, validationAssetData) : node.type === "image_to_image" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateLayerDecompositionAssets"])(validationDefinition, node.id, validationAssetData) : [])[0];
            if (assetValidationIssue) {
                setFeedback(assetValidationIssue.nodeId && validationDefinition.nodes.find((node)=>node.id === assetValidationIssue.nodeId && node.type === "image_to_image") ? seedreamValidationFeedback(assetValidationIssue) : videoValidationFeedback(assetValidationIssue));
                return;
            }
            const flushResult = await flushLatestDraft(startNodeId);
            if (!flushResult.ok) return;
            setFeedback(null);
            const detail = await createRun.mutateAsync({
                expected_revision: flushResult.revision,
                mode: startNodeId ? "from_node" : "full",
                start_node_id: startNodeId ?? null
            });
            setSelectedRunId(detail.run.id);
            openInspector("run");
        } catch (error) {
            setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error));
        } finally{
            updatePendingRunStart(pendingKey, false);
        }
    }
    async function retryFailedNode(runId, nodeId) {
        if (runListUnavailable || runProjection.isNodeActive(nodeId) || submissionPendingForNode(nodeId, pendingRunStartsRef.current)) {
            return;
        }
        updatePendingRunStart(nodeId, true);
        try {
            const detail = await retryNode.mutateAsync({
                nodeId,
                runId
            });
            setSelectedRunId(detail.run.id);
            openInspector("run");
        } catch (error) {
            setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error));
        } finally{
            updatePendingRunStart(nodeId, false);
        }
    }
    async function cancelActiveRun(runId) {
        try {
            await cancelRun.mutateAsync(runId);
        } catch (error) {
            setFeedback((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error));
        }
    }
    const workspaceRoute = `/workspace/aigc?view=${mode === "pipeline" ? "pipelines" : "templates"}`;
    function leave(event) {
        event.preventDefault();
        void navigateAfterFlush(workspaceRoute);
    }
    function toggleDetails() {
        if (openPanel === "inspector" && inspectorTab === "config") {
            setOpenPanel(null);
            return;
        }
        openInspector("config");
    }
    const continueFromNode = useLatestCallback({
        "AigcEditorContent.useLatestCallback[continueFromNode]": (nodeId)=>void execute(nodeId)
    }["AigcEditorContent.useLatestCallback[continueFromNode]"]);
    const openLayerEditor = useLatestCallback({
        "AigcEditorContent.useLatestCallback[openLayerEditor]": (href)=>void navigateAfterFlush(href)
    }["AigcEditorContent.useLatestCallback[openLayerEditor]"]);
    const runActions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorContent.useMemo[runActions]": ()=>({
                continueFromNode,
                openLayerEditor,
                pendingForNode
            })
    }["AigcEditorContent.useMemo[runActions]"], [
        continueFromNode,
        openLayerEditor,
        pendingForNode
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#101318] text-[#e8eaed] [--accent-foreground:210_17%_92%] [--accent:218_11%_18%] [--background:220_20%_8%] [--border:218_12%_20%] [--card:220_13%_11%] [--foreground:210_17%_92%] [--input:218_12%_24%] [--muted-foreground:218_9%_60%] [--muted:220_11%_16%] [--secondary-foreground:210_17%_88%] [--secondary:218_11%_16%]",
        "data-testid": "aigc-editor-shell",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "relative flex h-14 shrink-0 flex-row items-center gap-1 overflow-hidden border-b border-[#30353d] bg-[#171a1f] px-2 shadow-[0_3px_12px_rgba(0,0,0,0.22)] sm:px-3",
                "data-testid": "aigc-editor-header",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative z-10 flex min-w-0 flex-1 items-center gap-2",
                        "data-testid": "aigc-editor-title-row",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                asChild: true,
                                className: "h-10 w-10 shrink-0 text-zinc-400 hover:bg-[#252a31] hover:text-white",
                                size: "icon",
                                title: "返回 AIGC 工作台",
                                variant: "ghost",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                                    "aria-label": "返回",
                                    href: workspaceRoute,
                                    onClick: leave,
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1153,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1152,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1145,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                    className: "truncate text-sm font-medium text-zinc-100",
                                    "data-testid": "aigc-editor-title",
                                    title: name,
                                    children: name
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1157,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1156,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                className: "hidden shrink-0 border-zinc-700 bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-400 md:inline-flex",
                                "data-testid": "aigc-editor-mode",
                                variant: "outline",
                                children: mode === "pipeline" ? "画布" : "模板"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1165,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1141,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-label": `自动保存状态：${autosaveStatusText(autosaveState)}`,
                        "aria-live": "polite",
                        className: "sr-only",
                        "data-status": autosaveState.status,
                        "data-testid": "aigc-autosave-status",
                        children: autosaveStatusText(autosaveState)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1173,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolbarStarMap, {}, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1182,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-label": "画布命令",
                        className: "relative z-10 flex shrink-0 items-center justify-end gap-1",
                        "data-testid": "aigc-editor-actions",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                "aria-label": "面板命令",
                                className: "flex items-center",
                                "data-testid": "aigc-command-group-panel",
                                role: "group",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    "aria-label": "详情",
                                    "aria-pressed": openPanel === "inspector" && inspectorTab === "config",
                                    className: "h-10 w-10 text-zinc-400 hover:bg-[#252a31] hover:text-white",
                                    "data-testid": "aigc-command-inspector",
                                    onClick: toggleDetails,
                                    size: "icon",
                                    title: "详情",
                                    type: "button",
                                    variant: "ghost",
                                    children: openPanel === "inspector" && inspectorTab === "config" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2d$close$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRightClose$3e$__["PanelRightClose"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1206,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRight$3e$__["PanelRight"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1208,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1194,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1188,
                                columnNumber: 11
                            }, this),
                            mode === "pipeline" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        "aria-label": "文档命令",
                                        className: "flex items-center border-l border-zinc-700/70 pl-1",
                                        "data-testid": "aigc-command-group-document",
                                        role: "group",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            "aria-label": "另存为模板",
                                            className: "h-10 min-w-10 px-0 text-zinc-300 hover:bg-[#252a31] hover:text-white lg:px-3",
                                            "data-testid": "aigc-command-save-template",
                                            disabled: isSavingTemplate,
                                            onClick: ()=>{
                                                setTemplateName(editorStore.getState().name);
                                                setTemplateError(null);
                                                setSaveTemplateOpen(true);
                                            },
                                            size: "sm",
                                            title: "另存为模板",
                                            type: "button",
                                            variant: "ghost",
                                            children: [
                                                isSavingTemplate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                                    className: "h-4 w-4 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1236,
                                                    columnNumber: 21
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$files$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Files$3e$__["Files"], {
                                                    className: "h-4 w-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1238,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "hidden lg:inline",
                                                    children: "另存为模板"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1240,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1220,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1214,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        "aria-label": "执行命令",
                                        className: "flex items-center border-l border-zinc-700/70 pl-1",
                                        "data-testid": "aigc-command-group-execution",
                                        role: "group",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            "aria-label": fullExecutionInProgress ? "运行中" : "执行",
                                            className: "h-10 min-w-10 bg-blue-600 px-0 text-white hover:bg-blue-500 lg:px-3",
                                            "data-testid": "aigc-command-execute",
                                            disabled: !allowExecution || fullExecutionBlocked || !definition.nodes.some((node)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAigcExecutionNodeType"])(node.type)),
                                            onClick: ()=>void execute(),
                                            size: "sm",
                                            title: fullExecutionInProgress ? "运行中" : "执行",
                                            children: [
                                                hasPendingRun ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                                    className: "h-4 w-4 animate-spin"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1265,
                                                    columnNumber: 21
                                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                                    className: "h-4 w-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1267,
                                                    columnNumber: 21
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "hidden lg:inline",
                                                    children: fullExecutionInProgress ? "运行中" : "执行"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 1269,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1249,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1243,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1213,
                                columnNumber: 13
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1183,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1137,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-h-0 flex-1",
                children: [
                    isDesktop && hydrated && desktopNodePaletteVisible ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodePalette, {
                        onAdd: addNode,
                        onClose: ()=>setDesktopNodePalettePreference(false)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1281,
                        columnNumber: 11
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "relative min-w-0 flex-1",
                        ref: canvasContainerRef,
                        children: [
                            isDesktop && (!hydrated || !desktopNodePaletteVisible) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute left-3 top-3 z-30 border border-[#30353d] bg-[#181b20] p-1 shadow-lg shadow-black/30",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    "aria-controls": "aigc-node-palette",
                                    "aria-expanded": false,
                                    "aria-label": "打开节点库",
                                    onClick: ()=>setDesktopNodePalettePreference(true),
                                    size: "icon",
                                    title: "打开节点库",
                                    type: "button",
                                    variant: "ghost",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__["PanelLeft"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1302,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1292,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1291,
                                columnNumber: 13
                            }, this) : null,
                            !isDesktop && openPanel !== "inspector" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("absolute z-30 flex gap-1 border border-[#30353d] bg-[#181b20] p-1 shadow-lg shadow-black/30", openPanel === "nodes" ? "left-[252px] top-[60px]" : "left-3 top-3"),
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        "aria-controls": "aigc-node-palette",
                                        "aria-expanded": openPanel === "nodes",
                                        "aria-label": openPanel === "nodes" ? "关闭节点面板" : "打开节点面板",
                                        onClick: ()=>setOpenPanel((current)=>current === "nodes" ? null : "nodes"),
                                        size: "icon",
                                        title: openPanel === "nodes" ? "关闭节点面板" : "打开节点面板",
                                        type: "button",
                                        variant: "ghost",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeft$3e$__["PanelLeft"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1333,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1315,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        "aria-label": "打开检查器",
                                        onClick: ()=>openInspector("config"),
                                        size: "icon",
                                        type: "button",
                                        variant: "ghost",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRight$3e$__["PanelRight"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1342,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1335,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1307,
                                columnNumber: 13
                            }, this) : null,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcRunActionsProvider"], {
                                value: runActions,
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcRunProvider"], {
                                    value: runProjection,
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$node$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["NodeCanvas"], {
                                        backgroundProps: {
                                            color: "#39404a",
                                            gap: 20,
                                            size: 1
                                        },
                                        className: "bg-[#101318]",
                                        controlsProps: {
                                            className: "overflow-hidden rounded-md border border-[#343a43] bg-[#20242a] text-zinc-300 shadow-lg shadow-black/40 [&>button]:border-[#343a43] [&>button]:bg-[#20242a] [&>button]:fill-zinc-300 [&>button:hover]:bg-[#2a3038]",
                                            orientation: "horizontal",
                                            position: "bottom-center",
                                            showInteractive: true
                                        },
                                        edges: edges,
                                        nodeTypes: AIGC_NODE_TYPES,
                                        nodes: nodes,
                                        onNodeDragStop: (_, node)=>moveNode(node.id, {
                                                x: node.position.x,
                                                y: node.position.y
                                            }),
                                        onNodesChange: onNodesChange,
                                        reactFlowProps: {
                                            ...isDesktop ? {} : {
                                                fitViewOptions: {
                                                    minZoom: 0.25
                                                },
                                                minZoom: 0.25
                                            },
                                            defaultViewport: definition.viewport,
                                            deleteKeyCode: [
                                                "Backspace",
                                                "Delete"
                                            ],
                                            edgesReconnectable: false,
                                            isValidConnection: validateConnection,
                                            onConnect,
                                            onEdgesChange,
                                            onMoveEnd: (_, viewport)=>setViewport(viewport),
                                            onNodeClick: (_, node)=>selectNodeAndInspect(node.id),
                                            onNodeContextMenu: openNodeMenu,
                                            onInit: (instance)=>{
                                                reactFlowRef.current = instance;
                                            },
                                            onPaneClick: dismissInspectorFromPane,
                                            onPaneContextMenu: openNodePicker,
                                            snapGrid: [
                                                16,
                                                16
                                            ],
                                            snapToGrid: true
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1348,
                                        columnNumber: 15
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1347,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1346,
                                columnNumber: 11
                            }, this),
                            contextMenu?.kind === "picker" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$canvas$2d$context$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcCanvasNodePicker"], {
                                onAdd: (type)=>{
                                    addNode(type, contextMenu.flowPosition);
                                    setContextMenu(null);
                                },
                                onClose: ()=>setContextMenu(null),
                                position: contextMenu.position
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1397,
                                columnNumber: 13
                            }, this) : contextMenu?.kind === "node" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$canvas$2d$context$2d$menu$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcNodeContextMenu"], {
                                onClose: ()=>setContextMenu(null),
                                onRename: ()=>{
                                    setRenamingNodeId(contextMenu.nodeId);
                                    setContextMenu(null);
                                },
                                position: contextMenu.position
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1406,
                                columnNumber: 13
                            }, this) : null,
                            feedback ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "absolute bottom-4 left-1/2 z-20 -translate-x-1/2 border border-border bg-card px-3 py-2 text-xs shadow-md",
                                role: "status",
                                children: feedback
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1416,
                                columnNumber: 13
                            }, this) : null,
                            !isDesktop && openPanel === "nodes" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodePalette, {
                                className: "absolute inset-y-0 left-0 z-20 w-60 shadow-xl",
                                onAdd: (type)=>{
                                    addNode(type);
                                    setOpenPanel(null);
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1424,
                                columnNumber: 13
                            }, this) : null,
                            !isDesktop && openPanel === "inspector" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Inspector, {
                                className: "absolute inset-y-0 right-0 z-20 w-[min(320px,100vw)] shadow-xl",
                                allowExecution: allowExecution,
                                mode: mode,
                                node: selectedNode,
                                onCancelRun: (runId)=>void cancelActiveRun(runId),
                                onDescriptionChange: setDescription,
                                onExecuteNode: (nodeId)=>void execute(nodeId),
                                onNameChange: setName,
                                onClose: ()=>setOpenPanel(null),
                                onRetryNode: (runId, nodeId)=>void retryFailedNode(runId, nodeId),
                                onSelectRun: setSelectedRunId,
                                onTabChange: setInspectorTab,
                                nodeActive: selectedNodeIsActive,
                                nodePending: selectedNodePending,
                                nodeRunDetail: selectedNodeRunDetail,
                                runs: runs,
                                selectedRunId: selectedPanelRunId,
                                selectedRunDetail: selectedRunDetail,
                                selectedRunDetailState: selectedRunDetailState,
                                tab: inspectorTab
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1433,
                                columnNumber: 13
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1286,
                        columnNumber: 9
                    }, this),
                    isDesktop && openPanel === "inspector" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Inspector, {
                        allowExecution: allowExecution,
                        mode: mode,
                        node: selectedNode,
                        onCancelRun: (runId)=>void cancelActiveRun(runId),
                        onDescriptionChange: setDescription,
                        onExecuteNode: (nodeId)=>void execute(nodeId),
                        onNameChange: setName,
                        onClose: ()=>setOpenPanel(null),
                        onRetryNode: (runId, nodeId)=>void retryFailedNode(runId, nodeId),
                        onSelectRun: setSelectedRunId,
                        onTabChange: setInspectorTab,
                        nodeActive: selectedNodeIsActive,
                        nodePending: selectedNodePending,
                        nodeRunDetail: selectedNodeRunDetail,
                        runs: runs,
                        selectedRunId: selectedPanelRunId,
                        selectedRunDetail: selectedRunDetail,
                        selectedRunDetailState: selectedRunDetailState,
                        tab: inspectorTab
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1460,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1279,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: (nextOpen)=>{
                    if (isSavingTemplate) return;
                    setSaveTemplateOpen(nextOpen);
                    if (!nextOpen) setTemplateError(null);
                },
                open: saveTemplateOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "max-w-md p-6",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        onSubmit: (event)=>{
                            event.preventDefault();
                            void saveAsTemplate();
                        },
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                        children: "另存为模板"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1501,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                        children: "当前画布将保存为可复用模板，具体图片和框选引用不会写入模板。"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1502,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1500,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mt-5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                        htmlFor: "save-template-name",
                                        children: "模板名称"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1507,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        autoFocus: true,
                                        className: "mt-1.5",
                                        id: "save-template-name",
                                        maxLength: 120,
                                        onChange: (event)=>{
                                            setTemplateName(event.target.value);
                                            setTemplateError(null);
                                        },
                                        value: templateName
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1508,
                                        columnNumber: 15
                                    }, this),
                                    templateError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 text-xs text-destructive",
                                        role: "alert",
                                        children: templateError
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1520,
                                        columnNumber: 17
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1506,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                                className: "mt-6",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        disabled: isSavingTemplate,
                                        onClick: ()=>setSaveTemplateOpen(false),
                                        type: "button",
                                        variant: "outline",
                                        children: "取消"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1526,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                        disabled: isSavingTemplate || !templateName.trim(),
                                        type: "submit",
                                        children: [
                                            isSavingTemplate ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                                className: "h-4 w-4 animate-spin"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 1539,
                                                columnNumber: 19
                                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$files$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Files$3e$__["Files"], {
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 1541,
                                                columnNumber: 19
                                            }, this),
                                            isSavingTemplate ? "保存中" : "保存模板"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1534,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1525,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1494,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1493,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1485,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 1133,
        columnNumber: 5
    }, this);
}
_s1(AigcEditorContent, "eu3jiZDYGRpgO5/kAvynextiFGE=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStoreApi"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"],
        useDesktopLayout,
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRuns"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunDetails"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCreateAigcRun"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRetryAigcNode"],
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCancelAigcRun"],
        useLatestCallback,
        useLatestCallback
    ];
});
_c4 = AigcEditorContent;
function NodePalette({ className, onAdd, onClose }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("w-[184px] shrink-0 overflow-y-auto border-r border-[#30353d] bg-[#181b20] px-2 py-3", className),
        id: "aigc-node-palette",
        "data-testid": "aigc-node-palette",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-7 items-center justify-between gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-xs font-semibold text-foreground",
                        children: "节点"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1572,
                        columnNumber: 9
                    }, this),
                    onClose ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        "aria-controls": "aigc-node-palette",
                        "aria-expanded": true,
                        "aria-label": "隐藏节点库",
                        className: "h-7 w-7 shrink-0",
                        onClick: onClose,
                        size: "icon",
                        title: "隐藏节点库",
                        type: "button",
                        variant: "ghost",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$left$2d$close$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelLeftClose$3e$__["PanelLeftClose"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1585,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1574,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1571,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-[11px] text-muted-foreground",
                children: "点击添加到画布"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1589,
                columnNumber: 7
            }, this),
            [
                "modality",
                "model",
                "control"
            ].map((category)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mt-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mb-1.5 font-mono text-[10px] uppercase text-muted-foreground",
                            children: category === "modality" ? "模态" : category === "model" ? "模型" : "控制"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1592,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-1",
                            children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_EDITOR_NODE_REGISTRY"].filter((item)=>item.category === category).map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    className: "flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-foreground hover:bg-[#252a31]",
                                    onClick: ()=>onAdd(item.type),
                                    type: "button",
                                    children: [
                                        item.type.includes("image") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"], {
                                            className: "h-4 w-4 text-info"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1610,
                                            columnNumber: 19
                                        }, this) : item.type.includes("video") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
                                            className: "h-4 w-4",
                                            style: {
                                                color: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcModalityColors"])("video_asset").iconColor
                                            }
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1612,
                                            columnNumber: 19
                                        }, this) : item.type.includes("audio") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__["AudioLines"], {
                                            className: "h-4 w-4 text-info"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1619,
                                            columnNumber: 19
                                        }, this) : item.type.includes("text") ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$type$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Type$3e$__["Type"], {
                                            className: "h-4 w-4 text-info"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1621,
                                            columnNumber: 19
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                                            className: "h-4 w-4 text-primary"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                            lineNumber: 1623,
                                            columnNumber: 19
                                        }, this),
                                        item.label
                                    ]
                                }, item.type, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1603,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1599,
                            columnNumber: 11
                        }, this)
                    ]
                }, category, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1591,
                    columnNumber: 9
                }, this))
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 1563,
        columnNumber: 5
    }, this);
}
_c5 = NodePalette;
function Inspector({ allowExecution, className, mode, node, onCancelRun, onDescriptionChange, onExecuteNode, onNameChange, onClose, onRetryNode, onSelectRun, onTabChange, nodeActive, nodePending, nodeRunDetail, runs, selectedRunDetail, selectedRunDetailState, selectedRunId, tab }) {
    _s2();
    const name = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "Inspector.useAigcEditorStore[name]": (state)=>state.name
    }["Inspector.useAigcEditorStore[name]"]);
    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "Inspector.useAigcEditorStore[description]": (state)=>state.description
    }["Inspector.useAigcEditorStore[description]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "Inspector.useAigcEditorStore[definition]": (state)=>state.definition
    }["Inspector.useAigcEditorStore[definition]"]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("w-80 shrink-0 overflow-y-auto border-l border-[#30353d] bg-[#181b20]", className),
        "data-testid": "aigc-inspector",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-1 border-b border-[#30353d] p-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid min-w-0 flex-1 grid-cols-3",
                        children: [
                            "config",
                            "result",
                            "run"
                        ].map((item)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                "aria-selected": tab === item,
                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 rounded text-xs font-semibold", tab === item ? "bg-[#252a31] text-blue-400" : "text-muted-foreground hover:bg-[#20242a] hover:text-foreground"),
                                onClick: ()=>onTabChange(item),
                                role: "tab",
                                type: "button",
                                children: item === "config" ? "配置" : item === "result" ? "结果" : "运行"
                            }, item, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1692,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1690,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        "aria-label": "关闭详情栏",
                        className: "shrink-0",
                        onClick: onClose,
                        size: "icon",
                        title: "关闭详情栏",
                        type: "button",
                        variant: "ghost",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$panel$2d$right$2d$close$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__PanelRightClose$3e$__["PanelRightClose"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1718,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 1709,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1689,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "p-4",
                children: tab === "config" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-4",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "aigc-editor-name",
                                    children: "名称"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1725,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                    className: "mt-1.5",
                                    id: "aigc-editor-name",
                                    maxLength: 120,
                                    onChange: (event)=>onNameChange(event.target.value),
                                    value: name
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1726,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1724,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                    htmlFor: "aigc-editor-description",
                                    children: "描述"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1735,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                    className: "mt-1.5 min-h-20",
                                    id: "aigc-editor-description",
                                    maxLength: 500,
                                    onChange: (event)=>onDescriptionChange(event.target.value),
                                    value: description
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1736,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1734,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-t border-border pt-4",
                            children: node ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeCustomNameField, {
                                        node: node
                                    }, `${node.id}:${node.custom_name ?? ""}`, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1747,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeConfig, {
                                        mode: mode,
                                        node: node,
                                        runDetail: nodeRunDetail
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 1751,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1746,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InspectorEmpty, {}, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 1758,
                                columnNumber: 17
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1744,
                            columnNumber: 13
                        }, this),
                        allowExecution && mode === "pipeline" && node && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["isAigcExecutionNodeType"])(node.type) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            className: "w-full",
                            disabled: nodeActive || nodePending,
                            onClick: ()=>onExecuteNode(node.id),
                            size: "sm",
                            type: "button",
                            variant: "outline",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 1773,
                                    columnNumber: 17
                                }, this),
                                "从此节点运行"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1765,
                            columnNumber: 15
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1723,
                    columnNumber: 11
                }, this) : tab === "result" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResultPanel, {
                    definition: definition,
                    nodeId: node?.id ?? null,
                    runDetail: nodeRunDetail
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1779,
                    columnNumber: 11
                }, this) : mode === "template" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InspectorPlaceholder, {
                    copy: "模板不可执行，请先创建画布实例。",
                    title: "模板编辑模式"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1786,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunPanel, {
                    onCancel: onCancelRun,
                    onRetry: onRetryNode,
                    onSelectRun: onSelectRun,
                    runDetail: selectedRunDetail,
                    runDetailState: selectedRunDetailState,
                    runs: runs,
                    selectedRunId: selectedRunId
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1791,
                    columnNumber: 13
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1721,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 1682,
        columnNumber: 5
    }, this);
}
_s2(Inspector, "IDhsRO6hnmFGd56uKJNRHA+0Xbo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c6 = Inspector;
function NodeCustomNameField({ node }) {
    _s3();
    const setNodeCustomName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "NodeCustomNameField.useAigcEditorStore[setNodeCustomName]": (state)=>state.setNodeCustomName
    }["NodeCustomNameField.useAigcEditorStore[setNodeCustomName]"]);
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(node.custom_name ?? "");
    const cancelBlurRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                htmlFor: `node-custom-name-${node.id}`,
                children: "节点名称"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1816,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                className: "mt-1.5",
                id: `node-custom-name-${node.id}`,
                maxLength: 120,
                onBlur: ()=>{
                    if (cancelBlurRef.current) {
                        cancelBlurRef.current = false;
                        return;
                    }
                    setNodeCustomName(node.id, draft);
                },
                onChange: (event)=>setDraft(event.target.value),
                onKeyDown: (event)=>{
                    if (event.key === "Enter") {
                        event.preventDefault();
                        setNodeCustomName(node.id, draft);
                        event.currentTarget.blur();
                    } else if (event.key === "Escape") {
                        event.preventDefault();
                        cancelBlurRef.current = true;
                        setDraft(node.custom_name ?? "");
                        event.currentTarget.blur();
                    }
                },
                placeholder: "使用系统自动名称",
                value: draft
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1817,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-[10px] text-muted-foreground",
                children: "清空后恢复系统自动名称"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1844,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 1815,
        columnNumber: 5
    }, this);
}
_s3(NodeCustomNameField, "eROFNYzAfbf1mFcNvjGxEpcpf98=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c7 = NodeCustomNameField;
function NodeConfig({ mode, node, runDetail }) {
    _s4();
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "NodeConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["NodeConfig.useAigcEditorStore[update]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "NodeConfig.useAigcEditorStore[definition]": (state)=>state.definition
    }["NodeConfig.useAigcEditorStore[definition]"]);
    const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(node.type);
    const automaticDisplayName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes).get(node.id)?.displayName ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeBaseDisplayName"])(node);
    const managedSource = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedTextSource"])(node, definition.nodes);
    const displayName = node.custom_name?.trim() || managedSource?.itemLabel || automaticDisplayName;
    const modalityNode = asModalityNode(node);
    if (modalityNode) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityNodeConfig, {
            displayName: displayName,
            mode: mode,
            node: modalityNode,
            runDetail: runDetail
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1875,
            columnNumber: 7
        }, this);
    }
    if (node.type === "llm") {
        const imageInput = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$llm$2d$image$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveAigcLlmImageInput"])(definition, node.id, runDetail);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
            title: displayName,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LlmImageInputStatus, {
                    input: imageInput
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1892,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                    htmlFor: "node-model",
                    children: "模型"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1893,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                    className: "mt-1.5 h-10 w-full rounded-md border border-input bg-card px-2 text-xs",
                    id: "node-model",
                    onChange: (event)=>update(node.id, {
                            ...node.config,
                            model: event.target.value
                        }),
                    value: node.config.model,
                    children: registration?.models.map((model)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                            value: model,
                            children: model
                        }, model, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 1903,
                            columnNumber: 13
                        }, this))
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1894,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                    className: "mt-3 block",
                    htmlFor: "node-system",
                    children: "System Prompt"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1906,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                    className: "mt-1.5 min-h-24",
                    id: "node-system",
                    onChange: (event)=>update(node.id, {
                            ...node.config,
                            system_prompt: event.target.value
                        }),
                    value: node.config.system_prompt
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 1907,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1891,
            columnNumber: 7
        }, this);
    }
    if (node.type === "video_generation") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoGenerationConfig, {
            displayName: displayName,
            node: node
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1922,
            columnNumber: 12
        }, this);
    }
    if (node.type === "video_enhancement") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoEnhancementConfig, {
            displayName: displayName,
            node: node
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1925,
            columnNumber: 12
        }, this);
    }
    if (node.type === "video_face_blur") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoFaceBlurNodeConfig, {
            displayName: displayName,
            node: node
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1928,
            columnNumber: 12
        }, this);
    }
    if (node.type === "json_parser") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonParserNodeConfig, {
            displayName: displayName,
            node: node,
            runDetail: runDetail
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1932,
            columnNumber: 7
        }, this);
    }
    if (node.type === "image_to_image") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SeedreamImageConfig, {
            displayName: displayName,
            node: node
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1940,
            columnNumber: 12
        }, this);
    }
    if (node.type === "text_to_image") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
            title: displayName,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$image$2d$dimensions$2d$field$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcImageDimensionsField"], {
                config: node.config,
                nodeId: node.id,
                onChange: (config)=>update(node.id, config)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1945,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1944,
            columnNumber: 7
        }, this);
    }
    if (node.type === "layer_canvas" || node.type === "layer_composite") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
            title: displayName,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs leading-5 text-muted-foreground",
                children: "图层配置将在对应的图层工作流中编辑。"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1956,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 1955,
            columnNumber: 7
        }, this);
    }
    return null;
}
_s4(NodeConfig, "ie/ygTbTe3l/WuhzMzH1dOIvSSs=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c8 = NodeConfig;
function LlmImageInputStatus({ input }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-label": `LLM 图片输入：${input.sourceLabel ?? "未连接"}，${input.statusLabel}`,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mb-3 rounded border px-2.5 py-2 text-xs", input.state === "ready" ? "border-success/30 bg-success/10 text-success" : input.state === "unavailable" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted/50 text-muted-foreground"),
        "data-testid": "aigc-llm-image-input-inspector",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "font-medium text-foreground",
                children: "图片输入"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1983,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 break-words",
                children: [
                    input.sourceLabel ?? "未连接",
                    " · ",
                    input.statusLabel
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 1984,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 1971,
        columnNumber: 5
    }, this);
}
_c9 = LlmImageInputStatus;
function JsonParserNodeConfig({ displayName, node, runDetail }) {
    _s5();
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "JsonParserNodeConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["JsonParserNodeConfig.useAigcEditorStore[update]"]);
    const feedback = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonPathInputFeedback"])(node.config.json_path);
    const runNode = runDetail?.nodes.find((item)=>item.node_id === node.id);
    const error = runNode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcNodeLogError"])(runNode) : null;
    const errorMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonParserErrorMessage"])(error);
    const count = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonParserItemCount"])(runNode);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                htmlFor: `json-path-${node.id}`,
                children: "JSONPath"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2009,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                "aria-describedby": `json-path-feedback-${node.id}`,
                "aria-invalid": feedback.kind === "error",
                className: "mt-1.5 font-mono text-xs",
                id: `json-path-${node.id}`,
                maxLength: 500,
                onChange: (event)=>update(node.id, {
                        ...node.config,
                        json_path: event.target.value
                    }),
                placeholder: "$.items",
                spellCheck: false,
                value: node.config.json_path
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2010,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-1.5 break-words text-[10px] leading-4", feedback.kind === "error" ? "text-destructive" : "text-muted-foreground"),
                id: `json-path-feedback-${node.id}`,
                role: feedback.kind === "error" ? "alert" : undefined,
                children: feedback.message
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2026,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                className: "mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded border border-border bg-muted/20 p-2 text-[10px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        className: "text-muted-foreground",
                        children: "状态"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2039,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        children: runNode ? nodeStatusLabel(runNode.status) : "未运行"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2040,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        className: "text-muted-foreground",
                        children: "Item 数量"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2041,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        children: count === null ? "-" : `${count} 项`
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2042,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2038,
                columnNumber: 7
            }, this),
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-3 border-l-2 border-destructive pl-2 text-[10px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "break-all font-mono text-destructive",
                        children: error.code ?? "json_parser_failed"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2046,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 break-words text-destructive",
                        children: errorMessage
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 2049,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2045,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-3 text-[10px] leading-4 text-muted-foreground",
                children: "items 输出由系统自动连接，最多生成 20 个文本节点。"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2052,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2008,
        columnNumber: 5
    }, this);
}
_s5(JsonParserNodeConfig, "RBajBuqS6Evk18LY74U4n8OmnsM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c10 = JsonParserNodeConfig;
const SEEDREAM_IMAGE_OPERATION_OPTIONS = [
    {
        label: "图生图",
        value: "image_to_image"
    },
    {
        label: "图片编辑",
        value: "image_edit"
    },
    {
        label: "图层拆分",
        value: "layer_decomposition"
    }
];
function SeedreamImageConfig({ displayName, node }) {
    _s6();
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "SeedreamImageConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["SeedreamImageConfig.useAigcEditorStore[update]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "SeedreamImageConfig.useAigcEditorStore[definition]": (state)=>state.definition
    }["SeedreamImageConfig.useAigcEditorStore[definition]"]);
    const operation = node.config.operation ?? "image_to_image";
    const validationAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            "aigc",
            "media-validation-assets"
        ],
        queryFn: loadAigcMediaAssets
    });
    const definitionIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateSeedreamImageDefinition"])(definition).find((candidate)=>candidate.nodeId === node.id);
    const assetIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateLayerDecompositionAssets"])(definition, node.id, validationAssets.data ?? [])[0];
    const issue = definitionIssue ?? assetIssue;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                            children: "操作模式"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2096,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            "aria-label": "操作模式",
                            className: "mt-1.5 grid grid-cols-3 rounded-md border border-input bg-muted/40 p-0.5",
                            role: "group",
                            children: SEEDREAM_IMAGE_OPERATION_OPTIONS.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    "aria-pressed": operation === option.value,
                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("h-8 rounded px-1 text-[11px] font-semibold transition-colors", operation === option.value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"),
                                    onClick: ()=>update(node.id, {
                                            ...node.config,
                                            operation: option.value
                                        }),
                                    type: "button",
                                    children: option.label
                                }, option.value, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2103,
                                    columnNumber: 15
                                }, this))
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2097,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2095,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "rounded-md border border-border bg-muted/25 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "font-medium text-foreground",
                            children: "Seedream 5.0 Pro"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2126,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            children: operation === "image_to_image" ? "连接 1-10 张参考图和必填提示词，输出新图片。" : operation === "image_edit" ? "连接一张编辑图片或一个编辑图层，并连接必填提示词。" : "连接一张 PNG/JPEG；提示词可选，留空时自动识别主要元素。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2127,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2125,
                    columnNumber: 9
                }, this),
                operation === "layer_decomposition" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "拆分尺寸",
                            onChange: (value)=>update(node.id, {
                                    ...node.config,
                                    size: value
                                }),
                            options: [
                                {
                                    label: "自动",
                                    value: "auto"
                                },
                                "1K",
                                "1.5K",
                                "2K"
                            ],
                            value: node.config.size
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2137,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[10px] leading-4 text-muted-foreground",
                            children: "输入比例 1:16-16:1，总像素 262,144-36,000,000，文件小于 30 MB。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2153,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2136,
                    columnNumber: 11
                }, this) : operation === "image_to_image" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$image$2d$dimensions$2d$field$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcImageDimensionsField"], {
                    config: node.config,
                    nodeId: node.id,
                    onChange: (config)=>update(node.id, {
                            ...node.config,
                            ...config
                        })
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2158,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-2 gap-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                                    label: "画幅",
                                    onChange: (value)=>update(node.id, {
                                            ...node.config,
                                            aspect_ratio: value
                                        }),
                                    options: [
                                        "1:1",
                                        "16:9",
                                        "9:16",
                                        "4:3",
                                        "3:4"
                                    ],
                                    value: node.config.aspect_ratio
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2168,
                                    columnNumber: 15
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                                    label: "尺寸",
                                    onChange: (value)=>update(node.id, {
                                            ...node.config,
                                            size: value
                                        }),
                                    options: [
                                        "1K",
                                        "1.5K",
                                        "2K"
                                    ],
                                    value: node.config.size
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2179,
                                    columnNumber: 15
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2167,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "输出格式",
                            onChange: (value)=>update(node.id, {
                                    ...node.config,
                                    format: value
                                }),
                            options: [
                                {
                                    label: "PNG",
                                    value: "png"
                                },
                                {
                                    label: "JPEG",
                                    value: "jpeg"
                                }
                            ],
                            value: node.config.format
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2191,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2166,
                    columnNumber: 11
                }, this),
                issue ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive",
                    role: "alert",
                    children: issue.message
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2208,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2094,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2093,
        columnNumber: 5
    }, this);
}
_s6(SeedreamImageConfig, "5uc/BPwMV7cCkidK5HL9erlnd2s=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
_c11 = SeedreamImageConfig;
const VIDEO_MODE_OPTIONS = [
    {
        label: "文生视频",
        value: "text_to_video"
    },
    {
        label: "首帧图生视频",
        value: "first_frame"
    },
    {
        label: "首尾帧图生视频",
        value: "first_last_frame"
    },
    {
        label: "全模态参考生视频",
        value: "multimodal_reference"
    }
];
const VIDEO_TASK_TYPE_OPTIONS = [
    {
        label: "生成新视频",
        value: "generate"
    },
    {
        label: "编辑视频",
        value: "edit"
    },
    {
        label: "延长视频",
        value: "extend"
    }
];
function VideoGenerationConfig({ displayName, node }) {
    _s7();
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "VideoGenerationConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["VideoGenerationConfig.useAigcEditorStore[update]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "VideoGenerationConfig.useAigcEditorStore[definition]": (state)=>state.definition
    }["VideoGenerationConfig.useAigcEditorStore[definition]"]);
    const capabilities = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_CAPABILITIES"][node.config.model];
    const validationAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        queryKey: [
            "aigc",
            "video-validation-assets"
        ],
        queryFn: loadAigcMediaAssets
    });
    const definitionIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVideoGenerationDefinition"])(definition).find((candidate)=>candidate.nodeId === node.id);
    const assetIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVideoGenerationAssets"])(definition, node.id, validationAssets.data ?? [])[0];
    const issue = definitionIssue ?? assetIssue;
    const promptEdge = definition.edges.find((edge)=>edge.targetNodeId === node.id && edge.targetHandle === "prompt");
    const promptNode = definition.nodes.find((candidate)=>candidate.id === promptEdge?.sourceNodeId);
    const promptWarning = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedancePromptLengthWarning"])(promptNode?.type === "text" ? promptNode.config.text : "");
    const supportedLanguages = capabilities.promptLanguages.join("、");
    const inputDurationMaximum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedanceInputDurationLimit"])(node.config.model);
    const inputVideoMinimum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedanceVideoInputMinimum"])(node.config.model, node.config.task_type ?? "generate");
    function updateModel(model) {
        const normalized = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedanceVideoParameters"])(model, node.config);
        update(node.id, {
            ...node.config,
            model,
            duration_seconds: normalized.duration_seconds,
            resolution: normalized.resolution
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "模型",
                    onChange: (value)=>updateModel(value),
                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_MODELS"].map((model)=>({
                            label: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_CAPABILITIES"][model].displayName,
                            value: model
                        })),
                    value: node.config.model
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2291,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "生成模式",
                    onChange: (value)=>update(node.id, {
                            ...node.config,
                            generation_mode: value
                        }),
                    options: VIDEO_MODE_OPTIONS,
                    value: node.config.generation_mode
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2300,
                    columnNumber: 9
                }, this),
                node.config.generation_mode === "multimodal_reference" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "任务类型",
                    onChange: (value)=>update(node.id, {
                            ...node.config,
                            task_type: value
                        }),
                    options: VIDEO_TASK_TYPE_OPTIONS,
                    value: node.config.task_type ?? "generate"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2312,
                    columnNumber: 11
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid grid-cols-2 gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "分辨率",
                            onChange: (value)=>update(node.id, {
                                    ...node.config,
                                    resolution: value
                                }),
                            options: [
                                ...capabilities.resolutions
                            ],
                            value: node.config.resolution
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2325,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "宽高比",
                            onChange: (value)=>update(node.id, {
                                    ...node.config,
                                    aspect_ratio: value
                                }),
                            options: [
                                ...__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_ASPECT_RATIOS"]
                            ],
                            value: node.config.aspect_ratio
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2336,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2324,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "时长",
                    onChange: (value)=>update(node.id, {
                            ...node.config,
                            duration_seconds: Number(value)
                        }),
                    options: [
                        {
                            label: "智能时长",
                            value: "-1"
                        },
                        ...Array.from({
                            length: capabilities.duration.maximum - capabilities.duration.minimum + 1
                        }, (_, index)=>{
                            const seconds = capabilities.duration.minimum + index;
                            return {
                                label: `${seconds} 秒`,
                                value: String(seconds)
                            };
                        })
                    ],
                    value: String(node.config.duration_seconds)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2348,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                    className: "flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground",
                    children: [
                        "生成音频",
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                            checked: node.config.generate_audio,
                            className: "h-4 w-4 accent-primary",
                            onChange: (event)=>update(node.id, {
                                    ...node.config,
                                    generate_audio: event.target.checked
                                }),
                            type: "checkbox"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2375,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2373,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[10px] leading-4 text-muted-foreground",
                    children: [
                        "全模态上限：图片 ",
                        capabilities.maxReferenceImages,
                        "、视频",
                        " ",
                        capabilities.maxReferenceVideos,
                        "、音频",
                        " ",
                        capabilities.maxReferenceAudios
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2387,
                    columnNumber: 9
                }, this),
                node.config.generation_mode === "multimodal_reference" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[10px] leading-4 text-muted-foreground",
                    children: [
                        "输入时长：视频 ",
                        inputVideoMinimum,
                        "-",
                        inputDurationMaximum,
                        " 秒/个， 音频 2-",
                        inputDurationMaximum,
                        " 秒/段；视频、音频各自合计不超过",
                        " ",
                        inputDurationMaximum,
                        " 秒"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2393,
                    columnNumber: 11
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[10px] leading-4 text-muted-foreground",
                    children: [
                        "提示词语言：",
                        supportedLanguages
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2399,
                    columnNumber: 9
                }, this),
                promptWarning ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-900",
                    children: promptWarning
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2403,
                    columnNumber: 11
                }, this) : null,
                issue ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs leading-5 text-destructive",
                    role: "alert",
                    children: issue.message
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2408,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2290,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2289,
        columnNumber: 5
    }, this);
}
_s7(VideoGenerationConfig, "5uc/BPwMV7cCkidK5HL9erlnd2s=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
_c12 = VideoGenerationConfig;
const VIDEO_ENHANCEMENT_LABELS = {
    toolVersion: {
        standard: "标准版",
        professional: "专业版"
    },
    style: {
        hd: "高清",
        natural: "自然"
    },
    scene: {
        common: "通用",
        ugc: "UGC",
        short_series: "短剧",
        aigc: "AIGC",
        old_film: "老片修复"
    },
    bitrateLevel: {
        low: "低",
        medium: "中",
        high: "高"
    }
};
function VideoEnhancementConfig({ displayName, node }) {
    _s8();
    const updateNodeConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "VideoEnhancementConfig.useAigcEditorStore[updateNodeConfig]": (state)=>state.updateNodeConfig
    }["VideoEnhancementConfig.useAigcEditorStore[updateNodeConfig]"]);
    const config = node.config;
    const highCost = [
        config.tool_version === "professional" ? "专业版" : null,
        config.resolution_mode === "preset" && (config.resolution === "4k" || config.resolution === "8k") ? config.resolution.toUpperCase() : null,
        config.bit_depth >= 12 ? `${config.bit_depth}-bit` : null
    ].filter(Boolean);
    function update(patch) {
        updateNodeConfig(node.id, (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeVideoEnhancementConfig"])({
            ...config,
            ...patch
        }));
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-3",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigSection, {
                    title: "版本与风格",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "版本",
                            onChange: (value)=>update({
                                    tool_version: value
                                }),
                            options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_TOOL_VERSIONS"].map((value)=>({
                                    label: VIDEO_ENHANCEMENT_LABELS.toolVersion[value],
                                    value
                                })),
                            value: config.tool_version
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2477,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "增强风格",
                            onChange: (value)=>update({
                                    enhance_style: value
                                }),
                            options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_STYLES"].map((value)=>({
                                    label: VIDEO_ENHANCEMENT_LABELS.style[value],
                                    value
                                })),
                            value: config.enhance_style
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2491,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2476,
                    columnNumber: 9
                }, this),
                config.tool_version === "standard" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "场景",
                    onChange: (value)=>update({
                            scene: value
                        }),
                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_SCENES"].map((value)=>({
                            label: VIDEO_ENHANCEMENT_LABELS.scene[value],
                            value
                        })),
                    value: config.scene
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2508,
                    columnNumber: 11
                }, this) : null,
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigSection, {
                    title: "目标尺寸",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "尺寸模式",
                            onChange: (value)=>update({
                                    resolution_mode: value
                                }),
                            options: [
                                {
                                    label: "预设分辨率",
                                    value: "preset"
                                },
                                {
                                    label: "短边像素",
                                    value: "short_edge"
                                }
                            ],
                            value: config.resolution_mode
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2524,
                            columnNumber: 11
                        }, this),
                        config.resolution_mode === "preset" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "分辨率",
                            onChange: (value)=>update({
                                    resolution: value
                                }),
                            options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_RESOLUTIONS"].map((value)=>({
                                    label: value.toUpperCase(),
                                    value
                                })),
                            value: config.resolution
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2540,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NumberField, {
                            label: "短边像素",
                            max: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE"].maximum,
                            min: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_RESOLUTION_LIMIT_RANGE"].minimum,
                            onChange: (value)=>update({
                                    resolution_limit: value
                                }),
                            value: config.resolution_limit
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2555,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2523,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigSection, {
                    title: "帧率与码率",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                            label: "帧率",
                            onChange: (value)=>update({
                                    fps: value === "source" ? null : config.fps ?? 30
                                }),
                            options: [
                                {
                                    label: "保持原帧率",
                                    value: "source"
                                },
                                {
                                    label: "指定帧率",
                                    value: "custom"
                                }
                            ],
                            value: config.fps === null ? "source" : "custom"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2566,
                            columnNumber: 11
                        }, this),
                        config.fps === null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            "aria-hidden": "true",
                            className: "hidden sm:block"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2583,
                            columnNumber: 13
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NumberField, {
                            label: "目标 FPS",
                            max: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_FPS_RANGE"].maximum,
                            min: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_FPS_RANGE"].minimum,
                            onChange: (value)=>update({
                                    fps: value
                                }),
                            value: config.fps
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2585,
                            columnNumber: 13
                        }, this),
                        config.bit_depth !== 16 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                                    label: "码率模式",
                                    onChange: (value)=>update({
                                            bitrate_mode: value
                                        }),
                                    options: [
                                        {
                                            label: "档位",
                                            value: "level"
                                        },
                                        {
                                            label: "精确码率",
                                            value: "custom"
                                        }
                                    ],
                                    value: config.bitrate_mode
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2595,
                                    columnNumber: 15
                                }, this),
                                config.bitrate_mode === "level" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                                    label: "码率档位",
                                    onChange: (value)=>update({
                                            bitrate_level: value
                                        }),
                                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_BITRATE_LEVELS"].map((value)=>({
                                            label: VIDEO_ENHANCEMENT_LABELS.bitrateLevel[value],
                                            value
                                        })),
                                    value: config.bitrate_level
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2609,
                                    columnNumber: 17
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NumberField, {
                                    label: "码率 (kbps)",
                                    max: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_BITRATE_RANGE"].maximum,
                                    min: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_BITRATE_RANGE"].minimum,
                                    onChange: (value)=>update({
                                            bitrate: value
                                        }),
                                    value: config.bitrate
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                    lineNumber: 2626,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2594,
                            columnNumber: 13
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2565,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    disabled: config.tool_version === "standard",
                    label: "色深",
                    onChange: (value)=>update({
                            bit_depth: Number(value)
                        }),
                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_ENHANCEMENT_BIT_DEPTHS"].map((value)=>({
                            label: `${value}-bit`,
                            value: String(value)
                        })),
                    value: String(config.bit_depth)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2638,
                    columnNumber: 9
                }, this),
                config.tool_version === "standard" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-[10px] leading-4 text-muted-foreground",
                    children: "标准版固定输出 8-bit；专业版可选择更高色深。"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2653,
                    columnNumber: 11
                }, this) : config.bit_depth === 16 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-900",
                    children: "16-bit 为高成本 MOV 输出，仅支持不超过 40 秒的视频，码率由服务自动处理。"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2657,
                    columnNumber: 11
                }, this) : null,
                highCost.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "rounded-md border border-orange-300 bg-orange-50 px-2.5 py-2 text-[10px] font-semibold text-orange-900",
                    children: [
                        "高成本配置：",
                        highCost.join(" · ")
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2662,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2475,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2474,
        columnNumber: 5
    }, this);
}
_s8(VideoEnhancementConfig, "LsjO2FGlyqqDJP0uURADhfGg6bY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c13 = VideoEnhancementConfig;
function VideoFaceBlurNodeConfig({ displayName, node }) {
    _s9();
    const updateNodeConfig = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "VideoFaceBlurNodeConfig.useAigcEditorStore[updateNodeConfig]": (state)=>state.updateNodeConfig
    }["VideoFaceBlurNodeConfig.useAigcEditorStore[updateNodeConfig]"]);
    function update(patch) {
        updateNodeConfig(node.id, {
            ...node.config,
            ...patch
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigSection, {
            title: "打码参数",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "打码方式",
                    onChange: (value)=>update({
                            mask_mode: value
                        }),
                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_FACE_BLUR_MASK_MODES"].map((value)=>({
                            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurModeLabel"])(value),
                            value
                        })),
                    value: node.config.mask_mode
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2689,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                    label: "打码强度",
                    onChange: (value)=>update({
                            mask_strength: value
                        }),
                    options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["VIDEO_FACE_BLUR_MASK_STRENGTHS"].map((value)=>({
                            label: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurStrengthLabel"])(value),
                            value
                        })),
                    value: node.config.mask_strength
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2700,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2688,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2687,
        columnNumber: 5
    }, this);
}
_s9(VideoFaceBlurNodeConfig, "LsjO2FGlyqqDJP0uURADhfGg6bY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c14 = VideoFaceBlurNodeConfig;
function ModalityNodeConfig({ displayName, mode, node, runDetail }) {
    _s10();
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "ModalityNodeConfig.useAigcEditorStore[definition]": (state)=>state.definition
    }["ModalityNodeConfig.useAigcEditorStore[definition]"]);
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "ModalityNodeConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["ModalityNodeConfig.useAigcEditorStore[update]"]);
    const upstream = definition.edges.some((edge)=>edge.targetNodeId === node.id && edge.targetHandle === node.type);
    const projection = upstream && runDetail ? node.type === "text" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcEffectiveText"])(runDetail, definition, node.id) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcModalityRunResult"])(runDetail, node.id) : null;
    const managedSource = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedTextSource"])(node, definition.nodes);
    const resolvedDisplayName = node.custom_name?.trim() || managedSource?.itemLabel || displayName;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: resolvedDisplayName,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                htmlFor: `node-title-${node.id}`,
                children: "内容标题"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2757,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                className: "mt-1.5",
                disabled: upstream || Boolean(managedSource),
                id: `node-title-${node.id}`,
                onChange: (event)=>update(node.id, {
                        ...node.config,
                        title: event.target.value || null
                    }),
                placeholder: displayName,
                value: node.config.title ?? ""
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2758,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-4 border-t border-border pt-4",
                children: managedSource && node.type === "text" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "text-[10px] text-muted-foreground",
                            children: [
                                "只读上游内容 · 来源：",
                                managedSource.parserName
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2771,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            "aria-label": `${managedSource.itemLabel}只读内容`,
                            className: "max-h-64 overflow-y-auto rounded border border-border bg-muted/20 p-2.5",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "break-words whitespace-pre-wrap text-xs leading-5 text-foreground",
                                children: node.config.text || "无对应 item"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 2778,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2774,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2770,
                    columnNumber: 11
                }, this) : upstream && node.type === "text" ? projection && [
                    "reused",
                    "succeeded"
                ].includes(projection.status) && projection.text !== null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "space-y-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$prompt$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcPromptEditor"], {
                            node: node,
                            runDetail: runDetail
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2788,
                            columnNumber: 15
                        }, this),
                        node.config.upstream_text_override != null ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            className: "w-full",
                            onClick: ()=>update(node.id, {
                                    ...node.config,
                                    upstream_text_override: null
                                }),
                            size: "sm",
                            type: "button",
                            variant: "outline",
                            children: "恢复上游文本"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2790,
                            columnNumber: 17
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2787,
                    columnNumber: 13
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityProjectionPreview, {
                    displayName: displayName,
                    node: node,
                    projection: projection,
                    runDetail: runDetail
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2807,
                    columnNumber: 13
                }, this) : upstream ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityProjectionPreview, {
                    displayName: displayName,
                    node: node,
                    projection: projection,
                    runDetail: runDetail
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2815,
                    columnNumber: 11
                }, this) : node.type === "text" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$prompt$2d$editor$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcPromptEditor"], {
                    node: node,
                    runDetail: runDetail
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2822,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MediaInputConfig, {
                    displayName: displayName,
                    embedded: true,
                    mode: mode,
                    node: node
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2824,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 2768,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2756,
        columnNumber: 5
    }, this);
}
_s10(ModalityNodeConfig, "mqUTRNqwxO/iSqZ+fa17X5zd9Jc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c15 = ModalityNodeConfig;
function ModalityProjectionPreview({ displayName, node, projection, runDetail }) {
    _s11();
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "ModalityProjectionPreview.useAigcEditorStore[definition]": (state)=>state.definition
    }["ModalityProjectionPreview.useAigcEditorStore[definition]"]);
    if (!projection || [
        "idle",
        "ready",
        "queued",
        "running"
    ].includes(projection.status)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityStatus, {
            copy: "等待上游结果"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2849,
            columnNumber: 12
        }, this);
    }
    if ([
        "blocked",
        "canceled",
        "failed",
        "timed_out"
    ].includes(projection.status)) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityStatus, {
            copy: "上游执行失败",
            tone: "error"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2856,
            columnNumber: 12
        }, this);
    }
    if (projection.text) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "whitespace-pre-wrap text-xs leading-5",
                    children: projection.text
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2861,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    className: "mt-3 w-full",
                    onClick: ()=>void navigator.clipboard.writeText(projection.text ?? ""),
                    size: "sm",
                    type: "button",
                    variant: "outline",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 2871,
                            columnNumber: 11
                        }, this),
                        "复制文本"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 2864,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2860,
            columnNumber: 7
        }, this);
    }
    if (!projection.asset?.available || !projection.downloadUrl) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityStatus, {
            copy: "上游结果不可用，播放和下载已禁用"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 2878,
            columnNumber: 12
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityAsset, {
        asset: projection.asset,
        definition: definition,
        nodeId: node.id,
        runDetail: runDetail,
        title: displayName,
        type: node.type
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2881,
        columnNumber: 5
    }, this);
}
_s11(ModalityProjectionPreview, "G/EfyZGDGKbSw443hTVdOEJpf/4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c16 = ModalityProjectionPreview;
function ModalityStatus({ copy, tone = "muted" }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded border border-dashed border-border px-3 py-6 text-center text-xs", tone === "error" ? "text-destructive" : "text-muted-foreground"),
        role: "status",
        children: copy
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 2900,
        columnNumber: 5
    }, this);
}
_c17 = ModalityStatus;
const MEDIA_INPUT_OPTIONS = {
    image: {
        accept: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_MEDIA_ACCEPT"].image,
        hint: "JPEG / PNG / WebP / BMP / TIFF / GIF / HEIC / HEIF；300-6000 px；小于 30 MB",
        kind: "image",
        label: "图片",
        queryKey: "selectable-image-assets"
    },
    video: {
        accept: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_MEDIA_ACCEPT"].video,
        hint: "MP4 / MOV；H.264 / H.265；24-60 FPS；不超过 200 MB",
        kind: "video",
        label: "视频",
        queryKey: "selectable-video-assets"
    },
    audio: {
        accept: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_MEDIA_ACCEPT"].audio,
        hint: "WAV / MP3；不超过 15 MB",
        kind: "audio",
        label: "音频",
        queryKey: "selectable-audio-assets"
    }
};
function MediaInputConfig({ displayName, embedded = false, mode, node }) {
    _s12();
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "MediaInputConfig.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["MediaInputConfig.useAigcEditorStore[update]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "MediaInputConfig.useAigcEditorStore[definition]": (state)=>state.definition
    }["MediaInputConfig.useAigcEditorStore[definition]"]);
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    const [isUploading, setIsUploading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [uploadError, setUploadError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const options = MEDIA_INPUT_OPTIONS[node.type];
    const isLayerDecompositionInput = node.type === "image" && definition.edges.some((edge)=>{
        if (edge.sourceNodeId !== node.id || edge.sourceHandle !== "image" || edge.targetHandle !== "image") {
            return false;
        }
        const target = definition.nodes.find((candidate)=>candidate.id === edge.targetNodeId);
        return target?.type === "image_to_image" && target.config.operation === "layer_decomposition";
    });
    const assetsQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: mode === "pipeline",
        queryKey: [
            "aigc",
            options.queryKey
        ],
        queryFn: {
            "MediaInputConfig.useQuery[assetsQuery]": async ()=>{
                const [projectAssets, toolAssets] = await Promise.all([
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAssets(),
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listToolAssets()
                ]);
                const byId = new Map([
                    ...projectAssets,
                    ...toolAssets
                ].filter({
                    "MediaInputConfig.useQuery[assetsQuery]": (asset)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSelectableMediaAsset"])(asset, options.kind)
                }["MediaInputConfig.useQuery[assetsQuery]"]).map({
                    "MediaInputConfig.useQuery[assetsQuery]": (asset)=>[
                            asset.id,
                            asset
                        ]
                }["MediaInputConfig.useQuery[assetsQuery]"]));
                return [
                    ...byId.values()
                ];
            }
        }["MediaInputConfig.useQuery[assetsQuery]"]
    });
    if (mode === "template") {
        const content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "text-xs leading-5 text-muted-foreground",
            children: [
                "模板不保存具体",
                options.label,
                "。创建画布实例后再选择或上传素材。"
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3004,
            columnNumber: 7
        }, this);
        return embedded ? content : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
            title: displayName,
            children: content
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3009,
            columnNumber: 7
        }, this);
    }
    async function uploadMedia(file) {
        if (!file) return;
        const validationError = isLayerDecompositionInput ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateLayerDecompositionFile"])(file) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateAigcMediaFile"])(options.kind, file);
        if (validationError) {
            setUploadError(validationError);
            return;
        }
        setIsUploading(true);
        setUploadError(null);
        try {
            const asset = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].uploadAigcMedia(options.kind, file, {
                filename: file.name,
                mimeType: file.type
            });
            update(node.id, {
                ...node.config,
                asset_id: asset.id
            });
            queryClient.setQueryData([
                "aigc",
                options.queryKey
            ], (current = [])=>[
                    asset,
                    ...current.filter((item)=>item.id !== asset.id)
                ]);
            queryClient.setQueryData([
                "aigc",
                "media-validation-assets"
            ], (current = [])=>[
                    asset,
                    ...current.filter((item)=>item.id !== asset.id)
                ]);
        } catch (error) {
            setUploadError((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error));
        } finally{
            setIsUploading(false);
        }
    }
    const content = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                children: [
                    "资产库",
                    options.label
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3050,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$media$2d$asset$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcMediaAssetDialog"], {
                assets: assetsQuery.data ?? [],
                currentAssetId: node.config.asset_id,
                isLoading: assetsQuery.isPending,
                kind: options.kind,
                label: options.label,
                getCompatibility: (asset)=>isLayerDecompositionInput ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["layerDecompositionCompatibility"])(asset) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcMediaCompatibility"])(asset, options.kind),
                onSelect: (assetId)=>update(node.id, {
                        ...node.config,
                        asset_id: assetId
                    })
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3051,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "mt-3 flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border text-xs font-semibold text-foreground hover:border-primary/35 hover:text-primary",
                children: [
                    isUploading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                        className: "h-4 w-4 animate-spin"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3071,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3073,
                        columnNumber: 11
                    }, this),
                    isUploading ? "上传中" : "本地上传",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        accept: isLayerDecompositionInput ? ".jpeg,.jpg,.png,image/jpeg,image/png" : options.accept,
                        className: "sr-only",
                        disabled: isUploading,
                        onChange: (event)=>{
                            void uploadMedia(event.target.files?.[0]);
                            event.target.value = "";
                        },
                        type: "file"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3076,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3069,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-[10px] leading-4 text-muted-foreground",
                children: isLayerDecompositionInput ? "PNG / JPEG；比例 1:16-16:1；总像素 262,144-36,000,000；小于 30 MB" : options.hint
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3091,
                columnNumber: 7
            }, this),
            uploadError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-xs text-destructive",
                children: uploadError
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3097,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3049,
        columnNumber: 5
    }, this);
    return embedded ? content : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ConfigGroup, {
        title: displayName,
        children: content
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3102,
        columnNumber: 5
    }, this);
}
_s12(MediaInputConfig, "VFb3va0CoPV4Bp6kgEO9v5I5xrc=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
_c18 = MediaInputConfig;
async function loadAigcMediaAssets() {
    const [projectAssets, toolAssets] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAssets(),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listToolAssets()
    ]);
    return [
        ...new Map([
            ...projectAssets,
            ...toolAssets
        ].map((asset)=>[
                asset.id,
                asset
            ])).values()
    ];
}
function ConfigGroup({ children, title }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-3 flex items-center gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings2$3e$__["Settings2"], {
                        className: "h-4 w-4 text-primary"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3126,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-semibold",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3127,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3125,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3124,
        columnNumber: 5
    }, this);
}
_c19 = ConfigGroup;
function ConfigSection({ children, title }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("fieldset", {
        className: "grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/20 p-2 sm:grid-cols-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("legend", {
                className: "px-1 text-[10px] font-semibold text-muted-foreground",
                children: title
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3143,
                columnNumber: 7
            }, this),
            children
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3142,
        columnNumber: 5
    }, this);
}
_c20 = ConfigSection;
function NumberField({ label, max, min, onChange, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "text-xs font-medium text-muted-foreground",
        children: [
            label,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                className: "mt-1 h-9 text-xs text-foreground",
                max: max,
                min: min,
                onChange: (event)=>onChange(event.currentTarget.valueAsNumber),
                step: 1,
                type: "number",
                value: value
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3167,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3165,
        columnNumber: 5
    }, this);
}
_c21 = NumberField;
function SelectField({ disabled = false, label, onChange, options, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "text-xs font-medium text-muted-foreground",
        children: [
            label,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                className: "mt-1 h-9 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60",
                disabled: disabled,
                onChange: (event)=>onChange(event.target.value),
                value: value,
                children: options.map((option)=>{
                    const item = typeof option === "string" ? {
                        label: option,
                        value: option
                    } : option;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: item.value,
                        children: item.label
                    }, item.value, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3208,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3196,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3194,
        columnNumber: 5
    }, this);
}
_c22 = SelectField;
function ResultPanel({ definition, nodeId, runDetail }) {
    const snapshotDefinition = runDetail?.run.definition_snapshot;
    const snapshotNodes = snapshotDefinition?.schemaVersion === 2 ? snapshotDefinition.nodes : [];
    const currentDisplayNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes);
    const snapshotDisplayNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(snapshotNodes);
    const resultNodes = runDetail?.nodes.filter((item)=>(item.result.kind !== "none" || item.result.metadata?.empty === true) && (!nodeId || item.node_id === nodeId)) ?? [];
    if (!runDetail || resultNodes.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InspectorPlaceholder, {
            copy: "选择有结果的节点，或执行画布后查看输出。",
            title: "暂无结果"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3240,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-3",
        children: resultNodes.map((item)=>{
            const sourceNode = snapshotNodes.find((candidate)=>candidate.id === item.node_id);
            const sourceManagedLabel = sourceNode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedTextSource"])(sourceNode, snapshotNodes)?.itemLabel : null;
            const sourceName = currentDisplayNames.get(item.node_id)?.displayName || sourceNode?.custom_name?.trim() || sourceManagedLabel || snapshotDisplayNames.get(item.node_id)?.displayName || item.node_id;
            const modalityProjection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcModalityRunResult"])(runDetail, item.node_id);
            const compositeProjection = item.result.kind === "layer_composite" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcLayerCompositeResult"])(runDetail.run.definition_snapshot, item.node_id, runDetail.nodes) : null;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border border-border bg-background p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "truncate font-mono text-[10px] text-muted-foreground",
                                children: sourceName
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3276,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                variant: item.status === "reused" ? "info" : "success",
                                children: item.status === "reused" ? "复用" : "完成"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3279,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3275,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResultExecutionMetadata, {
                        node: item
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3283,
                        columnNumber: 11
                    }, this),
                    item.result.kind === "text" && item.result.text ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-3 whitespace-pre-wrap text-xs leading-5 text-foreground",
                                children: modalityProjection?.text ?? item.result.text
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3286,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                className: "mt-3 w-full",
                                onClick: ()=>void navigator.clipboard.writeText(modalityProjection?.text ?? item.result.text ?? ""),
                                size: "sm",
                                type: "button",
                                variant: "outline",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                                        className: "h-4 w-4"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3300,
                                        columnNumber: 17
                                    }, this),
                                    "复制文本"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3289,
                                columnNumber: 15
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3285,
                        columnNumber: 13
                    }, this) : null,
                    item.result.kind === "assets" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-3 space-y-2",
                        children: item.result.assets.map((asset)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResultAsset, {
                                asset: asset,
                                definition: definition,
                                nodeId: item.node_id,
                                runDetail: runDetail,
                                title: sourceName
                            }, asset.asset_id, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3308,
                                columnNumber: 17
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3306,
                        columnNumber: 13
                    }, this) : null,
                    item.result.kind === "none" && item.result.metadata?.empty === true ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-xs text-muted-foreground",
                        children: "未识别到字幕"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3321,
                        columnNumber: 13
                    }, this) : null,
                    compositeProjection ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-3 space-y-2",
                        children: [
                            compositeProjection.imageAsset ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ResultAsset, {
                                asset: compositeProjection.imageAsset,
                                definition: definition,
                                nodeId: item.node_id,
                                runDetail: runDetail,
                                title: sourceName
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3328,
                                columnNumber: 17
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-xs text-muted-foreground",
                                children: "最终扁平图片暂不可用"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3336,
                                columnNumber: 17
                            }, this),
                            compositeProjection.layerSet ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded border border-border bg-card px-2.5 py-2 text-xs",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "font-medium text-foreground",
                                        children: [
                                            "图层集 v",
                                            compositeProjection.layerSet.version,
                                            " ·",
                                            " ",
                                            compositeProjection.layerSet.layers.length + 1,
                                            " 个图层"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3342,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 text-muted-foreground",
                                        children: "已保留新图层集，可连接后续图层画布继续编辑"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3346,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3341,
                                columnNumber: 17
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3326,
                        columnNumber: 13
                    }, this) : null,
                    item.result.kind === "unavailable" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-3 text-xs text-muted-foreground",
                        children: "历史结果已不可用，资产可能已删除或无权访问"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3354,
                        columnNumber: 13
                    }, this) : null
                ]
            }, item.node_id, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3274,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3247,
        columnNumber: 5
    }, this);
}
_c23 = ResultPanel;
function ResultAsset({ asset, definition, nodeId, runDetail, title }) {
    const snapshotDefinition = runDetail.run.definition_snapshot;
    const resultUrl = asset.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(asset.download_url) : null;
    const modalityProjection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcModalityRunResult"])(runDetail, nodeId);
    const sourceNode = snapshotDefinition.nodes.find((candidate)=>candidate.id === nodeId);
    const resultTitle = title || __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(sourceNode?.type ?? "")?.label || "字幕结果";
    if (asset.mime_type === "application/x-subrip" || asset.mime_type === "text/srt") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SubtitleResultAsset, {
            asset: asset,
            title: resultTitle
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3394,
            columnNumber: 7
        }, this);
    }
    if (modalityProjection && modalityProjection.modality !== "text" && asset.available) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityAsset, {
            asset: asset,
            definition: definition,
            nodeId: nodeId,
            runDetail: runDetail,
            title: modalityProjection.title,
            type: modalityProjection.modality
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3406,
            columnNumber: 7
        }, this);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAigcVideoResult"])(snapshotDefinition, nodeId, asset)) {
        const projection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcVideoResult"])(snapshotDefinition, nodeId, [
            asset
        ]);
        const generatedMediaTitle = sourceNode?.type === "video_generation" ? resultTitle : projection.title;
        const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcVideoDownload"])(asset, generatedMediaTitle, definition);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                    audioState: projection.audioState,
                    bitDepth: projection.bitDepth,
                    fps: projection.fps,
                    initialMetadata: {
                        duration: projection.duration,
                        height: null,
                        width: null
                    },
                    mimeType: asset.mime_type,
                    name: `${projection.title}-${asset.ordinal + 1}`,
                    resolutionLabel: projection.resolution,
                    toolVersion: projection.toolVersion,
                    unavailableText: "视频结果已不可用，资产可能已删除或无权访问",
                    url: resultUrl,
                    variant: "panel"
                }, `${runDetail.run.id}:${asset.asset_id}`, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3433,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoResultMetadata, {
                    projection: projection
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3451,
                    columnNumber: 9
                }, this),
                download && resultUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    asChild: true,
                    className: "w-full",
                    size: "sm",
                    variant: "outline",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        download: download.filename,
                        href: download.url,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3455,
                                columnNumber: 15
                            }, this),
                            "下载视频"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3454,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3453,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3432,
            columnNumber: 7
        }, this);
    }
    const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcImageDownload"])(asset, resultTitle, definition);
    return resultUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                className: "block overflow-hidden border border-border bg-card",
                href: resultUrl,
                rel: "noreferrer",
                target: "_blank",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    alt: `生成结果 ${asset.ordinal + 1}`,
                    className: "block max-h-52 w-full object-contain",
                    src: resultUrl
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3475,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3467,
                columnNumber: 7
            }, this),
            download ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "w-full",
                size: "sm",
                variant: "outline",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    download: download.filename,
                    href: download.url,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 3484,
                            columnNumber: 13
                        }, this),
                        "下载图片"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3483,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3482,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3466,
        columnNumber: 5
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
        className: "text-xs text-muted-foreground",
        children: "结果资产已不可用，资产可能已删除或无权访问"
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3491,
        columnNumber: 5
    }, this);
}
_c24 = ResultAsset;
function SubtitleResultAsset({ asset, title }) {
    _s13();
    const resultUrl = asset.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(asset.download_url) : null;
    const subtitleQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: Boolean(resultUrl),
        queryKey: [
            "aigc",
            "subtitle-preview",
            asset.asset_id
        ],
        queryFn: {
            "SubtitleResultAsset.useQuery[subtitleQuery]": async ()=>{
                const response = await fetch(resultUrl);
                if (!response.ok) throw new Error("字幕预览加载失败");
                return response.text();
            }
        }["SubtitleResultAsset.useQuery[subtitleQuery]"]
    });
    const preview = parseSrtPreview(subtitleQuery.data ?? "");
    const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcSubtitleDownload"])(asset, title);
    if (!resultUrl) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "text-xs text-muted-foreground",
            children: "字幕结果已不可用，预览和下载已禁用"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3520,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "max-h-52 space-y-2 overflow-y-auto border border-border bg-card p-2.5",
                children: subtitleQuery.isPending ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-muted-foreground",
                    children: "正在加载字幕预览"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3529,
                    columnNumber: 11
                }, this) : subtitleQuery.isError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-destructive",
                    children: "字幕预览加载失败"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3531,
                    columnNumber: 11
                }, this) : preview.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-xs text-muted-foreground",
                    children: "未识别到字幕"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3533,
                    columnNumber: 11
                }, this) : preview.map((segment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-[112px_1fr] gap-2 text-xs",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono text-[10px] text-muted-foreground",
                                children: segment.time
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3537,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "whitespace-pre-wrap break-words text-foreground",
                                children: segment.text
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3540,
                                columnNumber: 15
                            }, this)
                        ]
                    }, segment.key, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3536,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3527,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2 text-[10px] text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "片段 ",
                            resultAssetMetadataNumber(asset, "segment_count") ?? preview.length
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3548,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "时长",
                            " ",
                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatVideoDuration"])(resultAssetMetadataNumber(asset, "duration_seconds") ?? 0)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3549,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3547,
                columnNumber: 7
            }, this),
            download ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "w-full",
                size: "sm",
                variant: "outline",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    download: download.filename,
                    href: download.url,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 3559,
                            columnNumber: 13
                        }, this),
                        "下载字幕"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3558,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3557,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3526,
        columnNumber: 5
    }, this);
}
_s13(SubtitleResultAsset, "vDOxb3Vca7buDlb4FPhoAgP/7BU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
_c25 = SubtitleResultAsset;
function parseSrtPreview(content) {
    return content.replace(/\r\n?/g, "\n").trim().split(/\n{2,}/).map((block, index)=>{
        const lines = block.split("\n").map((line)=>line.trim());
        const timeIndex = lines.findIndex((line)=>line.includes("-->"));
        if (timeIndex < 0) return null;
        const text = lines.slice(timeIndex + 1).filter(Boolean).join(" ");
        if (!text) return null;
        return {
            key: `${index}:${lines[timeIndex]}`,
            text,
            time: lines[timeIndex]
        };
    }).filter((value)=>value !== null);
}
function ModalityAsset({ asset, definition, nodeId, runDetail, title, type }) {
    const resultUrl = asset.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(asset.download_url) : null;
    if (type === "video") {
        const projection = runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcVideoResult"])(runDetail.run.definition_snapshot, nodeId, [
            asset
        ]) : null;
        const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcVideoDownload"])(asset, title, definition);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                    audioState: projection?.audioState,
                    bitDepth: projection?.bitDepth,
                    fps: projection?.fps,
                    initialMetadata: {
                        duration: projection?.duration ?? resultAssetMetadataNumber(asset, "duration_seconds"),
                        height: resultAssetMetadataNumber(asset, "height"),
                        width: resultAssetMetadataNumber(asset, "width")
                    },
                    mimeType: asset.mime_type,
                    name: title,
                    resolutionLabel: projection?.resolution,
                    toolVersion: projection?.toolVersion,
                    unavailableText: "视频结果已不可用，资产可能已删除或无权访问",
                    url: resultUrl,
                    variant: "panel"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3624,
                    columnNumber: 9
                }, this),
                download && resultUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    asChild: true,
                    className: "w-full",
                    size: "sm",
                    variant: "outline",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        download: download.filename,
                        href: download.url,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3646,
                                columnNumber: 15
                            }, this),
                            "下载视频"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3645,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3644,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3623,
            columnNumber: 7
        }, this);
    }
    if (type === "audio") {
        const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcAudioDownload"])(asset, title);
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "space-y-2",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$audio$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcAudioPlayer"], {
                    duration: resultAssetMetadataNumber(asset, "duration_seconds"),
                    mimeType: asset.mime_type,
                    name: title,
                    unavailableText: "音频结果已不可用，资产可能已删除或无权访问",
                    url: resultUrl,
                    variant: "panel"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3658,
                    columnNumber: 9
                }, this),
                download && resultUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                    asChild: true,
                    className: "w-full",
                    size: "sm",
                    variant: "outline",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        download: download.filename,
                        href: download.url,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3669,
                                columnNumber: 15
                            }, this),
                            "下载音频"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3668,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3667,
                    columnNumber: 11
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3657,
            columnNumber: 7
        }, this);
    }
    const download = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcImageDownload"])(asset, title, definition);
    return resultUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                "aria-label": `查看原图：${title}`,
                className: "block overflow-hidden border border-border bg-card",
                href: resultUrl,
                rel: "noreferrer",
                target: "_blank",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    alt: title,
                    className: "block max-h-52 w-full object-contain",
                    src: resultUrl
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3690,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3681,
                columnNumber: 7
            }, this),
            download ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                asChild: true,
                className: "w-full",
                size: "sm",
                variant: "outline",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                    download: download.filename,
                    href: download.url,
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                            className: "h-4 w-4"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                            lineNumber: 3699,
                            columnNumber: 13
                        }, this),
                        "下载图片"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 3698,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3697,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3680,
        columnNumber: 5
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityStatus, {
        copy: "图片结果已不可用，预览和下载已禁用"
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3706,
        columnNumber: 5
    }, this);
}
_c26 = ModalityAsset;
function resultAssetMetadataNumber(asset, key) {
    const value = asset.metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function VideoResultMetadata({ projection }) {
    const items = [
        ...projection.trackCount === null ? [] : [
            [
                "轨道",
                String(projection.trackCount)
            ]
        ],
        ...projection.elementCount === null ? [] : [
            [
                "元素",
                String(projection.elementCount)
            ]
        ],
        [
            "分辨率",
            projection.resolution ?? "-"
        ],
        [
            "帧率",
            projection.fps === null ? "-" : `${projection.fps} fps`
        ],
        [
            "时长",
            projection.duration === null ? "-" : (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatVideoDuration"])(projection.duration)
        ],
        [
            "版本",
            projection.toolVersion === null ? "-" : projection.toolVersion === "professional" ? "专业版" : "标准版"
        ],
        [
            "色深",
            projection.bitDepth === null ? "-" : `${projection.bitDepth}-bit`
        ],
        ...projection.maskMode === null ? [] : [
            [
                "打码方式",
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurModeLabel"])(projection.maskMode)
            ]
        ],
        ...projection.maskStrength === null ? [] : [
            [
                "打码强度",
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurStrengthLabel"])(projection.maskStrength)
            ]
        ],
        ...projection.provider === null ? [] : [
            [
                "供应商",
                projection.provider
            ]
        ],
        ...projection.providerTaskId === null ? [] : [
            [
                "供应商任务",
                projection.providerTaskId
            ]
        ],
        ...projection.providerRequestId === null ? [] : [
            [
                "Request ID",
                projection.providerRequestId
            ]
        ]
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
        "aria-label": "视频输出信息",
        className: "grid grid-cols-2 gap-x-3 gap-y-1 rounded border border-border bg-card px-2.5 py-2 text-[10px]",
        children: items.map(([label, value])=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-w-0 justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        className: "text-muted-foreground",
                        children: label
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3780,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        className: "truncate font-mono text-foreground",
                        children: value
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3781,
                        columnNumber: 11
                    }, this)
                ]
            }, label, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3779,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3774,
        columnNumber: 5
    }, this);
}
_c27 = VideoResultMetadata;
function ResultExecutionMetadata({ node }) {
    const attempt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["latestRelevantAttempt"])(node);
    const active = attempt?.status === "queued" || attempt?.status === "running";
    const cacheSource = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcCacheReuse"])(node);
    const providerTrace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcProviderTrace"])(node);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
        "aria-label": `结果执行信息：${node.node_id}`,
        className: "mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                children: "状态"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3803,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: nodeStatusLabel(node.status)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3804,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                children: "耗时"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3805,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: attempt ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcDuration"])(attempt.started_at, attempt.finished_at, active) : "-"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3806,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                children: "Attempt"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3815,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: attempt ? `#${attempt.attempt}` : "-"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3816,
                columnNumber: 7
            }, this),
            cacheSource ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        children: "缓存复用"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3819,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        className: "break-all font-mono",
                        children: cacheSource
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3820,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3818,
                columnNumber: 9
            }, this) : null,
            providerTrace?.taskId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        children: "供应商任务"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3825,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        className: "break-all font-mono",
                        children: providerTrace.taskId
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3826,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3824,
                columnNumber: 9
            }, this) : null,
            providerTrace?.requestId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                        children: "Request ID"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3831,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                        className: "break-all font-mono",
                        children: providerTrace.requestId
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3832,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3830,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3799,
        columnNumber: 5
    }, this);
}
_c28 = ResultExecutionMetadata;
function RunPanel({ onCancel, onRetry, onSelectRun, runDetail, runDetailState, runs, selectedRunId }) {
    if (!runDetail && runs.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InspectorPlaceholder, {
            copy: "点击顶部执行按钮创建第一次运行。",
            title: "暂无运行"
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
            lineNumber: 3858,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-4",
        children: [
            runs.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "block text-xs font-medium text-muted-foreground",
                children: [
                    "运行历史",
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                        className: "mt-1.5 h-9 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground",
                        onChange: (event)=>onSelectRun(event.target.value),
                        value: selectedRunId ?? runs[0]?.id,
                        children: runs.map((run)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                value: run.id,
                                children: [
                                    "#",
                                    run.run_number,
                                    " · ",
                                    runStatusLabel(run.status),
                                    " ·",
                                    " ",
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcLogTime"])(run.created_at)
                                ]
                            }, run.id, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3875,
                                columnNumber: 15
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3869,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3867,
                columnNumber: 9
            }, this) : null,
            !runDetail && runDetailState ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-muted-foreground",
                role: "status",
                children: runDetailState === "error" ? "运行详情加载失败，正在重试。" : "正在加载运行详情…"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3884,
                columnNumber: 9
            }, this) : null,
            runDetail ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between border-y border-border py-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-xs font-semibold",
                                children: [
                                    "Run #",
                                    runDetail.run.run_number
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3893,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                variant: runStatusVariant(runDetail.run.status),
                                children: runStatusLabel(runDetail.run.status)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3896,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3892,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(RunTimingSummary, {
                        run: runDetail.run
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3900,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LogErrorDetails, {
                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcRunLogError"])(runDetail.run),
                        label: "Run 失败原因"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3901,
                        columnNumber: 11
                    }, this),
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$queries$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isAigcRunActive"])(runDetail) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                        className: "w-full",
                        onClick: ()=>onCancel(runDetail.run.id),
                        size: "sm",
                        type: "button",
                        variant: "outline",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$ban$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Ban$3e$__["Ban"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3913,
                                columnNumber: 15
                            }, this),
                            "取消运行"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3906,
                        columnNumber: 13
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: runDetail.nodes.filter((node)=>node.included_in_plan).map((node)=>{
                            const attempt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["latestRelevantAttempt"])(node);
                            const cacheSource = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcCacheReuse"])(node);
                            const providerTrace = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcProviderTrace"])(node);
                            const attemptActive = attempt?.status === "queued" || attempt?.status === "running";
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                "aria-label": `节点日志：${node.node_id}`,
                                className: "space-y-2 border border-border bg-background px-2.5 py-2",
                                role: "group",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex items-center justify-between gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "min-w-0",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "truncate font-mono text-[10px] text-foreground",
                                                        children: node.node_id
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 3935,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "mt-1 text-[10px] text-muted-foreground",
                                                        children: [
                                                            nodeStatusLabel(node.status),
                                                            attempt ? ` · ${node.attempts.length} 次尝试 · Attempt #${attempt.attempt}` : ""
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 3938,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3934,
                                                columnNumber: 23
                                            }, this),
                                            [
                                                "failed",
                                                "timed_out",
                                                "blocked"
                                            ].includes(node.status) ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                "aria-label": `重试节点：${node.node_id}`,
                                                onClick: ()=>onRetry(runDetail.run.id, node.node_id),
                                                size: "icon",
                                                title: "重试节点",
                                                type: "button",
                                                variant: "ghost",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
                                                    className: "h-4 w-4"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                    lineNumber: 3954,
                                                    columnNumber: 27
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3946,
                                                columnNumber: 25
                                            }, this) : node.status === "succeeded" || node.status === "reused" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                                                className: "h-4 w-4 text-success"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3958,
                                                columnNumber: 25
                                            }, this) : node.status === "running" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                                className: "h-4 w-4 animate-spin text-primary"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3960,
                                                columnNumber: 25
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3933,
                                        columnNumber: 21
                                    }, this),
                                    attempt ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                        className: "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "开始"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3965,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcLogTime"])(attempt.started_at)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3966,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "结束"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3967,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcEndTime"])(attempt.finished_at, attemptActive)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3968,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                children: "耗时"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3974,
                                                columnNumber: 25
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcDuration"])(attempt.started_at, attempt.finished_at, attemptActive)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3975,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3964,
                                        columnNumber: 23
                                    }, this) : null,
                                    cacheSource ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-[10px] text-info",
                                        children: [
                                            "缓存复用 · 来源 Task",
                                            " ",
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "break-all font-mono",
                                                children: cacheSource
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3987,
                                                columnNumber: 25
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3985,
                                        columnNumber: 23
                                    }, this) : null,
                                    providerTrace ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
                                        "aria-label": `供应商追踪标识：${node.node_id}`,
                                        className: "grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-muted-foreground",
                                        children: [
                                            providerTrace.taskId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                        children: "供应商任务 ID"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 3999,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                        className: "break-all font-mono",
                                                        children: providerTrace.taskId
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 4000,
                                                        columnNumber: 29
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 3998,
                                                columnNumber: 27
                                            }, this) : null,
                                            providerTrace.requestId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                                                        children: "供应商 Request ID"
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 4007,
                                                        columnNumber: 29
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                                                        className: "break-all font-mono",
                                                        children: providerTrace.requestId
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                        lineNumber: 4008,
                                                        columnNumber: 29
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                                lineNumber: 4006,
                                                columnNumber: 27
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 3993,
                                        columnNumber: 23
                                    }, this) : null,
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LogErrorDetails, {
                                        error: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcNodeLogError"])(node),
                                        label: `节点失败原因：${node.node_id}`
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                        lineNumber: 4015,
                                        columnNumber: 21
                                    }, this)
                                ]
                            }, node.node_id, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                                lineNumber: 3927,
                                columnNumber: 19
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                        lineNumber: 3917,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 3891,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 3865,
        columnNumber: 5
    }, this);
}
_c29 = RunPanel;
function RunTimingSummary({ run }) {
    const active = run.status === "queued" || run.status === "running";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dl", {
        "aria-label": "Run 时间摘要",
        className: "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                className: "text-muted-foreground",
                children: "开始时间"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4036,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcLogTime"])(run.started_at)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4037,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                className: "text-muted-foreground",
                children: "结束时间"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4038,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcEndTime"])(run.finished_at, active)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4039,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dt", {
                className: "text-muted-foreground",
                children: "耗时"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4040,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("dd", {
                children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatAigcDuration"])(run.started_at, run.finished_at, active)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4041,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 4032,
        columnNumber: 5
    }, this);
}
_c30 = RunTimingSummary;
function LogErrorDetails({ error, label }) {
    if (!error) return null;
    const message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonParserErrorMessage"])(error) ?? error.message;
    const metadata = [
        error.code ? `错误码：${error.code}` : null,
        error.stage ? `阶段：${error.stage}` : null,
        error.requestId ? `Request ID：${error.requestId}` : null
    ].filter((item)=>item !== null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-label": label,
        className: "border-l-2 border-destructive pl-2 text-[10px]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "break-words text-destructive",
                children: message
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4066,
                columnNumber: 7
            }, this),
            metadata.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 break-words text-muted-foreground",
                children: metadata.join(" · ")
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4068,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 4062,
        columnNumber: 5
    }, this);
}
_c31 = LogErrorDetails;
function runStatusLabel(status) {
    return ({
        canceled: "已取消",
        failed: "失败",
        queued: "排队中",
        running: "运行中",
        succeeded: "已完成"
    })[status];
}
function runStatusVariant(status) {
    if (status === "succeeded") return "success";
    if (status === "failed" || status === "canceled") return "destructive";
    return "info";
}
function nodeStatusLabel(status) {
    return ({
        blocked: "阻塞",
        canceled: "已取消",
        failed: "失败",
        idle: "未执行",
        queued: "排队中",
        ready: "就绪",
        reused: "已复用",
        running: "运行中",
        succeeded: "已完成",
        timed_out: "超时"
    })[status];
}
function useDesktopLayout() {
    _s14();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"])({
        "useDesktopLayout.useSyncExternalStore": (onStoreChange)=>{
            const media = window.matchMedia("(min-width: 1024px)");
            media.addEventListener("change", onStoreChange);
            return ({
                "useDesktopLayout.useSyncExternalStore": ()=>media.removeEventListener("change", onStoreChange)
            })["useDesktopLayout.useSyncExternalStore"];
        }
    }["useDesktopLayout.useSyncExternalStore"], {
        "useDesktopLayout.useSyncExternalStore": ()=>window.matchMedia("(min-width: 1024px)").matches
    }["useDesktopLayout.useSyncExternalStore"], {
        "useDesktopLayout.useSyncExternalStore": ()=>false
    }["useDesktopLayout.useSyncExternalStore"]);
}
_s14(useDesktopLayout, "FpwL93IKMLJZuQQXefVtWynbBPQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useSyncExternalStore"]
    ];
});
function readNodePaletteVisibility() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    try {
        return window.localStorage.getItem(NODE_PALETTE_VISIBILITY_KEY) === "true";
    } catch  {
        return false;
    }
}
function writeNodePaletteVisibility(visible) {
    try {
        window.localStorage.setItem(NODE_PALETTE_VISIBILITY_KEY, String(visible));
    } catch  {
    // Keep the in-memory preference usable when browser storage is unavailable.
    }
}
function InspectorEmpty() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-8 text-center text-xs text-muted-foreground",
        children: "选择节点后编辑配置"
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 4141,
        columnNumber: 5
    }, this);
}
_c32 = InspectorEmpty;
function InspectorPlaceholder({ copy, title }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "py-8 text-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "text-sm font-semibold",
                children: title
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4150,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-2 text-xs leading-5 text-muted-foreground",
                children: copy
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                lineNumber: 4151,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 4149,
        columnNumber: 5
    }, this);
}
_c33 = InspectorPlaceholder;
function generatedMediaNameTargetNodeIds(definition, sourceNodeId) {
    const nodesById = new Map(definition.nodes.map((node)=>[
            node.id,
            node
        ]));
    const targets = definition.edges.flatMap((edge)=>{
        if (edge.sourceNodeId !== sourceNodeId) return [];
        const target = nodesById.get(edge.targetNodeId);
        return target?.type === "image" || target?.type === "video" ? [
            target.id
        ] : [];
    });
    return [
        ...new Set(targets.length > 0 ? targets : [
            sourceNodeId
        ])
    ];
}
function asModalityNode(node) {
    return node.type === "audio" || node.type === "image" || node.type === "text" || node.type === "video" ? node : null;
}
function toFlowNode(node) {
    return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
            node
        },
        style: {
            height: node.size.height,
            width: node.size.width
        }
    };
}
function toFlowEdge(edge, nodes = [], edges = [
    edge
]) {
    const incompatible = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVideoEdgeIncompatible"])(edge, nodes) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageEdgeIncompatible"])(edge, nodes, edges);
    const source = nodes.find((node)=>node.id === edge.sourceNodeId);
    const sourcePort = source ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(source.type)?.outputs.find((port)=>port.id === edge.sourceHandle) : undefined;
    const edgeColor = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcModalityColors"])(sourcePort?.type).edgeColor;
    return {
        id: edge.id,
        animated: incompatible,
        label: incompatible ? "与当前模式不兼容" : undefined,
        source: edge.sourceNodeId,
        sourceHandle: edge.sourceHandle,
        style: {
            stroke: incompatible ? "hsl(var(--destructive))" : edgeColor,
            strokeWidth: 2
        },
        target: edge.targetNodeId,
        targetHandle: edge.targetHandle
    };
}
function connectionToDomainEdge(connection) {
    return {
        id: `edge-${globalThis.crypto.randomUUID()}`,
        sourceNodeId: connection.source,
        sourceHandle: connection.sourceHandle ?? "",
        targetNodeId: connection.target,
        targetHandle: connection.targetHandle ?? ""
    };
}
function videoValidationFeedback(issue) {
    return `生视频节点（${issue.nodeId}）：${issue.message}`;
}
function seedreamValidationFeedback(issue) {
    return `Seedream 图片节点（${issue.nodeId}）：${issue.message}`;
}
function definitionValidationIssue(definition) {
    const seedreamIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateSeedreamImageDefinition"])(definition)[0];
    if (seedreamIssue) {
        return seedreamValidationFeedback(seedreamIssue);
    }
    const videoIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVideoGenerationDefinition"])(definition)[0];
    if (videoIssue) {
        return videoValidationFeedback(videoIssue);
    }
    const faceBlurIssue = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validateVideoFaceBlurDefinition"])(definition)[0];
    return faceBlurIssue ? `视频人脸打码节点（${faceBlurIssue.nodeId}）：${faceBlurIssue.message}` : null;
}
function definitionForNodeScope(definition, startNodeId) {
    const nodeIds = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$scope$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcProjectionNodeIds"])(definition, startNodeId);
    return {
        ...definition,
        nodes: definition.nodes.filter((node)=>nodeIds.has(node.id)),
        edges: definition.edges.filter((edge)=>nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))
    };
}
function setsOverlap(left, right) {
    for (const value of left){
        if (right.has(value)) return true;
    }
    return false;
}
function editorDraftFromEntity(entity) {
    return {
        definition: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["serializeAigcEditorDefinition"])(entity.definition),
        description: entity.description,
        name: entity.name
    };
}
function editorDraftFromState(state) {
    return {
        definition: state.definition,
        description: state.description,
        name: state.name
    };
}
function editorDraftsEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function validateEditorDraft(draft, startNodeId) {
    if (!draft.name.trim()) return "名称不能为空。";
    return definitionValidationIssue(startNodeId ? definitionForNodeScope(draft.definition, startNodeId) : draft.definition);
}
function autosaveErrorMessage(error) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isApiError"])(error) && error.status === 409 || typeof error === "object" && error !== null && "status" in error && error.status === 409) {
        return "保存冲突：服务端已有更新，请刷新后重新编辑。";
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error);
}
function autosaveStatusText(state) {
    if (state.status === "pending") return "等待自动保存";
    if (state.status === "saving") {
        return state.retryAttempt > 0 ? `正在保存（重试 ${state.retryAttempt}/3）` : "正在保存";
    }
    if (state.status === "failed") {
        return `自动保存失败：${state.message ?? "请稍后重试。"}`;
    }
    if (state.status === "conflict") {
        return state.message ?? "保存冲突：服务端已有更新，请刷新后重新编辑。";
    }
    if (state.status === "invalid") {
        return `草稿无效：${state.message ?? "请检查画布内容。"}`;
    }
    return `已保存 Revision ${state.revision}`;
}
function ToolbarStarMap() {
    const modalities = [
        "text",
        "image",
        "video",
        "audio"
    ];
    const pointPositions = [
        {
            left: "1%",
            top: 12
        },
        {
            left: "9%",
            top: 27
        },
        {
            left: "17%",
            top: 11
        },
        {
            left: "25%",
            top: 28
        },
        {
            left: "33%",
            top: 14
        },
        {
            left: "41%",
            top: 25
        },
        {
            left: "49%",
            top: 10
        },
        {
            left: "57%",
            top: 29
        },
        {
            left: "65%",
            top: 13
        },
        {
            left: "73%",
            top: 26
        },
        {
            left: "81%",
            top: 11
        },
        {
            left: "89%",
            top: 28
        }
    ];
    const lineRotations = [
        7.5,
        -8,
        8.5,
        -7,
        5.5,
        -7.5,
        9.5,
        -8,
        6.5,
        -7.5,
        8.5
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-hidden": "true",
        className: "pointer-events-none absolute inset-x-2 top-0 z-0 hidden h-full xl:block",
        "data-testid": "aigc-toolbar-star-map",
        children: [
            pointPositions.slice(0, -1).map((point, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute h-px w-[8.1%] origin-left bg-[#718096]/25",
                    "data-testid": "aigc-toolbar-star-line",
                    style: {
                        left: point.left,
                        top: point.top + 2,
                        transform: `rotate(${lineRotations[index]}deg)`
                    }
                }, `line-${index}`, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 4379,
                    columnNumber: 9
                }, this)),
            pointPositions.map((point, index)=>{
                const modality = modalities[index % modalities.length];
                const color = `var(--aigc-modality-${modality})`;
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "absolute h-[5px] w-[5px] rounded-full shadow-[0_0_9px_currentColor]",
                    "data-modality": modality,
                    "data-testid": "aigc-toolbar-star-point",
                    style: {
                        backgroundColor: color,
                        color,
                        left: point.left,
                        top: point.top
                    }
                }, `${modality}-${index}`, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
                    lineNumber: 4394,
                    columnNumber: 11
                }, this);
            })
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-editor.tsx",
        lineNumber: 4373,
        columnNumber: 5
    }, this);
}
_c34 = ToolbarStarMap;
function useLatestCallback(callback) {
    _s15();
    const callbackRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(callback);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useLayoutEffect"])({
        "useLatestCallback.useLayoutEffect": ()=>{
            callbackRef.current = callback;
        }
    }["useLatestCallback.useLayoutEffect"], [
        callback
    ]);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useLatestCallback.useCallback": (...args)=>callbackRef.current(...args)
    }["useLatestCallback.useCallback"], []);
}
_s15(useLatestCallback, "+DPI87qpLsHwvh4SdDhysFfg+vs=");
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13, _c14, _c15, _c16, _c17, _c18, _c19, _c20, _c21, _c22, _c23, _c24, _c25, _c26, _c27, _c28, _c29, _c30, _c31, _c32, _c33, _c34;
__turbopack_context__.k.register(_c, "AIGC_NODE_TYPES$Object.fromEntries$AIGC_EDITOR_NODE_REGISTRY.map");
__turbopack_context__.k.register(_c1, "AIGC_NODE_TYPES$Object.fromEntries");
__turbopack_context__.k.register(_c2, "AIGC_NODE_TYPES");
__turbopack_context__.k.register(_c3, "AigcEditor");
__turbopack_context__.k.register(_c4, "AigcEditorContent");
__turbopack_context__.k.register(_c5, "NodePalette");
__turbopack_context__.k.register(_c6, "Inspector");
__turbopack_context__.k.register(_c7, "NodeCustomNameField");
__turbopack_context__.k.register(_c8, "NodeConfig");
__turbopack_context__.k.register(_c9, "LlmImageInputStatus");
__turbopack_context__.k.register(_c10, "JsonParserNodeConfig");
__turbopack_context__.k.register(_c11, "SeedreamImageConfig");
__turbopack_context__.k.register(_c12, "VideoGenerationConfig");
__turbopack_context__.k.register(_c13, "VideoEnhancementConfig");
__turbopack_context__.k.register(_c14, "VideoFaceBlurNodeConfig");
__turbopack_context__.k.register(_c15, "ModalityNodeConfig");
__turbopack_context__.k.register(_c16, "ModalityProjectionPreview");
__turbopack_context__.k.register(_c17, "ModalityStatus");
__turbopack_context__.k.register(_c18, "MediaInputConfig");
__turbopack_context__.k.register(_c19, "ConfigGroup");
__turbopack_context__.k.register(_c20, "ConfigSection");
__turbopack_context__.k.register(_c21, "NumberField");
__turbopack_context__.k.register(_c22, "SelectField");
__turbopack_context__.k.register(_c23, "ResultPanel");
__turbopack_context__.k.register(_c24, "ResultAsset");
__turbopack_context__.k.register(_c25, "SubtitleResultAsset");
__turbopack_context__.k.register(_c26, "ModalityAsset");
__turbopack_context__.k.register(_c27, "VideoResultMetadata");
__turbopack_context__.k.register(_c28, "ResultExecutionMetadata");
__turbopack_context__.k.register(_c29, "RunPanel");
__turbopack_context__.k.register(_c30, "RunTimingSummary");
__turbopack_context__.k.register(_c31, "LogErrorDetails");
__turbopack_context__.k.register(_c32, "InspectorEmpty");
__turbopack_context__.k.register(_c33, "InspectorPlaceholder");
__turbopack_context__.k.register(_c34, "ToolbarStarMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-flow-node.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcFlowNodeCard",
    ()=>AigcFlowNodeCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQueries.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/react/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$system$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/system/dist/esm/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/copy.js [app-client] (ecmascript) <export default as Copy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/pencil.js [app-client] (ecmascript) <export default as Pencil>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/play.js [app-client] (ecmascript) <export default as Play>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$precise$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$audio$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-audio-player.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-run-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-video-player.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/download.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/media-assets.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/modality-colors.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$layers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/layers.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/json-parser-ui.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$llm$2d$image$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/llm-image-input.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-layout.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/result-projection.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/run-log.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-generation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-face-blur.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layer$2d$editor$2d$geometry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/layer-editor-geometry.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature(), _s6 = __turbopack_context__.k.signature();
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
function debugTimestamp() {
    return Date.now();
}
function AigcFlowNodeComponent({ data, id, selected }) {
    _s();
    const resizeNode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcFlowNodeComponent.useAigcEditorStore[resizeNode]": (state)=>state.resizeNode
    }["AigcFlowNodeComponent.useAigcEditorStore[resizeNode]"]);
    const renamingNodeId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcFlowNodeComponent.useAigcEditorStore[renamingNodeId]": (state)=>state.renamingNodeId
    }["AigcFlowNodeComponent.useAigcEditorStore[renamingNodeId]"]);
    const setRenamingNodeId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcFlowNodeComponent.useAigcEditorStore[setRenamingNodeId]": (state)=>state.setRenamingNodeId
    }["AigcFlowNodeComponent.useAigcEditorStore[setRenamingNodeId]"]);
    const setNodeCustomName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcFlowNodeComponent.useAigcEditorStore[setNodeCustomName]": (state)=>state.setNodeCustomName
    }["AigcFlowNodeComponent.useAigcEditorStore[setNodeCustomName]"]);
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcFlowNodeComponent.useAigcEditorStore[definition]": (state)=>state.definition
    }["AigcFlowNodeComponent.useAigcEditorStore[definition]"]);
    const edges = definition.edges;
    const runDetail = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunProjection"])(id);
    const layerPreviewRun = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcLayerPreviewRun"])(id);
    const runNode = runDetail?.nodes.find((item)=>item.node_id === id);
    const llmImageInput = data.node.type === "llm" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$llm$2d$image$2d$input$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolveAigcLlmImageInput"])(definition, data.node.id, runDetail) : null;
    const layerCanvasRunDetail = data.node.type === "layer_canvas" && runNode?.status !== "succeeded" && layerPreviewRun ? layerPreviewRun : runDetail;
    const displayName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes).get(data.node.id)?.displayName ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeBaseDisplayName"])(data.node);
    const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(data.node.type);
    const minimumSize = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeMinimumSize"])(data.node.type);
    const imageInputPort = registration?.inputs.find((port)=>port.id === "image" && port.type === "image_asset");
    const seedreamNode = data.node.type === "image_to_image" ? data.node : null;
    const referenceImageCount = seedreamNode && imageInputPort ? edges.filter((edge)=>edge.targetNodeId === id && edge.targetHandle === imageInputPort.id).length : 0;
    const imageInputFull = Boolean(seedreamNode && imageInputPort && referenceImageCount >= (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageInputLimit"])(seedreamNode, imageInputPort));
    const videoNode = data.node.type === "video_generation" ? data.node : null;
    const videoInputPorts = videoNode ? registration?.inputs.filter((port)=>{
        const connected = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputCount"])(edges, id, port.id) > 0;
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVideoPortActive"])(port, videoNode.config.generation_mode) || connected;
    }) ?? [] : null;
    const seedreamInputPorts = seedreamNode ? registration?.inputs.filter((port)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageInputActive"])(seedreamNode, port.id, edges) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageInputCount"])(edges, id, port.id) > 0) ?? [] : null;
    const renderedInputPorts = videoInputPorts ?? seedreamInputPorts ?? registration?.inputs ?? [];
    const renderedOutputPorts = seedreamNode ? registration?.outputs.filter((port)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageOutputActive"])(seedreamNode, port.id, edges) || edges.some((edge)=>edge.sourceNodeId === id && edge.sourceHandle === port.id)) ?? [] : registration?.outputs ?? [];
    const inputKind = mediaInputKind(data.node);
    const inputAssetId = localMediaAssetId(data.node);
    const modality = modalityNodeType(data.node);
    const currentModalityTitle = modality && typeof data.node.config.title === "string" && data.node.config.title.trim() ? data.node.config.title.trim() : displayName;
    const currentModalityMode = modality && edges.some((edge)=>edge.targetNodeId === data.node.id && edge.targetHandle === modalityHandle(modality)) ? "upstream" : "local";
    const modalityProjection = modality && runDetail ? modality === "text" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcEffectiveText"])(runDetail, definition, data.node.id) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcModalityRunResult"])(runDetail, data.node.id) : null;
    const modalityMode = modalityProjection?.mode ?? currentModalityMode;
    const modalityTitle = modalityProjection?.title ?? currentModalityTitle;
    const managedSource = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["managedTextSource"])(data.node, definition.nodes);
    const resolvedDisplayName = data.node.custom_name?.trim() || managedSource?.itemLabel || displayName;
    const renaming = renamingNodeId === id;
    const showsCanvasTitle = registration?.category !== "modality";
    const videoProjection = modality === "video" && modalityProjection && runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcVideoResult"])(runDetail.run.definition_snapshot, data.node.id, modalityProjection?.asset ? [
        modalityProjection.asset
    ] : []) : null;
    const inputAssetQuery = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: currentModalityMode === "local" && Boolean(inputAssetId),
        queryKey: [
            "aigc",
            "input-asset",
            inputAssetId
        ],
        queryFn: {
            "AigcFlowNodeComponent.useQuery[inputAssetQuery]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAsset(inputAssetId)
        }["AigcFlowNodeComponent.useQuery[inputAssetQuery]"]
    });
    const inputAsset = inputKind && inputAssetQuery.data && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$assets$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSelectableMediaAsset"])(inputAssetQuery.data, inputKind) ? inputAssetQuery.data : undefined;
    const layerCompositeProjection = data.node.type === "layer_composite" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcLayerCompositeResult"])(definition, data.node.id, runDetail?.nodes ?? []) : null;
    const multiTrackProjection = data.node.type === "multi_track_edit" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcVideoResult"])(runDetail?.run.definition_snapshot ?? definition, data.node.id, runNode?.result.assets ?? []) : null;
    const modalityDownload = modalityProjection?.asset && modality === "audio" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcAudioDownload"])(modalityProjection.asset, modalityTitle) : null;
    const generatedAsset = runNode?.result.kind === "assets" ? runNode.result.assets[0] : undefined;
    const generatedMediaDownload = generatedAsset?.available && [
        "text_to_image",
        "image_to_image",
        "image_edit"
    ].includes(data.node.type) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcImageDownload"])(generatedAsset, resolvedDisplayName, definition) : generatedAsset?.available && data.node.type === "video_generation" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcVideoDownload"])(generatedAsset, resolvedDisplayName, definition) : null;
    const multiTrackDownload = multiTrackProjection ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$download$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcVideoDownload"])(multiTrackProjection.asset, multiTrackProjection.title, definition) : null;
    const outputDownload = generatedMediaDownload ?? modalityDownload ?? multiTrackDownload;
    const outputTitle = generatedMediaDownload ? resolvedDisplayName : modality ? modalityTitle : multiTrackProjection?.title ?? "";
    const hasNodeActions = Boolean(outputDownload);
    const showsTitleRow = showsCanvasTitle || renaming;
    const displayAsset = modalityProjection?.asset;
    const preciseEditAssetId = data.node.type !== "image" ? null : currentModalityMode === "upstream" ? displayAsset?.available ? displayAsset.asset_id : null : inputAsset?.id ?? null;
    const preciseEditUrl = data.node.type !== "image" ? null : currentModalityMode === "upstream" ? displayAsset?.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAssetContentUrlById"])(displayAsset.asset_id) : null : inputAsset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(inputAsset) : null;
    const preciseEditName = currentModalityMode === "upstream" ? assetName(displayAsset?.metadata?.name, modalityTitle) : assetName(inputAsset?.metadata.name, "图片输入");
    const imageBboxBinding = data.node.type === "image" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcImageBboxBinding"])(definition, data.node.id, preciseEditAssetId) : null;
    const media = modality === "image" && modalityProjection ? {
        alt: modalityTitle,
        emptyText: modalityStateText(modalityProjection, "image"),
        url: displayAsset?.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAssetContentUrlById"])(displayAsset.asset_id) : null
    } : data.node.type === "image" && currentModalityMode === "local" ? {
        alt: inputAsset ? assetName(inputAsset.metadata.name, inputAsset.id) : "图片输入",
        emptyText: !inputAssetId ? "选择或上传图片" : inputAssetQuery.isPending ? "正在加载图片" : "图片暂不可预览",
        url: inputAsset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(inputAsset) : null
    } : null;
    // #region debug-point A-D:image-node-selection
    const debugDisplayAssetId = displayAsset?.asset_id;
    const debugDisplayAssetAvailable = displayAsset?.available;
    const debugDisplayAssetDownloadUrl = displayAsset?.download_url;
    const debugInputAssetId = inputAsset?.id;
    const debugInputAssetUrl = inputAsset?.url;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcFlowNodeComponent.useEffect": ()=>{
            if (data.node.type !== "image") return;
            fetch("http://127.0.0.1:7777/event", {
                body: JSON.stringify({
                    data: {
                        currentModalityMode,
                        displayAsset: debugDisplayAssetId ? {
                            assetId: debugDisplayAssetId,
                            available: debugDisplayAssetAvailable,
                            downloadUrl: debugDisplayAssetDownloadUrl
                        } : null,
                        inputAsset: debugInputAssetId ? {
                            id: debugInputAssetId,
                            url: debugInputAssetUrl
                        } : null,
                        inputAssetId,
                        inputQueryStatus: inputAssetQuery.status,
                        mediaUrl: media?.url ?? null,
                        modalityMode,
                        runId: runDetail?.run.id ?? null,
                        runStatus: runDetail?.run.status ?? null
                    },
                    hypothesisId: "A-D",
                    location: "aigc-flow-node.tsx:AigcFlowNodeComponent",
                    msg: "[DEBUG] Image node selected preview source",
                    runId: "post-fix",
                    sessionId: "aigc-image-preview-broken",
                    traceId: data.node.id,
                    ts: debugTimestamp()
                }),
                method: "POST"
            }).catch({
                "AigcFlowNodeComponent.useEffect": ()=>{}
            }["AigcFlowNodeComponent.useEffect"]);
        }
    }["AigcFlowNodeComponent.useEffect"], [
        currentModalityMode,
        data.node.id,
        data.node.type,
        debugDisplayAssetAvailable,
        debugDisplayAssetDownloadUrl,
        debugDisplayAssetId,
        debugInputAssetId,
        debugInputAssetUrl,
        inputAssetId,
        inputAssetQuery.status,
        media?.url,
        modalityMode,
        runDetail?.run.id,
        runDetail?.run.status
    ]);
    // #endregion
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-label": resolvedDisplayName,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-full w-full flex-col overflow-hidden rounded-md border border-border bg-card shadow-md", selected && "ring-2 ring-primary/20"),
                role: "group",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["NodeResizer"], {
                        color: "hsl(var(--primary))",
                        isVisible: selected,
                        minHeight: minimumSize.height,
                        minWidth: minimumSize.width,
                        onResizeEnd: (_, size)=>resizeNode(id, {
                                height: size.height,
                                width: size.width
                            })
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 438,
                        columnNumber: 7
                    }, this),
                    renderedInputPorts.map((port, index)=>{
                        const modalityColors = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcModalityColors"])(port.type);
                        const count = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputCount"])(edges, id, port.id);
                        const limit = data.node.type === "video_generation" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputLimit"])(data.node, port) : seedreamNode ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageInputLimit"])(seedreamNode, port) : port.max_connections;
                        const inactive = data.node.type === "video_generation" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVideoPortActive"])(port, data.node.config.generation_mode) || Boolean(seedreamNode && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageInputActive"])(seedreamNode, port.id, edges));
                        const full = imageInputFull && port.id === imageInputPort?.id || count >= limit;
                        const stateText = inactive ? "，与当前模式不兼容" : full ? data.node.type === "image_to_image" && port.type === "image_asset" ? `，已达到 ${limit} 张上限` : `，已达到 ${limit} 个连接上限` : "";
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Handle"], {
                            "aria-label": `${port.label}输入${stateText}`,
                            className: "!h-2.5 !w-2.5 !border-2 !border-card",
                            id: port.id,
                            isConnectable: !inactive && !full,
                            position: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$system$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Position"].Left,
                            style: {
                                backgroundColor: modalityColors.handleColor,
                                opacity: inactive ? 0.4 : 1,
                                top: `${(index + 1) / (renderedInputPorts.length + 1) * 100}%`
                            },
                            title: inactive ? `${port.label}输入与当前模式不兼容，请断开连线` : full ? data.node.type === "image_to_image" && port.type === "image_asset" ? `${port.label}输入已满，最多支持 ${limit} 张参考图` : `${port.label}输入已满，最多支持 ${limit} 个连接` : `${port.label}输入`,
                            type: "target"
                        }, port.id, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 474,
                            columnNumber: 11
                        }, this);
                    }),
                    renderedOutputPorts.map((port, index)=>{
                        const inactive = Boolean(seedreamNode && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageOutputActive"])(seedreamNode, port.id, edges));
                        const stateText = inactive ? "，与当前模式或编辑目标不兼容" : "";
                        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Handle"], {
                            "aria-label": `${port.label}输出${port.system_only ? "，仅系统可连接" : stateText}`,
                            className: "!h-2.5 !w-2.5 !border-2 !border-card",
                            id: port.id,
                            isConnectable: !inactive && !port.system_only,
                            position: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$system$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Position"].Right,
                            style: {
                                backgroundColor: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$modality$2d$colors$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcModalityColors"])(port.type).handleColor,
                                opacity: inactive ? 0.4 : 1,
                                top: `${(index + 1) / (renderedOutputPorts.length + 1) * 100}%`
                            },
                            title: port.system_only ? `${port.label}输出由系统自动管理` : inactive ? `${port.label}输出与当前模式或编辑目标不兼容，请断开连线` : `${port.label}输出`,
                            type: "source"
                        }, port.id, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 507,
                            columnNumber: 11
                        }, this);
                    }),
                    showsTitleRow ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "group/title flex h-7 shrink-0 items-center justify-between px-2.5",
                        "data-testid": "aigc-node-title-row",
                        children: [
                            renaming ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(InlineNodeNameInput, {
                                initialValue: resolvedDisplayName,
                                onCancel: ()=>setRenamingNodeId(null),
                                onSave: (value)=>{
                                    setNodeCustomName(id, value);
                                    setRenamingNodeId(null);
                                }
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 537,
                                columnNumber: 13
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "min-w-0 truncate text-[11px] font-medium text-foreground",
                                "data-testid": "aigc-node-title",
                                children: resolvedDisplayName
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 546,
                                columnNumber: 13
                            }, this),
                            hasNodeActions ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeActions, {
                                outputDownload: outputDownload,
                                outputTitle: outputTitle,
                                type: data.node,
                                visible: renaming && !showsCanvasTitle
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 554,
                                columnNumber: 13
                            }, this) : null
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 532,
                        columnNumber: 9
                    }, this) : hasNodeActions ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeActions, {
                        compact: true,
                        outputDownload: outputDownload,
                        outputTitle: outputTitle,
                        type: data.node,
                        visible: true
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 563,
                        columnNumber: 9
                    }, this) : null,
                    modality === "text" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ModalityTextBody, {
                        displayName: modalityTitle,
                        managedSource: managedSource,
                        mode: modalityMode,
                        projection: modalityProjection,
                        text: data.node.config.text ?? ""
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 572,
                        columnNumber: 9
                    }, this) : modality === "video" && modalityProjection ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                        audioState: videoProjection?.audioState,
                        bitDepth: videoProjection?.bitDepth,
                        fps: videoProjection?.fps,
                        initialMetadata: {
                            duration: resultMetadataNumber(displayAsset, "duration_seconds") ?? videoProjection?.duration ?? null,
                            height: resultMetadataNumber(displayAsset, "height"),
                            width: resultMetadataNumber(displayAsset, "width")
                        },
                        mimeType: displayAsset?.mime_type ?? null,
                        name: modalityTitle,
                        resolutionLabel: videoProjection?.resolution,
                        toolVersion: videoProjection?.toolVersion,
                        unavailableText: modalityStateText(modalityProjection, "video"),
                        url: displayAsset?.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(displayAsset.download_url) : null
                    }, `${runDetail?.run.id ?? "none"}:${displayAsset?.asset_id ?? "waiting"}`, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 580,
                        columnNumber: 9
                    }, this) : modality === "audio" && modalityProjection ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$audio$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcAudioPlayer"], {
                        duration: resultMetadataNumber(displayAsset, "duration_seconds"),
                        mimeType: displayAsset?.mime_type ?? null,
                        name: modalityTitle,
                        unavailableText: modalityStateText(modalityProjection, "audio"),
                        url: displayAsset?.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(displayAsset.download_url) : null
                    }, `${runDetail?.run.id ?? "none"}:${displayAsset?.asset_id ?? "waiting"}`, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 605,
                        columnNumber: 9
                    }, this) : data.node.type === "video" || data.node.type === "audio" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeInputMedia, {
                        asset: inputAsset,
                        kind: data.node.type,
                        loading: inputAssetQuery.isPending,
                        referenced: Boolean(inputAssetId)
                    }, `${data.node.type}:${inputAssetId ?? "empty"}:${inputAsset?.updated_at ?? "loading"}`, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 618,
                        columnNumber: 9
                    }, this) : media ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(NodeImageMedia, {
                        alt: media.alt,
                        emptyText: media.emptyText,
                        hasBbox: data.node.type === "image" && imageBboxBinding?.state === "valid",
                        url: media.url
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 626,
                        columnNumber: 9
                    }, this) : data.node.type === "layer_canvas" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LayerCanvasNodeBody, {
                        edges: edges,
                        node: data.node,
                        runDetail: layerCanvasRunDetail
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 636,
                        columnNumber: 9
                    }, this) : data.node.type === "layer_composite" && layerCompositeProjection ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LayerCompositeNodeBody, {
                        nodeId: data.node.id,
                        projection: layerCompositeProjection,
                        status: runNode?.status ?? null
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 642,
                        columnNumber: 9
                    }, this) : data.node.type === "multi_track_edit" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MultiTrackEditNodeBody, {
                        node: data.node,
                        projection: multiTrackProjection,
                        status: runNode?.status ?? null
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 648,
                        columnNumber: 9
                    }, this) : data.node.type === "json_parser" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(JsonParserNodeBody, {
                        node: data.node,
                        runNode: runNode
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 654,
                        columnNumber: 9
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "nodrag min-h-0 flex-1 overflow-hidden p-3",
                        children: [
                            seedreamNode && imageInputPort && (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageOperation"])(seedreamNode) === "image_to_image" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mb-1 text-xs font-medium text-foreground",
                                children: [
                                    "参考图 ",
                                    referenceImageCount,
                                    "/",
                                    imageInputPort.max_connections
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 663,
                                columnNumber: 13
                            }, this) : null,
                            data.node.type === "video_generation" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoGenerationSummary, {
                                edges: edges,
                                node: data.node
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 668,
                                columnNumber: 13
                            }, this) : null,
                            data.node.type === "video_enhancement" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(VideoEnhancementCostBadges, {
                                node: data.node
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 674,
                                columnNumber: 13
                            }, this) : null,
                            llmImageInput ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(LlmImageInputSummary, {
                                input: llmImageInput
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 677,
                                columnNumber: 13
                            }, this) : null,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "line-clamp-3 text-xs leading-5 text-muted-foreground",
                                children: runNode?.result.metadata?.empty === true ? "未识别到字幕" : nodeSummary(data.node)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 679,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 659,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 430,
                columnNumber: 7
            }, this),
            data.node.type === "image" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "nodrag absolute right-0 top-0 z-10 grid h-[12px] w-[12px] -translate-y-[calc(100%+0.375rem)] place-items-center rounded-full border border-border bg-card shadow-md",
                "data-testid": "aigc-image-node-actions",
                onClick: (event)=>event.stopPropagation(),
                onPointerDown: (event)=>event.stopPropagation(),
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$precise$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcPreciseEditDialog"], {
                    assetId: preciseEditAssetId,
                    assetName: preciseEditName,
                    bboxState: imageBboxBinding?.state ?? "none",
                    compactTrigger: true,
                    node: data.node,
                    sourceMode: currentModalityMode,
                    url: preciseEditUrl
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 694,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 688,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 429,
        columnNumber: 5
    }, this);
}
_s(AigcFlowNodeComponent, "dhif35A5ghwdHGhTgz2EUldPKME=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunProjection"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcLayerPreviewRun"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
_c = AigcFlowNodeComponent;
function LlmImageInputSummary({ input }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        "aria-label": `LLM 图片输入：${input.sourceLabel ?? "未连接"}，${input.statusLabel}`,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mb-2 rounded border px-2 py-1 text-[10px]", input.state === "ready" ? "border-success/30 bg-success/10 text-success" : input.state === "unavailable" ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted text-muted-foreground"),
        "data-testid": "aigc-llm-image-input",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "font-medium",
                children: "图片输入"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 727,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    " · ",
                    input.sourceLabel ?? "未连接"
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 728,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    " · ",
                    input.statusLabel
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 729,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 715,
        columnNumber: 5
    }, this);
}
_c1 = LlmImageInputSummary;
function NodeActions({ compact = false, outputDownload, outputTitle, type, visible }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("nodrag flex shrink-0 items-center gap-0.5", compact && "justify-end px-1 py-0.5", !visible && "opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-within/title:opacity-100"),
        "data-testid": "aigc-node-actions",
        onClick: (event)=>event.stopPropagation(),
        onPointerDown: (event)=>event.stopPropagation(),
        children: outputDownload ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
            "aria-label": `下载${downloadKindLabel(type)}：${outputTitle}`,
            className: "nodrag grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-card hover:text-foreground",
            download: outputDownload.filename,
            href: outputDownload.url,
            title: `下载${downloadKindLabel(type)}`,
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                className: "h-3.5 w-3.5"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 767,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
            lineNumber: 760,
            columnNumber: 9
        }, this) : null
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 748,
        columnNumber: 5
    }, this);
}
_c2 = NodeActions;
function ModalityTextBody({ displayName, managedSource, mode, projection, text }) {
    const visibleText = projection?.text ?? (mode === "local" || managedSource ? text : "");
    const stateText = projection || mode === "upstream" ? modalityStateText(projection, "text") : "配置输入文本";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3",
        children: [
            managedSource ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-w-0 flex-wrap gap-1 text-[9px]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-400",
                        children: "只读上游内容"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 797,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-muted-foreground",
                        title: `来源：${managedSource.parserName}`,
                        children: [
                            "来源：",
                            managedSource.parserName
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 800,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 796,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "line-clamp-5 break-words whitespace-pre-wrap text-xs leading-5 text-foreground",
                children: visibleText || stateText
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 808,
                columnNumber: 7
            }, this),
            mode === "upstream" && visibleText ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                "aria-label": `复制文本：${displayName}`,
                className: "nodrag mt-auto inline-flex h-7 items-center justify-center gap-1.5 rounded border border-border text-[10px] text-muted-foreground hover:text-foreground",
                onClick: (event)=>{
                    event.stopPropagation();
                    void navigator.clipboard.writeText(visibleText);
                },
                type: "button",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$copy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Copy$3e$__["Copy"], {
                        className: "h-3 w-3"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 821,
                        columnNumber: 11
                    }, this),
                    "复制"
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 812,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 794,
        columnNumber: 5
    }, this);
}
_c3 = ModalityTextBody;
function JsonParserNodeBody({ node, runNode }) {
    const count = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonParserItemCount"])(runNode);
    const error = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$run$2d$log$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAigcNodeLogError"])(runNode ?? {
        attempts: [],
        current_task_id: null,
        error: null,
        status: "idle"
    });
    const errorMessage = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$json$2d$parser$2d$ui$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsonParserErrorMessage"])(error);
    const status = runNode ? parserStatusLabel(runNode.status) : "未运行";
    const failed = runNode?.status === "failed" || runNode?.status === "timed_out";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 text-[10px]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-border bg-background px-2 py-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground",
                        children: "JSONPath"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 852,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-0.5 truncate font-mono text-xs text-foreground",
                        title: node.config.json_path,
                        children: node.config.json_path
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 853,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 851,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-wrap items-center gap-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded px-1.5 py-0.5 font-medium", failed ? "bg-destructive/10 text-destructive" : runNode?.status === "succeeded" || runNode?.status === "reused" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"),
                        children: status
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 861,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded bg-blue-500/10 px-1.5 py-0.5 font-medium text-blue-400",
                        children: count === null ? "等待 item" : `${count} 项`
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 873,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 860,
                columnNumber: 7
            }, this),
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-0 overflow-hidden border-l-2 border-destructive pl-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "break-all font-mono text-[9px] text-destructive",
                        children: error.code ?? "json_parser_failed"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 879,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 line-clamp-3 break-words text-destructive",
                        children: errorMessage
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 882,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 878,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 850,
        columnNumber: 5
    }, this);
}
_c4 = JsonParserNodeBody;
function parserStatusLabel(status) {
    return ({
        blocked: "阻塞",
        canceled: "已取消",
        failed: "失败",
        idle: "未运行",
        queued: "排队中",
        ready: "就绪",
        reused: "已复用",
        running: "解析中",
        succeeded: "已完成",
        timed_out: "超时"
    })[status];
}
function LayerCompositeNodeBody({ nodeId, projection, status }) {
    _s1();
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "LayerCompositeNodeBody.useAigcEditorStore[mode]": (state)=>state.mode
    }["LayerCompositeNodeBody.useAigcEditorStore[mode]"]);
    const runActions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"])();
    const targetLabel = projection.targetLayer?.name || projection.replacement?.layer_id || (projection.replacementConnected ? "运行后识别" : "尚未连接");
    const outputState = status === "running" || status === "queued" ? "正在合成" : status === "failed" || status === "timed_out" ? "合成失败" : projection.imageAsset ? "扁平图片已生成" : "等待运行";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "nodrag flex min-h-0 flex-1 flex-col gap-2 p-3 text-[10px]",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CompositeInputState, {
                        connected: projection.layersConnected,
                        label: "图层集输入"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 935,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(CompositeInputState, {
                        connected: projection.replacementConnected,
                        label: "替换图层输入"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 939,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 934,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded border border-border bg-background px-2 py-1.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-muted-foreground",
                        children: "替换目标"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 945,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-0.5 truncate font-medium text-foreground",
                        title: targetLabel,
                        children: targetLabel
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 946,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 944,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1 border-t border-border pt-2 text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "图片输出：",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-foreground",
                                children: outputState
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 952,
                                columnNumber: 16
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 951,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: [
                            "图层集输出：",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-foreground",
                                children: projection.layerSet ? ` v${projection.layerSet.version} · ${projection.layerSet.layers.length + 1} 层` : " 等待运行"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 956,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 954,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 950,
                columnNumber: 7
            }, this),
            mode === "pipeline" && runActions ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-auto shrink-0 border-t border-border pt-2",
                "data-testid": "layer-composite-actions",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ContinueFromLayerNodeButton, {
                    nodeId: nodeId,
                    nodeLabel: "图层合成",
                    runActions: runActions
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 968,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 964,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 933,
        columnNumber: 5
    }, this);
}
_s1(LayerCompositeNodeBody, "knCofPuc6RyMG95P/zqjjv771VU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"]
    ];
});
_c5 = LayerCompositeNodeBody;
function CompositeInputState({ connected, label }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        "aria-label": `${label}${connected ? "已连接" : "未连接"}`,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("rounded border px-1.5 py-1 text-center", connected ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground"),
        children: [
            label.replace("输入", ""),
            " · ",
            connected ? "已连接" : "未连接"
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 987,
        columnNumber: 5
    }, this);
}
_c6 = CompositeInputState;
function LayerCanvasNodeBody({ edges, node, runDetail }) {
    _s2();
    const runActions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"])();
    const pipelineId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "LayerCanvasNodeBody.useAigcEditorStore[pipelineId]": (state)=>state.entityId
    }["LayerCanvasNodeBody.useAigcEditorStore[pipelineId]"]);
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "LayerCanvasNodeBody.useAigcEditorStore[mode]": (state)=>state.mode
    }["LayerCanvasNodeBody.useAigcEditorStore[mode]"]);
    const layerSet = runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$layers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["findUpstreamLayerSet"])(edges, node.id, [
        runDetail
    ]) : null;
    const current = layerSet ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$layers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["layerCanvasSourceIsCurrent"])(node.config, layerSet) : false;
    const layers = layerSet ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$layers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyLayerCanvasConfig"])(layerSet, node.config) : [];
    const assetIds = layerSet ? [
        layerSet.base_asset_id,
        ...layers.map((layer)=>layer.asset_id)
    ] : [];
    const runPipelineId = runDetail?.run.pipeline_id ?? null;
    const runId = runDetail?.run.id ?? null;
    const assetQueries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"])({
        queries: assetIds.map({
            "LayerCanvasNodeBody.useQueries[assetQueries]": (assetId)=>({
                    enabled: Boolean(runPipelineId && runId),
                    queryFn: ({
                        "LayerCanvasNodeBody.useQueries[assetQueries]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAigcInternalRunAsset(runPipelineId, runId, assetId)
                    })["LayerCanvasNodeBody.useQueries[assetQueries]"],
                    queryKey: [
                        "aigc",
                        "layer-preview-asset",
                        runPipelineId,
                        runId,
                        assetId
                    ],
                    retry: false,
                    staleTime: 60_000
                })
        }["LayerCanvasNodeBody.useQueries[assetQueries]"])
    });
    const assetUrls = new Map(assetIds.flatMap((assetId, index)=>{
        const asset = assetQueries[index]?.data;
        const url = asset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(asset) : null;
        return url ? [
            [
                assetId,
                url
            ]
        ] : [];
    }));
    const failedAssetLabels = assetIds.flatMap((assetId, index)=>{
        if (!assetQueries[index]?.isError) return [];
        if (assetId === layerSet?.base_asset_id) return [
            "底图"
        ];
        const layer = layers.find((candidate)=>candidate.asset_id === assetId);
        return [
            layer ? `${layer.name || layer.id}（${layer.id}）` : assetId
        ];
    });
    const selected = current ? layers.find((layer)=>layer.id === node.config.selected_layer_id) : null;
    const modificationCount = layerSet && current ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$layers$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["layerCanvasModificationCount"])(layerSet.layers, layers) : node.config.transform_patches.length;
    const href = mode === "pipeline" && pipelineId ? `/workspace/aigc/pipelines/${pipelineId}/nodes/${node.id}/layers` : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "nodrag flex min-h-0 flex-1 flex-col gap-2 p-2.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-label": "图层组合预览",
                className: "relative min-h-20 flex-1 overflow-hidden rounded-md border border-border bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%),linear-gradient(-45deg,#e2e8f0_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:12px_12px]",
                children: [
                    layerSet && assetUrls.get(layerSet.base_asset_id) ? // Internal asset URLs are resolved by the backend.
                    // eslint-disable-next-line @next/next/no-img-element
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        alt: "图层组合底图",
                        className: "absolute inset-0 h-full w-full object-fill",
                        src: assetUrls.get(layerSet.base_asset_id)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1081,
                        columnNumber: 11
                    }, this) : null,
                    layerSet ? layers.filter((layer)=>layer.visible).toSorted((a, b)=>a.z_index - b.z_index).map((layer)=>{
                        const frame = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$layer$2d$editor$2d$geometry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getLayerFrame"])(layer, layerSet.canvas_width, layerSet.canvas_height);
                        const url = assetUrls.get(layer.asset_id);
                        return url ? // eslint-disable-next-line @next/next/no-img-element
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                            alt: "",
                            className: "absolute object-fill",
                            src: url,
                            style: {
                                height: `${frame.heightPercent}%`,
                                left: `${frame.leftPercent}%`,
                                top: `${frame.topPercent}%`,
                                width: `${frame.widthPercent}%`,
                                zIndex: layer.z_index
                            }
                        }, layer.id, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1100,
                            columnNumber: 19
                        }, this) : null;
                    }) : null,
                    !layerSet ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid h-full min-h-20 place-items-center px-3 text-center text-[11px] text-muted-foreground",
                        children: "当前 Run 无成功图层集"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1117,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1074,
                columnNumber: 7
            }, this),
            failedAssetLabels.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-[10px] font-medium text-destructive",
                role: "alert",
                title: failedAssetLabels.join("、"),
                children: [
                    failedAssetLabels.length,
                    " 个图层预览加载失败：",
                    failedAssetLabels.join("、")
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1123,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-1 text-[10px] text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "图层 ",
                            layerSet ? layerSet.layers.length + 1 : 0
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1133,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-right",
                        children: [
                            "修改 ",
                            modificationCount
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1134,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "col-span-2 truncate",
                        children: current ? selected ? `已选：${selected.name}` : "尚未选择图层" : layerSet ? "上游已变化，需重新确认" : "暂无可编辑图层集"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1135,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1132,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-auto grid shrink-0 gap-2 border-t border-border pt-2", href && runActions ? "grid-cols-2" : "grid-cols-1"),
                "data-testid": "layer-canvas-actions",
                children: [
                    href ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        className: "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent hover:text-accent-foreground",
                        href: href,
                        onClick: (event)=>{
                            event.stopPropagation();
                            if (!runActions) return;
                            event.preventDefault();
                            runActions.openLayerEditor(href);
                        },
                        onPointerDown: (event)=>event.stopPropagation(),
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__["Pencil"], {
                                className: "h-3 w-3 shrink-0"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 1164,
                                columnNumber: 13
                            }, this),
                            "打开图层编辑器"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1153,
                        columnNumber: 11
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-center text-[10px] text-muted-foreground",
                        children: "Pipeline 实例中可编辑"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1168,
                        columnNumber: 11
                    }, this),
                    mode === "pipeline" && runActions ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ContinueFromLayerNodeButton, {
                        nodeId: node.id,
                        nodeLabel: "图层画布",
                        runActions: runActions
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1173,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1145,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1073,
        columnNumber: 5
    }, this);
}
_s2(LayerCanvasNodeBody, "hlJLnd2pxld9wY+xqBrRpHMYoqQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"]
    ];
});
_c7 = LayerCanvasNodeBody;
function MultiTrackEditNodeBody({ node, projection, status }) {
    _s3();
    const dirty = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "MultiTrackEditNodeBody.useAigcEditorStore[dirty]": (state)=>state.dirty
    }["MultiTrackEditNodeBody.useAigcEditorStore[dirty]"]);
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "MultiTrackEditNodeBody.useAigcEditorStore[mode]": (state)=>state.mode
    }["MultiTrackEditNodeBody.useAigcEditorStore[mode]"]);
    const pipelineId = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "MultiTrackEditNodeBody.useAigcEditorStore[pipelineId]": (state)=>state.entityId
    }["MultiTrackEditNodeBody.useAigcEditorStore[pipelineId]"]);
    const runActions = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"])();
    const tracks = projection?.trackCount ?? node.config.tracks.length;
    const elements = projection?.elementCount ?? node.config.tracks.reduce((count, track)=>count + track.elements.length, 0);
    const durationMs = projection?.duration === null || projection?.duration === undefined ? node.config.tracks.reduce((duration, track)=>track.elements.reduce((trackDuration, element)=>Math.max(trackDuration, element.target_time.end_ms), duration), 0) : projection.duration * 1_000;
    const canvas = projection?.resolution ? projection.resolution.replace("x", " × ") : node.config.canvas.mode === "custom" ? `${node.config.canvas.width} × ${node.config.canvas.height}` : "自动画布";
    const resultUrl = projection?.asset?.available ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(projection.asset.download_url) : null;
    const href = mode === "pipeline" && pipelineId ? `/workspace/aigc/pipelines/${pipelineId}/nodes/${node.id}/timeline` : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "nodrag flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-3 text-[10px]",
        children: [
            projection?.asset ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
                fps: projection.fps,
                initialMetadata: {
                    duration: projection.duration,
                    height: resultMetadataNumber(projection.asset, "height"),
                    width: resultMetadataNumber(projection.asset, "width")
                },
                mimeType: projection.asset.mime_type,
                name: projection.title,
                resolutionLabel: projection.resolution,
                unavailableText: "多轨成片已不可用",
                url: resultUrl
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1233,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-3 gap-1 text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded border border-border bg-background px-1 py-1",
                        children: [
                            tracks,
                            " 轨道"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1248,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded border border-border bg-background px-1 py-1",
                        children: [
                            elements,
                            " 元素"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1251,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded border border-border bg-background px-1 py-1",
                        children: formatTimelineDuration(durationMs)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1254,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1247,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2 text-muted-foreground",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: canvas
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1259,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            projection?.fps ?? node.config.output.fps,
                            " FPS"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1260,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1258,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2 border-t border-border pt-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: dirty ? "未保存" : "已保存"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1263,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: multiTrackRunStatusLabel(status)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1264,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1262,
                columnNumber: 7
            }, this),
            href ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                className: "mt-auto inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-accent hover:text-accent-foreground",
                href: href,
                onClick: (event)=>{
                    event.stopPropagation();
                    if (!runActions) return;
                    event.preventDefault();
                    runActions.openLayerEditor(href);
                },
                onPointerDown: (event)=>event.stopPropagation(),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$pencil$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Pencil$3e$__["Pencil"], {
                        className: "h-3 w-3"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1278,
                        columnNumber: 11
                    }, this),
                    "编辑时间线"
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1267,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "mt-auto text-center text-muted-foreground",
                children: "Pipeline 实例中可编辑"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1282,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1231,
        columnNumber: 5
    }, this);
}
_s3(MultiTrackEditNodeBody, "IaV18NCJYzkIFAjAZVcW3LyS22U=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunActions"]
    ];
});
_c8 = MultiTrackEditNodeBody;
function formatTimelineDuration(durationMs) {
    const totalSeconds = Math.ceil(Math.max(0, durationMs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function multiTrackRunStatusLabel(status) {
    if (!status) return "未运行";
    const labels = {
        idle: "未运行",
        ready: "等待执行",
        queued: "排队中",
        running: "运行中",
        succeeded: "运行成功",
        failed: "运行失败",
        timed_out: "运行超时",
        canceled: "已取消",
        blocked: "已阻止",
        reused: "缓存复用"
    };
    return labels[status];
}
function ContinueFromLayerNodeButton({ nodeId, nodeLabel, runActions }) {
    const pending = runActions.pendingForNode(nodeId);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        "aria-label": "从此节点继续",
        className: "inline-flex h-7 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
        disabled: pending,
        onClick: (event)=>{
            event.stopPropagation();
            runActions.continueFromNode(nodeId);
        },
        onPointerDown: (event)=>event.stopPropagation(),
        title: `复用可用的上游结果，从${nodeLabel}节点重新执行当前节点及下游`,
        type: "button",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$play$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Play$3e$__["Play"], {
                className: "h-3 w-3 shrink-0"
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1342,
                columnNumber: 7
            }, this),
            pending ? "正在执行" : "从此节点继续"
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1330,
        columnNumber: 5
    }, this);
}
_c9 = ContinueFromLayerNodeButton;
function VideoGenerationSummary({ edges, node }) {
    const capabilities = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_CAPABILITIES"][node.config.model];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mb-2 grid grid-cols-3 gap-1 text-center text-[9px] font-medium text-muted-foreground",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    "图片 ",
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputCount"])(edges, node.id, "reference_images"),
                    "/",
                    capabilities.maxReferenceImages
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1358,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    "视频 ",
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputCount"])(edges, node.id, "reference_videos"),
                    "/",
                    capabilities.maxReferenceVideos
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1362,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                children: [
                    "音频 ",
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputCount"])(edges, node.id, "reference_audios"),
                    "/",
                    capabilities.maxReferenceAudios
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1366,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1357,
        columnNumber: 5
    }, this);
}
_c10 = VideoGenerationSummary;
function NodeImageMedia({ alt, emptyText, hasBbox, url }) {
    _s4();
    const [dimensions, setDimensions] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [previewOpen, setPreviewOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const resolution = dimensions?.url === url ? `${dimensions.width} × ${dimensions.height}` : null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-h-0 min-w-0 flex-1 overflow-hidden bg-card p-1.5",
                "data-testid": "aigc-image-preview",
                children: url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    "aria-label": `查看原图：${alt}`,
                    className: "nodrag group relative block h-full min-h-0 w-full min-w-0 cursor-zoom-in overflow-hidden",
                    onClick: (event)=>{
                        event.stopPropagation();
                        setPreviewOpen(true);
                    },
                    title: "查看原图",
                    type: "button",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                            alt: alt,
                            className: "absolute inset-0 block h-full w-full select-none object-contain",
                            draggable: false,
                            onLoad: (event)=>{
                                const image = event.currentTarget;
                                // #region debug-point B-C:image-load
                                fetch("http://127.0.0.1:7777/event", {
                                    body: JSON.stringify({
                                        data: {
                                            alt,
                                            currentSrc: image.currentSrc,
                                            naturalHeight: image.naturalHeight,
                                            naturalWidth: image.naturalWidth,
                                            url
                                        },
                                        hypothesisId: "B-C",
                                        location: "aigc-flow-node.tsx:NodeImageMedia:onLoad",
                                        msg: "[DEBUG] Image preview loaded",
                                        runId: "post-fix",
                                        sessionId: "aigc-image-preview-broken",
                                        traceId: alt,
                                        ts: Date.now()
                                    }),
                                    method: "POST"
                                }).catch(()=>{});
                                // #endregion
                                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                                    setDimensions({
                                        height: image.naturalHeight,
                                        url,
                                        width: image.naturalWidth
                                    });
                                }
                            },
                            onError: (event)=>{
                                const image = event.currentTarget;
                                // #region debug-point A-D:image-error
                                fetch("http://127.0.0.1:7777/event", {
                                    body: JSON.stringify({
                                        data: {
                                            alt,
                                            currentSrc: image.currentSrc,
                                            url
                                        },
                                        hypothesisId: "A-D",
                                        location: "aigc-flow-node.tsx:NodeImageMedia:onError",
                                        msg: "[DEBUG] Image preview failed",
                                        runId: "post-fix",
                                        sessionId: "aigc-image-preview-broken",
                                        traceId: alt,
                                        ts: Date.now()
                                    }),
                                    method: "POST"
                                }).catch(()=>{});
                            // #endregion
                            },
                            src: url
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1415,
                            columnNumber: 13
                        }, this),
                        resolution ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "pointer-events-none absolute bottom-1.5 right-1.5 rounded bg-slate-950/80 px-1.5 py-0.5 font-mono text-[9px] text-white shadow-sm",
                            children: resolution
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1475,
                            columnNumber: 15
                        }, this) : null,
                        hasBbox ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "pointer-events-none absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground shadow-sm",
                            children: "已框选"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1480,
                            columnNumber: 15
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1403,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid h-full min-h-0 w-full place-items-center px-3 text-center text-[10px] text-muted-foreground",
                    children: emptyText
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1486,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1398,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: setPreviewOpen,
                open: previewOpen,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)] overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-xl",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "border-b border-white/10 px-5 py-4 pr-14",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    children: "查看原图"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                    lineNumber: 1494,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    className: "text-slate-300",
                                    children: [
                                        alt,
                                        resolution ? ` · ${resolution}` : ""
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                    lineNumber: 1495,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1493,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid h-full min-h-0 w-full place-items-center overflow-hidden p-4",
                            children: url ? /* Signed asset URLs must be passed through without image optimization. */ /* eslint-disable-next-line @next/next/no-img-element */ /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                alt: `${alt} 原图预览`,
                                className: "block h-auto max-h-[calc(92dvh-7rem)] w-auto max-w-[calc(96vw-2rem)] object-contain",
                                draggable: false,
                                src: url
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                                lineNumber: 1504,
                                columnNumber: 15
                            }, this) : null
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                            lineNumber: 1500,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1492,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1491,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1397,
        columnNumber: 5
    }, this);
}
_s4(NodeImageMedia, "feioUsfTGn27wZlYzroMVg0jA+4=");
_c11 = NodeImageMedia;
function NodeInputMedia({ asset, kind, loading, referenced }) {
    _s5();
    const [metadata, setMetadata] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        duration: metadataNumber(asset, "duration_seconds"),
        height: metadataNumber(asset, "height"),
        width: metadataNumber(asset, "width")
    });
    const url = asset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(asset) : null;
    const name = asset ? assetName(asset.metadata.name, asset.id) : kind === "video" ? "视频输入" : "音频输入";
    const details = mediaDetails(asset, metadata, kind);
    const emptyText = !referenced ? `选择或上传${kind === "video" ? "视频" : "音频"}` : loading ? `正在加载${kind === "video" ? "视频" : "音频"}` : "资产不可用，请替换";
    function readMediaMetadata(media) {
        setMetadata({
            duration: Number.isFinite(media.duration) ? media.duration : null,
            height: media instanceof HTMLVideoElement && media.videoHeight > 0 ? media.videoHeight : null,
            width: media instanceof HTMLVideoElement && media.videoWidth > 0 ? media.videoWidth : null
        });
    }
    if (!url) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "grid min-h-0 flex-1 place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: emptyText
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1569,
                        columnNumber: 11
                    }, this),
                    referenced && !loading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 font-mono text-[9px] text-amber-300",
                        children: asset?.id ?? "引用已删除或无法访问"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                        lineNumber: 1571,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1568,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
            lineNumber: 1567,
            columnNumber: 7
        }, this);
    }
    if (kind === "audio") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-0 flex-1 flex-col justify-center gap-2 overflow-hidden bg-slate-950 p-2 text-white",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "truncate text-[10px] font-medium",
                    title: name,
                    children: name
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1583,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("audio", {
                    "aria-label": `播放音频：${name}`,
                    className: "nodrag nowheel h-8 w-full",
                    controls: true,
                    onLoadedMetadata: (event)=>readMediaMetadata(event.currentTarget),
                    preload: "metadata",
                    src: url
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1584,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "truncate font-mono text-[9px] text-slate-300",
                    children: details
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                    lineNumber: 1592,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
            lineNumber: 1582,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$video$2d$player$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AigcVideoPlayer"], {
        initialMetadata: metadata,
        mimeType: asset?.mime_type ?? null,
        name: name,
        url: url
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1598,
        columnNumber: 5
    }, this);
}
_s5(NodeInputMedia, "tX2e3eqfQVmCCKsClo8h4woK3gg=");
_c12 = NodeInputMedia;
function mediaDetails(asset, metadata, kind) {
    const values = [];
    if (kind === "video" && metadata.width && metadata.height) {
        values.push(`${metadata.width} × ${metadata.height}`);
    }
    if (metadata.duration !== null) values.push(formatDuration(metadata.duration));
    if (asset?.mime_type) values.push(asset.mime_type);
    return values.join(" · ") || "元数据读取中";
}
function metadataNumber(asset, key) {
    const value = asset?.metadata[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60 * 10) / 10;
    return minutes > 0 ? `${minutes}:${String(remainder).padStart(4, "0")}` : `${remainder}s`;
}
function modalityNodeType(node) {
    const type = node.type;
    return type === "audio" || type === "image" || type === "text" || type === "video" ? type : null;
}
function modalityHandle(modality) {
    return modality;
}
function modalityStateText(projection, modality) {
    const label = {
        audio: "音频",
        image: "图片",
        text: "文本",
        video: "视频"
    }[modality];
    if (!projection || [
        "idle",
        "ready",
        "queued",
        "running"
    ].includes(projection.status)) {
        return `等待上游${label}结果`;
    }
    if ([
        "blocked",
        "canceled",
        "failed",
        "timed_out"
    ].includes(projection.status)) {
        return `上游${label}生成失败`;
    }
    if (!projection.available && modality !== "text") {
        return `上游${label}结果不可用`;
    }
    return `等待上游${label}结果`;
}
function resultMetadataNumber(asset, key) {
    const value = asset?.metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function downloadKindLabel(node) {
    if (node.type === "audio") return "音频";
    if (node.type === "video" || node.type === "video_generation" || node.type === "multi_track_edit") {
        return "视频";
    }
    return "图片";
}
function mediaInputKind(node) {
    if (node.type === "image") return "image";
    if (node.type === "video") return "video";
    if (node.type === "audio") return "audio";
    return null;
}
function localMediaAssetId(node) {
    if (mediaInputKind(node) === null) return null;
    const assetId = node.config.asset_id;
    return typeof assetId === "string" ? assetId : null;
}
function assetName(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function nodeSummary(node) {
    if (node.type === "text") {
        const config = node.config;
        const referenceCount = config.bbox_references?.length ?? 0;
        const text = config.text || "配置输入文本";
        return referenceCount > 0 ? `${text} · ${referenceCount} 个区域引用` : text;
    }
    if (node.type === "image") {
        const assetId = localMediaAssetId(node);
        return assetId ? `资产 ${assetId}` : "选择或上传图片";
    }
    if (node.type === "video" || node.type === "audio") {
        const assetId = localMediaAssetId(node);
        return assetId ? `资产 ${assetId}` : "尚未选择素材";
    }
    if (node.type === "llm") return node.config.model;
    if (node.type === "video_generation") {
        const taskType = node.config.generation_mode === "multimodal_reference" ? ` · ${node.config.task_type ?? "generate"}` : "";
        return `${node.config.model} · ${node.config.generation_mode}${taskType}`;
    }
    if (node.type === "video_enhancement") {
        const resolution = node.config.resolution_mode === "preset" ? node.config.resolution.toUpperCase() : `短边 ${node.config.resolution_limit}px`;
        const version = node.config.tool_version === "professional" ? "专业版" : "标准版";
        const fps = node.config.fps === null ? "原帧率" : `${node.config.fps} FPS`;
        const style = node.config.enhance_style === "hd" ? "高清" : "自然";
        return `${version} · ${resolution} · ${fps} · ${style}`;
    }
    if (node.type === "video_face_blur") {
        return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurModeLabel"])(node.config.mask_mode)} · ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoFaceBlurStrengthLabel"])(node.config.mask_strength)}`;
    }
    if (node.type === "video_subtitle_extraction") {
        return "硬字幕 OCR · SRT";
    }
    if (node.type === "multi_track_edit") return "多轨剪辑工程";
    if (node.type === "json_parser") return node.config.json_path;
    if (node.type === "layer_canvas") {
        return node.config.selected_layer_id ? `已选择图层 ${node.config.selected_layer_id}` : "尚未选择图层";
    }
    if (node.type === "layer_composite") return "替换指定图层并合成图片";
    if (node.type === "image_to_image") {
        return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageTitle"])(node)} · ${node.config.model} · ${node.config.size}`;
    }
    return `${node.config.model} · ${node.config.aspect_ratio} · ${node.config.size}`;
}
function VideoEnhancementCostBadges({ node }) {
    const labels = [
        node.config.tool_version === "professional" ? "高成本 · 专业版" : null,
        node.config.resolution_mode === "preset" && (node.config.resolution === "4k" || node.config.resolution === "8k") ? `高成本 · ${node.config.resolution.toUpperCase()}` : null,
        node.config.bit_depth >= 12 ? `高成本 · ${node.config.bit_depth}-bit` : null
    ].filter((label)=>Boolean(label));
    if (labels.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mb-2 flex flex-wrap gap-1",
        "aria-label": "高成本配置",
        children: labels.map((label)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "rounded border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[9px] font-semibold text-orange-900",
                children: label
            }, label, false, {
                fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
                lineNumber: 1802,
                columnNumber: 9
            }, this))
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1800,
        columnNumber: 5
    }, this);
}
_c13 = VideoEnhancementCostBadges;
function InlineNodeNameInput({ initialValue, onCancel, onSave }) {
    _s6();
    const [draft, setDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialValue);
    const inputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const canceledRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "InlineNodeNameInput.useEffect": ()=>{
            const frame = requestAnimationFrame({
                "InlineNodeNameInput.useEffect.frame": ()=>{
                    inputRef.current?.focus();
                    inputRef.current?.select();
                }
            }["InlineNodeNameInput.useEffect.frame"]);
            return ({
                "InlineNodeNameInput.useEffect": ()=>cancelAnimationFrame(frame)
            })["InlineNodeNameInput.useEffect"];
        }
    }["InlineNodeNameInput.useEffect"], []);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        "aria-label": "节点名称",
        className: "nodrag nowheel min-w-0 flex-1 border border-blue-500 bg-[#101318] px-1.5 py-0.5 text-[11px] font-medium text-foreground outline-none",
        "data-testid": "aigc-node-name-input",
        maxLength: 120,
        onBlur: ()=>{
            if (canceledRef.current) return;
            onSave(draft);
        },
        onChange: (event)=>setDraft(event.target.value),
        onClick: (event)=>event.stopPropagation(),
        onKeyDown: (event)=>{
            event.stopPropagation();
            if (event.key === "Enter") {
                event.preventDefault();
                onSave(draft);
            } else if (event.key === "Escape") {
                event.preventDefault();
                canceledRef.current = true;
                onCancel();
            }
        },
        ref: inputRef,
        value: draft
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-flow-node.tsx",
        lineNumber: 1834,
        columnNumber: 5
    }, this);
}
_s6(InlineNodeNameInput, "2BWPsWRWAjAwL5l/jLH0LoMlr64=");
_c14 = InlineNodeNameInput;
const AigcFlowNodeCard = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memo"])(AigcFlowNodeComponent);
_c15 = AigcFlowNodeCard;
var _c, _c1, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c10, _c11, _c12, _c13, _c14, _c15;
__turbopack_context__.k.register(_c, "AigcFlowNodeComponent");
__turbopack_context__.k.register(_c1, "LlmImageInputSummary");
__turbopack_context__.k.register(_c2, "NodeActions");
__turbopack_context__.k.register(_c3, "ModalityTextBody");
__turbopack_context__.k.register(_c4, "JsonParserNodeBody");
__turbopack_context__.k.register(_c5, "LayerCompositeNodeBody");
__turbopack_context__.k.register(_c6, "CompositeInputState");
__turbopack_context__.k.register(_c7, "LayerCanvasNodeBody");
__turbopack_context__.k.register(_c8, "MultiTrackEditNodeBody");
__turbopack_context__.k.register(_c9, "ContinueFromLayerNodeButton");
__turbopack_context__.k.register(_c10, "VideoGenerationSummary");
__turbopack_context__.k.register(_c11, "NodeImageMedia");
__turbopack_context__.k.register(_c12, "NodeInputMedia");
__turbopack_context__.k.register(_c13, "VideoEnhancementCostBadges");
__turbopack_context__.k.register(_c14, "InlineNodeNameInput");
__turbopack_context__.k.register(_c15, "AigcFlowNodeCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcImageDimensionsField",
    ()=>AigcImageDimensionsField
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/image-dimensions.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function AigcImageDimensionsField({ config, nodeId, onChange }) {
    _s();
    const presetMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(config.size);
    const [draftOverride, setDraftOverride] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const draft = draftOverride?.size === config.size ? draftOverride : draftFromSize(config.size);
    const errors = validateDimensionDraft(draft);
    function selectCustomMode() {
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(config.size)) return;
        const dimensions = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDREAM_COMMON_IMAGE_DIMENSIONS"][config.size][config.aspect_ratio];
        const next = {
            height: String(dimensions.height),
            width: String(dimensions.width)
        };
        setDraftOverride({
            ...next,
            size: dimensions.size
        });
        onChange({
            ...config,
            size: dimensions.size
        });
    }
    function selectPresetMode() {
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(config.size)) return;
        onChange({
            ...config,
            size: "2K"
        });
    }
    function updateDraft(key, value) {
        const next = {
            ...draft,
            [key]: value
        };
        const rawSize = `${next.width}x${next.height}`;
        let size = rawSize;
        try {
            size = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamCustomImageSize"])(rawSize);
        } catch  {
        // Invalid intermediate input stays in the draft definition so save/run
        // validation cannot silently fall back to the previous valid size.
        }
        setDraftOverride({
            ...next,
            size
        });
        onChange({
            ...config,
            size
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "min-w-0 space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs font-medium text-muted-foreground",
                        children: "尺寸方式"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 82,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        "aria-label": "尺寸方式",
                        className: "mt-1 grid min-w-0 grid-cols-2 rounded-md border border-input bg-muted/40 p-0.5",
                        role: "group",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DimensionModeButton, {
                                active: presetMode,
                                label: "分辨率档位",
                                onClick: selectPresetMode
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                                lineNumber: 90,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DimensionModeButton, {
                                active: !presetMode,
                                label: "自定义像素",
                                onClick: selectCustomMode
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                                lineNumber: 95,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 81,
                columnNumber: 7
            }, this),
            presetMode ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                        label: "画幅",
                        onChange: (value)=>onChange({
                                ...config,
                                aspect_ratio: value
                            }),
                        options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDREAM_IMAGE_ASPECT_RATIOS"],
                        value: config.aspect_ratio
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 105,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                        label: "分辨率档位",
                        onChange: (value)=>onChange({
                                ...config,
                                size: value
                            }),
                        options: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDREAM_IMAGE_PRESET_SIZES"],
                        value: config.size
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 116,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 104,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2",
                "data-testid": "aigc-custom-dimensions-grid",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DimensionInput, {
                        error: errors.width,
                        id: `${nodeId}-image-width`,
                        label: "宽度",
                        onChange: (value)=>updateDraft("width", value),
                        value: draft.width
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 133,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(DimensionInput, {
                        error: errors.height,
                        id: `${nodeId}-image-height`,
                        label: "高度",
                        onChange: (value)=>updateDraft("height", value),
                        value: draft.height
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 140,
                        columnNumber: 11
                    }, this),
                    errors.combined ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "min-w-0 text-[10px] leading-4 text-destructive sm:col-span-2",
                        role: "alert",
                        children: errors.combined
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 148,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 129,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SelectField, {
                label: "输出格式",
                onChange: (value)=>onChange({
                        ...config,
                        format: value
                    }),
                options: [
                    {
                        label: "PNG",
                        value: "png"
                    },
                    {
                        label: "JPEG",
                        value: "jpeg"
                    }
                ],
                value: config.format
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
        lineNumber: 80,
        columnNumber: 5
    }, this);
}
_s(AigcImageDimensionsField, "dgr6e7djwgT+UZ8SOPGLfrF5Md4=");
_c = AigcImageDimensionsField;
function DimensionModeButton({ active, label, onClick }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        "aria-pressed": active,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("min-w-0 rounded px-2 py-2 text-[11px] font-semibold transition-colors", active ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"),
        onClick: onClick,
        type: "button",
        children: label
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
        lineNumber: 183,
        columnNumber: 5
    }, this);
}
_c1 = DimensionModeButton;
function DimensionInput({ error, id, label, onChange, value }) {
    const errorId = `${id}-error`;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "min-w-0 text-xs font-medium text-muted-foreground",
        htmlFor: id,
        children: [
            label,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                "aria-describedby": error ? errorId : undefined,
                "aria-invalid": Boolean(error),
                className: "mt-1 h-9 min-w-0 w-full text-xs text-foreground",
                id: id,
                inputMode: "numeric",
                min: 1,
                onChange: (event)=>onChange(event.currentTarget.value),
                step: 1,
                type: "number",
                value: value
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 219,
                columnNumber: 7
            }, this),
            error ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "mt-1 block text-[10px] leading-4 text-destructive",
                id: errorId,
                children: error
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 232,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
        lineNumber: 214,
        columnNumber: 5
    }, this);
}
_c2 = DimensionInput;
function SelectField({ label, onChange, options, value }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "min-w-0 text-xs font-medium text-muted-foreground",
        children: [
            label,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                className: "mt-1 h-9 min-w-0 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground",
                onChange: (event)=>onChange(event.currentTarget.value),
                value: value,
                children: options.map((option)=>{
                    const item = typeof option === "string" ? {
                        label: option,
                        value: option
                    } : option;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                        value: item.value,
                        children: item.label
                    }, item.value, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                        lineNumber: 268,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
                lineNumber: 257,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-image-dimensions-field.tsx",
        lineNumber: 255,
        columnNumber: 5
    }, this);
}
_c3 = SelectField;
function draftFromSize(size) {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size)) {
        return {
            height: "",
            width: ""
        };
    }
    const separator = size.indexOf("x");
    if (separator < 0) return {
        height: "",
        width: String(size)
    };
    return {
        height: size.slice(separator + 1),
        width: size.slice(0, separator)
    };
}
function validateDimensionDraft(draft) {
    const width = validateDimensionValue(draft.width, "宽度");
    const height = validateDimensionValue(draft.height, "高度");
    if (width || height) return {
        combined: null,
        height,
        width
    };
    try {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamCustomImageSize"])(`${draft.width}x${draft.height}`);
        return {
            combined: null,
            height: null,
            width: null
        };
    } catch (error) {
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SeedreamImageDimensionError"]) {
            if (error.code === "pixel_count_out_of_range") {
                return {
                    combined: "总像素必须在 921,600–4,624,220 之间",
                    height: null,
                    width: null
                };
            }
            if (error.code === "aspect_ratio_out_of_range") {
                return {
                    combined: "宽高比必须在 1:16–16:1 之间",
                    height: null,
                    width: null
                };
            }
        }
        return {
            combined: "图片尺寸格式必须为 WIDTHxHEIGHT",
            height: null,
            width: null
        };
    }
}
function validateDimensionValue(value, label) {
    if (value === "") return `请输入${label}`;
    if (!/^[0-9]+$/.test(value) || BigInt(value) === BigInt(0)) {
        return `${label}必须为正整数`;
    }
    return null;
}
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "AigcImageDimensionsField");
__turbopack_context__.k.register(_c1, "DimensionModeButton");
__turbopack_context__.k.register(_c2, "DimensionInput");
__turbopack_context__.k.register(_c3, "SelectField");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcMediaAssetDialog",
    ()=>AigcMediaAssetDialog,
    "mediaAssetName",
    ()=>mediaAssetName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/audio-lines.js [app-client] (ecmascript) <export default as AudioLines>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/search.js [app-client] (ecmascript) <export default as Search>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/video.js [app-client] (ecmascript) <export default as Video>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/badge.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/input.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
function AigcMediaAssetDialog({ assets, currentAssetId, isLoading, kind, label, getCompatibility, onSelect }) {
    _s();
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [pendingAssetId, setPendingAssetId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const currentAsset = assets.find((asset)=>asset.id === currentAssetId);
    const pendingAsset = assets.find((asset)=>asset.id === pendingAssetId);
    const pendingCompatibility = pendingAsset && getCompatibility ? getCompatibility(pendingAsset) : null;
    const filteredAssets = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcMediaAssetDialog.useMemo[filteredAssets]": ()=>{
            const keyword = query.trim().toLocaleLowerCase();
            const sorted = [
                ...assets
            ].sort({
                "AigcMediaAssetDialog.useMemo[filteredAssets].sorted": (left, right)=>Date.parse(right.created_at) - Date.parse(left.created_at)
            }["AigcMediaAssetDialog.useMemo[filteredAssets].sorted"]);
            if (!keyword) return sorted;
            return sorted.filter({
                "AigcMediaAssetDialog.useMemo[filteredAssets]": (asset)=>[
                        mediaAssetName(asset),
                        asset.id,
                        asset.mime_type ?? "",
                        mediaAssetSource(asset)
                    ].some({
                        "AigcMediaAssetDialog.useMemo[filteredAssets]": (value)=>value.toLocaleLowerCase().includes(keyword)
                    }["AigcMediaAssetDialog.useMemo[filteredAssets]"])
            }["AigcMediaAssetDialog.useMemo[filteredAssets]"]);
        }
    }["AigcMediaAssetDialog.useMemo[filteredAssets]"], [
        assets,
        query
    ]);
    function changeOpen(nextOpen) {
        setOpen(nextOpen);
        if (nextOpen) {
            setPendingAssetId(currentAsset?.id ?? null);
            setQuery("");
            return;
        }
        setPendingAssetId(null);
    }
    function confirmSelection() {
        if (!pendingAssetId) return;
        onSelect(pendingAssetId);
        changeOpen(false);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                className: "mt-1.5 w-full justify-start",
                disabled: isLoading,
                onClick: ()=>changeOpen(true),
                type: "button",
                variant: "outline",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this),
                    isLoading ? "正在加载资产..." : `从资产库选择${label}`
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("mt-2 rounded-md border px-3 py-2 text-xs", currentAsset ? "border-border bg-secondary/25" : currentAssetId ? "border-amber-400/45 bg-amber-50 text-amber-900" : "border-dashed border-border text-muted-foreground"),
                children: currentAsset ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "truncate font-medium text-foreground",
                            children: mediaAssetName(currentAsset)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 108,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-0.5 truncate text-[11px] text-muted-foreground",
                            children: mediaAssetDetails(currentAsset)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 111,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                    lineNumber: 107,
                    columnNumber: 11
                }, this) : currentAssetId ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "break-all",
                    children: [
                        "当前资产不可用 · ",
                        currentAssetId
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                    lineNumber: 116,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    children: [
                        "尚未选择",
                        label
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                    lineNumber: 118,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 96,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: changeOpen,
                open: open,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "grid h-[min(82dvh,760px)] w-[min(94vw,1100px)] max-w-[1100px] grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden p-0",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "border-b border-border px-6 py-5 pr-16",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    children: [
                                        "选择资产库",
                                        label
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                    lineNumber: 124,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    children: "通过缩略图和素材信息确认内容。选择仅在点击“确认选择”后生效。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 123,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-b border-border px-6 py-3",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "relative",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Search$3e$__["Search"], {
                                        className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                        lineNumber: 131,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$input$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Input"], {
                                        "aria-label": `搜索资产库${label}`,
                                        className: "pl-9",
                                        onChange: (event)=>setQuery(event.currentTarget.value),
                                        placeholder: "搜索名称、文件名或资产 ID",
                                        value: query
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                        lineNumber: 132,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                lineNumber: 130,
                                columnNumber: 13
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 129,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-h-0 overflow-y-auto px-6 py-5",
                            children: filteredAssets.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
                                children: filteredAssets.map((asset)=>{
                                    const selected = pendingAssetId === asset.id;
                                    const compatibility = getCompatibility?.(asset);
                                    const incompatible = compatibility?.state === "incompatible";
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        "aria-label": `选择${label}：${mediaAssetName(asset)}`,
                                        "aria-pressed": selected,
                                        disabled: incompatible,
                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("overflow-hidden rounded-md border bg-card text-left transition-colors hover:border-primary/40 hover:bg-secondary/20", incompatible && "cursor-not-allowed opacity-55", selected ? "border-primary ring-2 ring-primary/15" : "border-border"),
                                        onClick: ()=>setPendingAssetId(asset.id),
                                        type: "button",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MediaAssetPreview, {
                                                asset: asset,
                                                kind: kind
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                lineNumber: 164,
                                                columnNumber: 23
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "space-y-2 p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-start gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                className: "min-w-0 flex-1 truncate text-sm font-semibold text-foreground",
                                                                children: mediaAssetName(asset)
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                lineNumber: 167,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                "aria-hidden": "true",
                                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("grid h-5 w-5 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"),
                                                                children: selected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                                                                    className: "h-3 w-3"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                    lineNumber: 179,
                                                                    columnNumber: 41
                                                                }, this) : null
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                lineNumber: 170,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                        lineNumber: 166,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "truncate text-xs text-muted-foreground",
                                                        children: mediaAssetDetails(asset)
                                                    }, void 0, false, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                        lineNumber: 182,
                                                        columnNumber: 25
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "flex items-center justify-between gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "flex min-w-0 gap-1",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                        variant: "secondary",
                                                                        children: mediaAssetSource(asset)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                        lineNumber: 187,
                                                                        columnNumber: 29
                                                                    }, this),
                                                                    compatibility ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$badge$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Badge"], {
                                                                        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(compatibility.state === "available" && "border-success/35 text-success", compatibility.state === "pending" && "border-amber-400/45 text-amber-700", incompatible && "border-destructive/35 text-destructive"),
                                                                        variant: "outline",
                                                                        children: compatibility.message
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                        lineNumber: 191,
                                                                        columnNumber: 31
                                                                    }, this) : null
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                lineNumber: 186,
                                                                columnNumber: 27
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                className: "truncate text-[11px] text-muted-foreground",
                                                                children: formatAssetTime(asset.created_at)
                                                            }, void 0, false, {
                                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                                lineNumber: 206,
                                                                columnNumber: 27
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                        lineNumber: 185,
                                                        columnNumber: 25
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                                lineNumber: 165,
                                                columnNumber: 23
                                            }, this)
                                        ]
                                    }, asset.id, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                        lineNumber: 149,
                                        columnNumber: 21
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                lineNumber: 143,
                                columnNumber: 15
                            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid min-h-64 place-items-center rounded-md border border-dashed border-border bg-secondary/15 px-6 text-center",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MediaKindIcon, {
                                            className: "mx-auto h-10 w-10 text-muted-foreground",
                                            kind: kind
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                            lineNumber: 218,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-3 font-medium text-foreground",
                                            children: assets.length === 0 ? `暂无可选${label}` : "没有匹配的素材"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                            lineNumber: 222,
                                            columnNumber: 19
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-1 text-sm text-muted-foreground",
                                            children: assets.length === 0 ? `关闭弹窗后可使用“本地上传”添加${label}。` : "请尝试搜索其他名称、文件名或资产 ID。"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                            lineNumber: 227,
                                            columnNumber: 19
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                    lineNumber: 217,
                                    columnNumber: 17
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                lineNumber: 216,
                                columnNumber: 15
                            }, this)
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 141,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "border-t border-border px-6 py-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "min-w-0 text-left text-xs text-muted-foreground",
                                    children: pendingAsset ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "block max-w-80 truncate",
                                        children: [
                                            "已选择：",
                                            mediaAssetName(pendingAsset)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                        lineNumber: 239,
                                        columnNumber: 17
                                    }, this) : "请选择一个素材"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                    lineNumber: 237,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            onClick: ()=>changeOpen(false),
                                            type: "button",
                                            variant: "outline",
                                            children: "取消"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                            lineNumber: 247,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            disabled: !pendingAssetId || pendingCompatibility?.state === "incompatible",
                                            onClick: confirmSelection,
                                            type: "button",
                                            children: "确认选择"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                            lineNumber: 254,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                                    lineNumber: 246,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                            lineNumber: 236,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                    lineNumber: 122,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 121,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
        lineNumber: 85,
        columnNumber: 5
    }, this);
}
_s(AigcMediaAssetDialog, "2A9BTo/3AVBa4nP+XUZR/OyfNAA=");
_c = AigcMediaAssetDialog;
function MediaAssetPreview({ asset, kind }) {
    const previewUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(asset);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative grid aspect-video place-items-center overflow-hidden bg-slate-950",
        children: [
            kind === "image" && previewUrl ? // eslint-disable-next-line @next/next/no-img-element
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                alt: mediaAssetName(asset),
                className: "absolute inset-0 block h-full w-full object-contain",
                loading: "lazy",
                src: previewUrl
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 284,
                columnNumber: 9
            }, this) : kind === "video" && previewUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                "aria-label": `视频缩略图：${mediaAssetName(asset)}`,
                className: "absolute inset-0 block h-full w-full object-contain",
                muted: true,
                playsInline: true,
                preload: "metadata",
                src: previewUrl
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 291,
                columnNumber: 9
            }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid place-items-center gap-2 text-slate-300",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MediaKindIcon, {
                        className: "h-8 w-8",
                        kind: kind
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                        lineNumber: 301,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-xs",
                        children: mediaKindLabel(kind)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                        lineNumber: 302,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 300,
                columnNumber: 9
            }, this),
            kind === "video" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "pointer-events-none absolute inset-0 grid place-items-center",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "grid h-9 w-9 place-items-center rounded-full bg-slate-950/75 text-white",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                        lineNumber: 308,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                    lineNumber: 307,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 306,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "absolute bottom-2 right-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-white",
                children: mediaAssetMetric(asset)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
                lineNumber: 312,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
        lineNumber: 281,
        columnNumber: 5
    }, this);
}
_c1 = MediaAssetPreview;
function MediaKindIcon({ className, kind }) {
    if (kind === "image") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"], {
        className: className
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
        lineNumber: 326,
        columnNumber: 32
    }, this);
    if (kind === "audio") return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$audio$2d$lines$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AudioLines$3e$__["AudioLines"], {
        className: className
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
        lineNumber: 327,
        columnNumber: 32
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$video$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Video$3e$__["Video"], {
        className: className
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-media-asset-dialog.tsx",
        lineNumber: 328,
        columnNumber: 10
    }, this);
}
_c2 = MediaKindIcon;
function mediaAssetName(asset) {
    for (const key of [
        "name",
        "filename",
        "file_name",
        "title"
    ]){
        const value = asset.metadata?.[key];
        if (typeof value === "string" && value.trim() && !looksLikeOpaqueId(value.trim())) {
            return value.trim();
        }
    }
    const kind = mediaKindLabelFromAsset(asset);
    const time = formatAssetTime(asset.created_at);
    return time === "时间未知" ? `${kind}素材` : `${kind}素材 · ${time}`;
}
function mediaAssetDetails(asset) {
    const values = [
        mediaKindLabelFromAsset(asset),
        ...mediaAssetMetrics(asset),
        `ID ${asset.id.slice(0, 8)}`
    ];
    if (asset.mime_type) values.push(asset.mime_type);
    return values.filter(Boolean).join(" · ");
}
function mediaAssetMetric(asset) {
    return mediaAssetMetrics(asset)[0] ?? "规格未知";
}
function mediaAssetMetrics(asset) {
    const values = [];
    const width = metadataNumber(asset, "width");
    const height = metadataNumber(asset, "height");
    if (width && height) values.push(`${width} × ${height}`);
    const duration = metadataNumber(asset, "duration_seconds") ?? metadataNumber(asset, "duration");
    if (duration !== null) values.push(formatDuration(duration));
    if (asset.size_bytes) values.push(formatBytes(asset.size_bytes));
    return values;
}
function mediaKindLabel(kind) {
    if (kind === "image") return "图片";
    if (kind === "audio") return "音频";
    return "视频";
}
function mediaKindLabelFromAsset(asset) {
    if (asset.mime_type?.startsWith("image/")) return "图片";
    if (asset.mime_type?.startsWith("audio/")) return "音频";
    return "视频";
}
function mediaAssetSource(asset) {
    if (asset.project_id) return "项目资产";
    if (asset.tool_task_id) return "工具资产";
    if (asset.metadata?.origin === "aigc") return "AIGC 资产";
    return "公共资产";
}
function metadataNumber(asset, key) {
    const value = asset.metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
function formatDuration(seconds) {
    const rounded = Math.round(seconds);
    const minutes = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    return minutes > 0 ? `${minutes}:${String(remainder).padStart(2, "0")}` : `${rounded}s`;
}
function formatBytes(bytes) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatAssetTime(value) {
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "时间未知";
    return new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Shanghai"
    }).format(timestamp);
}
function looksLikeOpaqueId(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) || /^[0-9a-f]{24,}$/i.test(value);
}
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "AigcMediaAssetDialog");
__turbopack_context__.k.register(_c1, "MediaAssetPreview");
__turbopack_context__.k.register(_c2, "MediaKindIcon");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcPreciseEditDialog",
    ()=>AigcPreciseEditDialog
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/rotate-ccw.js [app-client] (ecmascript) <export default as RotateCcw>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scan$2d$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScanSearch$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/scan-search.js [app-client] (ecmascript) <export default as ScanSearch>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$bbox$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/bbox-canvas.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/bbox-references.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
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
function AigcPreciseEditDialog({ assetId, assetName, bboxState, compactTrigger = false, sourceMode, node, url }) {
    _s();
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPreciseEditDialog.useAigcEditorStore[definition]": (state)=>state.definition
    }["AigcPreciseEditDialog.useAigcEditorStore[definition]"]);
    const mode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPreciseEditDialog.useAigcEditorStore[mode]": (state)=>state.mode
    }["AigcPreciseEditDialog.useAigcEditorStore[mode]"]);
    const setBindings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPreciseEditDialog.useAigcEditorStore[setBindings]": (state)=>state.setImageBboxBindings
    }["AigcPreciseEditDialog.useAigcEditorStore[setBindings]"]);
    const [open, setOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [draftBbox, setDraftBbox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [selectedTextNodeIds, setSelectedTextNodeIds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(new Set());
    const [openedAssetId, setOpenedAssetId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [submitError, setSubmitError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const graphNodes = definition.nodes;
    const textNodes = graphNodes.filter((candidate)=>candidate.type === "text");
    const displayNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes);
    const eligibleIds = new Set((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["eligibleBboxTextTargets"])(definition, node.id, sourceMode === "upstream" ? assetId : undefined).map((candidate)=>candidate.id));
    const canOpen = mode === "pipeline" && Boolean(assetId && url);
    const configuredBbox = sourceMode === "upstream" ? node.config.upstream_bbox ?? null : node.config.bbox;
    const canConfirm = configuredBbox && draftBbox === null ? true : Boolean(draftBbox && selectedTextNodeIds.size > 0);
    function openEditor() {
        if (!canOpen) return;
        setOpenedAssetId(assetId);
        setSubmitError(null);
        setDraftBbox(bboxState === "valid" ? sourceMode === "upstream" ? node.config.upstream_bbox ?? null : node.config.bbox : null);
        setSelectedTextNodeIds(new Set(textNodes.filter((candidate)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(candidate).some((reference)=>reference.source_node_id === node.id)).map((candidate)=>candidate.id)));
        setOpen(true);
    }
    function toggleTarget(textNode) {
        setSelectedTextNodeIds((current)=>{
            const next = new Set(current);
            if (next.has(textNode.id)) next.delete(textNode.id);
            else next.add(textNode.id);
            return next;
        });
    }
    function confirm() {
        if (!canConfirm) return;
        if (!assetId || openedAssetId !== assetId) {
            setDraftBbox(null);
            setSubmitError("上游图片已更新，请重新框选");
            return;
        }
        setBindings(node.id, draftBbox, [
            ...selectedTextNodeIds
        ], {
            assetId,
            mode: sourceMode
        });
        setOpen(false);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                "aria-label": `精准编辑：${assetName}`,
                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("nodrag grid shrink-0 place-items-center rounded text-muted-foreground hover:bg-card hover:text-primary disabled:cursor-not-allowed disabled:opacity-40", compactTrigger ? "h-[10px] w-[10px]" : "h-6 w-6"),
                disabled: !canOpen,
                onClick: (event)=>{
                    event.stopPropagation();
                    openEditor();
                },
                title: canOpen ? "精准编辑" : sourceMode === "local" ? "选择图片后可精准编辑" : "等待可用的上游图片结果",
                type: "button",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$scan$2d$search$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ScanSearch$3e$__["ScanSearch"], {
                    className: compactTrigger ? "h-[6px] w-[6px]" : "h-3.5 w-3.5"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                    lineNumber: 155,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                lineNumber: 135,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                onOpenChange: setOpen,
                open: open,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "grid h-[92dvh] w-[96vw] max-w-[96vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:rounded-lg",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "border-b border-border px-5 py-4 pr-14",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    children: [
                                        "精准编辑 · ",
                                        assetName
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 164,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    children: "框选一个主体，并引用到与该图片共享图生图下游的文本节点。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 165,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                            lineNumber: 163,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid min-h-0 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1.7fr)_20rem] lg:overflow-hidden",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex min-h-[24rem] min-w-0 flex-col bg-slate-950",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex h-11 shrink-0 items-center justify-between border-b border-white/10 px-3 text-white",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-xs font-semibold",
                                                    children: "框选主体"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                    lineNumber: 172,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                                    className: "text-slate-200 hover:bg-white/10 hover:text-white",
                                                    onClick: ()=>setDraftBbox(null),
                                                    size: "sm",
                                                    type: "button",
                                                    variant: "ghost",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$rotate$2d$ccw$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__RotateCcw$3e$__["RotateCcw"], {
                                                            className: "h-4 w-4"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                            lineNumber: 180,
                                                            columnNumber: 19
                                                        }, this),
                                                        "重置"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                    lineNumber: 173,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 171,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "min-h-0 flex-1 p-4",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$bbox$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BboxCanvas"], {
                                                alt: `精准编辑：${assetName}`,
                                                bbox: draftBbox,
                                                className: "h-full min-h-[20rem] w-full border-slate-700",
                                                disabled: false,
                                                fillImageBox: true,
                                                onChange: setDraftBbox,
                                                url: url
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                lineNumber: 185,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 184,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 170,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                                    className: "border-t border-border bg-card p-4 lg:overflow-y-auto lg:border-l lg:border-t-0",
                                    children: [
                                        bboxState === "stale" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mb-4 border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs text-amber-200",
                                            role: "status",
                                            children: "上游图片已更新，请重新框选"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 198,
                                            columnNumber: 17
                                        }, this) : null,
                                        submitError ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mb-4 border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive",
                                            role: "alert",
                                            children: submitError
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 206,
                                            columnNumber: 17
                                        }, this) : null,
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mb-4",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-xs font-semibold text-foreground",
                                                    children: "当前框选"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                    lineNumber: 214,
                                                    columnNumber: 17
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "mt-1 font-mono text-[10px] text-muted-foreground",
                                                    children: draftBbox ? `${draftBbox.x1} ${draftBbox.y1} ${draftBbox.x2} ${draftBbox.y2}` : "尚未框选"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                    lineNumber: 215,
                                                    columnNumber: 17
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 213,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mb-2 text-xs font-semibold text-foreground",
                                            children: "引用到文本节点"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 221,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "space-y-2",
                                            children: textNodes.length > 0 ? textNodes.map((textNode)=>{
                                                const eligible = eligibleIds.has(textNode.id);
                                                const alreadySelected = selectedTextNodeIds.has(textNode.id);
                                                const hasExistingReference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(textNode).some((reference)=>reference.source_node_id === node.id);
                                                const atLimit = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(textNode).length >= __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_MAX_BBOX_REFERENCES"] && !hasExistingReference;
                                                const disabled = !eligible || atLimit;
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex items-start gap-2 border border-border p-2.5 text-xs", alreadySelected && "border-primary/50 bg-primary/[0.05]", disabled ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-primary/35"),
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                            checked: alreadySelected,
                                                            className: "mt-0.5 h-4 w-4 accent-primary",
                                                            disabled: disabled,
                                                            onChange: ()=>toggleTarget(textNode),
                                                            type: "checkbox"
                                                        }, void 0, false, {
                                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                            lineNumber: 247,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                            className: "min-w-0",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "block truncate font-semibold",
                                                                    children: displayNames.get(textNode.id)?.displayName ?? "文本节点"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                                    lineNumber: 255,
                                                                    columnNumber: 27
                                                                }, this),
                                                                textNode.config.text.trim() ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "mt-0.5 block truncate text-[10px] text-muted-foreground",
                                                                    children: textNode.config.text.trim()
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                                    lineNumber: 260,
                                                                    columnNumber: 29
                                                                }, this) : null,
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                                    className: "mt-0.5 block text-[10px] text-muted-foreground",
                                                                    children: !eligible ? "不满足共同图生图下游规则" : atLimit ? "已达到 10 条引用上限" : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(textNode).length}/10 条引用`
                                                                }, void 0, false, {
                                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                                    lineNumber: 264,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                            lineNumber: 254,
                                                            columnNumber: 25
                                                        }, this)
                                                    ]
                                                }, textNode.id, true, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                    lineNumber: 237,
                                                    columnNumber: 23
                                                }, this);
                                            }) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground",
                                                children: "暂无文本输入节点。先完成图片、文本与图生图节点连线。"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                                lineNumber: 276,
                                                columnNumber: 19
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 224,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 196,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                            lineNumber: 169,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex flex-col items-stretch gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-[11px] text-muted-foreground",
                                    children: "坐标由框选生成，保存后自动同步到所有引用。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 284,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex shrink-0 justify-end gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            onClick: ()=>setOpen(false),
                                            type: "button",
                                            variant: "outline",
                                            children: "取消"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 288,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            disabled: !canConfirm,
                                            onClick: confirm,
                                            type: "button",
                                            children: draftBbox ? `引用到 ${selectedTextNodeIds.size} 个节点` : "清除框选"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                            lineNumber: 291,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                                    lineNumber: 287,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                            lineNumber: 283,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                    lineNumber: 162,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
                lineNumber: 161,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-precise-edit-dialog.tsx",
        lineNumber: 134,
        columnNumber: 5
    }, this);
}
_s(AigcPreciseEditDialog, "V/S7gpI4Zf2fFhjHqAszvVyIhys=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"]
    ];
});
_c = AigcPreciseEditDialog;
var _c;
__turbopack_context__.k.register(_c, "AigcPreciseEditDialog");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-prompt-editor.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcPromptEditor",
    ()=>AigcPromptEditor
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQueries.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$expand$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Expand$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/expand.js [app-client] (ecmascript) <export default as Expand>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wand-sparkles.js [app-client] (ecmascript) <export default as WandSparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/label.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/bbox-references.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/aigc/aigc-run-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/result-projection.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$prompt$2d$optimization$2d$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/prompt-optimization-context.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
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
const MAX_INSTRUCTION_CODE_POINTS = 4000;
const MAX_DIRECTION_CODE_POINTS = 2000;
function AigcPromptEditor({ node, runDetail: runDetailProp }) {
    _s();
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPromptEditor.useAigcEditorStore[definition]": (state)=>state.definition
    }["AigcPromptEditor.useAigcEditorStore[definition]"]);
    const store = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStoreApi"])();
    const runContext = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunProjection"])(node.id);
    const runDetail = runDetailProp !== undefined ? runDetailProp : runContext;
    const graphDefinition = definition;
    const currentNode = graphDefinition.nodes.find((candidate)=>candidate.id === node.id && candidate.type === "text");
    const activeNode = currentNode ?? node;
    const update = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPromptEditor.useAigcEditorStore[update]": (state)=>state.updateNodeConfig
    }["AigcPromptEditor.useAigcEditorStore[update]"]);
    const applyOptimizedPrompt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPromptEditor.useAigcEditorStore[applyOptimizedPrompt]": (state)=>state.applyOptimizedTextPrompt
    }["AigcPromptEditor.useAigcEditorStore[applyOptimizedPrompt]"]);
    const updateInstruction = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPromptEditor.useAigcEditorStore[updateInstruction]": (state)=>state.updateBboxReferenceInstruction
    }["AigcPromptEditor.useAigcEditorStore[updateInstruction]"]);
    const removeReference = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"])({
        "AigcPromptEditor.useAigcEditorStore[removeReference]": (state)=>state.removeBboxReference
    }["AigcPromptEditor.useAigcEditorStore[removeReference]"]);
    const [validationMessage, setValidationMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [optimizationMessage, setOptimizationMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isOptimizing, setIsOptimizing] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [dialogOpen, setDialogOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [fullscreenEditorOpen, setFullscreenEditorOpen] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [fullscreenDraft, setFullscreenDraft] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [fullscreenOpeningValue, setFullscreenOpeningValue] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [optimizationOrigin, setOptimizationOrigin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("inspector");
    const [direction, setDirection] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const [targetNodeId, setTargetNodeId] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const mountedRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    const runDetailRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(runDetail);
    const optimizationAbortRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fullscreenEditorTriggerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const fullscreenOpeningValueRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])("");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcPromptEditor.useEffect": ()=>{
            runDetailRef.current = runDetail;
        }
    }["AigcPromptEditor.useEffect"], [
        runDetail
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcPromptEditor.useEffect": ()=>{
            mountedRef.current = true;
            return ({
                "AigcPromptEditor.useEffect": ()=>{
                    mountedRef.current = false;
                    optimizationAbortRef.current?.abort();
                }
            })["AigcPromptEditor.useEffect"];
        }
    }["AigcPromptEditor.useEffect"], []);
    const references = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(activeNode);
    const displayNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(graphDefinition.nodes);
    const sources = references.map((reference)=>graphDefinition.nodes.find((candidate)=>candidate.id === reference.source_node_id));
    const sourceBboxBindings = sources.map((source)=>{
        if (source?.type !== "image") return null;
        const usesUpstream = graphDefinition.edges.some((edge)=>edge.targetNodeId === source.id && edge.targetHandle === "image");
        const projection = runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcModalityRunResult"])(runDetail, source.id) : null;
        const effectiveAssetId = usesUpstream ? projection?.asset?.available ? projection.asset.asset_id : null : source.config.asset_id;
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcImageBboxBinding"])(graphDefinition, source.id, effectiveAssetId);
    });
    // #region debug-point A-D:reference-resolution
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AigcPromptEditor.useEffect": ()=>{
            fetch("http://127.0.0.1:7778/event", {
                body: JSON.stringify({
                    data: {
                        definitionNodeIds: graphDefinition.nodes.map({
                            "AigcPromptEditor.useEffect": (candidate)=>candidate.id
                        }["AigcPromptEditor.useEffect"]),
                        references: references.map({
                            "AigcPromptEditor.useEffect": (reference, index)=>{
                                const source = sources[index];
                                return {
                                    bbox: source?.type === "image" ? source.config.bbox : null,
                                    bboxAssetId: source?.type === "image" ? source.config.bbox_asset_id : null,
                                    bindingState: sourceBboxBindings[index]?.state ?? null,
                                    effectiveBbox: sourceBboxBindings[index]?.bbox ?? null,
                                    incomingEdges: graphDefinition.edges.filter({
                                        "AigcPromptEditor.useEffect": (edge)=>edge.targetNodeId === reference.source_node_id
                                    }["AigcPromptEditor.useEffect"]),
                                    sourceExists: Boolean(source),
                                    sourceNodeId: reference.source_node_id,
                                    sourceType: source?.type ?? null,
                                    upstreamBbox: source?.type === "image" ? source.config.upstream_bbox : null,
                                    upstreamBboxAssetId: source?.type === "image" ? source.config.upstream_bbox_asset_id : null
                                };
                            }
                        }["AigcPromptEditor.useEffect"]),
                        textNodeId: activeNode.id
                    },
                    hypothesisId: "A-D",
                    location: "aigc-prompt-editor.tsx:AigcPromptEditor",
                    msg: "[DEBUG] Resolved bbox prompt references",
                    runId: "post-fix",
                    sessionId: "bbox-reference-invalid",
                    traceId: activeNode.id
                }),
                method: "POST"
            }).catch({
                "AigcPromptEditor.useEffect": ()=>{}
            }["AigcPromptEditor.useEffect"]);
        }
    }["AigcPromptEditor.useEffect"], [
        activeNode.id,
        graphDefinition.edges,
        graphDefinition.nodes,
        references,
        sourceBboxBindings,
        sources
    ]);
    // #endregion
    const assetIds = sources.map((source)=>source?.type === "image" ? source.config.asset_id : null);
    const assetQueries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"])({
        queries: assetIds.map({
            "AigcPromptEditor.useQueries[assetQueries]": (assetId)=>({
                    enabled: Boolean(assetId),
                    queryFn: ({
                        "AigcPromptEditor.useQueries[assetQueries]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAsset(assetId)
                    })["AigcPromptEditor.useQueries[assetQueries]"],
                    queryKey: [
                        "aigc",
                        "image-asset",
                        assetId
                    ]
                })
        }["AigcPromptEditor.useQueries[assetQueries]"])
    });
    const upstream = graphDefinition.edges.some((edge)=>edge.targetNodeId === activeNode.id && edge.targetHandle === "text");
    const effectiveProjection = upstream && runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcEffectiveText"])(runDetail, graphDefinition, activeNode.id) : null;
    const effectiveText = upstream ? effectiveProjection?.text ?? "" : activeNode.config.text;
    const targets = promptOptimizationTargets(graphDefinition, activeNode.id);
    const selectedOptimizationTarget = targets.find((target)=>target.id === targetNodeId);
    const showsVideoReferenceMarkerHint = selectedOptimizationTarget?.node.type === "video_generation";
    const canEditText = !upstream || Boolean(effectiveProjection && [
        "reused",
        "succeeded"
    ].includes(effectiveProjection.status) && effectiveProjection.text !== null);
    const canOptimize = targets.length > 0 && Boolean(effectiveText.trim() || references.some((reference)=>reference.instruction.trim()));
    function updateText(value) {
        if (__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_COORDINATE_TAG_PATTERN"].test(value)) {
            setValidationMessage("坐标标签由框选生成，不能手工输入。");
            return false;
        }
        setValidationMessage(null);
        setOptimizationMessage(null);
        update(activeNode.id, {
            ...activeNode.config,
            ...upstream ? {
                upstream_text_override: value
            } : {
                text: value
            }
        });
        return true;
    }
    function openFullscreenEditor(trigger) {
        fullscreenEditorTriggerRef.current = trigger;
        fullscreenOpeningValueRef.current = effectiveText;
        setFullscreenOpeningValue(effectiveText);
        setFullscreenDraft(effectiveText);
        setFullscreenEditorOpen(true);
    }
    function closeFullscreenEditor() {
        setFullscreenEditorOpen(false);
        window.setTimeout(()=>{
            fullscreenEditorTriggerRef.current?.focus();
        }, 0);
    }
    function applyFullscreenText(value, expectedValue) {
        if (effectiveText !== expectedValue) {
            setValidationMessage("提示词内容已变化，请重新打开编辑器后再应用。");
            return false;
        }
        if (value === effectiveText) return true;
        return updateText(value);
    }
    function updateReferenceInstruction(sourceNodeId, value) {
        if (__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_COORDINATE_TAG_PATTERN"].test(value)) {
            setValidationMessage("坐标标签由框选生成，不能手工输入。");
            return;
        }
        setValidationMessage(null);
        setOptimizationMessage(null);
        updateInstruction(activeNode.id, sourceNodeId, truncateCodePoints(value, MAX_INSTRUCTION_CODE_POINTS));
    }
    function openOptimizationDialog(origin = "inspector") {
        const optimizationText = origin === "fullscreen" ? fullscreenDraft : effectiveText;
        if (targets.length === 0 || !(optimizationText.trim() || references.some((reference)=>reference.instruction.trim()))) {
            return;
        }
        setTargetNodeId((current)=>targets.some((target)=>target.id === current) ? current : targets[0]?.id ?? "");
        setOptimizationOrigin(origin);
        setOptimizationMessage(null);
        setDialogOpen(true);
    }
    async function optimizePrompt() {
        const selectedTarget = targets.find((target)=>target.id === targetNodeId);
        const sourceText = optimizationOrigin === "fullscreen" ? fullscreenDraft : effectiveText;
        const expectedEffectiveText = optimizationOrigin === "fullscreen" ? fullscreenOpeningValueRef.current : effectiveText;
        const canOptimizeSource = targets.length > 0 && Boolean(sourceText.trim() || references.some((reference)=>reference.instruction.trim()));
        if (!canOptimizeSource || !selectedTarget || isOptimizing) return;
        const editorState = store.getState();
        const requestDefinition = editorState.definition;
        const expected = {
            bbox_references: references.map((reference)=>({
                    ...reference
                })),
            text: activeNode.config.text,
            title: activeNode.config.title,
            upstream_text_override: activeNode.config.upstream_text_override ?? null
        };
        const request = buildPromptOptimizationRequest(requestDefinition, selectedTarget.node, sourceText, direction, references.map((reference)=>reference.instruction), editorState.mode === "pipeline" && editorState.entityId ? {
            baseRevision: editorState.revision,
            pipelineId: editorState.entityId,
            runDetail
        } : null);
        const requestSnapshot = promptOptimizationSnapshot(requestDefinition, activeNode.id, runDetail?.run.id ?? null, request, expected);
        const controller = new AbortController();
        optimizationAbortRef.current?.abort();
        optimizationAbortRef.current = controller;
        setIsOptimizing(true);
        setOptimizationMessage(null);
        setValidationMessage(null);
        try {
            const result = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].optimizeAigcPrompt(request, {
                signal: controller.signal
            });
            if (!mountedRef.current || controller.signal.aborted) return;
            const latestState = store.getState();
            const latestDefinition = latestState.definition;
            const latestNode = latestDefinition.nodes.find((candidate)=>candidate.id === activeNode.id);
            const latestTarget = latestDefinition.nodes.find((candidate)=>candidate.id === selectedTarget.id);
            if (latestNode?.type !== "text" || !latestTarget || promptOptimizationSnapshot(latestDefinition, activeNode.id, runDetailRef.current?.run.id ?? null, buildPromptOptimizationRequest(latestDefinition, latestTarget, sourceText, direction, (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["bboxReferences"])(latestNode).map((reference)=>reference.instruction), latestState.mode === "pipeline" && latestState.entityId ? {
                baseRevision: latestState.revision,
                pipelineId: latestState.entityId,
                runDetail: runDetailRef.current
            } : null), latestNode.config) !== requestSnapshot || effectiveTextForSnapshot(latestDefinition, latestNode, runDetailRef.current) !== expectedEffectiveText) {
                setOptimizationMessage({
                    kind: "info",
                    text: "文本、Run、目标配置或连线已变化，本次优化结果未应用。"
                });
                return;
            }
            const status = optimizationOrigin === "fullscreen" ? result.optimized_text === sourceText ? "unchanged" : "updated" : applyOptimizedPrompt(activeNode.id, expected, result.optimized_text, result.optimized_reference_instructions, request.target_type === "text_to_image" || request.target_type === "image_to_image");
            if (status === "stale") {
                setOptimizationMessage({
                    kind: "info",
                    text: "提示词已发生变化，本次优化结果未应用，请重新优化。"
                });
            } else if (status === "unchanged") {
                setOptimizationMessage({
                    kind: "info",
                    text: "当前提示词无需调整。"
                });
                if (optimizationOrigin === "fullscreen") setDialogOpen(false);
            } else {
                if (optimizationOrigin === "fullscreen") {
                    setFullscreenDraft(result.optimized_text);
                }
                const generationType = result.generation_type;
                const explanation = result.optimization_explanation?.trim();
                setOptimizationMessage({
                    kind: "success",
                    text: generationType || explanation ? `提示词已优化${generationType ? `（${generationType}）` : ""}${explanation ? `：${explanation}` : ""}` : "提示词已优化，可撤销恢复。"
                });
                setDialogOpen(false);
            }
        } catch (error) {
            if (controller.signal.aborted) return;
            setOptimizationMessage({
                kind: "error",
                text: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getUserFacingErrorMessage"])(error)
            });
        } finally{
            if (optimizationAbortRef.current === controller) {
                optimizationAbortRef.current = null;
                if (mountedRef.current) setIsOptimizing(false);
            }
        }
    }
    function cancelOptimization() {
        const controller = optimizationAbortRef.current;
        optimizationAbortRef.current = null;
        controller?.abort();
        setIsOptimizing(false);
        setOptimizationMessage({
            kind: "info",
            text: "已取消优化。"
        });
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                        children: "基础文本"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                        lineNumber: 479,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            references.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-mono text-[10px] text-muted-foreground",
                                children: [
                                    references.length,
                                    "/10"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 482,
                                columnNumber: 13
                            }, this) : null,
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                "aria-label": "优化提示词",
                                disabled: !canOptimize || isOptimizing,
                                onClick: ()=>openOptimizationDialog(),
                                size: "sm",
                                title: targets.length === 0 ? "请先连接 LLM、生图或生视频目标节点" : "根据目标模型优化提示词",
                                type: "button",
                                variant: "outline",
                                children: [
                                    isOptimizing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                        className: "h-3.5 w-3.5 animate-spin"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 500,
                                        columnNumber: 15
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__["WandSparkles"], {
                                        className: "h-3.5 w-3.5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 502,
                                        columnNumber: 15
                                    }, this),
                                    isOptimizing ? "优化中" : "优化提示词"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 486,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                        lineNumber: 480,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 478,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                "aria-label": "提示词编辑面",
                className: "max-h-96 overflow-y-auto rounded-lg border border-input bg-card shadow-sm transition focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/15",
                role: "group",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "relative border-b border-border/70",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                "aria-label": "展开编辑基础文本",
                                className: "min-h-24 max-h-40 w-full overflow-y-auto whitespace-pre-wrap px-3 py-2 pr-12 text-left font-mono text-sm leading-6 text-foreground outline-none transition hover:bg-secondary/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60",
                                "data-testid": "aigc-prompt-preview",
                                disabled: isOptimizing,
                                onClick: (event)=>openFullscreenEditor(event.currentTarget),
                                type: "button",
                                children: effectiveText || "（空）"
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 514,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                "aria-label": "展开编辑基础文本",
                                className: "absolute right-2 top-2 border-border/70 bg-card/90",
                                disabled: isOptimizing,
                                onClick: (event)=>openFullscreenEditor(event.currentTarget),
                                size: "icon",
                                title: "展开编辑基础文本",
                                type: "button",
                                variant: "ghost",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$expand$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Expand$3e$__["Expand"], {
                                    "aria-hidden": "true",
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 534,
                                    columnNumber: 13
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 524,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "absolute bottom-2 right-3 rounded bg-card/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
                                children: [
                                    Array.from(effectiveText).length,
                                    " 字符"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 536,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                        lineNumber: 513,
                        columnNumber: 9
                    }, this),
                    references.length > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2 border-t border-border/70 p-2",
                        children: references.map((reference, index)=>{
                            const source = sources[index];
                            const binding = sourceBboxBindings[index];
                            const bbox = binding?.state === "valid" ? binding.bbox : null;
                            const sourceLabel = source?.type === "image" ? displayNames.get(reference.source_node_id)?.displayName ?? "图片节点" : "失效图片节点";
                            const paused = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isBboxReferencePaused"])(graphDefinition, reference.source_node_id, activeNode.id);
                            const coordinates = bbox ? `bbox ${bbox.x1} ${bbox.y1} ${bbox.x2} ${bbox.y2}` : null;
                            const assetQuery = assetQueries[index];
                            const status = !source || !bbox ? "引用来源已失效" : paused ? "已暂停" : assetQuery?.isPending ? "素材加载中" : assetQuery?.isError ? "缩略图加载失败" : null;
                            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-1.5",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        "aria-label": `BBox 引用：${sourceLabel}，${coordinates ?? "引用来源已失效"}`,
                                        className: "flex min-w-0 items-center gap-2 rounded-md border border-primary/25 bg-primary/5 px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                                        role: "group",
                                        tabIndex: 0,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "min-w-0 flex-1 truncate font-medium text-foreground",
                                                children: sourceLabel
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                lineNumber: 578,
                                                columnNumber: 21
                                            }, this),
                                            coordinates ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "shrink-0 font-mono text-[10px] text-muted-foreground",
                                                children: coordinates
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                lineNumber: 582,
                                                columnNumber: 23
                                            }, this) : null,
                                            status ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "shrink-0 text-[10px] text-muted-foreground",
                                                children: status
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                lineNumber: 587,
                                                columnNumber: 23
                                            }, this) : null,
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                "aria-label": `移除框选引用：${sourceLabel}`,
                                                className: "grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition hover:bg-secondary hover:text-destructive disabled:pointer-events-none disabled:opacity-50",
                                                disabled: isOptimizing,
                                                onClick: ()=>removeReference(activeNode.id, reference.source_node_id),
                                                title: `移除框选引用：${sourceLabel}`,
                                                type: "button",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                    className: "h-3.5 w-3.5"
                                                }, void 0, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                    lineNumber: 601,
                                                    columnNumber: 23
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                lineNumber: 591,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 572,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                        "aria-label": `框选引用说明：${sourceLabel}`,
                                        className: "min-h-14 resize-y border-0 bg-transparent px-2 py-1.5 text-xs shadow-none focus-visible:ring-0",
                                        disabled: isOptimizing,
                                        onChange: (event)=>updateReferenceInstruction(reference.source_node_id, event.target.value),
                                        placeholder: "描述如何使用这个框选主体",
                                        value: reference.instruction
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 604,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, reference.source_node_id, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 571,
                                columnNumber: 17
                            }, this);
                        })
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                        lineNumber: 541,
                        columnNumber: 11
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 508,
                columnNumber: 7
            }, this),
            validationMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-destructive",
                role: "alert",
                children: validationMessage
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 624,
                columnNumber: 9
            }, this) : null,
            optimizationMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: optimizationMessage.kind === "error" ? "text-xs text-destructive" : optimizationMessage.kind === "success" ? "text-xs text-success" : "text-xs text-muted-foreground",
                role: optimizationMessage.kind === "error" ? "alert" : "status",
                children: optimizationMessage.text
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 629,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(PromptFullscreenEditor, {
                editable: canEditText && !isOptimizing,
                canOptimize: canEditText && targets.length > 0 && Boolean(fullscreenDraft.trim() || references.some((reference)=>reference.instruction.trim())),
                draft: fullscreenDraft,
                isOptimizing: isOptimizing,
                nodeName: displayNames.get(activeNode.id)?.displayName ?? activeNode.config.title ?? "文本节点",
                onApply: applyFullscreenText,
                onClose: closeFullscreenEditor,
                onDraftChange: setFullscreenDraft,
                onOptimize: ()=>openOptimizationDialog("fullscreen"),
                open: fullscreenEditorOpen,
                validationMessage: validationMessage,
                valueAtOpen: fullscreenOpeningValue
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 642,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
                open: dialogOpen,
                onOpenChange: (open)=>{
                    if (!isOptimizing) setDialogOpen(open);
                },
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
                    className: "flex max-h-[calc(100dvh-1rem)] flex-col border-[#343a43] bg-[#171a1f] text-zinc-100 sm:max-h-[calc(100dvh-3rem)] sm:max-w-xl [&_label]:text-zinc-200",
                    closeButtonClassName: "border-[#3d444e] bg-[#20242a] text-zinc-400 hover:bg-[#2a3038] hover:text-zinc-100",
                    "data-testid": "aigc-prompt-optimization-dialog",
                    hideCloseButton: isOptimizing,
                    onEscapeKeyDown: (event)=>{
                        if (isOptimizing) event.preventDefault();
                    },
                    onInteractOutside: (event)=>{
                        if (isOptimizing) event.preventDefault();
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                            className: "shrink-0 px-5 pt-5",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                    className: "text-zinc-100",
                                    children: "优化提示词"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 686,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                    className: "text-zinc-400",
                                    children: [
                                        "选择直接下游目标，优化结果将",
                                        optimizationOrigin === "fullscreen" ? "更新当前全屏草稿。" : "写回当前文本节点。"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 687,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 685,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-2",
                            "data-testid": "aigc-prompt-optimization-body",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            children: "当前文本"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 699,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-1.5 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-[#343a43] bg-[#101318] px-3 py-2 text-xs leading-5 text-zinc-400",
                                            children: optimizationOrigin === "fullscreen" ? fullscreenDraft || "（空）" : effectiveText || "（空）"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 700,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 698,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: `prompt-target-${activeNode.id}`,
                                            children: "目标模型"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 707,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                            "aria-label": "目标模型",
                                            className: "mt-1.5 h-9 w-full rounded-md border border-[#343a43] bg-[#101318] px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-primary/35 disabled:opacity-50",
                                            disabled: isOptimizing,
                                            id: `prompt-target-${activeNode.id}`,
                                            onChange: (event)=>setTargetNodeId(event.target.value),
                                            value: targetNodeId,
                                            children: targets.map((target)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: target.id,
                                                    children: target.displayName
                                                }, target.id, false, {
                                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                                    lineNumber: 719,
                                                    columnNumber: 19
                                                }, this))
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 710,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 706,
                                    columnNumber: 13
                                }, this),
                                showsVideoReferenceMarkerHint ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs leading-5 text-zinc-400",
                                    role: "status",
                                    children: "优化会尽量保留提示词中的参考媒体标记。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 726,
                                    columnNumber: 15
                                }, this) : null,
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$label$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Label"], {
                                            htmlFor: `prompt-direction-${activeNode.id}`,
                                            children: "优化方向"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 731,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                            className: "mt-1.5 min-h-24 border-[#343a43] bg-[#101318] text-zinc-100 placeholder:text-zinc-600",
                                            disabled: isOptimizing,
                                            id: `prompt-direction-${activeNode.id}`,
                                            maxLength: MAX_DIRECTION_CODE_POINTS,
                                            onChange: (event)=>setDirection(truncateCodePoints(event.target.value, MAX_DIRECTION_CODE_POINTS)),
                                            placeholder: "可选，例如：强化镜头节奏，保持品牌文字不变",
                                            value: direction
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 734,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 730,
                                    columnNumber: 13
                                }, this),
                                optimizationMessage?.kind === "error" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "text-xs text-destructive",
                                    role: "alert",
                                    children: optimizationMessage.text
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 752,
                                    columnNumber: 15
                                }, this) : null
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 694,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                            className: "shrink-0 border-t border-[#343a43] px-5 py-4",
                            "data-testid": "aigc-prompt-optimization-footer",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    className: "border-[#3d444e] bg-[#20242a] text-zinc-200 hover:bg-[#2a3038]",
                                    onClick: ()=>isOptimizing ? cancelOptimization() : setDialogOpen(false),
                                    type: "button",
                                    variant: "outline",
                                    children: isOptimizing ? "取消优化" : "取消"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 761,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                    disabled: isOptimizing || !targetNodeId,
                                    onClick: ()=>void optimizePrompt(),
                                    type: "button",
                                    children: [
                                        isOptimizing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                            className: "h-4 w-4 animate-spin"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 779,
                                            columnNumber: 17
                                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__["WandSparkles"], {
                                            className: "h-4 w-4"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                            lineNumber: 781,
                                            columnNumber: 17
                                        }, this),
                                        isOptimizing ? "优化中" : "开始优化"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                    lineNumber: 773,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 757,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                    lineNumber: 673,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                lineNumber: 667,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
        lineNumber: 477,
        columnNumber: 5
    }, this);
}
_s(AigcPromptEditor, "ZrseHpxBpzG82MVKt2mrZbRPGGo=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStoreApi"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$aigc$2d$run$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcRunProjection"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$aigc$2f$providers$2f$aigc$2d$editor$2d$store$2d$provider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAigcEditorStore"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"]
    ];
});
_c = AigcPromptEditor;
function PromptFullscreenEditor({ editable, canOptimize, draft, isOptimizing, nodeName, onApply, onClose, onDraftChange, onOptimize, open, validationMessage, valueAtOpen }) {
    function apply() {
        if (onApply(draft, valueAtOpen)) onClose();
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
        onOpenChange: (nextOpen)=>{
            if (!nextOpen) onClose();
        },
        open: open,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "grid h-[94dvh] w-[calc(100vw-1rem)] max-w-[96rem] grid-rows-[auto_minmax(0,1fr)_auto] border-[#343a43] bg-[#171a1f] p-0 text-zinc-100 sm:h-[92dvh] sm:w-[96vw] sm:max-w-[96rem] sm:rounded-xl [&_label]:text-zinc-200",
            closeButtonClassName: "border-[#3d444e] bg-[#20242a] text-zinc-400 hover:bg-[#2a3038] hover:text-zinc-100",
            "data-testid": "aigc-fullscreen-prompt-editor",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    className: "border-b border-[#343a43] px-5 py-4 pr-16",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-start justify-between gap-3 pr-10",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                                        className: "text-zinc-100",
                                        children: "编辑基础文本"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 838,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                                        className: "sr-only",
                                        children: [
                                            "完整查看和编辑",
                                            nodeName,
                                            "的提示词"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 839,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-1 truncate text-xs text-zinc-400",
                                        children: nodeName
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 842,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mt-2 font-mono text-xs text-zinc-500",
                                        children: [
                                            Array.from(draft).length,
                                            " 字符"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 845,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 837,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                disabled: !canOptimize || isOptimizing,
                                onClick: onOptimize,
                                size: "sm",
                                title: "根据目标模型优化当前草稿",
                                type: "button",
                                variant: "outline",
                                children: [
                                    isOptimizing ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                        className: "h-3.5 w-3.5 animate-spin"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 858,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__["WandSparkles"], {
                                        className: "h-3.5 w-3.5"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                        lineNumber: 860,
                                        columnNumber: 17
                                    }, this),
                                    isOptimizing ? "优化中" : "优化提示词"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                                lineNumber: 849,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                        lineNumber: 836,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                    lineNumber: 835,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "min-h-0 p-4 sm:p-5",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                            "aria-label": "完整基础文本",
                            autoFocus: true,
                            className: "h-full min-h-0 resize-none border-[#343a43] bg-[#101318] font-mono text-sm leading-6 text-zinc-100 placeholder:text-zinc-600 focus-visible:border-primary/55",
                            onChange: (event)=>onDraftChange(event.target.value),
                            onKeyDown: (event)=>{
                                if (editable && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                                    event.preventDefault();
                                    apply();
                                }
                            },
                            readOnly: !editable,
                            value: draft
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 867,
                            columnNumber: 11
                        }, this),
                        validationMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "mt-2 text-xs text-destructive",
                            role: "alert",
                            children: validationMessage
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 886,
                            columnNumber: 13
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                    lineNumber: 866,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogFooter"], {
                    className: "border-t border-[#343a43] px-5 py-4",
                    "data-testid": "aigc-fullscreen-prompt-editor-footer",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            className: "border-[#3d444e] bg-[#20242a] text-zinc-200 hover:bg-[#2a3038]",
                            onClick: onClose,
                            type: "button",
                            variant: "outline",
                            children: "取消"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 895,
                            columnNumber: 11
                        }, this),
                        editable ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            onClick: apply,
                            type: "button",
                            children: "应用"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                            lineNumber: 904,
                            columnNumber: 13
                        }, this) : null
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
                    lineNumber: 891,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
            lineNumber: 830,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-prompt-editor.tsx",
        lineNumber: 824,
        columnNumber: 5
    }, this);
}
_c1 = PromptFullscreenEditor;
function promptOptimizationTargets(definition, textNodeId) {
    const displayNames = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes);
    return definition.edges.filter((edge)=>edge.sourceNodeId === textNodeId && edge.sourceHandle === "text" && edge.targetHandle === "prompt").map((edge)=>definition.nodes.find((node)=>node.id === edge.targetNodeId)).filter((target)=>target?.type === "llm" || target?.type === "text_to_image" || target?.type === "image_to_image" || target?.type === "video_generation").map((node)=>({
            displayName: displayNames.get(node.id)?.displayName ?? node.type,
            id: node.id,
            node
        }));
}
function buildPromptOptimizationRequest(definition, target, text, optimizationDirection, referenceInstructions, pipeline = null) {
    const common = {
        optimization_direction: optimizationDirection,
        target_node_id: target.id,
        text
    };
    if (target.type === "llm") {
        return {
            ...common,
            reference_instructions: [],
            target_config: {
                model: target.config.model,
                system_prompt: target.config.system_prompt
            },
            target_type: "llm"
        };
    }
    if (target.type === "text_to_image") {
        return {
            ...common,
            reference_instructions: referenceInstructions,
            target_config: {
                aspect_ratio: target.config.aspect_ratio,
                model: target.config.model,
                reference_image_count: 0,
                size: target.config.size
            },
            target_type: "text_to_image"
        };
    }
    if (target.type === "image_to_image") {
        return {
            ...common,
            ...pipeline ? {
                pipeline_context: {
                    base_revision: pipeline.baseRevision,
                    definition_snapshot: structuredClone(definition),
                    pipeline_id: pipeline.pipelineId,
                    source_image: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$prompt$2d$optimization$2d$context$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resolvePromptOptimizationSourceImage"])(definition, target.id, pipeline.runDetail)
                }
            } : {},
            reference_instructions: referenceInstructions,
            target_config: {
                aspect_ratio: target.config.aspect_ratio,
                model: target.config.model,
                operation: target.config.operation ?? "image_to_image",
                reference_image_count: definition.edges.filter((edge)=>edge.targetNodeId === target.id && edge.targetHandle === "image").length,
                size: target.config.size
            },
            target_type: "image_to_image"
        };
    }
    if (target.type !== "video_generation") {
        throw new Error("unsupported prompt optimization target");
    }
    const handleOrder = [
        "first_frame",
        "last_frame",
        "reference_images",
        "reference_videos",
        "reference_audios"
    ];
    const roleByHandle = {
        first_frame: "first_frame",
        last_frame: "last_frame",
        reference_images: "reference_image",
        reference_videos: "reference_video",
        reference_audios: "reference_audio"
    };
    const mediaByHandle = {
        first_frame: "image",
        last_frame: "image",
        reference_images: "image",
        reference_videos: "video",
        reference_audios: "audio"
    };
    const references = handleOrder.flatMap((targetHandle)=>definition.edges.filter((edge)=>edge.targetNodeId === target.id && edge.targetHandle === targetHandle).map((edge, index)=>({
                media_type: mediaByHandle[targetHandle],
                ordinal: index + 1,
                role: roleByHandle[targetHandle],
                source_handle: mediaByHandle[targetHandle],
                source_node_id: edge.sourceNodeId,
                target_handle: targetHandle
            })));
    return {
        ...common,
        reference_instructions: [],
        target_config: {
            aspect_ratio: target.config.aspect_ratio,
            duration_seconds: target.config.duration_seconds,
            generate_audio: target.config.generate_audio,
            generation_mode: target.config.generation_mode,
            model: target.config.model,
            references,
            task_type: target.config.task_type ?? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_TASK_TYPE"]
        },
        target_type: "video_generation"
    };
}
function promptOptimizationSnapshot(definition, textNodeId, runId, request, config) {
    return JSON.stringify({
        config: {
            bbox_references: config.bbox_references ?? [],
            text: config.text,
            upstream_text_override: config.upstream_text_override ?? null
        },
        edges: definition.edges.filter((edge)=>edge.sourceNodeId === textNodeId || edge.targetNodeId === textNodeId || edge.targetNodeId === request.target_node_id),
        request: promptOptimizationSemanticRequest(request),
        runId
    });
}
function promptOptimizationSemanticRequest(request) {
    if (request.target_type !== "image_to_image" || !request.pipeline_context) {
        return request;
    }
    return {
        ...request,
        pipeline_context: {
            definition_snapshot: request.pipeline_context.definition_snapshot,
            pipeline_id: request.pipeline_context.pipeline_id,
            source_image: request.pipeline_context.source_image
        }
    };
}
function effectiveTextForSnapshot(definition, node, runDetail) {
    const upstream = definition.edges.some((edge)=>edge.targetNodeId === node.id && edge.targetHandle === "text");
    if (!upstream) return node.config.text;
    if (node.config.upstream_text_override != null) {
        return node.config.upstream_text_override;
    }
    return runDetail ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$result$2d$projection$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["projectAigcEffectiveText"])(runDetail, definition, node.id)?.text ?? "" : "";
}
function truncateCodePoints(value, maxLength) {
    return Array.from(value).slice(0, maxLength).join("");
}
var _c, _c1;
__turbopack_context__.k.register(_c, "AigcPromptEditor");
__turbopack_context__.k.register(_c1, "PromptFullscreenEditor");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-run-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcRunActionsProvider",
    ()=>AigcRunActionsProvider,
    "AigcRunProvider",
    ()=>AigcRunProvider,
    "useAigcActiveRun",
    ()=>useAigcActiveRun,
    "useAigcLayerPreviewRun",
    ()=>useAigcLayerPreviewRun,
    "useAigcRunActions",
    ()=>useAigcRunActions,
    "useAigcRunProjection",
    ()=>useAigcRunProjection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature();
"use client";
;
const AigcRunContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const AigcRunActionsContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const AigcRunProvider = AigcRunContext.Provider;
const AigcRunActionsProvider = AigcRunActionsContext.Provider;
function useAigcRunProjection(nodeId) {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AigcRunContext)?.displayRunForNode(nodeId) ?? null;
}
_s(useAigcRunProjection, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
function useAigcActiveRun(nodeId) {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AigcRunContext)?.activeRunForNode(nodeId) ?? null;
}
_s1(useAigcActiveRun, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
function useAigcLayerPreviewRun(nodeId) {
    _s2();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AigcRunContext)?.latestSuccessfulRunForNode(nodeId) ?? null;
}
_s2(useAigcLayerPreviewRun, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
function useAigcRunActions() {
    _s3();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AigcRunActionsContext);
}
_s3(useAigcRunActions, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/aigc-video-player.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcVideoPlayer",
    ()=>AigcVideoPlayer,
    "formatVideoDuration",
    ()=>formatVideoDuration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
function AigcVideoPlayer({ audioState = null, bitDepth = null, className, fps = null, initialMetadata, mimeType, name, resolutionLabel = null, toolVersion = null, unavailableText = "视频结果不可用", url, variant = "node" }) {
    _s();
    const [loadedMetadata, setLoadedMetadata] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const videoRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const metadata = loadedMetadata?.source === url ? loadedMetadata : initialMetadata;
    const details = videoDetails({
        audioState,
        bitDepth,
        fps,
        metadata,
        mimeType,
        resolutionLabel,
        toolVersion
    });
    function readMetadata(media) {
        setLoadedMetadata({
            duration: Number.isFinite(media.duration) ? media.duration : null,
            height: media.videoHeight > 0 ? media.videoHeight : null,
            source: url || "",
            width: media.videoWidth > 0 ? media.videoWidth : null
        });
    }
    if (!url) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("grid place-items-center bg-slate-950 px-3 text-center text-[10px] text-slate-300", variant === "node" ? "min-h-0 flex-1" : "h-44", className),
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: unavailableText
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                        lineNumber: 74,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-[9px] text-amber-300",
                        children: "播放和下载已禁用"
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                        lineNumber: 75,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                lineNumber: 73,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative overflow-hidden bg-slate-950 p-1.5", variant === "node" ? "min-h-0 flex-1" : "h-44", className),
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("video", {
                    "aria-label": `播放视频：${name}`,
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("block h-full w-full object-contain", variant === "node" && "nodrag nopan nowheel"),
                    controls: true,
                    onLoadedMetadata: (event)=>readMetadata(event.currentTarget),
                    playsInline: true,
                    preload: "metadata",
                    ref: videoRef,
                    src: url
                }, void 0, false, {
                    fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                    lineNumber: 92,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pointer-events-none absolute inset-x-1.5 top-1.5 bg-gradient-to-b from-slate-950/95 to-transparent px-1.5 pb-5 pt-1 text-white",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "truncate text-[9px] font-medium",
                            children: name
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                            lineNumber: 106,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "truncate font-mono text-[8px] text-slate-300",
                            children: details
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                            lineNumber: 107,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
                    lineNumber: 105,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
            lineNumber: 85,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/aigc-video-player.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, this);
}
_s(AigcVideoPlayer, "kl3OER0/7Lmp0TWZUyfL+LxnWEM=");
_c = AigcVideoPlayer;
function formatVideoDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.round(seconds % 60 * 10) / 10;
    return minutes > 0 ? `${minutes}:${String(remainder).padStart(4, "0")}` : `${remainder}s`;
}
function videoDetails({ audioState, bitDepth, fps, metadata, mimeType, resolutionLabel, toolVersion }) {
    const values = [];
    if (metadata.width && metadata.height) {
        values.push(`${metadata.width} × ${metadata.height}`);
    } else if (resolutionLabel) {
        values.push(resolutionLabel);
    }
    if (metadata.duration !== null) {
        values.push(formatVideoDuration(metadata.duration));
    }
    if (fps !== null) values.push(`${fps} fps`);
    if (toolVersion !== null) {
        values.push(toolVersion === "professional" ? "专业版" : "标准版");
    }
    if (bitDepth !== null) values.push(`${bitDepth}-bit`);
    if (audioState !== null) {
        values.push(audioState ? "有音频" : "无音频");
    }
    if (mimeType) values.push(mimeType);
    values.push("可用");
    return values.join(" · ");
}
var _c;
__turbopack_context__.k.register(_c, "AigcVideoPlayer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AigcEditorStoreProvider",
    ()=>AigcEditorStoreProvider,
    "useAigcEditorStore",
    ()=>useAigcEditorStore,
    "useAigcEditorStoreApi",
    ()=>useAigcEditorStoreApi
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/editor-store.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature();
"use client";
;
;
;
const AigcEditorStoreContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function AigcEditorStoreProvider({ children, initialState, store }) {
    _s();
    if (!store && !initialState) {
        throw new Error("AigcEditorStoreProvider requires initialState or store");
    }
    const editorStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "AigcEditorStoreProvider.useMemo[editorStore]": ()=>store ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$editor$2d$store$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createAigcEditorStore"])(initialState)
    }["AigcEditorStoreProvider.useMemo[editorStore]"], [
        initialState,
        store
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AigcEditorStoreContext.Provider, {
        value: editorStore,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/workspace/aigc/providers/aigc-editor-store-provider.tsx",
        lineNumber: 37,
        columnNumber: 5
    }, this);
}
_s(AigcEditorStoreProvider, "iozqV3LdlqlMXrEFRPdYKTWkOWk=");
_c = AigcEditorStoreProvider;
function useAigcEditorStore(selector) {
    _s1();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"])(useAigcEditorStoreApi(), selector);
}
_s1(useAigcEditorStore, "tRpAAnpj2/w/nb/IphdrVKKBg0Y=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useStore"]
    ];
});
function useAigcEditorStoreApi() {
    _s2();
    const store = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AigcEditorStoreContext);
    if (!store) {
        throw new Error("useAigcEditorStore must be used within AigcEditorStoreProvider");
    }
    return store;
}
_s2(useAigcEditorStoreApi, "Wl1jJrZzTCxjtMcqth/dX4wg3Uo=");
var _c;
__turbopack_context__.k.register(_c, "AigcEditorStoreProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/canvas/bbox-canvas.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BboxCanvas",
    ()=>BboxCanvas,
    "resizeBbox",
    ()=>resizeBbox
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$image$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/image-edit-dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
function BboxCanvas({ alt, bbox, className, disabled, fillImageBox = false, fitToImageAspect, onChange, onImageLoad, onPreview, url }) {
    _s();
    const containerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const imageRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const dragStartRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const resizeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [naturalImageSize, setNaturalImageSize] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [renderedImageState, setRenderedImageState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const renderedImageRect = renderedImageState?.url === url ? renderedImageState.rect : null;
    const naturalAspectRatio = naturalImageSize?.url === url && naturalImageSize.width > 0 && naturalImageSize.height > 0 ? `${naturalImageSize.width} / ${naturalImageSize.height}` : undefined;
    function imageRect() {
        const image = imageRef.current;
        if (!image) return null;
        const bounds = image.getBoundingClientRect();
        return bounds.width > 0 && bounds.height > 0 ? bounds : null;
    }
    const updateRenderedImageRect = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "BboxCanvas.useCallback[updateRenderedImageRect]": ()=>{
            const container = containerRef.current;
            const image = imageRef.current;
            if (!container || !image || !url) return null;
            const containerBounds = container.getBoundingClientRect();
            const rect = imageRect();
            if (!rect) return null;
            if (rect.width <= 0 || rect.height <= 0) {
                return null;
            }
            // `getBoundingClientRect` reports the *visual* size, so inside React Flow's
            // zoomed `transform: scale(zoom)` subtree it is already multiplied by the
            // current zoom. The overlay is positioned in local (unscaled) CSS px and
            // then re-scaled by the same transform, so we must divide the measurement
            // back into local space or the box double-scales and drifts off the region.
            // `offsetWidth` is a layout metric unaffected by ancestor transforms, so its
            // ratio to the visual width yields the cumulative scale (1 in the dialog).
            const scale = image.offsetWidth > 0 ? rect.width / image.offsetWidth : 1;
            const safeScale = scale > 0 ? scale : 1;
            const nextRect = {
                height: rect.height / safeScale,
                left: (rect.left - containerBounds.left) / safeScale,
                top: (rect.top - containerBounds.top) / safeScale,
                width: rect.width / safeScale
            };
            setRenderedImageState({
                "BboxCanvas.useCallback[updateRenderedImageRect]": (current)=>{
                    const sameRect = current?.url === url && Math.abs(current.rect.height - nextRect.height) < 0.5 && Math.abs(current.rect.left - nextRect.left) < 0.5 && Math.abs(current.rect.top - nextRect.top) < 0.5 && Math.abs(current.rect.width - nextRect.width) < 0.5;
                    return sameRect ? current : {
                        rect: nextRect,
                        url
                    };
                }
            }["BboxCanvas.useCallback[updateRenderedImageRect]"]);
            return nextRect;
        }
    }["BboxCanvas.useCallback[updateRenderedImageRect]"], [
        url
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BboxCanvas.useEffect": ()=>{
            if (!url) return;
            updateRenderedImageRect();
            const container = containerRef.current;
            const image = imageRef.current;
            if (typeof ResizeObserver === "undefined" || !container && !image) {
                window.addEventListener("resize", updateRenderedImageRect);
                return ({
                    "BboxCanvas.useEffect": ()=>{
                        window.removeEventListener("resize", updateRenderedImageRect);
                    }
                })["BboxCanvas.useEffect"];
            }
            const observer = new ResizeObserver({
                "BboxCanvas.useEffect": ()=>{
                    updateRenderedImageRect();
                }
            }["BboxCanvas.useEffect"]);
            if (container) observer.observe(container);
            if (image) observer.observe(image);
            return ({
                "BboxCanvas.useEffect": ()=>{
                    observer.disconnect();
                }
            })["BboxCanvas.useEffect"];
        }
    }["BboxCanvas.useEffect"], [
        updateRenderedImageRect,
        url
    ]);
    function point(event) {
        updateRenderedImageRect();
        const rect = imageRect();
        return rect && rect.width > 0 && rect.height > 0 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$image$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeImagePoint"])(event.clientX, event.clientY, rect) : null;
    }
    function handlePointerDown(event) {
        if (disabled) return;
        if (resizeRef.current) return;
        const nextPoint = point(event);
        if (!nextPoint) return;
        dragStartRef.current = {
            clientX: event.clientX,
            clientY: event.clientY,
            moved: false,
            point: nextPoint
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    function handlePointerMove(event) {
        if (disabled) return;
        const nextPoint = point(event);
        if (!nextPoint) return;
        if (resizeRef.current) {
            setBbox(resizeBbox(resizeRef.current.bbox, resizeRef.current.handle, nextPoint));
            return;
        }
        if (dragStartRef.current) {
            const distance = Math.hypot(event.clientX - dragStartRef.current.clientX, event.clientY - dragStartRef.current.clientY);
            if (distance < 4 && !dragStartRef.current.moved) return;
            dragStartRef.current.moved = true;
            setBbox((0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$image$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBboxAnnotation"])(dragStartRef.current.point, nextPoint));
        }
    }
    function handlePointerUp(event) {
        if (disabled) return;
        const nextPoint = point(event);
        if (nextPoint && resizeRef.current) {
            setBbox(resizeBbox(resizeRef.current.bbox, resizeRef.current.handle, nextPoint));
        } else if (nextPoint && dragStartRef.current) {
            const distance = Math.hypot(event.clientX - dragStartRef.current.clientX, event.clientY - dragStartRef.current.clientY);
            if (dragStartRef.current.moved || distance >= 4) {
                setBbox((0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$image$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBboxAnnotation"])(dragStartRef.current.point, nextPoint));
            }
        }
        dragStartRef.current = null;
        resizeRef.current = null;
    }
    function setBbox(annotation) {
        onChange(annotation?.type === "bbox" ? annotation : null);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative place-items-center overflow-hidden rounded-lg border border-slate-800 bg-slate-950", fitToImageAspect && naturalAspectRatio ? "inline-grid w-auto justify-self-center" : "grid w-full", className),
        ref: containerRef,
        style: fitToImageAspect && naturalAspectRatio ? {
            aspectRatio: naturalAspectRatio
        } : undefined,
        children: url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "relative grid h-full w-full place-items-center",
            onPointerMove: handlePointerMove,
            onPointerUp: handlePointerUp,
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                    alt: alt,
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("block select-none object-contain touch-none", fillImageBox ? "absolute inset-0 h-full w-full" : "h-auto max-h-full w-auto max-w-full", !disabled && (onPreview ? "cursor-zoom-in" : "cursor-crosshair")),
                    draggable: false,
                    onDoubleClick: ()=>{
                        if (disabled || !onPreview) return;
                        onPreview();
                    },
                    onLoad: (event)=>{
                        const image = event.currentTarget;
                        if (url) {
                            setNaturalImageSize({
                                height: image.naturalHeight,
                                url,
                                width: image.naturalWidth
                            });
                        }
                        onImageLoad?.(image.naturalWidth, image.naturalHeight);
                        updateRenderedImageRect();
                    },
                    onPointerDown: (event)=>{
                        event.stopPropagation();
                        handlePointerDown(event);
                    },
                    ref: imageRef,
                    src: url
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                    lineNumber: 240,
                    columnNumber: 11
                }, this),
                bbox && renderedImageRect ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "pointer-events-none absolute",
                    style: {
                        height: `${renderedImageRect.height}px`,
                        left: `${renderedImageRect.left}px`,
                        top: `${renderedImageRect.top}px`,
                        width: `${renderedImageRect.width}px`
                    },
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(BboxOverlay, {
                        bbox: bbox,
                        disabled: disabled,
                        onClear: ()=>onChange(null),
                        onResizeStart: (event, handle)=>{
                            if (disabled) return;
                            resizeRef.current = {
                                bbox,
                                handle
                            };
                            dragStartRef.current = null;
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                            event.stopPropagation();
                        }
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                        lineNumber: 283,
                        columnNumber: 15
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                    lineNumber: 274,
                    columnNumber: 13
                }, this) : null
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
            lineNumber: 233,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
            className: "px-4 text-center text-sm text-slate-300",
            children: "尚未生成目标图。填写提示词后即可生成首张图片。"
        }, void 0, false, {
            fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
            lineNumber: 299,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
        lineNumber: 217,
        columnNumber: 5
    }, this);
}
_s(BboxCanvas, "OVYYE/kZYhjw3rBRNBGgEGDvReQ=");
_c = BboxCanvas;
function BboxOverlay({ bbox, disabled, onClear, onResizeStart }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "pointer-events-none absolute border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]",
        style: {
            height: `${(bbox.y2 - bbox.y1) / 10}%`,
            left: `${bbox.x1 / 10}%`,
            top: `${bbox.y1 / 10}%`,
            width: `${(bbox.x2 - bbox.x1) / 10}%`
        },
        children: [
            [
                "top-left",
                "top-right",
                "bottom-left",
                "bottom-right"
            ].map((handle)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                    "aria-label": `调整框选区域：${handle}`,
                    className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("pointer-events-auto absolute h-3 w-3 rounded-full border-2 border-white bg-primary shadow-sm", handle.includes("top") ? "-top-1.5" : "-bottom-1.5", handle.includes("left") ? "-left-1.5" : "-right-1.5"),
                    disabled: disabled,
                    onPointerDown: (event)=>onResizeStart(event, handle),
                    type: "button"
                }, handle, false, {
                    fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                    lineNumber: 333,
                    columnNumber: 11
                }, this)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                "aria-label": "删除框选区域",
                className: "pointer-events-auto absolute -right-1.5 -top-1.5 grid h-3 w-3 place-items-center rounded-full border border-white bg-destructive text-destructive-foreground shadow-sm transition hover:scale-105",
                disabled: disabled,
                onClick: (event)=>{
                    event.stopPropagation();
                    onClear();
                },
                type: "button",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                    className: "h-2 w-2"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                    lineNumber: 357,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
                lineNumber: 347,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/canvas/bbox-canvas.tsx",
        lineNumber: 322,
        columnNumber: 5
    }, this);
}
_c1 = BboxOverlay;
function resizeBbox(bbox, handle, point) {
    const start = {
        x: handle.includes("left") ? point.x : bbox.x1,
        y: handle.includes("top") ? point.y : bbox.y1
    };
    const end = {
        x: handle.includes("right") ? point.x : bbox.x2,
        y: handle.includes("bottom") ? point.y : bbox.y2
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$image$2d$edit$2d$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createBboxAnnotation"])(start, end);
}
var _c, _c1;
__turbopack_context__.k.register(_c, "BboxCanvas");
__turbopack_context__.k.register(_c1, "BboxOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/canvas/canvas-context.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CanvasHandlersProvider",
    ()=>CanvasHandlersProvider,
    "REFERENCE_MEDIA_MIN_SIZE",
    ()=>REFERENCE_MEDIA_MIN_SIZE,
    "REFERENCE_NODE_HORIZONTAL_CHROME",
    ()=>REFERENCE_NODE_HORIZONTAL_CHROME,
    "REFERENCE_NODE_VERTICAL_CHROME",
    ()=>REFERENCE_NODE_VERTICAL_CHROME,
    "useCanvasHandlers",
    ()=>useCanvasHandlers
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
const REFERENCE_MEDIA_MIN_SIZE = 80;
const REFERENCE_NODE_HORIZONTAL_CHROME = 20;
const REFERENCE_NODE_VERTICAL_CHROME = 52;
const noop = ()=>undefined;
const CanvasHandlersContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])({
    getOutputDownloadUrl: ()=>null,
    onOutputImageLoad: noop,
    onOutputLayerDecompose: noop,
    onOutputPreview: noop,
    onOutputSetAsReference: noop,
    onReferenceBboxChange: noop,
    onReferenceImageLoad: noop,
    onReferencePreview: noop,
    onRequestRemoveReference: noop
});
const CanvasHandlersProvider = CanvasHandlersContext.Provider;
function useCanvasHandlers() {
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(CanvasHandlersContext);
}
_s(useCanvasHandlers, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/canvas/node-canvas.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NodeCanvas",
    ()=>NodeCanvas,
    "defaultNodeTypes",
    ()=>defaultNodeTypes
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/react/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$output$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/output-node.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$reference$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/reference-node.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
;
;
const defaultNodeTypes = {
    output: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$output$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OutputNode"],
    reference: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$reference$2d$node$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ReferenceNode"]
};
function NodeCanvas({ backgroundProps, className, controlsProps, nodes, edges, nodeTypes = defaultNodeTypes, onNodesChange, onNodeDragStop, reactFlowProps, children }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ReactFlowProvider"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("relative h-full w-full", className),
            "data-testid": "node-canvas-root",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["ReactFlow"], {
                    ...reactFlowProps,
                    edges: edges,
                    fitView: true,
                    nodeTypes: nodeTypes,
                    nodes: nodes,
                    onNodeDragStop: onNodeDragStop,
                    onNodesChange: onNodesChange,
                    proOptions: {
                        hideAttribution: true
                    },
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Background"], {
                            ...backgroundProps
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/node-canvas.tsx",
                            lineNumber: 73,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Controls"], {
                            ...controlsProps
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/node-canvas.tsx",
                            lineNumber: 74,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/canvas/node-canvas.tsx",
                    lineNumber: 63,
                    columnNumber: 9
                }, this),
                children
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/canvas/node-canvas.tsx",
            lineNumber: 59,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/canvas/node-canvas.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
_c = NodeCanvas;
var _c;
__turbopack_context__.k.register(_c, "NodeCanvas");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/canvas/output-node.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OutputNode",
    ()=>OutputNode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/react/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/download.js [app-client] (ecmascript) <export default as Download>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImagePlus$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image-plus.js [app-client] (ecmascript) <export default as ImagePlus>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/layers.js [app-client] (ecmascript) <export default as Layers3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/maximize-2.js [app-client] (ecmascript) <export default as Maximize2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TriangleAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as TriangleAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/canvas-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
const SOURCE_LABELS = {
    image_to_image: "参考图生图",
    layer_decomposition: "图层拆分",
    text_to_image: "文生图"
};
/**
 * Output node: shows a generation result (text-to-image / image-to-image /
 * layer decomposition). While the task runs it renders a pending state; on
 * success it shows the image at its intrinsic aspect ratio plus download,
 * preview, set-as-reference and layer-decomposition actions.
 */ function OutputNodeComponent({ data, id, selected }) {
    _s();
    const handlers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCanvasHandlers"])();
    const downloadUrl = handlers.getOutputDownloadUrl(id);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition", selected ? "border-primary ring-1 ring-primary/30" : "border-border"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["NodeResizer"], {
                color: "hsl(var(--primary))",
                isVisible: selected,
                keepAspectRatio: true,
                minHeight: 140,
                minWidth: 140
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/output-node.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "flex items-center gap-1.5 text-xs font-semibold text-foreground",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground",
                        children: SOURCE_LABELS[data.source]
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 54,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/output-node.tsx",
                    lineNumber: 53,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/output-node.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "nodrag relative min-h-0 flex-1 bg-slate-950",
                children: data.status === "pending" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    "aria-live": "polite",
                    className: "grid h-full w-full place-items-center gap-2 p-4 text-center text-xs text-slate-300",
                    role: "status",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                            className: "h-5 w-5 text-primary"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 66,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: "生成中，请留在画布查看结果。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 67,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/canvas/output-node.tsx",
                    lineNumber: 61,
                    columnNumber: 11
                }, this) : data.status === "failed" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid h-full w-full place-items-center gap-2 p-4 text-center text-xs text-destructive",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TriangleAlert$3e$__["TriangleAlert"], {
                            className: "h-5 w-5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 71,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            children: data.errorMessage ?? "生成失败，可在右侧重试。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 72,
                            columnNumber: 13
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/canvas/output-node.tsx",
                    lineNumber: 70,
                    columnNumber: 11
                }, this) : data.url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid h-full w-full place-items-center overflow-hidden p-1",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                        alt: data.name,
                        className: "block h-full w-full select-none object-contain",
                        draggable: false,
                        onLoad: (event)=>{
                            const image = event.currentTarget;
                            handlers.onOutputImageLoad(id, image.naturalWidth, image.naturalHeight);
                        },
                        src: data.url
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 78,
                        columnNumber: 13
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/output-node.tsx",
                    lineNumber: 75,
                    columnNumber: 11
                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid h-full w-full place-items-center p-4 text-center text-xs text-slate-300",
                    children: "结果暂不可预览。"
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/output-node.tsx",
                    lineNumber: 94,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/output-node.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            data.status === "succeeded" && data.url ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-10 shrink-0 items-center gap-1 border-t border-border bg-card/80 px-2",
                children: [
                    downloadUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                        "aria-label": `下载：${data.name}`,
                        className: "nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                        download: data.name,
                        href: downloadUrl,
                        rel: "noreferrer",
                        title: "下载",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$download$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Download$3e$__["Download"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 110,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 102,
                        columnNumber: 13
                    }, this) : null,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        "aria-label": `查看原图：${data.name}`,
                        className: "nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground",
                        onClick: ()=>handlers.onOutputPreview(id),
                        title: "查看原图",
                        type: "button",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$maximize$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Maximize2$3e$__["Maximize2"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 120,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 113,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        "aria-label": `设为参考图：${data.name}`,
                        className: "nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50",
                        disabled: data.disabled,
                        onClick: ()=>handlers.onOutputSetAsReference(id),
                        title: "设为参考图",
                        type: "button",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2d$plus$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImagePlus$3e$__["ImagePlus"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 130,
                            columnNumber: 13
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 122,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        "aria-label": `图层拆分：${data.name}`,
                        className: "nodrag grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:opacity-50",
                        disabled: data.disabled || data.layerBusy,
                        onClick: ()=>handlers.onOutputLayerDecompose(id),
                        title: "图层拆分",
                        type: "button",
                        children: data.layerBusy ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                            className: "h-3.5 w-3.5 animate-spin"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 141,
                            columnNumber: 15
                        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layers$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Layers3$3e$__["Layers3"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/output-node.tsx",
                            lineNumber: 143,
                            columnNumber: 15
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/output-node.tsx",
                        lineNumber: 132,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/canvas/output-node.tsx",
                lineNumber: 100,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/canvas/output-node.tsx",
        lineNumber: 39,
        columnNumber: 5
    }, this);
}
_s(OutputNodeComponent, "PgiOtDWpPNBtkdE4mJlweUNsbqk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCanvasHandlers"]
    ];
});
_c = OutputNodeComponent;
const OutputNode = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memo"])(OutputNodeComponent);
_c1 = OutputNode;
var _c, _c1;
__turbopack_context__.k.register(_c, "OutputNodeComponent");
__turbopack_context__.k.register(_c1, "OutputNode");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/canvas/reference-node.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ReferenceNode",
    ()=>ReferenceNode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@xyflow/react/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trash-2.js [app-client] (ecmascript) <export default as Trash2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$bbox$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/bbox-canvas.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/workspace/canvas/canvas-context.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
/**
 * Reference image node: carries one project reference image, shows its「图N」
 * badge, supports media-ratio-normalized resize and in-node bbox framing.
 * Removal is confirmed and handled by the page (unlinks the reference without
 * deleting the backend asset).
 */ function ReferenceNodeComponent({ data, id, selected }) {
    _s();
    const handlers = (0, __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCanvasHandlers"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("flex h-full w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition", selected ? "border-primary ring-1 ring-primary/30" : "border-border"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$xyflow$2f$react$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["NodeResizer"], {
                color: "hsl(var(--primary))",
                isVisible: selected && !data.disabled,
                minHeight: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["REFERENCE_MEDIA_MIN_SIZE"] + __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["REFERENCE_NODE_VERTICAL_CHROME"],
                minWidth: __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["REFERENCE_MEDIA_MIN_SIZE"] + __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["REFERENCE_NODE_HORIZONTAL_CHROME"]
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                lineNumber: 35,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "flex items-center gap-1.5 text-xs font-semibold text-foreground",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary",
                                children: data.label
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                                lineNumber: 43,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "max-w-[9rem] truncate",
                                children: data.name
                            }, void 0, false, {
                                fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                        lineNumber: 42,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        "aria-label": `移除参考图：${data.name}`,
                        className: "nodrag grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-destructive disabled:opacity-50",
                        disabled: data.disabled,
                        onClick: ()=>handlers.onRequestRemoveReference(id),
                        title: `移除参考图：${data.name}`,
                        type: "button",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trash$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trash2$3e$__["Trash2"], {
                            className: "h-3.5 w-3.5"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                            lineNumber: 56,
                            columnNumber: 11
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                        lineNumber: 48,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                lineNumber: 41,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "nodrag min-h-0 flex-1 p-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$bbox$2d$canvas$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BboxCanvas"], {
                    alt: `参考图：${data.name}`,
                    bbox: data.bbox,
                    className: "h-full w-full",
                    disabled: data.disabled,
                    fillImageBox: true,
                    onChange: (bbox)=>handlers.onReferenceBboxChange(id, bbox),
                    onImageLoad: (naturalWidth, naturalHeight)=>handlers.onReferenceImageLoad(id, naturalWidth, naturalHeight),
                    onPreview: ()=>handlers.onReferencePreview(id),
                    url: data.url
                }, void 0, false, {
                    fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                    lineNumber: 60,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/components/workspace/canvas/reference-node.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/components/workspace/canvas/reference-node.tsx",
        lineNumber: 29,
        columnNumber: 5
    }, this);
}
_s(ReferenceNodeComponent, "PgiOtDWpPNBtkdE4mJlweUNsbqk=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$workspace$2f$canvas$2f$canvas$2d$context$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCanvasHandlers"]
    ];
});
_c = ReferenceNodeComponent;
const ReferenceNode = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["memo"])(ReferenceNodeComponent);
_c1 = ReferenceNode;
var _c, _c1;
__turbopack_context__.k.register(_c, "ReferenceNodeComponent");
__turbopack_context__.k.register(_c1, "ReferenceNode");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/workspace/image-edit-dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ImageEditDialog",
    ()=>ImageEditDialog,
    "createBboxAnnotation",
    ()=>createBboxAnnotation,
    "getContainedImageRect",
    ()=>getContainedImageRect,
    "normalizeImagePoint",
    ()=>normalizeImagePoint
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$dashed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BoxSelect$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/square-dashed.js [app-client] (ecmascript) <export default as BoxSelect>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$dot$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleDot$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-dot.js [app-client] (ecmascript) <export default as CircleDot>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eraser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eraser$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/eraser.js [app-client] (ecmascript) <export default as Eraser>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/image.js [app-client] (ecmascript) <export default as ImageIcon>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as LoaderCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wand-sparkles.js [app-client] (ecmascript) <export default as WandSparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/button.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/dialog.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/ui/textarea.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/utils.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
function getContainedImageRect(container, naturalWidth, naturalHeight) {
    if (container.width <= 0 || container.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
        return {
            ...container,
            height: 0,
            width: 0
        };
    }
    const scale = Math.min(container.width / naturalWidth, container.height / naturalHeight);
    const width = naturalWidth * scale;
    const height = naturalHeight * scale;
    return {
        height,
        left: container.left + (container.width - width) / 2,
        top: container.top + (container.height - height) / 2,
        width
    };
}
function normalizeImagePoint(clientX, clientY, imageRect) {
    return {
        x: normalizeCoordinate(clientX - imageRect.left, imageRect.width),
        y: normalizeCoordinate(clientY - imageRect.top, imageRect.height)
    };
}
function createBboxAnnotation(start, end) {
    const x1 = Math.min(start.x, end.x);
    const y1 = Math.min(start.y, end.y);
    const x2 = Math.max(start.x, end.x);
    const y2 = Math.max(start.y, end.y);
    return x1 < x2 && y1 < y2 ? {
        type: "bbox",
        x1,
        x2,
        y1,
        y2
    } : null;
}
function normalizeCoordinate(relative, length) {
    if (length <= 0) return 0;
    return Math.min(999, Math.max(0, Math.round(relative / length * 1000)));
}
function ImageEditDialog({ asset, format, isSubmitting, onOpenChange, onSubmit, open, size }) {
    _s();
    const imageRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const dragStartRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [annotation, setAnnotation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [mode, setMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("whole");
    const [prompt, setPrompt] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])("");
    const previewUrl = asset ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafePreviewUrl"])(asset) : null;
    function contentRect() {
        const image = imageRef.current;
        if (!image) return null;
        const bounds = image.getBoundingClientRect();
        return getContainedImageRect(bounds, image.naturalWidth, image.naturalHeight);
    }
    function pointFromEvent(event) {
        const rect = contentRect();
        return rect && rect.width > 0 && rect.height > 0 ? normalizeImagePoint(event.clientX, event.clientY, rect) : null;
    }
    function handlePointerDown(event) {
        if (mode === "whole") return;
        const point = pointFromEvent(event);
        if (!point) return;
        if (mode === "point") {
            setAnnotation({
                type: "point",
                ...point
            });
            return;
        }
        dragStartRef.current = point;
        event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    function handlePointerMove(event) {
        if (mode !== "bbox" || !dragStartRef.current) return;
        const point = pointFromEvent(event);
        if (!point) return;
        setAnnotation(createBboxAnnotation(dragStartRef.current, point));
    }
    function handlePointerUp(event) {
        if (mode !== "bbox" || !dragStartRef.current) return;
        const point = pointFromEvent(event);
        if (point) {
            setAnnotation(createBboxAnnotation(dragStartRef.current, point));
        }
        dragStartRef.current = null;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    function selectMode(nextMode) {
        setMode(nextMode);
        dragStartRef.current = null;
        if (nextMode === "whole") setAnnotation(null);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Dialog"], {
        onOpenChange: (next)=>{
            if (!isSubmitting) onOpenChange(next);
        },
        open: open,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogContent"], {
            className: "grid h-[min(94dvh,64rem)] max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto]",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogHeader"], {
                    className: "border-b border-border px-4 py-4 pr-14 sm:px-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogTitle"], {
                            children: "图片编辑"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 191,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$dialog$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DialogDescription"], {
                            children: "整图重绘，或用点选/框选将编辑指令定位到具体区域。"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 192,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                    lineNumber: 190,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "grid min-h-0 gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "min-w-0",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mb-3 flex min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-border bg-secondary/55 p-1",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolButton, {
                                            active: mode === "whole",
                                            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ImageIcon$3e$__["ImageIcon"],
                                            label: "整图编辑",
                                            onClick: ()=>selectMode("whole")
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 200,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolButton, {
                                            active: mode === "point",
                                            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$dot$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CircleDot$3e$__["CircleDot"],
                                            label: "点选精修",
                                            onClick: ()=>selectMode("point")
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 206,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(ToolButton, {
                                            active: mode === "bbox",
                                            icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$square$2d$dashed$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BoxSelect$3e$__["BoxSelect"],
                                            label: "框选精修",
                                            onClick: ()=>selectMode("bbox")
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 212,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "mx-1 h-5 w-px shrink-0 bg-border"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 218,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                                            "aria-label": "清除标注",
                                            disabled: !annotation,
                                            onClick: ()=>setAnnotation(null),
                                            size: "icon",
                                            title: "清除标注",
                                            type: "button",
                                            variant: "ghost",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$eraser$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Eraser$3e$__["Eraser"], {
                                                "aria-hidden": "true",
                                                className: "h-4 w-4"
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                                lineNumber: 228,
                                                columnNumber: 17
                                            }, this)
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 219,
                                            columnNumber: 15
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "ml-auto hidden truncate px-2 font-mono text-[11px] text-muted-foreground sm:block",
                                            children: annotation ? annotationLabel(annotation) : "NO ANNOTATION"
                                        }, void 0, false, {
                                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                            lineNumber: 230,
                                            columnNumber: 15
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 199,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "relative grid min-h-64 w-full place-items-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 sm:min-h-96 lg:h-full lg:max-h-[66dvh]",
                                    children: previewUrl ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "relative inline-grid max-h-full max-w-full place-items-center",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("img", {
                                                alt: "待编辑源图",
                                                className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])("block h-auto max-h-[66dvh] w-auto max-w-full select-none object-contain", mode === "point" && "cursor-crosshair", mode === "bbox" && "cursor-crosshair touch-none"),
                                                draggable: false,
                                                onPointerDown: handlePointerDown,
                                                onPointerMove: handlePointerMove,
                                                onPointerUp: handlePointerUp,
                                                ref: imageRef,
                                                src: previewUrl
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                                lineNumber: 240,
                                                columnNumber: 19
                                            }, this),
                                            annotation ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AnnotationOverlay, {
                                                annotation: annotation
                                            }, void 0, false, {
                                                fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                                lineNumber: 254,
                                                columnNumber: 33
                                            }, this) : null
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                        lineNumber: 237,
                                        columnNumber: 17
                                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "px-6 text-center text-sm text-slate-300",
                                        children: "源图暂不可预览"
                                    }, void 0, false, {
                                        fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                        lineNumber: 257,
                                        columnNumber: 17
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 235,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 198,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                            className: "flex min-w-0 flex-col",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-xl border border-border bg-secondary/35 px-3 py-2 text-xs text-muted-foreground",
                                    children: [
                                        "输出 ",
                                        size,
                                        " · ",
                                        format.toUpperCase()
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 265,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                    className: "mt-4 text-sm font-semibold",
                                    htmlFor: "image-edit-prompt",
                                    children: "编辑指令"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 268,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-1 text-xs leading-5 text-muted-foreground",
                                    children: "只描述需要改变的内容。未标注时指令作用于整张图片。"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 274,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$textarea$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Textarea"], {
                                    className: "mt-3 min-h-40 flex-1 resize-y leading-6 lg:min-h-0",
                                    disabled: isSubmitting,
                                    id: "image-edit-prompt",
                                    maxLength: 4000,
                                    onChange: (event)=>setPrompt(event.target.value),
                                    placeholder: "例如：将背景改为暖灰色摄影棚，保留商品造型和光影。",
                                    value: prompt
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 277,
                                    columnNumber: 13
                                }, this),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mt-2 text-right font-mono text-[11px] text-muted-foreground",
                                    children: [
                                        prompt.length,
                                        " / 4000"
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 286,
                                    columnNumber: 13
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 264,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                    lineNumber: 197,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex flex-col-reverse gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end sm:px-6",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            disabled: isSubmitting,
                            onClick: ()=>onOpenChange(false),
                            type: "button",
                            variant: "ghost",
                            children: "取消"
                        }, void 0, false, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 293,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
                            disabled: isSubmitting || !prompt.trim() || !previewUrl || mode !== "whole" && !annotation,
                            onClick: ()=>onSubmit({
                                    annotation,
                                    prompt: prompt.trim()
                                }),
                            type: "button",
                            children: [
                                isSubmitting ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LoaderCircle$3e$__["LoaderCircle"], {
                                    "aria-hidden": "true",
                                    className: "h-4 w-4 animate-spin"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 312,
                                    columnNumber: 15
                                }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wand$2d$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__WandSparkles$3e$__["WandSparkles"], {
                                    "aria-hidden": "true",
                                    className: "h-4 w-4"
                                }, void 0, false, {
                                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                                    lineNumber: 314,
                                    columnNumber: 15
                                }, this),
                                isSubmitting ? "正在提交" : "生成编辑版本"
                            ]
                        }, void 0, true, {
                            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                            lineNumber: 301,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/workspace/image-edit-dialog.tsx",
                    lineNumber: 292,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
            lineNumber: 189,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/image-edit-dialog.tsx",
        lineNumber: 183,
        columnNumber: 5
    }, this);
}
_s(ImageEditDialog, "7bosIs/cpbr+wnVp7AHc21PL4Xs=");
_c = ImageEditDialog;
function ToolButton({ active, icon: Icon, label, onClick }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$ui$2f$button$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Button"], {
        "aria-label": label,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$utils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])(active && "border-primary/30 bg-card text-primary"),
        onClick: onClick,
        size: "icon",
        title: label,
        type: "button",
        variant: active ? "outline" : "ghost",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
            "aria-hidden": "true",
            className: "h-4 w-4"
        }, void 0, false, {
            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
            lineNumber: 345,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/workspace/image-edit-dialog.tsx",
        lineNumber: 336,
        columnNumber: 5
    }, this);
}
_c1 = ToolButton;
function AnnotationOverlay({ annotation }) {
    if (annotation.type === "point") {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
            className: "pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.35)]",
            style: {
                left: `${annotation.x / 10}%`,
                top: `${annotation.y / 10}%`
            }
        }, void 0, false, {
            fileName: "[project]/components/workspace/image-edit-dialog.tsx",
            lineNumber: 357,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: "pointer-events-none absolute border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.8)]",
        style: {
            height: `${(annotation.y2 - annotation.y1) / 10}%`,
            left: `${annotation.x1 / 10}%`,
            top: `${annotation.y1 / 10}%`,
            width: `${(annotation.x2 - annotation.x1) / 10}%`
        }
    }, void 0, false, {
        fileName: "[project]/components/workspace/image-edit-dialog.tsx",
        lineNumber: 364,
        columnNumber: 5
    }, this);
}
_c2 = AnnotationOverlay;
function annotationLabel(annotation) {
    return annotation.type === "point" ? `POINT ${annotation.x},${annotation.y}` : `BBOX ${annotation.x1},${annotation.y1} → ${annotation.x2},${annotation.y2}`;
}
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "ImageEditDialog");
__turbopack_context__.k.register(_c1, "ToolButton");
__turbopack_context__.k.register(_c2, "AnnotationOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=components_0z2x8db._.js.map