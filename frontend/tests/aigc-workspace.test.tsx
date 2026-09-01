import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AigcWorkspace } from "@/components/workspace/aigc/aigc-workspace";
import { AigcQueryProvider } from "@/components/workspace/aigc/providers/aigc-query-provider";
import type {
  AigcPage,
  AigcPipeline,
  AigcPipelineDefinition,
  AigcPipelineTemplate
} from "@/lib/aigc/types";

const apiMocks = vi.hoisted(() => ({
  createAigcPipeline: vi.fn(),
  deleteAigcPipeline: vi.fn(),
  deleteAigcTemplate: vi.fn(),
  instantiateAigcTemplate: vi.fn(),
  listAigcPipelines: vi.fn(),
  listAigcTemplates: vi.fn()
}));
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn()
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: apiMocks,
  getUserFacingErrorMessage: () => "请求失败"
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigationMocks
}));

const definition: AigcPipelineDefinition = {
  schemaVersion: 1,
  nodes: [
    {
      id: "input-1",
      type: "text_input",
      position: { x: 0, y: 20 },
      size: { width: 240, height: 160 },
      config: { text: "产品主图" }
    },
    {
      id: "model-1",
      type: "text_to_image",
      position: { x: 320, y: 20 },
      size: { width: 260, height: 220 },
      config: {
        model: "doubao-seedream-5-0-pro-260628",
        aspect_ratio: "1:1",
        size: "2K",
        format: "png"
      }
    }
  ],
  edges: [
    {
      id: "edge-1",
      sourceNodeId: "input-1",
      sourceHandle: "text",
      targetNodeId: "model-1",
      targetHandle: "prompt"
    }
  ],
  viewport: { x: 0, y: 0, zoom: 1 }
};

const template: AigcPipelineTemplate = {
  id: "template-1",
  name: "商品主图模板",
  description: "生成电商商品主视觉",
  definition,
  revision: 2,
  created_at: "2026-08-29T01:00:00Z",
  updated_at: "2026-08-29T02:00:00Z"
};

const pipeline: AigcPipeline = {
  id: "pipeline-1",
  name: "秋季活动画布",
  description: "秋季活动生成流程",
  definition,
  source_template_id: template.id,
  source_template_revision: template.revision,
  revision: 1,
  latest_run_status: "succeeded",
  created_at: "2026-08-29T01:00:00Z",
  updated_at: "2026-08-29T03:00:00Z"
};

function page<T>(items: T[]): AigcPage<T> {
  return {
    items,
    page: 1,
    page_size: 20,
    total: items.length
  };
}

function renderWorkspace({
  initialPipelines = page([pipeline]),
  initialTemplates = page([template])
}: {
  initialPipelines?: AigcPage<AigcPipeline>;
  initialTemplates?: AigcPage<AigcPipelineTemplate>;
} = {}) {
  return render(
    <AigcQueryProvider>
      <AigcWorkspace
        initialPipelines={initialPipelines}
        initialTemplates={initialTemplates}
      />
    </AigcQueryProvider>
  );
}

