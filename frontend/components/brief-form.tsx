"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  apiClient,
  getUserFacingErrorMessage
} from "@/lib/api-client";
import type { BriefCreate, ProjectCreate } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const platformOptions = [
  { label: "抖音 / 短视频强转化", value: "douyin" },
  { label: "小红书 / 种草叙事", value: "xiaohongshu" },
  { label: "TikTok / Global Launch", value: "tiktok" },
  { label: "Bilibili / 场景解释", value: "bilibili" }
];

const aspectRatioOptions: Array<{
  label: string;
  value: NonNullable<BriefCreate["aspect_ratio"]>;
}> = [
  { label: "9:16 竖屏", value: "9:16" },
  { label: "16:9 横屏", value: "16:9" },
  { label: "1:1 方形", value: "1:1" },
  { label: "4:3 横版", value: "4:3" },
  { label: "3:4 竖版", value: "3:4" }
];

const durationOptions = [15, 30, 45, 60, 90];

const selectClassName =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-1 text-sm text-foreground shadow-sm transition-all focus-visible:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50";

export function BriefForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const prompt = getFormValue(formData, "prompt");
    const productName = getFormValue(formData, "product_name");
    const durationSeconds = Number(getFormValue(formData, "duration_seconds"));

    if (prompt.length === 0) {
      setErrorMessage("请先写下广告需求，系统需要它来建立项目 Brief。");
      return;
    }

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      setErrorMessage("请选择有效的视频时长。");
      return;
    }

    const brief: BriefCreate = {
      prompt,
      aspect_ratio: getFormValue(
        formData,
        "aspect_ratio"
      ) as BriefCreate["aspect_ratio"],
      audience: toOptionalValue(getFormValue(formData, "audience")),
      duration_seconds: durationSeconds,
      product_name: toOptionalValue(productName),
      style: toOptionalValue(getFormValue(formData, "style")),
      target_platform: getFormValue(formData, "target_platform")
    };

    const payload: ProjectCreate = {
      brief,
      name: productName.length > 0 ? `${productName} 创意项目` : null
    };

    try {
      setIsSubmitting(true);
      const project = await apiClient.createProject(payload);
      router.push(`/projects/${encodeURIComponent(project.id)}`);
    } catch (error) {
      setErrorMessage(formatSubmitError(error));
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="prompt">广告需求</Label>
        <Textarea
          className="min-h-36"
          id="prompt"
          name="prompt"
          placeholder="例如：为一款便携咖啡机生成 30 秒竖屏广告，突出通勤、露营和办公室场景，开头 3 秒必须有强钩子。"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="投放平台" name="target_platform">
          <select
            className={selectClassName}
            defaultValue="douyin"
            id="target_platform"
            name="target_platform"
          >
            {platformOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="画面比例" name="aspect_ratio">
          <select
            className={selectClassName}
            defaultValue="9:16"
            id="aspect_ratio"
            name="aspect_ratio"
          >
            {aspectRatioOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="视频时长" name="duration_seconds">
          <select
            className={selectClassName}
            defaultValue="30"
            id="duration_seconds"
            name="duration_seconds"
          >
            {durationOptions.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds} 秒
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="商品名称" name="product_name">
          <Input
            id="product_name"
            name="product_name"
            placeholder="例如：AeroPress Go"
          />
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="视觉风格" name="style">
          <Input
            id="style"
            name="style"
            placeholder="电影感、赛博橙蓝、真实生活流"
          />
        </FormField>

        <FormField label="目标受众" name="audience">
          <Input
            id="audience"
            name="audience"
            placeholder="一线城市通勤白领、精致露营玩家"
          />
        </FormField>
      </div>

      {errorMessage ? (
        <div
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm leading-6 text-destructive"
          role="alert"
        >
          {errorMessage}
        </div>
      ) : null}

      <Button
        className="h-12 w-full rounded-2xl"
        disabled={isSubmitting}
        type="submit"
        variant="cinematic"
      >
        {isSubmitting ? "正在建立项目..." : "生成项目并进入详情页"}
      </Button>
    </form>
  );
}

function FormField({
  children,
  className,
  label,
  name
}: {
  children: ReactNode;
  className?: string;
  label: string;
  name: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
    </div>
  );
}

function getFormValue(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalValue(value: string): string | null {
  return value.length > 0 ? value : null;
}

function formatSubmitError(error: unknown): string {
  return getUserFacingErrorMessage(error);
}
