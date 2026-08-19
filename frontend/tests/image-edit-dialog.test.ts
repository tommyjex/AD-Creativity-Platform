import { describe, expect, it } from "vitest";

import {
  createBboxAnnotation,
  getContainedImageRect,
  normalizeImagePoint
} from "@/components/workspace/image-edit-dialog";

describe("图片编辑标注几何", () => {
  it("从 object-contain 的实际内容矩形排除左右 letterbox", () => {
    const content = getContainedImageRect(
      { height: 400, left: 100, top: 50, width: 800 },
      1000,
      1000
    );

    expect(content).toEqual({
      height: 400,
      left: 300,
      top: 50,
      width: 400
    });
    expect(normalizeImagePoint(300, 250, content)).toEqual({ x: 0, y: 500 });
    expect(normalizeImagePoint(700, 250, content)).toEqual({ x: 999, y: 500 });
  });

  it("从 object-contain 的实际内容矩形排除上下 letterbox", () => {
    const content = getContainedImageRect(
      { height: 800, left: 20, top: 10, width: 400 },
      1600,
      900
    );

    expect(content.width).toBe(400);
    expect(content.height).toBe(225);
    expect(content.top).toBe(297.5);
    expect(normalizeImagePoint(220, 410, content)).toEqual({ x: 500, y: 500 });
  });

  it("按 round/clamp 规则生成 0..999 点坐标", () => {
    const rect = { height: 200, left: 50, top: 100, width: 400 };

    expect(normalizeImagePoint(151, 151, rect)).toEqual({ x: 253, y: 255 });
    expect(normalizeImagePoint(-100, 999, rect)).toEqual({ x: 0, y: 999 });
  });

  it("反向拖框后排序 bbox 并拒绝零面积框", () => {
    expect(
      createBboxAnnotation({ x: 900, y: 700 }, { x: 100, y: 200 })
    ).toEqual({
      type: "bbox",
      x1: 100,
      x2: 900,
      y1: 200,
      y2: 700
    });
    expect(
      createBboxAnnotation({ x: 100, y: 200 }, { x: 100, y: 300 })
    ).toBeNull();
  });
});