describe("AIGC workspace list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.listAigcTemplates.mockResolvedValue(page([template]));
    apiMocks.listAigcPipelines.mockResolvedValue(page([pipeline]));
    apiMocks.instantiateAigcTemplate.mockResolvedValue(pipeline);
    apiMocks.createAigcPipeline.mockResolvedValue(pipeline);
    apiMocks.deleteAigcTemplate.mockResolvedValue(undefined);
    apiMocks.deleteAigcPipeline.mockResolvedValue(undefined);
  });

  it("defaults to templates and uses a five-column wide layout", () => {
    renderWorkspace();

    expect(
      screen.getByRole("tab", { name: "画布模板" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("商品主图模板")).toBeInTheDocument();
    expect(screen.getByTestId("aigc-card-grid")).toHaveClass("xl:grid-cols-5");
    expect(
      screen.getByRole("link", { name: "编辑模板：商品主图模板" })
    ).toHaveAttribute("href", "/workspace/aigc/templates/template-1");
  });

  it("switches to my pipelines without a second request for initial data", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("tab", { name: "我的画布" }));

    expect(screen.getByText("秋季活动画布")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(apiMocks.listAigcPipelines).not.toHaveBeenCalled();
  });

  it("filters templates by name and resets to the first page", async () => {
    const filteredTemplate = { ...template, id: "template-2", name: "海报模板" };
    apiMocks.listAigcTemplates.mockResolvedValue(page([filteredTemplate]));
    renderWorkspace();

    fireEvent.change(screen.getByRole("textbox", { name: "按名称筛选" }), {
      target: { value: " 海报 " }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));

    await waitFor(() => {
      expect(apiMocks.listAigcTemplates).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        query: "海报"
      });
    });
    expect(await screen.findByText("海报模板")).toBeInTheDocument();
  });

  it("instantiates a template and opens the new pipeline", async () => {
    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "使用模板：商品主图模板" })
    );

    await waitFor(() => {
      expect(apiMocks.instantiateAigcTemplate).toHaveBeenCalledWith(
        "template-1"
      );
      expect(navigationMocks.push).toHaveBeenCalledWith(
        "/workspace/aigc/pipelines/pipeline-1"
      );
    });
  });

  it("creates a named blank pipeline from the dialog", async () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("button", { name: "新建空白画布" }));
    expect(screen.getByRole("dialog", { name: "新建空白画布" })).toHaveClass(
      "max-w-lg",
      "p-6",
      "sm:p-7"
    );
    fireEvent.change(screen.getByLabelText("画布名称"), {
      target: { value: "新品流程" }
    });
    fireEvent.click(screen.getByRole("button", { name: "创建画布" }));

    await waitFor(() => {
      expect(apiMocks.createAigcPipeline).toHaveBeenCalledWith({
        name: "新品流程",
        description: "",
        definition: {
          schemaVersion: 1,
          nodes: [],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 }
        },
        source_template_id: null,
        source_template_revision: null
      });
    });
  });

  it("cancels template deletion without opening or instantiating the item", () => {
    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "删除模板：商品主图模板" })
    );

    expect(
      screen.getByRole("dialog", { name: "删除画布模板？" })
    ).toHaveTextContent("即将删除模板“商品主图模板”");
    expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(apiMocks.deleteAigcTemplate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes a pipeline once, closes the dialog, and refreshes its list", async () => {
    let resolveDelete: (() => void) | undefined;
    apiMocks.deleteAigcPipeline.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      })
    );
    apiMocks.listAigcPipelines.mockResolvedValue(page([]));
    renderWorkspace();
    fireEvent.click(screen.getByRole("tab", { name: "我的画布" }));

    fireEvent.click(
      screen.getByRole("button", { name: "删除画布：秋季活动画布" })
    );
    expect(
      screen.getByRole("dialog", { name: "删除画布？" })
    ).toHaveTextContent("即将删除画布“秋季活动画布”");

    const confirmButton = screen.getByRole("button", { name: "确认删除" });
    fireEvent.click(confirmButton);
    await waitFor(() => expect(confirmButton).toBeDisabled());
    fireEvent.click(confirmButton);
    expect(apiMocks.deleteAigcPipeline).toHaveBeenCalledTimes(1);
    expect(navigationMocks.push).not.toHaveBeenCalled();

    resolveDelete?.();

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(apiMocks.listAigcPipelines).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        query: ""
      });
    });
    expect(screen.queryByText("秋季活动画布")).not.toBeInTheDocument();
  });

  it("keeps the dialog and item when template deletion fails", async () => {
    apiMocks.deleteAigcTemplate.mockRejectedValue(new Error("network"));
    renderWorkspace();

    fireEvent.click(
      screen.getByRole("button", { name: "删除模板：商品主图模板" })
    );
    fireEvent.click(screen.getByRole("button", { name: "确认删除" }));

    await waitFor(() => {
      expect(apiMocks.deleteAigcTemplate).toHaveBeenCalledWith("template-1");
      expect(screen.getByRole("alert")).toHaveTextContent("请求失败");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("商品主图模板")).toBeInTheDocument();
    expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
    expect(navigationMocks.push).not.toHaveBeenCalled();
  });
});
