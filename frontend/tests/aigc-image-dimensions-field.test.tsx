import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { AigcImageDimensionsField } from "@/components/workspace/aigc/aigc-image-dimensions-field";
import { normalizeSeedreamCustomImageSize } from "@/lib/aigc/image-dimensions";
import type { ImageModelConfig } from "@/lib/aigc/types";

function DimensionsHarness({
  initialConfig,
  onChange = vi.fn()
}: {
  initialConfig: ImageModelConfig;
  onChange?: (config: ImageModelConfig) => void;
}) {
  const [config, setConfig] = useState(initialConfig);
  return (
    <AigcImageDimensionsField
      config={config}
      nodeId="image-model"
      onChange={(next) => {
        setConfig(next);
        onChange(next);
      }}
    />
  );
}

describe("AIGC image dimensions field", () => {
  it("switches between preset and custom dimensions using the official mapping", () => {
    const onChange = vi.fn();
    render(
      <DimensionsHarness
        initialConfig={{
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "16:9",
          size: "1.5K",
          format: "png"
        }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText("画幅")).toHaveValue("16:9");
    expect(screen.getByLabelText("分辨率档位")).toHaveValue("1.5K");
    fireEvent.click(screen.getByRole("button", { name: "自定义像素" }));

    expect(screen.queryByLabelText("画幅")).toBeNull();
    expect(screen.queryByLabelText("分辨率档位")).toBeNull();
    expect(screen.getByLabelText("宽度")).toHaveValue(2048);
    expect(screen.getByLabelText("高度")).toHaveValue(1152);
    expect(screen.getByLabelText("输出格式")).toHaveValue("png");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        aspect_ratio: "16:9",
        size: "2048x1152"
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "分辨率档位" }));
    expect(screen.getByLabelText("画幅")).toHaveValue("16:9");
    expect(screen.getByLabelText("分辨率档位")).toHaveValue("2K");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        aspect_ratio: "16:9",
        size: "2K"
      })
    );
  });

  it("keeps invalid keyboard drafts visible and reports field and combined errors", () => {
    const onChange = vi.fn();
    render(
      <DimensionsHarness
        initialConfig={{
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: normalizeSeedreamCustomImageSize("2048x1024"),
          format: "jpeg"
        }}
        onChange={onChange}
      />
    );

    const width = screen.getByLabelText("宽度");
    fireEvent.change(width, { target: { value: "" } });
    expect(width).toHaveValue(null);
    expect(screen.getByText("请输入宽度")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: "x1024" })
    );

    fireEvent.change(width, { target: { value: "1024.5" } });
    expect(screen.getByText("宽度必须为正整数")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: "1024.5x1024" })
    );

    fireEvent.change(width, { target: { value: "512" } });
    fireEvent.change(screen.getByLabelText("高度"), {
      target: { value: "512" }
    });
    expect(
      screen.getByText("总像素必须在 921,600–4,624,220 之间")
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ size: "512x512" })
    );

    fireEvent.change(width, { target: { value: "3841" } });
    fireEvent.change(screen.getByLabelText("高度"), {
      target: { value: "240" }
    });
    expect(
      screen.getByText("宽高比必须在 1:16–16:1 之间")
    ).toBeInTheDocument();
  });

  it("uses a stable single-column narrow layout without fixed-width controls", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390
    });
    render(
      <DimensionsHarness
        initialConfig={{
          model: "doubao-seedream-5-0-pro-260628",
          aspect_ratio: "1:1",
          size: normalizeSeedreamCustomImageSize("2048x1024"),
          format: "png"
        }}
      />
    );

    expect(screen.getByTestId("aigc-custom-dimensions-grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "min-w-0"
    );
    expect(screen.getByLabelText("宽度")).toHaveClass("w-full", "min-w-0");
    expect(screen.getByLabelText("高度")).toHaveClass("w-full", "min-w-0");
  });
});
