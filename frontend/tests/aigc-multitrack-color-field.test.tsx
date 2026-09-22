import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AigcMultitrackColorField } from "@/components/workspace/aigc/aigc-multitrack-color-field";

function renderField(value = "#11223380") {
  const callbacks = {
    onCommit: vi.fn(),
    onGestureCancel: vi.fn(),
    onGestureCommit: vi.fn(),
    onGestureStart: vi.fn(),
    onPreview: vi.fn()
  };
  render(
    <AigcMultitrackColorField
      label="文字颜色"
      value={value}
      {...callbacks}
    />
  );
  return callbacks;
}

describe("AigcMultitrackColorField", () => {
  it("opens an anchored visual picker with synchronized alpha", () => {
    const callbacks = renderField();

    fireEvent.click(screen.getByRole("button", { name: "选择文字颜色" }));

    expect(
      screen.getByRole("dialog", { name: "文字颜色选择器" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("文字颜色 RGBA")).toHaveValue("#11223380");
    expect(screen.getByLabelText("文字颜色透明度")).toHaveValue("50");

    const alpha = screen.getByLabelText("文字颜色透明度");
    fireEvent.pointerDown(alpha, { pointerId: 1 });
    fireEvent.change(alpha, { target: { value: "25" } });
    expect(callbacks.onGestureStart).toHaveBeenCalledTimes(1);
    expect(callbacks.onPreview).toHaveBeenLastCalledWith("#11223340");

    fireEvent.pointerUp(alpha, { pointerId: 1 });
    expect(callbacks.onGestureCommit).toHaveBeenCalledWith("#11223340");
  });

  it("commits valid hexadecimal input on blur", () => {
    const callbacks = renderField();
    const input = screen.getByLabelText("文字颜色 RGBA");

    fireEvent.change(input, { target: { value: "#aabbcc44" } });
    fireEvent.blur(input);

    expect(callbacks.onCommit).toHaveBeenCalledWith("#AABBCC44");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps an invalid draft visible without committing it", () => {
    const callbacks = renderField();
    const input = screen.getByLabelText("文字颜色 RGBA");

    fireEvent.change(input, { target: { value: "#123" } });
    fireEvent.blur(input);

    expect(input).toHaveValue("#123");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "请输入 #RRGGBBAA 格式"
    );
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });
});
