import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NodeCanvas } from "@/components/workspace/canvas/node-canvas";

describe("NodeCanvas controls", () => {
  it("keeps the shared default and accepts scoped control presentation", () => {
    const view = render(<NodeCanvas nodes={[]} />);
    const defaultControls = screen.getByTestId("rf__controls");
    const defaultCanvas = screen.getByTestId("node-canvas-root");

    expect(defaultControls).toHaveClass("vertical", "bottom", "left");
    expect(defaultCanvas).not.toHaveClass("aigc-dark-canvas");

    view.rerender(
      <NodeCanvas
        backgroundProps={{ color: "#39404a", gap: 20, size: 1 }}
        className="aigc-dark-canvas"
        controlsProps={{
          className: "workbench-controls",
          orientation: "horizontal",
          position: "bottom-center"
        }}
        nodes={[]}
      />
    );

    expect(screen.getByTestId("rf__controls")).toHaveClass(
      "workbench-controls",
      "horizontal",
      "bottom",
      "center"
    );
    expect(screen.getByTestId("node-canvas-root")).toHaveClass(
      "aigc-dark-canvas"
    );
  });
});
