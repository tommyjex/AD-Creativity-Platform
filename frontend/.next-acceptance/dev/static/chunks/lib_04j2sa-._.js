(globalThis["TURBOPACK"] || (globalThis["TURBOPACK"] = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/aigc/acceptance-network-guard.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "installAcceptanceNetworkGuard",
    ()=>installAcceptanceNetworkGuard,
    "isForbiddenAcceptanceRequest",
    ()=>isForbiddenAcceptanceRequest
]);
const FORBIDDEN_PATH = /\/(?:enhance-video|face-blur-video|multi-track-edit)(?:[/?#]|$)/i;
const INSTALL_KEY = Symbol.for("aigc.acceptance.network-guard");
function isForbiddenAcceptanceRequest(input) {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
        const url = new URL(raw, window.location.origin);
        return url.hostname.toLowerCase().includes("mediakit") || FORBIDDEN_PATH.test(url.pathname);
    } catch  {
        return /mediakit/i.test(raw) || FORBIDDEN_PATH.test(raw);
    }
}
function installAcceptanceNetworkGuard() {
    const guardedWindow = window;
    const installed = guardedWindow[INSTALL_KEY];
    if (installed) {
        installed.references += 1;
        return ()=>releaseGuard(guardedWindow);
    }
    const originalFetch = window.fetch;
    const originalOpen = XMLHttpRequest.prototype.open;
    const invokeOpen = originalOpen;
    const originalSendBeacon = navigator.sendBeacon?.bind(navigator);
    window.fetch = (input, init)=>{
        assertAllowed(input);
        return originalFetch(input, init);
    };
    XMLHttpRequest.prototype.open = function(method, url, async = true, username, password) {
        assertAllowed(url);
        return invokeOpen.call(this, method, url, async, username ?? null, password ?? null);
    };
    if (originalSendBeacon) {
        navigator.sendBeacon = (url, data)=>{
            assertAllowed(url);
            return originalSendBeacon(url, data);
        };
    }
    guardedWindow[INSTALL_KEY] = {
        references: 1,
        restore: ()=>{
            window.fetch = originalFetch;
            XMLHttpRequest.prototype.open = originalOpen;
            if (originalSendBeacon) navigator.sendBeacon = originalSendBeacon;
            delete guardedWindow[INSTALL_KEY];
        }
    };
    return ()=>releaseGuard(guardedWindow);
}
function assertAllowed(input) {
    if (isForbiddenAcceptanceRequest(input)) {
        throw new Error("Acceptance safety guard blocked a MediaKit processing request");
    }
}
function releaseGuard(guardedWindow) {
    const installed = guardedWindow[INSTALL_KEY];
    if (!installed) return;
    installed.references -= 1;
    if (installed.references === 0) installed.restore();
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/autosave-coordinator.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AUTOSAVE_DEBOUNCE_MS",
    ()=>AUTOSAVE_DEBOUNCE_MS,
    "AUTOSAVE_RETRY_DELAYS_MS",
    ()=>AUTOSAVE_RETRY_DELAYS_MS,
    "AutosaveCoordinator",
    ()=>AutosaveCoordinator
]);
const AUTOSAVE_DEBOUNCE_MS = 800;
const AUTOSAVE_RETRY_DELAYS_MS = [
    1_000,
    2_000,
    4_000
];
class AutosaveCoordinator {
    clone;
    equals;
    getErrorMessage;
    isConflict;
    isRetryable;
    onlineTarget;
    save;
    validate;
    listeners = new Set();
    debounceTimer = null;
    drainPromise = null;
    disposed = false;
    nextSnapshotId = 1;
    latestSnapshot;
    savedSnapshot;
    state;
    constructor(options){
        this.clone = options.clone ?? defaultClone;
        this.equals = options.equals;
        this.getErrorMessage = options.getErrorMessage ?? defaultErrorMessage;
        this.isConflict = options.isConflict ?? defaultIsConflict;
        this.isRetryable = options.isRetryable ?? defaultIsRetryable;
        this.onlineTarget = options.onlineTarget === undefined ? defaultOnlineTarget() : options.onlineTarget;
        this.save = options.save;
        this.validate = options.validate ?? (()=>null);
        const initialSnapshot = this.capture(options.initialSnapshot);
        this.latestSnapshot = {
            id: 0,
            value: initialSnapshot
        };
        this.savedSnapshot = {
            id: 0,
            value: initialSnapshot
        };
        this.state = freezeState({
            status: "idle",
            revision: options.initialRevision,
            latestSnapshotId: 0,
            savedSnapshotId: 0,
            dirty: false,
            message: null,
            retryAttempt: 0
        });
        this.onlineTarget?.addEventListener("online", this.handleOnline);
    }
    getState() {
        return this.state;
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return ()=>{
            this.listeners.delete(listener);
        };
    }
    update(snapshot) {
        if (this.disposed) return this.latestSnapshot.id;
        const captured = this.capture(snapshot);
        if (this.equals(captured, this.latestSnapshot.value)) {
            return this.latestSnapshot.id;
        }
        const next = {
            id: this.nextSnapshotId++,
            value: captured
        };
        this.latestSnapshot = next;
        if (!this.drainPromise && this.equals(next.value, this.savedSnapshot.value)) {
            this.clearDebounce();
            this.savedSnapshot = next;
            this.setState({
                status: "saved",
                latestSnapshotId: next.id,
                savedSnapshotId: next.id,
                dirty: false,
                message: null,
                retryAttempt: 0
            });
            return next.id;
        }
        if (this.state.status === "conflict") {
            this.setState({
                latestSnapshotId: next.id,
                dirty: true
            });
            return next.id;
        }
        const validationMessage = this.validate(next.value);
        if (validationMessage) {
            this.clearDebounce();
            this.setState({
                status: this.drainPromise ? "saving" : "invalid",
                latestSnapshotId: next.id,
                dirty: true,
                message: this.drainPromise ? null : validationMessage,
                retryAttempt: 0
            });
            return next.id;
        }
        if (this.drainPromise) {
            this.setState({
                status: "saving",
                latestSnapshotId: next.id,
                dirty: true,
                message: null
            });
            return next.id;
        }
        this.scheduleDebouncedSave();
        return next.id;
    }
    async flush(options = {}) {
        this.clearDebounce();
        const validate = options.validate ?? this.validate;
        if (this.drainPromise) {
            const activeDrain = this.drainPromise;
            await activeDrain;
            if (this.drainPromise === activeDrain) {
                this.drainPromise = null;
            }
        }
        if (!this.state.dirty) {
            return {
                ok: true,
                revision: this.state.revision
            };
        }
        if (this.state.status === "conflict") {
            return this.failureResult("conflict");
        }
        const validationMessage = validate(this.latestSnapshot.value);
        if (validationMessage) {
            this.setState({
                status: "invalid",
                dirty: true,
                message: validationMessage,
                retryAttempt: 0
            });
            return this.failureResult("invalid");
        }
        await this.startDrain(validate);
        const settledState = this.getState();
        if (!settledState.dirty) {
            return {
                ok: true,
                revision: settledState.revision
            };
        }
        if (settledState.status === "conflict" || settledState.status === "invalid" || settledState.status === "failed") {
            return this.failureResult(settledState.status);
        }
        return this.failureResult("failed", "自动保存未能完成。");
    }
    async rebase(options) {
        if (this.disposed || options.revision <= this.state.revision) {
            return {
                applied: false,
                dirty: this.state.dirty,
                revision: this.state.revision,
                snapshot: this.latestSnapshot.value
            };
        }
        this.clearDebounce();
        if (this.drainPromise) {
            const activeDrain = this.drainPromise;
            await activeDrain;
            if (this.drainPromise === activeDrain) {
                this.drainPromise = null;
            }
        }
        if (this.disposed || options.revision <= this.state.revision) {
            return {
                applied: false,
                dirty: this.state.dirty,
                revision: this.state.revision,
                snapshot: this.latestSnapshot.value
            };
        }
        const serverValue = this.capture(options.snapshot);
        const hadLocalChanges = !this.equals(this.latestSnapshot.value, this.savedSnapshot.value);
        const rebasedValue = hadLocalChanges ? this.capture(options.merge(this.savedSnapshot.value, this.latestSnapshot.value, serverValue)) : serverValue;
        const serverSnapshot = {
            id: this.nextSnapshotId++,
            value: serverValue
        };
        this.savedSnapshot = serverSnapshot;
        const dirty = !this.equals(rebasedValue, serverValue);
        this.latestSnapshot = dirty ? {
            id: this.nextSnapshotId++,
            value: rebasedValue
        } : serverSnapshot;
        this.setState({
            status: dirty ? "pending" : "saved",
            revision: options.revision,
            latestSnapshotId: this.latestSnapshot.id,
            savedSnapshotId: this.savedSnapshot.id,
            dirty,
            message: null,
            retryAttempt: 0
        });
        if (dirty) {
            const validationMessage = this.validate(rebasedValue);
            if (validationMessage) {
                this.setState({
                    status: "invalid",
                    message: validationMessage
                });
            } else {
                this.scheduleDebouncedSave();
            }
        }
        return {
            applied: true,
            dirty,
            revision: options.revision,
            snapshot: this.latestSnapshot.value
        };
    }
    notifyOnline() {
        if (this.disposed || this.state.status !== "failed" || !this.state.dirty || this.drainPromise) {
            return;
        }
        const validationMessage = this.validate(this.latestSnapshot.value);
        if (validationMessage) {
            this.setState({
                status: "invalid",
                message: validationMessage,
                retryAttempt: 0
            });
            return;
        }
        void this.startDrain();
    }
    activate() {
        if (!this.disposed) return;
        this.disposed = false;
        this.onlineTarget?.addEventListener("online", this.handleOnline);
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.clearDebounce();
        this.onlineTarget?.removeEventListener("online", this.handleOnline);
        this.listeners.clear();
    }
    handleOnline = ()=>{
        this.notifyOnline();
    };
    capture(snapshot) {
        return deepFreeze(this.clone(snapshot));
    }
    scheduleDebouncedSave() {
        this.clearDebounce();
        this.setState({
            status: "pending",
            latestSnapshotId: this.latestSnapshot.id,
            dirty: true,
            message: null,
            retryAttempt: 0
        });
        this.debounceTimer = setTimeout(()=>{
            this.debounceTimer = null;
            void this.startDrain();
        }, AUTOSAVE_DEBOUNCE_MS);
    }
    startDrain(validate = this.validate) {
        if (this.drainPromise) return this.drainPromise;
        const promise = this.drain(validate);
        this.drainPromise = promise;
        void promise.finally(()=>{
            if (this.drainPromise === promise) {
                this.drainPromise = null;
            }
        });
        return promise;
    }
    async drain(validate) {
        while(!this.disposed && this.latestSnapshot.id !== this.savedSnapshot.id){
            const submitted = this.latestSnapshot;
            const validationMessage = validate(submitted.value);
            if (validationMessage) {
                this.setState({
                    status: "invalid",
                    dirty: true,
                    message: validationMessage,
                    retryAttempt: 0
                });
                return;
            }
            this.setState({
                status: "saving",
                latestSnapshotId: this.latestSnapshot.id,
                dirty: true,
                message: null,
                retryAttempt: 0
            });
            const outcome = await this.saveWithRetry(submitted);
            if (outcome.ok) {
                this.savedSnapshot = submitted;
                const latestMatchesSaved = this.equals(this.latestSnapshot.value, submitted.value);
                if (latestMatchesSaved) {
                    this.savedSnapshot = this.latestSnapshot;
                }
                this.setState({
                    status: latestMatchesSaved ? "saved" : "saving",
                    revision: outcome.revision,
                    latestSnapshotId: this.latestSnapshot.id,
                    savedSnapshotId: this.savedSnapshot.id,
                    dirty: !latestMatchesSaved,
                    message: null,
                    retryAttempt: 0
                });
                continue;
            }
            if (outcome.reason === "conflict") {
                this.setState({
                    status: "conflict",
                    latestSnapshotId: this.latestSnapshot.id,
                    dirty: true,
                    message: outcome.message,
                    retryAttempt: 0
                });
                return;
            }
            if (this.latestSnapshot.id !== submitted.id) {
                continue;
            }
            this.setState({
                status: "failed",
                latestSnapshotId: this.latestSnapshot.id,
                dirty: true,
                message: outcome.message,
                retryAttempt: outcome.retryAttempt
            });
            return;
        }
    }
    async saveWithRetry(submitted) {
        let retryAttempt = 0;
        while(!this.disposed){
            try {
                const result = await this.save({
                    snapshot: this.capture(submitted.value),
                    snapshotId: submitted.id,
                    expectedRevision: this.state.revision
                });
                return {
                    ok: true,
                    revision: result.revision
                };
            } catch (error) {
                if (this.isConflict(error)) {
                    return {
                        ok: false,
                        reason: "conflict",
                        message: this.getErrorMessage(error),
                        retryAttempt
                    };
                }
                if (!this.isRetryable(error) || retryAttempt >= AUTOSAVE_RETRY_DELAYS_MS.length) {
                    return {
                        ok: false,
                        reason: "failed",
                        message: this.getErrorMessage(error),
                        retryAttempt
                    };
                }
                const delay = AUTOSAVE_RETRY_DELAYS_MS[retryAttempt];
                retryAttempt += 1;
                this.setState({
                    status: "saving",
                    dirty: true,
                    message: this.getErrorMessage(error),
                    retryAttempt
                });
                await wait(delay);
            }
        }
        return {
            ok: false,
            reason: "failed",
            message: "自动保存协调器已停止。",
            retryAttempt
        };
    }
    failureResult(reason, fallbackMessage) {
        return {
            ok: false,
            reason,
            revision: this.state.revision,
            message: this.state.message ?? fallbackMessage ?? "自动保存失败。"
        };
    }
    clearDebounce() {
        if (this.debounceTimer === null) return;
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
    }
    setState(patch) {
        this.state = freezeState({
            ...this.state,
            ...patch
        });
        for (const listener of this.listeners){
            listener(this.state);
        }
    }
}
function defaultClone(snapshot) {
    return structuredClone(snapshot);
}
function deepFreeze(value, seen = new WeakSet()) {
    if (value === null || typeof value !== "object" || ArrayBuffer.isView(value) || seen.has(value)) {
        return value;
    }
    seen.add(value);
    for (const child of Object.values(value)){
        deepFreeze(child, seen);
    }
    return Object.freeze(value);
}
function freezeState(state) {
    return Object.freeze(state);
}
function errorStatus(error) {
    if (typeof error === "object" && error !== null && "status" in error && typeof error.status === "number") {
        return error.status;
    }
    return null;
}
function defaultIsConflict(error) {
    return errorStatus(error) === 409;
}
function defaultIsRetryable(error) {
    const status = errorStatus(error);
    return error instanceof TypeError || status === 0 || status !== null && status >= 500;
}
function defaultErrorMessage(error) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
        return error.message;
    }
    return "自动保存失败。";
}
function defaultOnlineTarget() {
    return typeof globalThis.addEventListener === "function" && typeof globalThis.removeEventListener === "function" ? globalThis : null;
}
function wait(delayMs) {
    return new Promise((resolve)=>{
        setTimeout(resolve, delayMs);
    });
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/bbox-references.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_COORDINATE_TAG_PATTERN",
    ()=>AIGC_COORDINATE_TAG_PATTERN,
    "AIGC_MAX_BBOX_REFERENCES",
    ()=>AIGC_MAX_BBOX_REFERENCES,
    "bboxReferences",
    ()=>bboxReferences,
    "connectionBreaksBboxReferences",
    ()=>connectionBreaksBboxReferences,
    "eligibleBboxTextTargets",
    ()=>eligibleBboxTextTargets,
    "isBboxReferencePaused",
    ()=>isBboxReferencePaused,
    "isEligibleBboxTextTarget",
    ()=>isEligibleBboxTextTarget,
    "sanitizeBboxReferences",
    ()=>sanitizeBboxReferences
]);
const AIGC_MAX_BBOX_REFERENCES = 10;
const AIGC_COORDINATE_TAG_PATTERN = /<\/?\s*(?:bbox|point)\b/iu;
function bboxReferences(node) {
    return node.config.bbox_references ?? [];
}
function isBboxTextNode(node) {
    return node.type === "text";
}
function isBboxImageNode(node) {
    return node.type === "image";
}
function hasUpstream(definition, nodeId) {
    return definition.edges.some((edge)=>edge.targetNodeId === nodeId);
}
function hasStrictBboxRelationship(definition, imageNodeId, textNodeId) {
    const downstream = definition.edges.filter((edge)=>edge.sourceNodeId === textNodeId && edge.sourceHandle === "text");
    if (downstream.length === 0) return false;
    return downstream.every((promptEdge)=>{
        const target = definition.nodes.find((node)=>node.id === promptEdge.targetNodeId);
        if (target?.type !== "image_to_image" || promptEdge.targetHandle !== "prompt") {
            return false;
        }
        return definition.edges.some((edge)=>edge.sourceNodeId === imageNodeId && edge.sourceHandle === "image" && edge.targetNodeId === target.id && edge.targetHandle === "image");
    });
}
function isEligibleBboxTextTarget(definition, imageNodeId, textNodeId, effectiveImageAssetId) {
    const textNode = definition.nodes.find((node)=>node.id === textNodeId);
    const imageNode = definition.nodes.find((node)=>node.id === imageNodeId);
    if (!textNode || !imageNode) {
        return false;
    }
    if (definition.schemaVersion === 2 && (textNode.type !== "text" || imageNode.type !== "image")) {
        return false;
    }
    if (!isBboxTextNode(textNode) || !isBboxImageNode(imageNode)) {
        return false;
    }
    const imageHasUpstream = hasUpstream(definition, imageNodeId);
    return !hasUpstream(definition, textNodeId) && (!imageHasUpstream || Boolean(effectiveImageAssetId)) && hasStrictBboxRelationship(definition, imageNodeId, textNodeId);
}
function eligibleBboxTextTargets(definition, imageNodeId, effectiveImageAssetId) {
    return definition.nodes.filter((node)=>isBboxTextNode(node) && isEligibleBboxTextTarget(definition, imageNodeId, node.id, effectiveImageAssetId));
}
function isBboxReferencePaused(definition, imageNodeId, textNodeId) {
    const textNode = definition.nodes.find((node)=>node.id === textNodeId);
    const imageNode = definition.nodes.find((node)=>node.id === imageNodeId);
    return Boolean(textNode && imageNode && isBboxTextNode(textNode) && isBboxImageNode(imageNode) && hasStrictBboxRelationship(definition, imageNodeId, textNodeId) && hasUpstream(definition, textNodeId));
}
function sanitizeBboxReferences(definition) {
    const nodes = definition.nodes.map((node)=>{
        if (!isBboxTextNode(node)) return node;
        const references = bboxReferences(node);
        const nextReferences = references.filter((reference)=>{
            const image = definition.nodes.find((candidate)=>candidate.id === reference.source_node_id);
            return image != null && isBboxImageNode(image) && (hasUpstream(definition, image.id) ? image.config.upstream_bbox != null && image.config.upstream_bbox_asset_id != null || image.config.bbox != null && image.config.bbox_asset_id === image.config.asset_id : image.config.bbox != null && image.config.bbox_asset_id === image.config.asset_id) && hasStrictBboxRelationship(definition, reference.source_node_id, node.id);
        });
        return nextReferences.length === references.length ? node : {
            ...node,
            config: {
                ...node.config,
                bbox_references: nextReferences
            }
        };
    });
    return nodes.every((node, index)=>node === definition.nodes[index]) ? definition : {
        ...definition,
        nodes
    };
}
function connectionBreaksBboxReferences(connection, nodes, edges) {
    const source = nodes.find((node)=>node.id === connection.sourceNodeId);
    if (!source || !isBboxTextNode(source) || bboxReferences(source).length === 0) {
        return false;
    }
    const target = nodes.find((node)=>node.id === connection.targetNodeId);
    if (target?.type !== "image_to_image" || connection.sourceHandle !== "text" || connection.targetHandle !== "prompt") {
        return true;
    }
    return bboxReferences(source).some((reference)=>!edges.some((edge)=>edge.sourceNodeId === reference.source_node_id && edge.sourceHandle === "image" && edge.targetNodeId === connection.targetNodeId && edge.targetHandle === "image"));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/connection-validation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "connectionValidationFeedback",
    ()=>connectionValidationFeedback,
    "getAigcConnectionValidationError",
    ()=>getAigcConnectionValidationError,
    "isValidAigcConnection",
    ()=>isValidAigcConnection
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/bbox-references.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-generation.ts [app-client] (ecmascript)");
;
;
;
;
function isValidAigcConnection(connection, nodes, edges) {
    return getAigcConnectionValidationError(connection, nodes, edges) === null;
}
function getAigcConnectionValidationError(connection, nodes, edges) {
    const { source, sourceHandle, target, targetHandle } = connection;
    if (!source || !target || !sourceHandle || !targetHandle || source === target) {
        return "invalid_connection";
    }
    if (edges.some((edge)=>edge.sourceNodeId === source && edge.sourceHandle === sourceHandle && edge.targetNodeId === target && edge.targetHandle === targetHandle)) {
        return "duplicate_edge";
    }
    const sourceNode = nodes.find((node)=>node.id === source);
    const targetNode = nodes.find((node)=>node.id === target);
    if (!sourceNode || !targetNode) return "invalid_connection";
    const sourcePort = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(sourceNode.type)?.outputs.find((port)=>port.id === sourceHandle);
    const targetPort = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(targetNode.type)?.inputs.find((port)=>port.id === targetHandle);
    if (!sourcePort || !targetPort || sourcePort.type !== targetPort.type) {
        return "port_type_mismatch";
    }
    if (sourcePort.system_only) {
        return "system_only_output";
    }
    if (targetNode.type === "video_generation" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isVideoPortActive"])(targetPort, targetNode.config.generation_mode)) {
        return "input_not_allowed_for_mode";
    }
    if (targetNode.type === "image_to_image" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageInputActive"])(targetNode, targetPort.id, edges)) {
        return "input_not_allowed_for_mode";
    }
    if (sourceNode.type === "image_to_image" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImageOutputActive"])(sourceNode, sourcePort.id, edges)) {
        return "output_not_allowed_for_mode";
    }
    if (wouldCreateCycle(source, target, edges)) {
        return "cycle";
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["connectionBreaksBboxReferences"])({
        sourceNodeId: source,
        sourceHandle,
        targetNodeId: target,
        targetHandle
    }, [
        ...nodes
    ], [
        ...edges
    ])) {
        return "bbox_reference_conflict";
    }
    const connectionCount = edges.filter((edge)=>edge.targetNodeId === target && edge.targetHandle === targetHandle).length;
    const maxConnections = targetNode.type === "video_generation" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputLimit"])(targetNode, targetPort) : targetNode.type === "image_to_image" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageInputLimit"])(targetNode, targetPort) : targetPort.max_connections;
    return connectionCount >= maxConnections ? "target_connection_limit" : null;
}
function connectionValidationFeedback(validationError, connection, nodes) {
    const target = nodes.find((node)=>node.id === connection.target);
    if (validationError === "target_connection_limit" && target?.type === "image_to_image" && connection.targetHandle === "image") {
        const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(target.type);
        const port = registration?.inputs.find((candidate)=>candidate.id === connection.targetHandle);
        const limit = port ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageInputLimit"])(target, port) : 1;
        return (target.config.operation ?? "image_to_image") === "image_to_image" ? `图生图节点最多支持 ${limit} 张参考图` : `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageTitle"])(target)}节点最多支持 ${limit} 张图片`;
    }
    if (validationError === "target_connection_limit" && target?.type === "video_generation") {
        const port = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(target.type)?.inputs.find((candidate)=>candidate.id === connection.targetHandle);
        if (port) {
            return `${port.label}最多支持 ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$generation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["videoInputLimit"])(target, port)} 个连接`;
        }
    }
    if (validationError === "input_not_allowed_for_mode" && target?.type === "video_generation") {
        const port = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(target.type)?.inputs.find((candidate)=>candidate.id === connection.targetHandle);
        return `${port?.label ?? "该输入"}不适用于当前生成模式`;
    }
    if (validationError === "input_not_allowed_for_mode" && target?.type === "image_to_image") {
        const port = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(target.type)?.inputs.find((candidate)=>candidate.id === connection.targetHandle);
        return `${port?.label ?? "该输入"}不适用于${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageTitle"])(target)}模式`;
    }
    if (validationError === "output_not_allowed_for_mode") {
        return "该输出不适用于当前 Seedream 模式或编辑目标";
    }
    if (validationError === "system_only_output") {
        return "JSON 解析器的 items 输出由系统自动管理，不能手工连接。";
    }
    if (validationError === "duplicate_edge") return "该连线已存在。";
    if (validationError === "cycle") return "连线会形成环路。";
    if (validationError === "bbox_reference_conflict") {
        return "该文本节点含框选引用，只能连接到同时接收对应图片的图生图节点。";
    }
    return "端口类型不匹配，或目标端口已有输入。";
}
function wouldCreateCycle(sourceNodeId, targetNodeId, edges) {
    const downstream = new Map();
    for (const edge of edges){
        const targets = downstream.get(edge.sourceNodeId) ?? [];
        targets.push(edge.targetNodeId);
        downstream.set(edge.sourceNodeId, targets);
    }
    const pending = [
        targetNodeId
    ];
    const visited = new Set();
    while(pending.length > 0){
        const nodeId = pending.pop();
        if (nodeId === sourceNodeId) return true;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);
        pending.push(...downstream.get(nodeId) ?? []);
    }
    return false;
}
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
"[project]/lib/aigc/download.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/definition-migration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/asset-display.ts [app-client] (ecmascript)");
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
    if (!asset?.available || !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSafeAssetContentUrl"])(asset.download_url) || !asset.asset_id.trim()) {
        return null;
    }
    const fileExtension = extension(asset.mime_type);
    const naming = aigcDownloadNaming(asset, title, fallbackTitle, definition);
    const ordinalSuffix = !naming.applyOrdinal || omitFirstOrdinalSuffix && asset.ordinal === 0 ? "" : `-${asset.ordinal + 1}`;
    const filename = utf8LimitedFilename(naming.basename, `${ordinalSuffix}.${fileExtension}`);
    const url = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$asset$2d$display$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getAssetDownloadUrlById"])(asset.asset_id, filename);
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
    const migrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(definition);
    const node = migrated.nodes.find((candidate)=>candidate.id === nodeId);
    if (!node || !(node.type === "text_to_image" || node.type === "video_generation" || node.type === "image_to_image" && node.config.operation !== "layer_decomposition")) {
        return null;
    }
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(migrated.nodes).get(nodeId)?.displayName ?? null;
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/editor-store.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createAigcEditorStore",
    ()=>createAigcEditorStore,
    "deriveAigcModalityNodeMode",
    ()=>deriveAigcModalityNodeMode,
    "mergeAigcServerRevision",
    ()=>mergeAigcServerRevision,
    "readAigcRunDefinitionSnapshot",
    ()=>readAigcRunDefinitionSnapshot,
    "serializeAigcEditorDefinition",
    ()=>serializeAigcEditorDefinition
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/vanilla.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/connection-validation.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/definition-migration.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/multitrack.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-enhancement.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/video-face-blur.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/bbox-references.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-layout.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
;
const HISTORY_LIMIT = 30;
const emptyDefinition = {
    schemaVersion: 2,
    nodes: [],
    edges: [],
    viewport: {
        x: 0,
        y: 0,
        zoom: 1
    }
};
const emptyInitialState = {
    definition: emptyDefinition,
    description: "",
    entityId: "",
    mode: "pipeline",
    name: "",
    revision: 0
};
function createAigcEditorStore(initialState = emptyInitialState) {
    let serverSnapshot = normalizeEditorSnapshot(initialState);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$vanilla$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createStore"])((set, get)=>({
            definition: serverSnapshot.definition,
            description: initialState.description,
            dirty: false,
            entityId: initialState.entityId || null,
            future: [],
            mode: initialState.mode,
            name: initialState.name,
            past: [],
            renamingNodeId: null,
            revision: initialState.revision,
            selectedNodeId: null,
            initialize: (payload)=>{
                serverSnapshot = normalizeEditorSnapshot(payload);
                set({
                    ...payload,
                    definition: serverSnapshot.definition,
                    dirty: false,
                    future: [],
                    past: [],
                    renamingNodeId: null,
                    selectedNodeId: null
                });
            },
            applyServerRevision: (payload, resolved)=>{
                const state = get();
                if (payload.revision <= state.revision) return "ignored";
                const remote = normalizeEditorSnapshot(payload);
                const next = resolved?.draft ?? (state.dirty ? mergeAigcServerRevision(serverSnapshot, snapshot(state), remote) : remote);
                const dirty = resolved?.dirty ?? state.dirty;
                const rebaseHistory = (item)=>mergeAigcServerRevision(serverSnapshot, item, remote, resolved?.authoritativeNodeNames);
                serverSnapshot = remote;
                set({
                    ...structuredClone(next),
                    dirty,
                    future: dirty ? state.future.map(rebaseHistory) : [],
                    past: dirty ? state.past.map(rebaseHistory) : [],
                    revision: payload.revision,
                    selectedNodeId: state.selectedNodeId && next.definition.nodes.some((node)=>node.id === state.selectedNodeId) ? state.selectedNodeId : null
                });
                return "applied";
            },
            selectNode: (selectedNodeId)=>set({
                    selectedNodeId
                }),
            setRenamingNodeId: (renamingNodeId)=>set({
                    renamingNodeId
                }),
            markSaved: (revision)=>{
                const state = get();
                serverSnapshot = snapshot(state);
                set({
                    dirty: false,
                    revision
                });
            },
            setName: (name)=>commit(set, get, {
                    name
                }),
            setDescription: (description)=>commit(set, get, {
                    description
                }),
            setViewport: (viewport)=>set((state)=>{
                    if (state.definition.viewport.x === viewport.x && state.definition.viewport.y === viewport.y && state.definition.viewport.zoom === viewport.zoom) {
                        return state;
                    }
                    return {
                        definition: {
                            ...state.definition,
                            viewport
                        },
                        dirty: true
                    };
                }),
            addNode: (type, centerPosition)=>{
                const state = get();
                const node = createNode(type, state.definition.nodes.length, centerPosition);
                commit(set, get, {
                    definition: {
                        ...state.definition,
                        nodes: [
                            ...state.definition.nodes,
                            node
                        ]
                    },
                    selectedNodeId: node.id
                });
            },
            applyGeneratedNodeNames: (names)=>{
                if (names.size === 0) return;
                const state = get();
                const applyNames = (definition)=>({
                        ...definition,
                        nodes: definition.nodes.map((node)=>{
                            const name = names.get(node.id);
                            return name === undefined ? node : {
                                ...node,
                                custom_name: name
                            };
                        })
                    });
                const definition = applyNames(state.definition);
                if (definition.nodes.every((node, index)=>node.custom_name === state.definition.nodes[index]?.custom_name)) {
                    return;
                }
                set({
                    definition,
                    dirty: true,
                    future: state.future.map((item)=>({
                            ...item,
                            definition: applyNames(item.definition)
                        })),
                    past: state.past.map((item)=>({
                            ...item,
                            definition: applyNames(item.definition)
                        }))
                });
            },
            setNodeCustomName: (nodeId, customName)=>{
                const state = get();
                const normalized = normalizeCustomName(customName);
                const current = state.definition.nodes.find((node)=>node.id === nodeId);
                if (!current || (current.custom_name ?? null) === normalized) return;
                commit(set, get, {
                    definition: {
                        ...state.definition,
                        nodes: state.definition.nodes.map((node)=>node.id === nodeId ? {
                                ...node,
                                custom_name: normalized
                            } : node)
                    }
                });
            },
            moveNode: (nodeId, position)=>{
                const state = get();
                commit(set, get, {
                    definition: {
                        ...state.definition,
                        nodes: state.definition.nodes.map((node)=>node.id === nodeId ? {
                                ...node,
                                position
                            } : node)
                    }
                });
            },
            resizeNode: (nodeId, size)=>{
                const state = get();
                commit(set, get, {
                    definition: {
                        ...state.definition,
                        nodes: state.definition.nodes.map((node)=>node.id === nodeId ? {
                                ...node,
                                size: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeAigcNodeSize"])(node.type, size)
                            } : node)
                    }
                });
            },
            updateNodeConfig: (nodeId, config)=>{
                const state = get();
                const definition = editorDefinition(state.definition);
                const currentNode = definition.nodes.find((node)=>node.id === nodeId);
                const imageAssetChanged = currentNode?.type === "image" && "asset_id" in config && currentNode.config.asset_id !== config.asset_id;
                const nodes = definition.nodes.map((node)=>{
                    if (node.id === nodeId) {
                        return {
                            ...node,
                            config: imageAssetChanged && node.type === "image" ? {
                                ...config,
                                bbox: null,
                                bbox_asset_id: null
                            } : node.type === "image_to_image" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamImageConfig"])(config, (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageOperation"])(node)) : node.type === "video_enhancement" ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeVideoEnhancementConfig"])(config) : config
                        };
                    }
                    if (imageAssetChanged && node.type === "text") {
                        return {
                            ...node,
                            config: {
                                ...node.config,
                                bbox_references: textReferences(node).filter((reference)=>reference.source_node_id !== nodeId)
                            }
                        };
                    }
                    return node;
                });
                commit(set, get, {
                    definition: {
                        ...definition,
                        nodes
                    }
                });
            },
            applyOptimizedTextPrompt: (nodeId, expected, optimizedText, optimizedInstructions, optimizeReferences = true)=>{
                const state = get();
                const definition = editorDefinition(state.definition);
                const node = definition.nodes.find((candidate)=>candidate.id === nodeId);
                if (node?.type !== "text") return "stale";
                const currentReferences = textReferences(node);
                const expectedReferences = expected.bbox_references ?? [];
                if (node.config.text !== expected.text || (node.config.upstream_text_override ?? null) !== (expected.upstream_text_override ?? null) || currentReferences.length !== expectedReferences.length || currentReferences.some((reference, index)=>reference.source_node_id !== expectedReferences[index]?.source_node_id || reference.instruction !== expectedReferences[index]?.instruction) || optimizeReferences && optimizedInstructions.length !== currentReferences.length) {
                    return "stale";
                }
                const nextReferences = optimizeReferences ? currentReferences.map((reference, index)=>({
                        ...reference,
                        instruction: optimizedInstructions[index] ?? ""
                    })) : currentReferences;
                const upstream = definition.edges.some((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === "text");
                const currentEffectiveText = upstream ? node.config.upstream_text_override : node.config.text;
                if (currentEffectiveText === optimizedText && currentReferences.every((reference, index)=>reference.instruction === nextReferences[index]?.instruction)) {
                    return "unchanged";
                }
                commit(set, get, {
                    definition: {
                        ...definition,
                        nodes: definition.nodes.map((candidate)=>candidate.id === nodeId && candidate.type === "text" ? {
                                ...candidate,
                                config: {
                                    ...candidate.config,
                                    bbox_references: nextReferences,
                                    ...upstream ? {
                                        upstream_text_override: optimizedText
                                    } : {
                                        text: optimizedText
                                    }
                                }
                            } : candidate)
                    }
                });
                return "applied";
            },
            setImageBboxBindings: (imageNodeId, bbox, textNodeIds, source)=>{
                const state = get();
                const currentDefinition = editorDefinition(state.definition);
                const image = currentDefinition.nodes.find((node)=>node.id === imageNodeId);
                if (image?.type !== "image") return;
                const binding = source ?? {
                    assetId: image.config.asset_id,
                    mode: "local"
                };
                if (bbox && !binding.assetId) return;
                const selectedTargets = new Set(textNodeIds);
                const nodes = currentDefinition.nodes.map((node)=>{
                    if (node.id === imageNodeId && node.type === "image") {
                        const bindingConfig = binding.mode === "upstream" ? {
                            upstream_bbox: bbox,
                            upstream_bbox_asset_id: bbox ? binding.assetId : null
                        } : {
                            bbox,
                            bbox_asset_id: bbox ? binding.assetId : null
                        };
                        return {
                            ...node,
                            config: {
                                ...node.config,
                                ...bindingConfig
                            }
                        };
                    }
                    if (node.type !== "text") return node;
                    const references = textReferences(node);
                    const existing = references.find((reference)=>reference.source_node_id === imageNodeId);
                    let nextReferences = references;
                    if (!bbox || !selectedTargets.has(node.id)) {
                        nextReferences = references.filter((reference)=>reference.source_node_id !== imageNodeId);
                    } else if (!existing && references.length < __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$bbox$2d$references$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_MAX_BBOX_REFERENCES"]) {
                        nextReferences = [
                            ...references,
                            {
                                instruction: "",
                                source_node_id: imageNodeId
                            }
                        ];
                    }
                    return nextReferences === references ? node : {
                        ...node,
                        config: {
                            ...node.config,
                            bbox_references: nextReferences
                        }
                    };
                });
                const definition = {
                    ...currentDefinition,
                    nodes
                };
                commit(set, get, {
                    definition
                });
            },
            updateBboxReferenceInstruction: (textNodeId, imageNodeId, instruction)=>{
                const state = get();
                const definition = editorDefinition(state.definition);
                commit(set, get, {
                    definition: {
                        ...definition,
                        nodes: definition.nodes.map((node)=>node.id === textNodeId && node.type === "text" ? {
                                ...node,
                                config: {
                                    ...node.config,
                                    bbox_references: textReferences(node).map((reference)=>reference.source_node_id === imageNodeId ? {
                                            ...reference,
                                            instruction
                                        } : reference)
                                }
                            } : node)
                    }
                });
            },
            removeBboxReference: (textNodeId, imageNodeId)=>{
                const state = get();
                const definition = editorDefinition(state.definition);
                commit(set, get, {
                    definition: {
                        ...definition,
                        nodes: definition.nodes.map((node)=>node.id === textNodeId && node.type === "text" ? {
                                ...node,
                                config: {
                                    ...node.config,
                                    bbox_references: textReferences(node).filter((reference)=>reference.source_node_id !== imageNodeId)
                                }
                            } : node)
                    }
                });
            },
            removeNode: (nodeId)=>{
                const state = get();
                const currentDefinition = editorDefinition(state.definition);
                const definition = {
                    ...currentDefinition,
                    nodes: currentDefinition.nodes.filter((node)=>node.id !== nodeId),
                    edges: currentDefinition.edges.filter((edge)=>edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
                };
                commit(set, get, {
                    definition,
                    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
                });
            },
            connect: (edge)=>{
                const state = get();
                if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$connection$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isValidAigcConnection"])({
                    source: edge.sourceNodeId,
                    sourceHandle: edge.sourceHandle,
                    target: edge.targetNodeId,
                    targetHandle: edge.targetHandle
                }, state.definition.nodes, state.definition.edges)) {
                    return false;
                }
                commit(set, get, {
                    definition: {
                        ...state.definition,
                        edges: [
                            ...state.definition.edges,
                            edge
                        ]
                    }
                });
                return true;
            },
            removeEdge: (edgeId)=>{
                const state = get();
                const removedEdge = state.definition.edges.find((edge)=>edge.id === edgeId);
                const detachesManagedText = removedEdge?.sourceHandle === "items" && removedEdge.targetHandle === "text";
                const definition = {
                    ...state.definition,
                    edges: state.definition.edges.filter((edge)=>edge.id !== edgeId),
                    nodes: detachesManagedText ? state.definition.nodes.map((node)=>node.id === removedEdge.targetNodeId && node.type === "text" && node.config.generated_by_parser_node_id === removedEdge.sourceNodeId ? {
                            ...node,
                            config: {
                                ...node.config,
                                generated_by_parser_node_id: null,
                                generated_item_index: null,
                                generated_from_run_id: null
                            }
                        } : node) : state.definition.nodes
                };
                commit(set, get, {
                    definition
                });
            },
            undo: ()=>{
                const state = get();
                const previous = state.past.at(-1);
                if (!previous) return;
                set({
                    ...structuredClone(previous),
                    dirty: true,
                    future: [
                        snapshot(state),
                        ...state.future
                    ].slice(0, HISTORY_LIMIT),
                    past: state.past.slice(0, -1),
                    selectedNodeId: null
                });
            },
            redo: ()=>{
                const state = get();
                const next = state.future[0];
                if (!next) return;
                set({
                    ...structuredClone(next),
                    dirty: true,
                    future: state.future.slice(1),
                    past: [
                        ...state.past,
                        snapshot(state)
                    ].slice(-HISTORY_LIMIT),
                    selectedNodeId: null
                });
            }
        }));
}
function commit(set, get, changes) {
    const state = get();
    set({
        ...changes,
        dirty: true,
        future: [],
        past: [
            ...state.past,
            snapshot(state)
        ].slice(-HISTORY_LIMIT)
    });
}
function snapshot(state) {
    return structuredClone({
        definition: state.definition,
        description: state.description,
        name: state.name
    });
}
function normalizeEditorSnapshot(source) {
    return {
        definition: normalizeDefinition(source.definition),
        description: source.description,
        name: source.name
    };
}
function mergeAigcServerRevision(base, local, server, authoritativeNodeNames = new Map()) {
    return {
        definition: mergeAigcServerDefinition(base.definition, local.definition, server.definition, authoritativeNodeNames),
        description: local.description,
        name: local.name
    };
}
function mergeAigcServerDefinition(base, local, server, authoritativeNodeNames) {
    const baseManaged = new Map(base.nodes.flatMap((node)=>{
        const key = managedNodeKey(node);
        return key ? [
            [
                key,
                node
            ]
        ] : [];
    }));
    const localManaged = new Map(local.nodes.flatMap((node)=>{
        const key = managedNodeKey(node);
        return key ? [
            [
                key,
                node
            ]
        ] : [];
    }));
    const localById = new Map(local.nodes.map((node)=>[
            node.id,
            node
        ]));
    const serverById = new Map(server.nodes.map((node)=>[
            node.id,
            node
        ]));
    const deletedManagedKeys = new Set([
        ...baseManaged
    ].flatMap(([key])=>localManaged.has(key) ? [] : [
            key
        ]));
    for (const [key, node] of baseManaged){
        const localNode = localById.get(node.id);
        if (localNode && managedNodeKey(localNode) !== key) {
            deletedManagedKeys.add(key);
        }
    }
    const serverManaged = new Map(server.nodes.flatMap((node)=>{
        const key = managedNodeKey(node);
        return key ? [
            [
                key,
                node
            ]
        ] : [];
    }));
    const consumedManagedKeys = new Set();
    const managedIdRemap = new Map();
    const nodes = local.nodes.flatMap((node)=>{
        const key = managedNodeKey(node);
        if (!key) {
            const remoteNode = serverById.get(node.id);
            return [
                {
                    ...structuredClone(node),
                    custom_name: authoritativeNodeNames.get(node.id) ?? (authoritativeNodeNames.has(node.id) && remoteNode ? remoteNode.custom_name ?? null : node.custom_name ?? null)
                }
            ];
        }
        const remoteNode = serverManaged.get(key);
        if (!remoteNode || deletedManagedKeys.has(key)) return [];
        consumedManagedKeys.add(key);
        managedIdRemap.set(node.id, remoteNode.id);
        const baseNode = baseManaged.get(key);
        return [
            {
                ...structuredClone(remoteNode),
                custom_name: authoritativeNodeNames.has(node.id) ? authoritativeNodeNames.get(node.id) ?? remoteNode.custom_name ?? null : node.custom_name ?? null,
                position: structuredClone(baseNode && pointsEqual(node.position, baseNode.position) ? remoteNode.position : node.position),
                size: structuredClone(baseNode && sizesEqual(node.size, baseNode.size) ? remoteNode.size : node.size)
            }
        ];
    });
    for (const serverNode of server.nodes){
        const key = managedNodeKey(serverNode);
        if (!key || consumedManagedKeys.has(key) || deletedManagedKeys.has(key) || nodes.some((node)=>node.id === serverNode.id)) {
            continue;
        }
        nodes.push(structuredClone(serverNode));
    }
    const nodeIds = new Set(nodes.map((node)=>node.id));
    const localSystemKeys = new Set(local.edges.flatMap((edge)=>{
        const key = systemEdgeKey(edge, local.nodes);
        return key ? [
            key
        ] : [];
    }));
    const deletedSystemKeys = new Set(base.edges.flatMap((edge)=>{
        const key = systemEdgeKey(edge, base.nodes);
        return key && !localSystemKeys.has(key) ? [
            key
        ] : [];
    }));
    const edges = [];
    const edgeSignatures = new Set();
    const addEdge = (edge)=>{
        const remapped = {
            ...structuredClone(edge),
            sourceNodeId: managedIdRemap.get(edge.sourceNodeId) ?? edge.sourceNodeId,
            targetNodeId: managedIdRemap.get(edge.targetNodeId) ?? edge.targetNodeId
        };
        if (!nodeIds.has(remapped.sourceNodeId) || !nodeIds.has(remapped.targetNodeId)) {
            return;
        }
        const signature = edgeSignature(remapped);
        if (edgeSignatures.has(signature)) return;
        edgeSignatures.add(signature);
        edges.push(remapped);
    };
    for (const edge of local.edges){
        if (!systemEdgeKey(edge, local.nodes)) addEdge(edge);
    }
    for (const edge of server.edges){
        const key = systemEdgeKey(edge, server.nodes);
        if (key && !deletedSystemKeys.has(key)) addEdge(edge);
    }
    return {
        schemaVersion: 2,
        nodes,
        edges,
        viewport: structuredClone(local.viewport)
    };
}
function managedNodeKey(node) {
    if (node.type !== "text" || typeof node.config.generated_by_parser_node_id !== "string" || typeof node.config.generated_item_index !== "number") {
        return null;
    }
    return `${node.config.generated_by_parser_node_id}\u0000${node.config.generated_item_index}`;
}
function systemEdgeKey(edge, nodes) {
    if (edge.sourceHandle !== "items" || edge.targetHandle !== "text") {
        return null;
    }
    const target = nodes.find((node)=>node.id === edge.targetNodeId);
    const managedKey = target ? managedNodeKey(target) : null;
    return managedKey?.startsWith(`${edge.sourceNodeId}\u0000`) ? managedKey : null;
}
function edgeSignature(edge) {
    return [
        edge.sourceNodeId,
        edge.sourceHandle,
        edge.targetNodeId,
        edge.targetHandle
    ].join("\u0000");
}
function pointsEqual(left, right) {
    return left.x === right.x && left.y === right.y;
}
function sizesEqual(left, right) {
    return left.width === right.width && left.height === right.height;
}
function normalizeDefinition(definition) {
    const migrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcDefinitionV2"])(definition);
    return {
        ...migrated,
        nodes: migrated.nodes.map((node)=>{
            const normalizedSize = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeAigcNodeSize"])(node.type, node.size);
            if (node.type === "text") {
                return {
                    ...structuredClone(node),
                    size: normalizedSize,
                    config: {
                        ...structuredClone(node.config),
                        bbox_references: structuredClone(node.config.bbox_references ?? [])
                    }
                };
            }
            if (node.type === "image") {
                return {
                    ...structuredClone(node),
                    size: normalizedSize,
                    config: {
                        ...structuredClone(node.config),
                        bbox: node.config.bbox ?? null,
                        bbox_asset_id: node.config.bbox_asset_id ?? null,
                        upstream_bbox: node.config.upstream_bbox ?? null,
                        upstream_bbox_asset_id: node.config.upstream_bbox_asset_id ?? null
                    }
                };
            }
            if (node.type === "image_to_image") {
                return {
                    ...structuredClone(node),
                    size: normalizedSize,
                    config: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamImageConfig"])(structuredClone(node.config))
                };
            }
            if (node.type === "text_to_image") {
                return {
                    ...structuredClone(node),
                    size: normalizedSize,
                    config: {
                        ...structuredClone(node.config),
                        size: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamImageSizeForStorage"])(node.config.size)
                    }
                };
            }
            if (node.type === "video_enhancement") {
                return {
                    ...structuredClone(node),
                    size: normalizedSize,
                    config: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeVideoEnhancementConfig"])(node.config)
                };
            }
            return {
                ...structuredClone(node),
                size: normalizedSize
            };
        })
    };
}
function createNode(type, index, centerPosition) {
    const nodeType = type;
    const id = `${nodeType}-${globalThis.crypto.randomUUID()}`;
    const common = {
        id,
        custom_name: null,
        position: centerPosition ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodePositionFromCenter"])(nodeType, centerPosition) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeInitialPosition"])(nodeType, index),
        size: (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$layout$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeDefaultSize"])(nodeType)
    };
    if (nodeType === "text") {
        return {
            ...common,
            type: nodeType,
            config: {
                bbox_references: [],
                text: "",
                title: null,
                upstream_text_override: null
            }
        };
    }
    if (nodeType === "image") {
        return {
            ...common,
            type: nodeType,
            config: {
                asset_id: null,
                bbox: null,
                bbox_asset_id: null,
                title: null,
                upstream_bbox: null,
                upstream_bbox_asset_id: null
            }
        };
    }
    if (nodeType === "video" || nodeType === "audio") {
        return {
            ...common,
            type: nodeType,
            config: {
                asset_id: null,
                title: null
            }
        };
    }
    if (nodeType === "llm") {
        return {
            ...common,
            type: nodeType,
            config: {
                model: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_DEFAULT_TEXT_MODEL"],
                system_prompt: "",
                temperature: 0.7
            }
        };
    }
    if (nodeType === "video_generation") {
        return {
            ...common,
            type: nodeType,
            config: structuredClone(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_DEFAULT_VIDEO_CONFIG"])
        };
    }
    if (nodeType === "video_enhancement") {
        return {
            ...common,
            type: nodeType,
            config: structuredClone(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$enhancement$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_DEFAULT_VIDEO_ENHANCEMENT_CONFIG"])
        };
    }
    if (nodeType === "video_face_blur") {
        return {
            ...common,
            type: nodeType,
            config: structuredClone(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$video$2d$face$2d$blur$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_DEFAULT_VIDEO_FACE_BLUR_CONFIG"])
        };
    }
    if (nodeType === "video_subtitle_extraction") {
        return {
            ...common,
            type: nodeType,
            config: {
                mode: "Subtitle"
            }
        };
    }
    if (nodeType === "multi_track_edit") {
        return {
            ...common,
            type: nodeType,
            config: structuredClone(__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$multitrack$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AIGC_DEFAULT_MULTI_TRACK_EDIT_CONFIG"])
        };
    }
    if (nodeType === "json_parser") {
        return {
            ...common,
            type: nodeType,
            config: {
                json_path: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_DEFAULT_JSON_PATH"]
            }
        };
    }
    if (nodeType === "layer_canvas") {
        return {
            ...common,
            type: nodeType,
            config: {
                selected_layer_id: null,
                source_layer_set: null,
                transform_patches: []
            }
        };
    }
    if (nodeType === "layer_composite") {
        return {
            ...common,
            type: nodeType,
            config: {}
        };
    }
    return {
        ...common,
        type: nodeType,
        config: {
            model: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_DEFAULT_IMAGE_MODEL"],
            aspect_ratio: "1:1",
            size: "2K",
            format: "png",
            ...nodeType === "image_to_image" ? {
                operation: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_DEFAULT_IMAGE_OPERATION"]
            } : {}
        }
    };
}
function normalizeCustomName(value) {
    if (value === null) return null;
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > 120 || /[\u0000-\u001f\u007f]/.test(normalized)) {
        throw new Error("节点名称必须为不超过 120 个字符的单行文本");
    }
    return normalized;
}
function deriveAigcModalityNodeMode(definition, nodeId) {
    const node = definition.nodes.find((candidate)=>candidate.id === nodeId);
    if (node?.type !== "text" && node?.type !== "image" && node?.type !== "video" && node?.type !== "audio") {
        return null;
    }
    return definition.edges.some((edge)=>edge.targetNodeId === nodeId) ? "upstream" : "local";
}
function serializeAigcEditorDefinition(definition) {
    return structuredClone((0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcDefinitionV2"])(definition));
}
function readAigcRunDefinitionSnapshot(definitionSnapshot) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(definitionSnapshot);
}
function textReferences(node) {
    return node.config.bbox_references ?? [];
}
function editorDefinition(definition) {
    return definition;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/image-dimensions.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
_c = MIN_IMAGE_PIXELS_BIGINT;
const MAX_IMAGE_PIXELS_BIGINT = BigInt(SEEDREAM_MAX_IMAGE_PIXELS);
_c1 = MAX_IMAGE_PIXELS_BIGINT;
const MAX_ASPECT_RATIO_BIGINT = BigInt(SEEDREAM_MAX_ASPECT_RATIO);
_c2 = MAX_ASPECT_RATIO_BIGINT;
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
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "MIN_IMAGE_PIXELS_BIGINT");
__turbopack_context__.k.register(_c1, "MAX_IMAGE_PIXELS_BIGINT");
__turbopack_context__.k.register(_c2, "MAX_ASPECT_RATIO_BIGINT");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/json-parser-ui.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "jsonParserErrorMessage",
    ()=>jsonParserErrorMessage,
    "jsonParserItemCount",
    ()=>jsonParserItemCount,
    "jsonPathInputFeedback",
    ()=>jsonPathInputFeedback,
    "managedTextSource",
    ()=>managedTextSource
]);
const JSON_PARSER_ERROR_MESSAGES = {
    json_parser_invalid_path: "JSONPath 无效，请检查表达式后重试。",
    json_parser_invalid_json: "上游内容不是有效 JSON，请只传入纯 JSON 或单个 JSON 代码块。",
    json_parser_path_not_found: "JSONPath 未匹配到内容，请检查字段路径。",
    json_parser_path_ambiguous: "JSONPath 匹配到多个结果，请改为只匹配一个数组。",
    json_parser_result_not_array: "JSONPath 的结果不是数组，请选择一个数组字段。",
    json_parser_item_limit_exceeded: "数组项目超过 20 项，请缩小 JSONPath 结果范围。",
    json_parser_source_changed: "解析器已被删除或变更，请重新运行当前画布。",
    json_parser_materialization_failed: "文本节点生成失败，请检查画布后重试。"
};
function jsonPathInputFeedback(value) {
    const normalized = value.trim();
    if (!normalized) {
        return {
            kind: "error",
            message: "JSONPath 不能为空。"
        };
    }
    if (normalized.length > 500) {
        return {
            kind: "error",
            message: "JSONPath 最多 500 个字符。"
        };
    }
    if (!normalized.startsWith("$")) {
        return {
            kind: "error",
            message: "JSONPath 必须以 $ 开头。"
        };
    }
    return {
        kind: "hint",
        message: "示例：$.items。保存和运行时将由服务端校验完整语法。"
    };
}
function jsonParserErrorMessage(error) {
    if (!error) return null;
    return error.code ? JSON_PARSER_ERROR_MESSAGES[error.code] ?? error.message : error.message;
}
function jsonParserItemCount(node) {
    return node?.result.kind === "text_items" && Array.isArray(node.result.items) ? node.result.items.length : null;
}
function managedTextSource(node, nodes) {
    if (node.type !== "text" || typeof node.config.generated_by_parser_node_id !== "string" || typeof node.config.generated_item_index !== "number") {
        return null;
    }
    const parserId = node.config.generated_by_parser_node_id;
    const parser = nodes.find((candidate)=>candidate.id === parserId && candidate.type === "json_parser");
    if (!parser) return null;
    const parserNumber = nodes.filter((candidate)=>candidate.type === "json_parser").findIndex((candidate)=>candidate.id === parserId) + 1;
    const parserCount = nodes.filter((candidate)=>candidate.type === "json_parser").length;
    return {
        itemLabel: `JSON 项 ${node.config.generated_item_index + 1}`,
        parserId,
        parserName: parserCount > 1 ? `JSON 解析器${parserNumber}` : "JSON 解析器"
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/layers.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "applyLayerCanvasConfig",
    ()=>applyLayerCanvasConfig,
    "createLayerTransformPatches",
    ()=>createLayerTransformPatches,
    "findUpstreamLayerSet",
    ()=>findUpstreamLayerSet,
    "layerCanvasModificationCount",
    ()=>layerCanvasModificationCount,
    "layerCanvasSourceIsCurrent",
    ()=>layerCanvasSourceIsCurrent,
    "layerSetSummary",
    ()=>layerSetSummary
]);
function layerSetSummary(layerSet) {
    return {
        digest: layerSet.digest,
        id: layerSet.id,
        version: layerSet.version
    };
}
function layerCanvasSourceIsCurrent(config, layerSet) {
    const source = config.source_layer_set;
    return Boolean(source && source.id === layerSet.id && source.version === layerSet.version && source.digest === layerSet.digest);
}
function applyLayerCanvasConfig(layerSet, config) {
    if (!layerCanvasSourceIsCurrent(config, layerSet)) {
        return normalizeLayerOrder(layerSet.layers);
    }
    const patches = new Map(config.transform_patches.map((patch)=>[
            patch.layer_id,
            patch
        ]));
    return normalizeLayerOrder(layerSet.layers.flatMap((layer)=>{
        const patch = patches.get(layer.id);
        if (patch?.deleted) return [];
        return [
            {
                ...layer,
                scale: patch?.scale ?? layer.scale,
                visible: patch?.visible ?? layer.visible,
                x: patch?.x ?? layer.x,
                y: patch?.y ?? layer.y,
                z_index: patch?.z_index ?? layer.z_index
            }
        ];
    }));
}
function createLayerTransformPatches(sourceLayers, draftLayers) {
    const draftById = new Map(draftLayers.map((layer)=>[
            layer.id,
            layer
        ]));
    return sourceLayers.flatMap((source)=>{
        const draft = draftById.get(source.id);
        if (!draft) return [
            {
                deleted: true,
                layer_id: source.id
            }
        ];
        const patch = {
            layer_id: source.id
        };
        if (draft.x !== source.x) patch.x = draft.x;
        if (draft.y !== source.y) patch.y = draft.y;
        if (draft.scale !== source.scale) patch.scale = draft.scale;
        if (draft.z_index !== source.z_index) patch.z_index = draft.z_index;
        if (draft.visible !== source.visible) patch.visible = draft.visible;
        return Object.keys(patch).length > 1 ? [
            patch
        ] : [];
    });
}
function layerCanvasModificationCount(sourceLayers, draftLayers) {
    return createLayerTransformPatches(sourceLayers, draftLayers).length;
}
function findUpstreamLayerSet(edges, nodeId, runDetails) {
    const sourceNodeIds = new Set(edges.filter((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === "layers" && edge.sourceHandle === "layers").map((edge)=>edge.sourceNodeId));
    if (sourceNodeIds.size === 0) return null;
    for (const detail of runDetails){
        const source = detail.nodes.find((node)=>sourceNodeIds.has(node.node_id) && (node.status === "succeeded" || node.status === "reused") && node.result.layer_set);
        if (source?.result.layer_set) return source.result.layer_set;
    }
    return null;
}
function normalizeLayerOrder(layers) {
    return layers.toSorted((a, b)=>a.z_index - b.z_index).map((layer, index)=>({
            ...layer,
            z_index: index + 1
        }));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/llm-image-input.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveAigcLlmImageInput",
    ()=>resolveAigcLlmImageInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)");
;
function resolveAigcLlmImageInput(definition, llmNodeId, runDetail) {
    const edge = definition.edges.find((candidate)=>candidate.targetNodeId === llmNodeId && candidate.targetHandle === "image");
    if (!edge) {
        return {
            sourceLabel: null,
            state: "disconnected",
            statusLabel: "未连接，按纯文本执行"
        };
    }
    const source = definition.nodes.find((node)=>node.id === edge.sourceNodeId);
    if (!source) {
        return {
            sourceLabel: "图片来源",
            state: "unavailable",
            statusLabel: "图片来源不可用"
        };
    }
    const sourceLabel = source.custom_name?.trim() ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["deriveAigcNodeDisplayNames"])(definition.nodes).get(source.id)?.displayName ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$display$2d$name$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["aigcNodeBaseDisplayName"])(source);
    const sourceRunNode = runDetail?.nodes.find((node)=>node.node_id === source.id);
    if (!sourceRunNode) {
        return {
            sourceLabel,
            state: "waiting",
            statusLabel: "已连接，等待图片来源"
        };
    }
    if ([
        "blocked",
        "canceled",
        "failed",
        "timed_out"
    ].includes(sourceRunNode.status)) {
        return {
            sourceLabel,
            state: "unavailable",
            statusLabel: "图片来源运行失败"
        };
    }
    if ([
        "idle",
        "ready",
        "queued",
        "running"
    ].includes(sourceRunNode.status)) {
        return {
            sourceLabel,
            state: "waiting",
            statusLabel: "已连接，等待图片来源"
        };
    }
    const imageAsset = sourceRunNode.result.assets.find((asset)=>asset.mime_type?.startsWith("image/"));
    if (!imageAsset?.available) {
        return {
            sourceLabel,
            state: "unavailable",
            statusLabel: "图片来源不可用"
        };
    }
    return {
        sourceLabel,
        state: "ready",
        statusLabel: "图片已就绪"
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/media-assets.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isSelectableMediaAsset",
    ()=>isSelectableMediaAsset
]);
const MEDIA_ASSET_TYPES = {
    image: new Set([
        "generated_image",
        "uploaded_image"
    ]),
    video: new Set([
        "uploaded_video",
        "storyboard_video",
        "final_video"
    ]),
    audio: new Set([
        "uploaded_audio"
    ])
};
function isSelectableMediaAsset(asset, kind) {
    if (asset.status !== "succeeded" || asset.asset_role === "internal_base" || asset.asset_role === "internal_layer") {
        return false;
    }
    return Boolean(asset.mime_type?.startsWith(`${kind}/`) || MEDIA_ASSET_TYPES[kind].has(asset.type));
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/media-validation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/modality-colors.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAigcModalityColors",
    ()=>getAigcModalityColors
]);
function modalityColors(token) {
    const mainColor = `var(--aigc-modality-${token})`;
    return Object.freeze({
        handleColor: mainColor,
        edgeColor: mainColor,
        cardBorderColor: `var(--aigc-modality-${token}-border)`,
        cardHeaderBackgroundColor: `var(--aigc-modality-${token}-light)`,
        iconColor: mainColor
    });
}
const AIGC_MODALITY_COLORS = {
    text: modalityColors("text"),
    image_asset: modalityColors("image"),
    video_asset: modalityColors("video"),
    audio_asset: modalityColors("audio"),
    subtitle_asset: modalityColors("video"),
    layer_set: modalityColors("image"),
    image_layer: modalityColors("image"),
    edited_layer: modalityColors("image")
};
const AIGC_NEUTRAL_MODALITY_COLORS = Object.freeze({
    handleColor: "hsl(var(--border))",
    edgeColor: "hsl(var(--border))",
    cardBorderColor: "hsl(var(--border))",
    cardHeaderBackgroundColor: "hsl(var(--muted))",
    iconColor: "hsl(var(--muted-foreground))"
});
function getAigcModalityColors(portType) {
    if (portType && Object.prototype.hasOwnProperty.call(AIGC_MODALITY_COLORS, portType)) {
        return AIGC_MODALITY_COLORS[portType];
    }
    return AIGC_NEUTRAL_MODALITY_COLORS;
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
"[project]/lib/aigc/node-display-name.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aigcNodeBaseDisplayName",
    ()=>aigcNodeBaseDisplayName,
    "deriveAigcNodeDisplayNames",
    ()=>deriveAigcNodeDisplayNames
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)");
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
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$seedream$2d$image$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedreamImageTitle"])(node);
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(node.type)?.label ?? node.type;
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/node-layout.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aigcNodeDefaultSize",
    ()=>aigcNodeDefaultSize,
    "aigcNodeInitialPosition",
    ()=>aigcNodeInitialPosition,
    "aigcNodeMinimumSize",
    ()=>aigcNodeMinimumSize,
    "aigcNodePositionFromCenter",
    ()=>aigcNodePositionFromCenter,
    "normalizeAigcNodeSize",
    ()=>normalizeAigcNodeSize
]);
const DEFAULT_NODE_SIZE = {
    width: 240,
    height: 160
};
const DEFAULT_LAYER_CANVAS_SIZE = {
    width: 420,
    height: 460
};
const DEFAULT_LAYER_COMPOSITE_SIZE = {
    width: 400,
    height: 380
};
const MINIMUM_NODE_SIZE = {
    width: 190,
    height: 120
};
const MINIMUM_LAYER_CANVAS_SIZE = {
    width: 380,
    height: 420
};
const MINIMUM_LAYER_COMPOSITE_SIZE = {
    width: 360,
    height: 340
};
const LAYER_NODE_TYPES = new Set([
    "layer_canvas",
    "layer_composite"
]);
function aigcNodeDefaultSize(type) {
    if (type === "layer_canvas") return {
        ...DEFAULT_LAYER_CANVAS_SIZE
    };
    if (type === "layer_composite") return {
        ...DEFAULT_LAYER_COMPOSITE_SIZE
    };
    return {
        ...DEFAULT_NODE_SIZE
    };
}
function aigcNodeMinimumSize(type) {
    if (type === "layer_canvas") return {
        ...MINIMUM_LAYER_CANVAS_SIZE
    };
    if (type === "layer_composite") return {
        ...MINIMUM_LAYER_COMPOSITE_SIZE
    };
    return {
        ...MINIMUM_NODE_SIZE
    };
}
function normalizeAigcNodeSize(type, size) {
    const minimum = aigcNodeMinimumSize(type);
    return {
        height: Math.max(size.height, minimum.height),
        width: Math.max(size.width, minimum.width)
    };
}
function aigcNodeInitialPosition(type, index) {
    const columnGap = LAYER_NODE_TYPES.has(type) ? 460 : 300;
    const rowGap = LAYER_NODE_TYPES.has(type) ? 500 : 230;
    const columns = LAYER_NODE_TYPES.has(type) ? 3 : 4;
    return {
        x: 80 + index % columns * columnGap,
        y: 80 + Math.floor(index / columns) * rowGap
    };
}
function aigcNodePositionFromCenter(type, center) {
    const size = aigcNodeDefaultSize(type);
    const snap = (value)=>Math.round(value / 16) * 16;
    return {
        x: snap(center.x - size.width / 2),
        y: snap(center.y - size.height / 2)
    };
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
"[project]/lib/aigc/prompt-optimization-context.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolvePromptOptimizationSourceImage",
    ()=>resolvePromptOptimizationSourceImage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
;
function resolvePromptOptimizationSourceImage(definition, targetNodeId, runDetail) {
    const target = definition.nodes.find((node)=>node.id === targetNodeId && node.type === "image_to_image");
    if (target?.type !== "image_to_image") return null;
    const operation = target.config.operation ?? "image_to_image";
    if (operation === "layer_decomposition") return null;
    const targetHandle = operation === "image_edit" ? "edit_image" : "image";
    const imageInputEdges = definition.edges.filter((edge)=>edge.targetNodeId === target.id && [
            "edit_image",
            "edit_layer",
            "image"
        ].includes(edge.targetHandle));
    if (imageInputEdges.some((edge)=>edge.targetHandle !== targetHandle)) {
        return null;
    }
    const incoming = definition.edges.filter((edge)=>edge.targetNodeId === target.id && edge.targetHandle === targetHandle);
    if (incoming.length !== 1) return null;
    const edge = incoming[0];
    const source = definition.nodes.find((node)=>node.id === edge.sourceNodeId);
    const sourcePort = source ? __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(source.type)?.outputs.find((port)=>port.id === edge.sourceHandle) : null;
    if (!source || edge.sourceHandle !== "image" || sourcePort?.type !== "image_asset") {
        return null;
    }
    const descriptor = {
        source_handle: "image",
        source_node_id: edge.sourceNodeId,
        target_handle: targetHandle
    };
    const sourceHasUpstreamImage = definition.edges.some((candidate)=>candidate.targetNodeId === source.id && candidate.targetHandle === "image");
    if (source.type === "image" && !sourceHasUpstreamImage) {
        const assetId = source.config.asset_id?.trim();
        return assetId ? {
            ...descriptor,
            asset_id: assetId,
            run_id: null
        } : null;
    }
    if (!runDetail || !runDetail.run.definition_snapshot.nodes.some((node)=>node.id === source.id)) {
        return null;
    }
    const runNode = runDetail.nodes.find((candidate)=>candidate.node_id === source.id);
    const asset = runNode?.result.assets[0];
    if (!runNode || ![
        "reused",
        "succeeded"
    ].includes(runNode.status) || !asset?.available || !asset.asset_id.trim() || !asset.mime_type?.toLowerCase().startsWith("image/")) {
        return null;
    }
    return {
        ...descriptor,
        asset_id: asset.asset_id,
        run_id: runDetail.run.id
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/queries.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "aigcQueryKeys",
    ()=>aigcQueryKeys,
    "aigcRunDetailPollingInterval",
    ()=>aigcRunDetailPollingInterval,
    "aigcRunPollingInterval",
    ()=>aigcRunPollingInterval,
    "fetchAllAigcRuns",
    ()=>fetchAllAigcRuns,
    "isAigcRunActive",
    ()=>isAigcRunActive,
    "layerPreviewFallbackRunId",
    ()=>layerPreviewFallbackRunId,
    "newestActiveOrRecentRun",
    ()=>newestActiveOrRecentRun,
    "useAigcRun",
    ()=>useAigcRun,
    "useAigcRunDetails",
    ()=>useAigcRunDetails,
    "useAigcRuns",
    ()=>useAigcRuns,
    "useCancelAigcRun",
    ()=>useCancelAigcRun,
    "useCreateAigcRun",
    ()=>useCreateAigcRun,
    "useRetryAigcNode",
    ()=>useRetryAigcNode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useMutation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQueries.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/useQuery.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@tanstack/react-query/build/modern/QueryClientProvider.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature(), _s2 = __turbopack_context__.k.signature(), _s3 = __turbopack_context__.k.signature(), _s4 = __turbopack_context__.k.signature(), _s5 = __turbopack_context__.k.signature();
"use client";
;
;
;
const ACTIVE_RUN_STATUSES = new Set([
    "queued",
    "running"
]);
const RUN_PAGE_SIZE = 100;
const aigcQueryKeys = {
    all: [
        "aigc"
    ],
    pipeline: (pipelineId)=>[
            "aigc",
            "pipeline",
            pipelineId
        ],
    runs: (pipelineId)=>[
            "aigc",
            "pipeline",
            pipelineId,
            "runs"
        ],
    run: (runId)=>[
            "aigc",
            "run",
            runId
        ]
};
function useAigcRuns(pipelineId, initialData, enabled = true) {
    _s();
    const completeInitialData = initialData && initialData.items.length >= initialData.total ? initialData : undefined;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled,
        initialData: completeInitialData,
        queryFn: {
            "useAigcRuns.useQuery": ()=>fetchAllAigcRuns(pipelineId)
        }["useAigcRuns.useQuery"],
        queryKey: aigcQueryKeys.runs(pipelineId),
        refetchInterval: {
            "useAigcRuns.useQuery": (query)=>query.state.data?.items.some({
                    "useAigcRuns.useQuery": (run)=>ACTIVE_RUN_STATUSES.has(run.status)
                }["useAigcRuns.useQuery"]) ? 2_000 : false
        }["useAigcRuns.useQuery"]
    });
}
_s(useAigcRuns, "4ZpngI1uv+Uo3WQHEZmTQ5FNM+k=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
async function fetchAllAigcRuns(pipelineId) {
    const items = [];
    let total = 0;
    for(let page = 1;; page += 1){
        const response = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].listAigcRuns(pipelineId, {
            page,
            pageSize: RUN_PAGE_SIZE
        });
        items.push(...response.items);
        total = response.total;
        if (response.items.length === 0 || items.length >= response.total) {
            break;
        }
    }
    return {
        items,
        page: 1,
        page_size: RUN_PAGE_SIZE,
        total
    };
}
function useAigcRunDetails(runs) {
    _s1();
    const queries = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useAigcRunDetails.useMemo[queries]": ()=>runs.map({
                "useAigcRunDetails.useMemo[queries]": (run)=>({
                        queryFn: ({
                            "useAigcRunDetails.useMemo[queries]": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAigcRun(run.id)
                        })["useAigcRunDetails.useMemo[queries]"],
                        queryKey: aigcQueryKeys.run(run.id),
                        refetchInterval: ({
                            "useAigcRunDetails.useMemo[queries]": (query)=>aigcRunDetailPollingInterval(run, query.state.data)
                        })["useAigcRunDetails.useMemo[queries]"],
                        retry: false
                    })
            }["useAigcRunDetails.useMemo[queries]"])
    }["useAigcRunDetails.useMemo[queries]"], [
        runs
    ]);
    const combined = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"])({
        queries,
        combine: combineAigcRunDetails
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useAigcRunDetails.useMemo": ()=>({
                details: combined.details,
                states: new Map(runs.map({
                    "useAigcRunDetails.useMemo": (run, index)=>[
                            run.id,
                            combined.states[index] ?? "loading"
                        ]
                }["useAigcRunDetails.useMemo"]))
            })
    }["useAigcRunDetails.useMemo"], [
        combined,
        runs
    ]);
}
_s1(useAigcRunDetails, "F/sm9kqdlyAYizj4Ki6xUso3q+I=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQueries$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueries"]
    ];
});
function combineAigcRunDetails(results) {
    const details = new Map();
    const states = [];
    results.forEach((result)=>{
        const detail = result.data;
        if (detail) {
            details.set(detail.run.id, detail);
            states.push(result.isError ? "error" : "success");
            return;
        }
        states.push(result.isError ? "error" : "loading");
    });
    return {
        details,
        states
    };
}
function useAigcRun(runId) {
    _s2();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"])({
        enabled: runId !== null,
        queryFn: {
            "useAigcRun.useQuery": ()=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].getAigcRun(runId)
        }["useAigcRun.useQuery"],
        queryKey: aigcQueryKeys.run(runId ?? "none"),
        refetchInterval: {
            "useAigcRun.useQuery": (query)=>aigcRunPollingInterval(query.state.data)
        }["useAigcRun.useQuery"]
    });
}
_s2(useAigcRun, "4ZpngI1uv+Uo3WQHEZmTQ5FNM+k=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useQuery$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQuery"]
    ];
});
function useCreateAigcRun(pipelineId) {
    _s3();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "useCreateAigcRun.useMutation": (payload)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].createAigcRun(pipelineId, payload, globalThis.crypto.randomUUID())
        }["useCreateAigcRun.useMutation"],
        onSuccess: {
            "useCreateAigcRun.useMutation": (detail)=>{
                queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
                void queryClient.invalidateQueries({
                    queryKey: aigcQueryKeys.runs(pipelineId)
                });
            }
        }["useCreateAigcRun.useMutation"]
    });
}
_s3(useCreateAigcRun, "YK0wzM21ECnncaq5SECwU+/SVdQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"]
    ];
});
function useRetryAigcNode(pipelineId) {
    _s4();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "useRetryAigcNode.useMutation": ({ nodeId, runId })=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].retryAigcRunNode(runId, nodeId, globalThis.crypto.randomUUID())
        }["useRetryAigcNode.useMutation"],
        onSuccess: {
            "useRetryAigcNode.useMutation": (detail)=>{
                queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
                void queryClient.invalidateQueries({
                    queryKey: aigcQueryKeys.runs(pipelineId)
                });
            }
        }["useRetryAigcNode.useMutation"]
    });
}
_s4(useRetryAigcNode, "YK0wzM21ECnncaq5SECwU+/SVdQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"]
    ];
});
function useCancelAigcRun(pipelineId) {
    _s5();
    const queryClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"])({
        mutationFn: {
            "useCancelAigcRun.useMutation": (runId)=>__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["apiClient"].cancelAigcRun(runId)
        }["useCancelAigcRun.useMutation"],
        onSuccess: {
            "useCancelAigcRun.useMutation": (detail)=>{
                queryClient.setQueryData(aigcQueryKeys.run(detail.run.id), detail);
                void queryClient.invalidateQueries({
                    queryKey: aigcQueryKeys.runs(pipelineId)
                });
            }
        }["useCancelAigcRun.useMutation"]
    });
}
_s5(useCancelAigcRun, "YK0wzM21ECnncaq5SECwU+/SVdQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$QueryClientProvider$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useQueryClient"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$tanstack$2f$react$2d$query$2f$build$2f$modern$2f$useMutation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMutation"]
    ];
});
function newestActiveOrRecentRun(runs) {
    return runs.find((run)=>ACTIVE_RUN_STATUSES.has(run.status)) ?? runs[0] ?? null;
}
function layerPreviewFallbackRunId(runs, current) {
    if (!current || !ACTIVE_RUN_STATUSES.has(current.run.status)) return null;
    const latestSuccessfulRun = runs.find((run)=>run.id !== current.run.id && run.status === "succeeded");
    if (latestSuccessfulRun) return latestSuccessfulRun.id;
    if (current.run.source_run_id && current.run.source_run_id !== current.run.id) {
        return current.run.source_run_id;
    }
    return null;
}
function isAigcRunActive(detail) {
    return detail ? ACTIVE_RUN_STATUSES.has(detail.run.status) : false;
}
function aigcRunPollingInterval(detail) {
    return detail && ACTIVE_RUN_STATUSES.has(detail.run.status) ? 2_000 : false;
}
function aigcRunDetailPollingInterval(summary, detail) {
    if (detail) return aigcRunPollingInterval(detail);
    return ACTIVE_RUN_STATUSES.has(summary.status) ? 2_000 : false;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/result-projection.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isAigcVideoResult",
    ()=>isAigcVideoResult,
    "projectAigcEffectiveText",
    ()=>projectAigcEffectiveText,
    "projectAigcImageBboxBinding",
    ()=>projectAigcImageBboxBinding,
    "projectAigcLayerCompositeResult",
    ()=>projectAigcLayerCompositeResult,
    "projectAigcModalityRunResult",
    ()=>projectAigcModalityRunResult,
    "projectAigcVideoResult",
    ()=>projectAigcVideoResult
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/definition-migration.ts [app-client] (ecmascript)");
;
function projectAigcImageBboxBinding(definition, nodeId, effectiveAssetId) {
    const node = definition.nodes.find((candidate)=>candidate.id === nodeId && candidate.type === "image");
    if (!node) return null;
    const upstream = definition.edges.some((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === "image");
    const bbox = upstream ? node.config.upstream_bbox ?? null : node.config.bbox;
    const assetId = upstream ? node.config.upstream_bbox_asset_id ?? null : node.config.bbox_asset_id;
    return {
        assetId,
        bbox,
        state: !bbox || !assetId ? "none" : effectiveAssetId === assetId ? "valid" : "stale"
    };
}
function projectAigcModalityRunResult(runDetail, nodeId) {
    const definition = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(runDetail.run.definition_snapshot);
    const node = definition.nodes.find((candidate)=>candidate.id === nodeId);
    if (!node || !isModalityNode(node)) return null;
    const runNode = runDetail.nodes.find((candidate)=>candidate.node_id === nodeId);
    if (!runNode) return null;
    const asset = runNode.result.assets[0];
    const available = Boolean(asset?.available);
    return {
        asset,
        available,
        downloadUrl: available ? asset?.download_url ?? null : null,
        modality: node.type,
        mode: definition.edges.some((edge)=>edge.targetNodeId === node.id) ? "upstream" : "local",
        status: runNode.status,
        text: node.type === "text" && runNode.result.kind === "text" ? runNode.result.text : null,
        title: modalityResultTitle(node, definition.nodes)
    };
}
function projectAigcEffectiveText(runDetail, currentDefinition, nodeId) {
    const node = currentDefinition.nodes.find((candidate)=>candidate.id === nodeId && candidate.type === "text");
    if (!node) return null;
    const incoming = currentDefinition.edges.find((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === "text");
    const title = modalityResultTitle(node, currentDefinition.nodes);
    if (!incoming) {
        return {
            asset: undefined,
            available: true,
            downloadUrl: null,
            modality: "text",
            mode: "local",
            status: "succeeded",
            text: node.config.text,
            title
        };
    }
    const source = runDetail.nodes.find((candidate)=>candidate.node_id === incoming.sourceNodeId);
    const status = source?.status ?? "idle";
    const dependencySucceeded = status === "succeeded" || status === "reused";
    const managedIndex = node.config.generated_item_index;
    if (node.config.generated_by_parser_node_id === incoming.sourceNodeId && managedIndex != null && incoming.sourceHandle === "items") {
        const item = source?.result.kind === "text_items" ? source.result.items?.find((candidate)=>candidate.index === managedIndex) : undefined;
        const runNode = runDetail.nodes.find((candidate)=>candidate.node_id === nodeId);
        return {
            asset: undefined,
            available: dependencySucceeded && item !== undefined,
            downloadUrl: null,
            modality: "text",
            mode: "upstream",
            status: runNode?.status ?? status,
            text: dependencySucceeded ? item?.text ?? null : null,
            title
        };
    }
    const upstreamText = source?.result.kind === "text" ? source.result.text : null;
    const text = dependencySucceeded && node.config.upstream_text_override != null ? node.config.upstream_text_override : dependencySucceeded ? upstreamText : null;
    return {
        asset: undefined,
        available: dependencySucceeded && text !== null,
        downloadUrl: null,
        modality: "text",
        mode: "upstream",
        status,
        text,
        title
    };
}
function projectAigcLayerCompositeResult(definition, nodeId, runNodes) {
    const compositeResult = runNodes.find((candidate)=>candidate.node_id === nodeId)?.result;
    const layersSourceId = sourceNodeIdForInput(definition, nodeId, "layers");
    const replacementSourceId = sourceNodeIdForInput(definition, nodeId, "replacement");
    const inputLayerSet = runNodes.find((candidate)=>candidate.node_id === layersSourceId)?.result.layer_set ?? null;
    const replacement = runNodes.find((candidate)=>candidate.node_id === replacementSourceId)?.result.edited_layer ?? null;
    const layerSet = compositeResult?.layer_set ?? null;
    const targetLayer = replacement ? (layerSet ?? inputLayerSet)?.layers.find((layer)=>layer.id === replacement.layer_id) ?? null : null;
    return {
        imageAsset: compositeResult?.assets.find((asset)=>asset.available && (asset.mime_type?.toLowerCase().startsWith("image/") || asset.mime_type === null)),
        inputLayerSet,
        layerSet,
        layersConnected: layersSourceId !== null,
        replacement,
        replacementConnected: replacementSourceId !== null,
        targetLayer
    };
}
function projectAigcVideoResult(definition, nodeId, assets) {
    const normalized = definition ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(definition) : undefined;
    const node = normalized?.nodes.find((candidate)=>candidate.id === nodeId);
    const sourceNode = findVideoSourceNode(normalized, node);
    const generationNode = sourceNode?.type === "video_generation" ? sourceNode : undefined;
    const enhancementNode = sourceNode?.type === "video_enhancement" ? sourceNode : undefined;
    const faceBlurNode = sourceNode?.type === "video_face_blur" ? sourceNode : undefined;
    const multiTrackNode = sourceNode?.type === "multi_track_edit" ? sourceNode : undefined;
    const asset = assets.find((candidate)=>candidate.mime_type?.toLowerCase().startsWith("video/") || candidate.mime_type === null);
    const metadata = asset?.metadata;
    return {
        asset,
        audioState: generationNode?.config.generate_audio ?? null,
        bitDepth: metadataNumber(metadata, "bit_depth") ?? enhancementNode?.config.bit_depth ?? null,
        duration: metadataNumber(metadata, "duration_seconds") ?? metadataNumber(metadata, "duration") ?? millisecondsToSeconds(metadataNumber(metadata, "duration_ms")) ?? (generationNode && generationNode.config.duration_seconds >= 0 ? generationNode.config.duration_seconds : null),
        elementCount: metadataNumber(metadata, "element_count"),
        fps: metadataNumber(metadata, "fps") ?? enhancementNode?.config.fps ?? multiTrackNode?.config.output.fps ?? null,
        maskMode: metadataMaskMode(metadata) ?? faceBlurNode?.config.mask_mode ?? null,
        maskStrength: metadataMaskStrength(metadata) ?? faceBlurNode?.config.mask_strength ?? null,
        provider: metadataString(metadata, "provider"),
        providerRequestId: metadataString(metadata, "provider_request_id"),
        providerTaskId: metadataString(metadata, "provider_task_id"),
        resolution: metadataString(metadata, "resolution") ?? dimensionsFromMetadata(metadata) ?? enhancementResolution(enhancementNode) ?? multiTrackResolution(multiTrackNode) ?? generationNode?.config.resolution ?? null,
        title: node?.type === "video" && node.config.title ? node.config.title : node?.type === "video_enhancement" ? "画质增强结果" : node?.type === "video_face_blur" ? "人脸打码结果" : node?.type === "multi_track_edit" ? "多轨剪辑成片" : "视频结果",
        toolVersion: metadataToolVersion(metadata) ?? enhancementNode?.config.tool_version ?? null,
        trackCount: metadataNumber(metadata, "track_count")
    };
}
function isAigcVideoResult(definition, nodeId, asset) {
    const node = definition ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$definition$2d$migration$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateAigcRunSnapshotV2"])(definition).nodes.find((candidate)=>candidate.id === nodeId) : undefined;
    return node?.type === "video" || node?.type === "video_generation" || node?.type === "video_enhancement" || node?.type === "video_face_blur" || node?.type === "multi_track_edit" || Boolean(asset.mime_type?.toLowerCase().startsWith("video/"));
}
function findVideoSourceNode(definition, node) {
    if (node?.type === "video_generation" || node?.type === "video_enhancement" || node?.type === "video_face_blur" || node?.type === "multi_track_edit") {
        return node;
    }
    if (!definition || node?.type !== "video") return undefined;
    const sourceId = definition.edges.find((edge)=>edge.targetNodeId === node.id && edge.targetHandle === "video")?.sourceNodeId;
    const source = definition.nodes.find((candidate)=>candidate.id === sourceId);
    return source?.type === "video_generation" || source?.type === "video_enhancement" || source?.type === "video_face_blur" || source?.type === "multi_track_edit" ? source : undefined;
}
function multiTrackResolution(node) {
    if (!node || node.config.canvas.width === null || node.config.canvas.height === null) {
        return null;
    }
    return `${node.config.canvas.width}x${node.config.canvas.height}`;
}
function enhancementResolution(node) {
    if (!node) return null;
    return node.config.resolution_mode === "preset" ? node.config.resolution : node.config.resolution_limit === null ? null : `${node.config.resolution_limit}px 短边`;
}
function isModalityNode(node) {
    return node.type === "text" || node.type === "image" || node.type === "video" || node.type === "audio";
}
function modalityResultTitle(node, nodes) {
    if (node.config.title?.trim()) return node.config.title.trim();
    const baseName = {
        audio: "音频节点",
        image: "图片节点",
        text: "文本节点",
        video: "视频节点"
    }[node.type];
    const peers = nodes.filter((candidate)=>candidate.type === node.type);
    return peers.length <= 1 ? baseName : `${baseName}${peers.findIndex((candidate)=>candidate.id === node.id) + 1}`;
}
function metadataNumber(metadata, key) {
    const value = metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}
function metadataString(metadata, key) {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value : null;
}
function dimensionsFromMetadata(metadata) {
    const width = metadataNumber(metadata, "width");
    const height = metadataNumber(metadata, "height");
    return width !== null && height !== null ? `${width}x${height}` : null;
}
function millisecondsToSeconds(value) {
    return value === null ? null : value / 1_000;
}
function metadataToolVersion(metadata) {
    const value = metadata?.tool_version;
    return value === "professional" || value === "standard" ? value : null;
}
function metadataMaskMode(metadata) {
    const value = metadata?.mask_mode;
    return value === "mosaic" || value === "blur" ? value : null;
}
function metadataMaskStrength(metadata) {
    const value = metadata?.mask_strength;
    return value === "low" || value === "medium" || value === "high" ? value : null;
}
function sourceNodeIdForInput(definition, nodeId, targetHandle) {
    return definition?.edges.find((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === targetHandle)?.sourceNodeId ?? null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/run-log.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AIGC_BLOCKED_MESSAGE",
    ()=>AIGC_BLOCKED_MESSAGE,
    "AIGC_REDACTED_ERROR_FALLBACK",
    ()=>AIGC_REDACTED_ERROR_FALLBACK,
    "AIGC_RUN_ERROR_FALLBACK",
    ()=>AIGC_RUN_ERROR_FALLBACK,
    "formatAigcDuration",
    ()=>formatAigcDuration,
    "formatAigcEndTime",
    ()=>formatAigcEndTime,
    "formatAigcErrorStage",
    ()=>formatAigcErrorStage,
    "formatAigcLogTime",
    ()=>formatAigcLogTime,
    "getAigcCacheReuse",
    ()=>getAigcCacheReuse,
    "getAigcNodeLogError",
    ()=>getAigcNodeLogError,
    "getAigcProviderTrace",
    ()=>getAigcProviderTrace,
    "getAigcRunLogError",
    ()=>getAigcRunLogError,
    "latestRelevantAttempt",
    ()=>latestRelevantAttempt
]);
const AIGC_RUN_ERROR_FALLBACK = "执行失败，未提供详细原因";
const AIGC_REDACTED_ERROR_FALLBACK = "执行失败，错误详情已脱敏";
const AIGC_BLOCKED_MESSAGE = "因上游失败被阻塞";
const localDateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    year: "numeric"
});
function formatAigcLogTime(value) {
    if (!value) return "-";
    const timestamp = Date.parse(value);
    if (!Number.isFinite(timestamp)) return "-";
    const parts = Object.fromEntries(localDateTimeFormatter.formatToParts(timestamp).map((part)=>[
            part.type,
            part.value
        ]));
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function formatAigcEndTime(value, active) {
    const formatted = formatAigcLogTime(value);
    return formatted === "-" && active ? "进行中" : formatted;
}
function formatAigcDuration(startedAt, finishedAt, active = false) {
    const started = parseTimestamp(startedAt);
    if (started === null) return "-";
    const finished = parseTimestamp(finishedAt);
    if (finished === null) return active ? "进行中" : "-";
    if (finished < started) return "-";
    return formatDurationMilliseconds(finished - started);
}
function latestRelevantAttempt(node) {
    if (node.attempts.length === 0) return null;
    const currentAttempt = node.current_task_id ? node.attempts.find((attempt)=>attempt.task_id === node.current_task_id) : undefined;
    if (currentAttempt) return currentAttempt;
    return node.attempts.reduce((latest, attempt)=>attempt.attempt > latest.attempt ? attempt : latest);
}
function getAigcRunLogError(run) {
    if (run.status !== "failed") return null;
    return toLogError(run.error);
}
function getAigcNodeLogError(node) {
    if (node.status === "blocked") {
        return {
            code: null,
            message: AIGC_BLOCKED_MESSAGE,
            requestId: null,
            stage: null
        };
    }
    if (node.status !== "failed" && node.status !== "timed_out") return null;
    return toLogError(latestRelevantAttempt(node)?.error ?? node.error ?? null);
}
function getAigcCacheReuse(node) {
    return node.status === "reused" ? safeTraceValue(node.reused_from_task_id) : null;
}
function formatAigcErrorStage(stage) {
    if (!stage) return null;
    const normalized = stage.trim().toLowerCase();
    if ([
        "initialization",
        "input_resolution",
        "scheduling",
        "validate",
        "validation"
    ].includes(normalized)) {
        return "validate";
    }
    if ([
        "create",
        "submit"
    ].includes(normalized)) return "submit";
    if ([
        "poll",
        "provider_poll"
    ].includes(normalized)) return "poll";
    if ([
        "asset_transfer",
        "download",
        "store",
        "transfer"
    ].includes(normalized)) {
        return "transfer";
    }
    if ([
        "database",
        "db",
        "persist",
        "persistence",
        "repository"
    ].includes(normalized)) {
        return "persistence";
    }
    return safeStageValue(normalized);
}
function getAigcProviderTrace(node) {
    const attempt = latestRelevantAttempt(node);
    const assets = attempt?.result.assets.length ? attempt.result.assets : node.result.assets;
    const metadata = assets.find((asset)=>asset.metadata)?.metadata;
    const requestId = safeTraceValue(metadata?.provider_request_id);
    const taskId = safeTraceValue(metadata?.provider_task_id);
    return requestId || taskId ? {
        requestId,
        taskId
    } : null;
}
function parseTimestamp(value) {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
}
function formatDurationMilliseconds(durationMs) {
    if (durationMs < 1_000) return `${durationMs} 毫秒`;
    const totalSeconds = Math.floor(durationMs / 1_000);
    const hours = Math.floor(totalSeconds / 3_600);
    const minutes = Math.floor(totalSeconds % 3_600 / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours} 小时`);
    if (minutes > 0) parts.push(`${minutes} 分`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} 秒`);
    return parts.join(" ");
}
function toLogError(error) {
    return {
        code: error?.code ?? null,
        message: safeErrorMessage(error?.message),
        requestId: error?.request_id ?? null,
        stage: formatAigcErrorStage(error?.stage)
    };
}
function safeErrorMessage(value) {
    if (!value) return AIGC_RUN_ERROR_FALLBACK;
    if (/https?:\/\//i.test(value) || /\b(api[_ -]?key|authorization|bearer|credential|password|secret|signature|token)\b/i.test(value)) {
        return AIGC_REDACTED_ERROR_FALLBACK;
    }
    return value;
}
function safeStageValue(value) {
    return /^[a-z0-9_-]{1,80}$/.test(value) ? value : null;
}
function safeTraceValue(value) {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return /^[A-Za-z0-9._:/-]{1,255}$/.test(normalized) ? normalized : null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/run-scope.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ACTIVE_AIGC_RUN_STATUSES",
    ()=>ACTIVE_AIGC_RUN_STATUSES,
    "createAigcRunProjection",
    ()=>createAigcRunProjection,
    "getAigcProjectionNodeIds",
    ()=>getAigcProjectionNodeIds,
    "getAigcRunConflictNodeIds",
    ()=>getAigcRunConflictNodeIds,
    "getAigcRunProjectionNodeIds",
    ()=>getAigcRunProjectionNodeIds,
    "getAigcRunScopeNodeIds",
    ()=>getAigcRunScopeNodeIds,
    "getConnectedAigcNodeIds",
    ()=>getConnectedAigcNodeIds,
    "getDownstreamAigcNodeIds",
    ()=>getDownstreamAigcNodeIds,
    "selectAigcProjectionRunIds",
    ()=>selectAigcProjectionRunIds
]);
const ACTIVE_AIGC_RUN_STATUSES = new Set([
    "queued",
    "running"
]);
function getConnectedAigcNodeIds(definition, startNodeId) {
    const nodeIds = new Set(definition.nodes.map((node)=>node.id));
    if (!nodeIds.has(startNodeId)) return new Set();
    const adjacency = new Map([
        ...nodeIds
    ].map((nodeId)=>[
            nodeId,
            new Set()
        ]));
    for (const edge of definition.edges){
        if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
            continue;
        }
        adjacency.get(edge.sourceNodeId)?.add(edge.targetNodeId);
        adjacency.get(edge.targetNodeId)?.add(edge.sourceNodeId);
    }
    const connected = new Set([
        startNodeId
    ]);
    const pending = [
        startNodeId
    ];
    while(pending.length > 0){
        const current = pending.pop();
        for (const neighbor of adjacency.get(current) ?? []){
            if (connected.has(neighbor)) continue;
            connected.add(neighbor);
            pending.push(neighbor);
        }
    }
    return connected;
}
function getDownstreamAigcNodeIds(definition, startNodeId) {
    const nodeIds = new Set(definition.nodes.map((node)=>node.id));
    if (!nodeIds.has(startNodeId)) return new Set();
    const children = adjacencyFor(definition, nodeIds, "downstream");
    return walkAigcNodeIds(startNodeId, children);
}
function getAigcProjectionNodeIds(definition, startNodeId) {
    const nodeIds = new Set(definition.nodes.map((node)=>node.id));
    if (!nodeIds.has(startNodeId)) return new Set();
    const children = adjacencyFor(definition, nodeIds, "downstream");
    const parents = adjacencyFor(definition, nodeIds, "upstream");
    const projected = new Set(walkAigcNodeIds(startNodeId, children));
    const pending = [
        ...projected
    ];
    while(pending.length > 0){
        const current = pending.pop();
        for (const parent of parents.get(current) ?? []){
            if (projected.has(parent)) continue;
            projected.add(parent);
            pending.push(parent);
        }
    }
    return projected;
}
function getAigcRunConflictNodeIds(run) {
    if (run.mode === "full") {
        return new Set(run.definition_snapshot.nodes.map((node)=>node.id));
    }
    if (run.start_node_id === null) return new Set();
    return getDownstreamAigcNodeIds(run.definition_snapshot, run.start_node_id);
}
function getAigcRunProjectionNodeIds(run) {
    if (run.mode === "full") {
        return new Set(run.definition_snapshot.nodes.map((node)=>node.id));
    }
    if (run.start_node_id === null) return new Set();
    return getAigcProjectionNodeIds(run.definition_snapshot, run.start_node_id);
}
const getAigcRunScopeNodeIds = getAigcRunProjectionNodeIds;
function selectAigcProjectionRunIds(definition, runs, selectedRunId) {
    const selectedIds = new Set();
    const newestFirst = newestRunsFirst(runs);
    for (const run of newestFirst){
        if (ACTIVE_AIGC_RUN_STATUSES.has(run.status)) {
            selectedIds.add(run.id);
        }
    }
    if (selectedRunId !== null) selectedIds.add(selectedRunId);
    for (const node of definition.nodes){
        const latestTerminal = newestFirst.find((run)=>!ACTIVE_AIGC_RUN_STATUSES.has(run.status) && getAigcRunProjectionNodeIds(run).has(node.id));
        if (latestTerminal) selectedIds.add(latestTerminal.id);
        const latestSuccessful = newestFirst.find((run)=>run.status === "succeeded" && getAigcRunProjectionNodeIds(run).has(node.id));
        if (latestSuccessful) selectedIds.add(latestSuccessful.id);
    }
    return [
        ...selectedIds
    ];
}
function createAigcRunProjection(definition, runs, details, selectedRunId) {
    const currentNodeIds = new Set(definition.nodes.map((node)=>node.id));
    const newestFirst = newestRunsFirst(runs);
    const activeRuns = newestFirst.filter((run)=>ACTIVE_AIGC_RUN_STATUSES.has(run.status));
    const activeScopes = activeRuns.map((run)=>({
            run,
            scope: getAigcRunProjectionNodeIds(run)
        }));
    const terminalRuns = newestFirst.filter((run)=>!ACTIVE_AIGC_RUN_STATUSES.has(run.status));
    const successfulRuns = terminalRuns.filter((run)=>run.status === "succeeded");
    const selectedDetail = selectedRunId === null ? undefined : details.get(selectedRunId);
    function detailForNode(candidates, nodeId) {
        const run = candidates.find((candidate)=>getAigcRunProjectionNodeIds(candidate).has(nodeId));
        return run ? details.get(run.id) ?? null : null;
    }
    function activeRunForNodeId(nodeId) {
        return activeScopes.find(({ scope })=>scope.has(nodeId))?.run ?? null;
    }
    function selectedRunForNode(nodeId) {
        if (selectedDetail && getAigcRunProjectionNodeIds(selectedDetail.run).has(nodeId)) {
            return selectedDetail;
        }
        return null;
    }
    return {
        isNodeActive (nodeId) {
            return currentNodeIds.has(nodeId) && activeRunForNodeId(nodeId) !== null;
        },
        activeRunForNode (nodeId) {
            if (!currentNodeIds.has(nodeId)) return null;
            const run = activeRunForNodeId(nodeId);
            return run ? details.get(run.id) ?? null : null;
        },
        displayRunForNode (nodeId) {
            if (!currentNodeIds.has(nodeId)) return null;
            const selectedRun = selectedRunForNode(nodeId);
            if (selectedRun) return selectedRun;
            const activeRun = activeRunForNodeId(nodeId);
            if (activeRun) return details.get(activeRun.id) ?? null;
            return detailForNode(terminalRuns, nodeId);
        },
        latestSuccessfulRunForNode (nodeId) {
            if (!currentNodeIds.has(nodeId)) return null;
            return detailForNode(successfulRuns, nodeId);
        },
        hasAnyActiveRun: activeRuns.length > 0
    };
}
function newestRunsFirst(runs) {
    return [
        ...runs
    ].sort((left, right)=>right.run_number - left.run_number);
}
function adjacencyFor(definition, nodeIds, direction) {
    const adjacency = new Map([
        ...nodeIds
    ].map((nodeId)=>[
            nodeId,
            new Set()
        ]));
    for (const edge of definition.edges){
        if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
            continue;
        }
        const source = direction === "downstream" ? edge.sourceNodeId : edge.targetNodeId;
        const target = direction === "downstream" ? edge.targetNodeId : edge.sourceNodeId;
        adjacency.get(source)?.add(target);
    }
    return adjacency;
}
function walkAigcNodeIds(startNodeId, adjacency) {
    const visited = new Set([
        startNodeId
    ]);
    const pending = [
        startNodeId
    ];
    while(pending.length > 0){
        const current = pending.pop();
        for (const neighbor of adjacency.get(current) ?? []){
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            pending.push(neighbor);
        }
    }
    return visited;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/aigc/seedream-image.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/image-dimensions.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/aigc/media-validation.ts [app-client] (ecmascript)");
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
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamImageSize"])(size);
    } catch  {
        return size;
    }
}
function normalizeSeedreamImageConfig(config, previousOperation) {
    const operation = config.operation ?? "image_to_image";
    let size = config.size;
    if (operation === "layer_decomposition" && previousOperation !== undefined && previousOperation !== operation) {
        size = "auto";
    } else if (operation === "image_edit" && previousOperation !== undefined && previousOperation !== operation && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size)) {
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
        const message = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$media$2d$validation$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["layerDecompositionAssetError"])(asset);
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
    const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get("image_to_image");
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
        if (operation === "image_to_image" && size === "auto" || operation === "image_edit" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size) || operation === "layer_decomposition" && size !== "auto" && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedreamImagePresetSize"])(size)) {
            return issue("size_not_allowed_for_mode", `${seedreamImageTitle(node)}模式不支持尺寸 ${String(size)}`);
        }
    }
    if (size === "auto") return null;
    try {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["normalizeSeedreamImageSize"])(size);
        return null;
    } catch (error) {
        return issue("invalid_image_size", seedreamImageDimensionErrorMessage(error));
    }
}
function seedreamImageDimensionErrorMessage(error) {
    if (!(error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$image$2d$dimensions$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SeedreamImageDimensionError"])) {
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
"[project]/lib/aigc/video-generation.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isVideoEdgeIncompatible",
    ()=>isVideoEdgeIncompatible,
    "isVideoPortActive",
    ()=>isVideoPortActive,
    "seedancePromptLengthWarning",
    ()=>seedancePromptLengthWarning,
    "validateVideoGenerationAssets",
    ()=>validateVideoGenerationAssets,
    "validateVideoGenerationDefinition",
    ()=>validateVideoGenerationDefinition,
    "videoInputCount",
    ()=>videoInputCount,
    "videoInputLimit",
    ()=>videoInputLimit
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/lib/aigc/node-registry.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/seedance.ts [app-client] (ecmascript)");
;
;
function isVideoPortActive(port, mode) {
    return port.modes.length === 0 || port.modes.includes(mode);
}
function videoInputLimit(node, port) {
    const capabilities = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_CAPABILITIES"][node.config.model];
    if (port.id === "reference_images") {
        return capabilities.maxReferenceImages;
    }
    if (port.id === "reference_videos") {
        return capabilities.maxReferenceVideos;
    }
    if (port.id === "reference_audios") {
        return capabilities.maxReferenceAudios;
    }
    return port.max_connections;
}
function videoInputCount(edges, nodeId, handleId) {
    return edges.filter((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === handleId).length;
}
function isVideoEdgeIncompatible(edge, nodes) {
    const target = nodes.find((node)=>node.id === edge.targetNodeId);
    if (target?.type !== "video_generation") return false;
    const port = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get(target.type)?.inputs.find((candidate)=>candidate.id === edge.targetHandle);
    return Boolean(port && !isVideoPortActive(port, target.config.generation_mode));
}
function validateVideoGenerationDefinition(definition) {
    return definition.nodes.flatMap((node)=>node.type === "video_generation" ? validateVideoGenerationNode(node, definition.edges) : []);
}
function validateVideoGenerationAssets(definition, nodeId, assets) {
    const node = definition.nodes.find((candidate)=>candidate.id === nodeId);
    if (node?.type !== "video_generation") return [];
    const assetById = new Map(assets.map((asset)=>[
            asset.id,
            asset
        ]));
    const connected = (handle)=>definition.edges.filter((edge)=>edge.targetNodeId === nodeId && edge.targetHandle === handle).map((edge)=>definition.nodes.find((candidate)=>candidate.id === edge.sourceNodeId)).flatMap((source)=>source && (source.type === "video" || source.type === "audio" || source.type === "image") && source.config.asset_id ? [
                assetById.get(source.config.asset_id)
            ] : []).filter((asset)=>Boolean(asset));
    const maximum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedanceInputDurationLimit"])(node.config.model);
    const videoMinimum = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["seedanceVideoInputMinimum"])(node.config.model, node.config.task_type ?? "generate");
    const videos = connected("reference_videos");
    const audios = connected("reference_audios");
    for (const [label, items, minimum] of [
        [
            "参考视频",
            videos,
            videoMinimum
        ],
        [
            "参考音频",
            audios,
            2
        ]
    ]){
        const inspected = items.filter((asset)=>asset.metadata.inspection_version === 1);
        for (const asset of inspected){
            const duration = metadataNumber(asset, "duration_seconds");
            if (duration === null || duration < minimum || duration > maximum) {
                return [
                    {
                        code: "invalid_media_input",
                        message: `${label}时长需为 ${minimum}-${maximum} 秒`,
                        nodeId
                    }
                ];
            }
        }
        const total = inspected.reduce((sum, asset)=>sum + (metadataNumber(asset, "duration_seconds") ?? 0), 0);
        if (total > maximum) {
            return [
                {
                    code: "invalid_media_input",
                    message: `${label}总时长 ${formatSeconds(total)}，不能超过 ${maximum} 秒`,
                    nodeId
                }
            ];
        }
    }
    return [];
}
function validateVideoGenerationNode(node, edges) {
    const registration = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$aigc$2f$node$2d$registry$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["AIGC_NODE_REGISTRY_BY_TYPE"].get("video_generation");
    if (!registration) return [];
    const counts = Object.fromEntries(registration.inputs.map((port)=>[
            port.id,
            videoInputCount(edges, node.id, port.id)
        ]));
    const issue = (code, message)=>({
            code,
            message,
            nodeId: node.id
        });
    for (const port of registration.inputs){
        if (counts[port.id] > 0 && !isVideoPortActive(port, node.config.generation_mode)) {
            return [
                issue("input_not_allowed_for_mode", `${port.label}不适用于当前生成模式，请断开对应连线`)
            ];
        }
        const limit = videoInputLimit(node, port);
        if (counts[port.id] > limit) {
            return [
                issue("input_connection_limit_exceeded", `${port.label}最多连接 ${limit} 个素材，当前为 ${counts[port.id]} 个`)
            ];
        }
    }
    const capabilities = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_CAPABILITIES"][node.config.model];
    if (!capabilities.resolutions.includes(node.config.resolution)) {
        return [
            issue("invalid_resolution", "当前模型不支持所选分辨率")
        ];
    }
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isSeedanceDurationValid"])(node.config.model, node.config.duration_seconds)) {
        return [
            issue("invalid_duration", "当前模型不支持所选视频时长")
        ];
    }
    if (!__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_ASPECT_RATIOS"].includes(node.config.aspect_ratio)) {
        return [
            issue("invalid_aspect_ratio", "宽高比配置无效")
        ];
    }
    if (node.config.generation_mode === "text_to_video" && counts.prompt === 0) {
        return [
            issue("required_input_missing", "文生视频模式必须连接提示词")
        ];
    }
    if ((node.config.generation_mode === "first_frame" || node.config.generation_mode === "first_last_frame") && counts.first_frame === 0) {
        return [
            issue("required_input_missing", "当前模式必须连接首帧图片")
        ];
    }
    if (node.config.generation_mode === "first_last_frame" && counts.last_frame === 0) {
        return [
            issue("required_input_missing", "首尾帧模式必须连接尾帧图片")
        ];
    }
    if (node.config.generation_mode === "multimodal_reference") {
        const referenceCount = counts.reference_images + counts.reference_videos + counts.reference_audios;
        if (counts.prompt + referenceCount === 0) {
            return [
                issue("reference_input_required", "全模态参考模式至少需要提示词或一种参考素材")
            ];
        }
        if (node.config.model !== __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$seedance$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SEEDANCE_DEFAULT_MODEL"] && counts.reference_audios > 0 && counts.reference_images + counts.reference_videos === 0) {
            return [
                issue("audio_only_not_supported", "Seedance 2.0 系列仅有音频时，还需连接参考图片或参考视频")
            ];
        }
        if (((node.config.task_type ?? "generate") === "edit" || (node.config.task_type ?? "generate") === "extend") && counts.reference_videos === 0) {
            return [
                issue("reference_video_required", `${node.config.task_type === "edit" ? "编辑" : "延长"}任务必须连接参考视频`)
            ];
        }
    }
    return [];
}
function seedancePromptLengthWarning(text) {
    const trimmed = text.trim();
    if (!trimmed) return null;
    const chineseCharacters = [
        ...trimmed
    ].filter((character)=>/[\u3400-\u9fff]/u.test(character)).length;
    if (chineseCharacters > 500) {
        return `中文提示词约 ${chineseCharacters} 字，建议不超过 500 字`;
    }
    const englishWords = trimmed.replace(/[\u3400-\u9fff]/gu, " ").match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
    return englishWords > 1000 ? `英文提示词约 ${englishWords} 词，建议不超过 1000 词` : null;
}
function metadataNumber(asset, key) {
    const value = asset.metadata[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}
function formatSeconds(value) {
    return `${Math.round(value * 10) / 10} 秒`;
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
"[project]/lib/asset-display.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/api-client.ts [app-client] (ecmascript)");
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
    const baseUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "");
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
    const baseUrl = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "");
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
        return `${(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$api$2d$client$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBackendBaseUrl"])().replace(/\/+$/, "")}${value}`;
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/layer-editor-geometry.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MAX_LAYER_SCALE",
    ()=>MAX_LAYER_SCALE,
    "MIN_LAYER_SCALE",
    ()=>MIN_LAYER_SCALE,
    "clampLayerScale",
    ()=>clampLayerScale,
    "getLayerFrame",
    ()=>getLayerFrame,
    "moveLayer",
    ()=>moveLayer,
    "positionFromDrag",
    ()=>positionFromDrag,
    "scaleFromResize",
    ()=>scaleFromResize
]);
const MIN_LAYER_SCALE = 0.05;
const MAX_LAYER_SCALE = 20;
function getLayerFrame(layer, canvasWidth, canvasHeight) {
    const [x1, y1, x2, y2] = layer.bbox_absolute;
    return {
        heightPercent: (y2 - y1) * layer.scale * 100 / canvasHeight,
        leftPercent: layer.x * 100 / canvasWidth,
        topPercent: layer.y * 100 / canvasHeight,
        widthPercent: (x2 - x1) * layer.scale * 100 / canvasWidth
    };
}
function positionFromDrag(start, deltaX, deltaY, renderedWidth, renderedHeight, canvasWidth, canvasHeight) {
    if (renderedWidth <= 0 || renderedHeight <= 0) return start;
    return {
        x: roundCoordinate(start.x + deltaX / renderedWidth * canvasWidth),
        y: roundCoordinate(start.y + deltaY / renderedHeight * canvasHeight)
    };
}
function clampLayerScale(value) {
    if (!Number.isFinite(value)) return MIN_LAYER_SCALE;
    return Math.min(MAX_LAYER_SCALE, Math.max(MIN_LAYER_SCALE, value));
}
function scaleFromResize(start, deltaX, deltaY, renderedWidth, renderedHeight, canvasWidth, canvasHeight) {
    if (renderedWidth <= 0 || renderedHeight <= 0 || canvasWidth <= 0 || canvasHeight <= 0) {
        return start.scale;
    }
    const baseWidth = start.layerWidth / canvasWidth * renderedWidth;
    const baseHeight = start.layerHeight / canvasHeight * renderedHeight;
    const diagonalSquared = baseWidth ** 2 + baseHeight ** 2;
    if (diagonalSquared <= 0) return start.scale;
    const projectedScaleDelta = (deltaX * baseWidth + deltaY * baseHeight) / diagonalSquared;
    return clampLayerScale(start.scale + projectedScaleDelta);
}
function moveLayer(layers, layerId, direction) {
    const ordered = layers.toSorted((a, b)=>a.z_index - b.z_index);
    const index = ordered.findIndex((layer)=>layer.id === layerId);
    const targetIndex = direction === "up" ? index + 1 : index - 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
        return [
            ...layers
        ];
    }
    const current = ordered[index];
    const target = ordered[targetIndex];
    return ordered.map((layer)=>{
        if (layer.id === current.id) {
            return {
                ...layer,
                z_index: target.z_index
            };
        }
        if (layer.id === target.id) {
            return {
                ...layer,
                z_index: current.z_index
            };
        }
        return layer;
    }).toSorted((a, b)=>a.z_index - b.z_index);
}
function roundCoordinate(value) {
    return Math.round(value * 100) / 100;
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

//# sourceMappingURL=lib_04j2sa-._.js.map