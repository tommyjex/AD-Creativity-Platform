"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type { Asset } from "@/lib/api-types";
import { getAssetContentUrlById, getSafePreviewUrl, getWorkspaceAssetDescription } from "@/lib/asset-display";
import { subtitleFieldClass } from "@/lib/subtitle-translation";
import { SubtitleVideoPreview } from "./video-preview";

export function SubtitleVideoInput({
  label, role, assetId, assets, disabled, onSelect, onAsset
}: {
  label: string;
  role: "reference" | "clean";
  assetId: string | null;
  assets: Asset[];
  disabled: boolean;
  onSelect: (id: string | null) => void;
  onAsset: (asset: Asset) => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const currentId = useRef(assetId);
  useEffect(() => { currentId.current = assetId; }, [assetId]);
  const videos = assets.filter((asset) => asset.project_id === null &&
    (asset.mime_type?.startsWith("video/") || asset.metadata.tool_asset_kind === "video"));
  const asset = videos.find((item) => item.id === assetId);
  const preview = asset ? getSafePreviewUrl(asset) : assetId ? getAssetContentUrlById(assetId) : null;

  async function importAsset(action: () => Promise<Asset>) {
    const token = ++generation.current;
    const startingId = currentId.current;
    setBusy(true);
    setError(null);
    try {
      const imported = await action();
      if (!alive.current || token !== generation.current || currentId.current !== startingId) return;
      onAsset(imported);
      onSelect(imported.id);
      setUrl("");
    } catch (cause) {
      if (alive.current && token === generation.current) setError(getUserFacingErrorMessage(cause));
    } finally {
      if (alive.current && token === generation.current) setBusy(false);
    }
  }

  return (
    <section className="min-w-0 space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{label}</h3>
      <label className="block text-xs text-muted-foreground">
        选择工具视频资产
        <select aria-label={`${label}资产`} className={`${subtitleFieldClass} mt-1`} value={assetId ?? ""} disabled={disabled || busy} onChange={(event) => onSelect(event.target.value || null)}>
          <option value="">未选择</option>
          {assetId && !asset ? <option value={assetId}>{assetId}</option> : null}
          {videos.map((item) => <option key={item.id} value={item.id}>{getWorkspaceAssetDescription(item)}</option>)}
        </select>
      </label>
      <label className="block text-xs text-muted-foreground">
        本地上传 · 最大 512 MiB
        <input aria-label={`${label}上传`} className={`${subtitleFieldClass} mt-1`} type="file" accept="video/*" disabled={disabled || busy} onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (file.size > 512 * 1024 * 1024) { setError("视频不能超过 512 MiB。"); return; }
          void importAsset(() => apiClient.uploadSubtitleVideo(file, role, { filename: file.name, mimeType: file.type }));
        }} />
      </label>
      <label className="block text-xs text-muted-foreground">
        HTTPS TOS 对象地址
        <input aria-label={`${label}地址`} className={`${subtitleFieldClass} mt-1`} type="url" value={url} disabled={disabled || busy} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <Button type="button" variant="outline" disabled={disabled || busy || !url.trim()} onClick={() => {
        try {
          if (new URL(url).protocol !== "https:") throw new Error();
        } catch { setError("请输入 HTTPS TOS 对象地址，不接受 tos://。"); return; }
        void importAsset(() => apiClient.importSubtitleVideo(url.trim(), role));
      }}>{busy ? "正在导入…" : "导入地址"}</Button>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {preview ? <SubtitleVideoPreview key={assetId} url={preview} label={label} /> : <p className="py-6 text-center text-sm text-muted-foreground">尚未导入视频</p>}
    </section>
  );
}
