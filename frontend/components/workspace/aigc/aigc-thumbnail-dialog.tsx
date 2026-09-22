"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, LoaderCircle, Video } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiClient, getUserFacingErrorMessage } from "@/lib/api-client";
import type {
  AigcPipeline,
  AigcPipelineThumbnailCandidate
} from "@/lib/aigc/types";

interface AigcThumbnailDialogProps {
  onOpenChange: (open: boolean) => void;
  onUpdated: (pipeline: AigcPipeline) => void;
  open: boolean;
  pipeline: AigcPipeline | null;
}

export function AigcThumbnailDialog({
  onOpenChange,
  onUpdated,
  open,
  pipeline
}: AigcThumbnailDialogProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const candidatesQuery = useQuery({
    queryKey: ["aigc", "pipeline-thumbnail-candidates", pipeline?.id],
    queryFn: () =>
      apiClient.listAigcPipelineThumbnailCandidates(pipeline!.id, {
        page: 1,
        pageSize: 50
      }),
    enabled: open && pipeline !== null
  });
  const updateMutation = useMutation({
    mutationFn: (assetId: string | null) =>
      apiClient.updateAigcPipelineThumbnail(pipeline!.id, {
        asset_id: assetId
      }),
    onError: (mutationError) => setError(getUserFacingErrorMessage(mutationError)),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: ["aigc", "pipelines"] });
      setError(null);
      setSelectedAssetId(null);
      onUpdated(updated);
      onOpenChange(false);
    }
  });

  function close(nextOpen: boolean) {
    if (!nextOpen && !updateMutation.isPending) {
      setError(null);
      setSelectedAssetId(null);
      onOpenChange(false);
    }
  }

  const candidates = candidatesQuery.data?.items ?? [];
  const selected =
    candidates.find((candidate) => candidate.asset_id === selectedAssetId) ??
    null;

  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="max-w-3xl p-6 sm:p-7">
        <DialogHeader>
          <DialogTitle>选择缩略图</DialogTitle>
          <DialogDescription>
            仅展示该画布成功运行产生的图片和视频结果。
          </DialogDescription>
        </DialogHeader>
        {candidatesQuery.isPending ? (
          <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
          </div>
        ) : candidatesQuery.error ? (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {getUserFacingErrorMessage(candidatesQuery.error)}
          </div>
        ) : candidates.length === 0 ? (
          <div className="border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            尚无可用的图片或视频产物。
          </div>
        ) : (
          <div
            aria-label="缩略图候选"
            className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3"
            role="radiogroup"
          >
            {candidates.map((candidate) => (
              <ThumbnailCandidate
                candidate={candidate}
                key={candidate.asset_id}
                onSelect={setSelectedAssetId}
                selected={selectedAssetId === candidate.asset_id}
              />
            ))}
          </div>
        )}
        {error ? (
          <div className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : null}
        <DialogFooter className="mt-4">
          <Button
            disabled={updateMutation.isPending}
            onClick={() => close(false)}
            type="button"
            variant="ghost"
          >
            取消
          </Button>
          {pipeline?.thumbnail_asset_id ? (
            <Button
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate(null)}
              type="button"
              variant="outline"
            >
              清除缩略图
            </Button>
          ) : null}
          <Button
            disabled={!selected || updateMutation.isPending}
            onClick={() => {
              if (selected) updateMutation.mutate(selected.asset_id);
            }}
            type="button"
          >
            {updateMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            使用所选缩略图
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThumbnailCandidate({
  candidate,
  onSelect,
  selected
}: {
  candidate: AigcPipelineThumbnailCandidate;
  onSelect: (assetId: string) => void;
  selected: boolean;
}) {
  const isImage = candidate.kind === "image";

  return (
    <button
      aria-checked={selected}
      className={`overflow-hidden border text-left transition ${
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-border hover:border-primary/60"
      }`}
      onClick={() => onSelect(candidate.asset_id)}
      role="radio"
      type="button"
    >
      <div className="aspect-[4/3] bg-muted">
        {isImage ? (
          <>
            {/* Signed URLs are remote and short-lived, so Next optimization is unsuitable. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              className="h-full w-full object-contain"
              src={candidate.url}
            />
          </>
        ) : (
          <video
            className="h-full w-full object-contain"
            muted
            playsInline
            preload="metadata"
            src={candidate.url}
          />
        )}
      </div>
      <span className="flex items-center gap-1 px-2 py-1.5 text-xs">
        {isImage ? (
          <ImageIcon className="h-3.5 w-3.5" />
        ) : (
          <Video className="h-3.5 w-3.5" />
        )}
        {isImage ? "图片" : "视频"} · {candidate.node_id}
      </span>
    </button>
  );
}
