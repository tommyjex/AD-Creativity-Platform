import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseAigcView } from "@/app/workspace/aigc/page";
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
  listAigcPipelineThumbnailCandidates: vi.fn(),
  listAigcPipelines: vi.fn(),
  listAigcTemplates: vi.fn(),
  updateAigcPipelineThumbnail: vi.fn()
}));
const navigationMocks = vi.hoisted(() => ({
  push: vi.fn()
}));
const permissionMocks = vi.hoisted(() => ({ canWrite: true }));

vi.mock("@/lib/auth/auth-provider", () => ({
  useCanWrite: () => permissionMocks.canWrite
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
  thumbnail_asset_id: null,
  thumbnail: null,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function renderWorkspace({
  initialError,
  initialPipelines = page([pipeline]),
  initialTemplates = page([template]),
  initialView
}: {
  initialError?: string;
  initialPipelines?: AigcPage<AigcPipeline>;
  initialTemplates?: AigcPage<AigcPipelineTemplate>;
  initialView?: "templates" | "pipelines";
} = {}) {
  return render(
    <AigcQueryProvider>
      <AigcWorkspace
        initialError={initialError}
        initialPipelines={initialPipelines}
        initialTemplates={initialTemplates}
        initialView={initialView}
      />
    </AigcQueryProvider>
  );
}

describe("AIGC workspace list", () => {
  beforeEach(() => {
    permissionMocks.canWrite = true;
    vi.clearAllMocks();
    apiMocks.listAigcTemplates.mockResolvedValue(page([template]));
    apiMocks.listAigcPipelines.mockResolvedValue(page([pipeline]));
    apiMocks.listAigcPipelineThumbnailCandidates.mockResolvedValue(
      page([
        {
          asset_id: "asset-image-1",
          run_id: "run-1",
          node_id: "model-1",
          mime_type: "image/png",
          kind: "image",
          url: "https://example.test/image.png",
          created_at: "2026-08-29T03:00:00Z"
        }
      ])
    );
    apiMocks.instantiateAigcTemplate.mockResolvedValue(pipeline);
    apiMocks.createAigcPipeline.mockResolvedValue(pipeline);
    apiMocks.deleteAigcTemplate.mockResolvedValue(undefined);
    apiMocks.deleteAigcPipeline.mockResolvedValue(undefined);
    apiMocks.updateAigcPipelineThumbnail.mockResolvedValue({
      ...pipeline,
      thumbnail_asset_id: "asset-image-1",
      thumbnail: {
        asset_id: "asset-image-1",
        mime_type: "image/png",
        kind: "image",
        source: "pinned",
        url: "https://example.test/image.png"
      }
    });
  });

  it("opens templates read-only for viewers without exposing mutations", () => {
    permissionMocks.canWrite = false;
    renderWorkspace();

    expect(screen.queryByRole("button", { name: "新建空白画布" })).toBeNull();
    expect(screen.queryByRole("button", { name: /删除模板/ })).toBeNull();
    expect(screen.getByRole("button", { name: /查看模板/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /查看模板/ }));
    expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
    expect(navigationMocks.push).toHaveBeenCalledWith(
      "/workspace/aigc/templates/template-1"
    );
  });

  it("defaults to templates and uses the approved responsive grid", () => {
    renderWorkspace();

    expect(
      screen.getByRole("tab", { name: "画布模板" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("商品主图模板")).toBeInTheDocument();
    expect(screen.getByTestId("aigc-card-grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-2",
      "lg:grid-cols-3",
      "xl:grid-cols-4"
    );
    expect(
      screen.getByRole("link", { name: "编辑模板：商品主图模板" })
    ).toHaveAttribute("href", "/workspace/aigc/templates/template-1");
  });

  it("renders the constrained constellation workspace shell and current view total", () => {
    renderWorkspace();

    expect(screen.getByTestId("aigc-workspace")).toHaveClass(
      "bg-[#090d0c]",
      "text-slate-100"
    );
    expect(screen.getByTestId("aigc-workspace-content")).toHaveClass(
      "mx-auto",
      "max-w-[1400px]"
    );
    expect(screen.getByText("DAG CREATION WORKSPACE")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "星图创作台" })
    ).toBeInTheDocument();
    expect(screen.getByText("1 个模板")).toHaveClass(
      "rounded-full",
      "border-emerald-400/20"
    );
  });

  it("keeps tabs, submitted search, clear action and creation in one responsive toolbar", () => {
    renderWorkspace();

    expect(screen.getByTestId("aigc-workspace-toolbar")).toHaveClass(
      "flex-col",
      "lg:flex-row"
    );
    expect(
      screen.getByRole("tablist", { name: "AIGC 视图" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "按名称筛选" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "筛选" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "新建空白画布" })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "按名称筛选" }), {
      target: { value: "商品" }
    });
    expect(
      screen.getByRole("button", { name: "清空筛选" })
    ).toBeInTheDocument();
    expect(apiMocks.listAigcTemplates).not.toHaveBeenCalled();
  });

  it("renders preview metadata and a missing-description fallback", () => {
    renderWorkspace({
      initialTemplates: page([{ ...template, description: "" }])
    });

    expect(screen.getByText("未填写说明")).toBeInTheDocument();
    expect(screen.getByText(/2 节点/)).toBeInTheDocument();
    expect(screen.getByText(/1 模型/)).toBeInTheDocument();
    expect(screen.getByTestId("aigc-topology-preview")).toBeInTheDocument();
    expect(screen.getByTestId("aigc-preview-node-image")).toBeInTheDocument();
  });

  it("prefers a contained pipeline image thumbnail", () => {
    renderWorkspace({
      initialView: "pipelines",
      initialPipelines: page([
        {
          ...pipeline,
          thumbnail_asset_id: "asset-image-1",
          thumbnail: {
            asset_id: "asset-image-1",
            kind: "image",
            mime_type: "image/png",
            source: "pinned",
            url: "https://example.test/preview.png"
          }
        }
      ])
    });

    expect(screen.getByRole("img", { name: "画布缩略图" })).toHaveClass(
      "aspect-[16/10]",
      "object-contain"
    );
    expect(screen.queryByTestId("aigc-topology-preview")).toBeNull();
  });

  it("falls back to topology when a pipeline thumbnail fails", () => {
    renderWorkspace({
      initialView: "pipelines",
      initialPipelines: page([
        {
          ...pipeline,
          thumbnail_asset_id: "asset-image-1",
          thumbnail: {
            asset_id: "asset-image-1",
            kind: "image",
            mime_type: "image/png",
            source: "pinned",
            url: "https://example.test/broken.png"
          }
        }
      ])
    });

    fireEvent.error(screen.getByRole("img", { name: "画布缩略图" }));

    expect(screen.getByTestId("aigc-topology-preview")).toBeInTheDocument();
  });

  it("keeps card tool actions isolated from the primary open action", () => {
    renderWorkspace({ initialView: "pipelines" });

    fireEvent.click(
      screen.getByRole("button", { name: "选择缩略图：秋季活动画布" })
    );

    expect(navigationMocks.push).not.toHaveBeenCalled();
    expect(apiMocks.instantiateAigcTemplate).not.toHaveBeenCalled();
  });

  it("hides pipeline mutation tools from read-only viewers", () => {
    permissionMocks.canWrite = false;
    renderWorkspace({ initialView: "pipelines" });

    expect(screen.queryByRole("button", { name: /选择缩略图/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /删除画布/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: "打开画布：秋季活动画布" })
    ).toBeInTheDocument();
  });

  it("shows a retryable request error", () => {
    renderWorkspace({ initialError: "请求失败" });

    expect(screen.getByRole("alert")).toHaveTextContent("请求失败");
    expect(screen.getByRole("alert")).toHaveClass(
      "rounded-lg",
      "border-red-400/30"
    );
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("distinguishes an empty list from an empty search result", async () => {
    apiMocks.listAigcTemplates.mockResolvedValue(page([]));
    renderWorkspace({ initialTemplates: page([]) });

    const emptyHeading = screen.getByRole("heading", {
      name: "暂无画布模板"
    });
    expect(emptyHeading).toBeInTheDocument();
    expect(emptyHeading.closest("div.mt-6")).toHaveClass("rounded-lg");

    fireEvent.change(screen.getByRole("textbox", { name: "按名称筛选" }), {
      target: { value: "不存在" }
    });
    fireEvent.click(screen.getByRole("button", { name: "筛选" }));

    expect(
      await screen.findByRole("heading", { name: "没有匹配的画布" })
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "清空筛选" })
    ).toHaveLength(2);
  });

  it("renders pagination for more than one page", () => {
    renderWorkspace({
      initialTemplates: {
        items: [template],
        page: 1,
        page_size: 20,
        total: 21
      }
    });

    expect(
      screen.getByRole("navigation", { name: "画布分页" })
    ).toHaveTextContent("1 / 2");
    expect(
      screen.getByRole("navigation", { name: "画布分页" })
    ).toHaveClass("border-white/10");
    expect(screen.getByRole("button", { name: "上一页" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
  });

  it("shows the loading state while the selected view is pending", () => {
    const templatesRequest = deferred<AigcPage<AigcPipelineTemplate>>();
    apiMocks.listAigcTemplates.mockReturnValue(templatesRequest.promise);
    renderWorkspace({ initialError: "初始加载失败" });

    expect(screen.getByRole("status")).toHaveTextContent("正在加载画布");
    expect(screen.getByRole("status")).toHaveClass("rounded-lg", "mt-6");
  });

  it("starts on my pipelines when requested by the URL view", () => {
    renderWorkspace({ initialView: "pipelines" });

    expect(
      screen.getByRole("tab", { name: "我的画布" })
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("秋季活动画布")).toBeInTheDocument();
    expect(screen.queryByText("商品主图模板")).toBeNull();
    expect(apiMocks.listAigcPipelines).not.toHaveBeenCalled();
  });

  it("falls back to templates for missing, invalid, or repeated views", () => {
    expect(parseAigcView(undefined)).toBe("templates");
    expect(parseAigcView("unknown")).toBe("templates");
    expect(parseAigcView(["pipelines", "templates"])).toBe("templates");
    expect(parseAigcView("templates")).toBe("templates");
    expect(parseAigcView("pipelines")).toBe("pipelines");
  });

  it("switches to my pipelines without a second request for initial data", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("tab", { name: "我的画布" }));

    expect(screen.getByText("秋季活动画布")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(apiMocks.listAigcPipelines).not.toHaveBeenCalled();
  });

  it("chooses a pipeline thumbnail from eligible candidates", async () => {
    renderWorkspace({ initialView: "pipelines" });

    fireEvent.click(
      screen.getByRole("button", { name: "选择缩略图：秋季活动画布" })
    );

    expect(await screen.findByRole("dialog", { name: "选择缩略图" })).toBeInTheDocument();
    await waitFor(() => {
      expect(apiMocks.listAigcPipelineThumbnailCandidates).toHaveBeenCalledWith(
        "pipeline-1",
        { page: 1, pageSize: 50 }
      );
    });
    fireEvent.click(screen.getByRole("radio", { name: /图片 · model-1/ }));
    fireEvent.click(screen.getByRole("button", { name: "使用所选缩略图" }));

    await waitFor(() => {
      expect(apiMocks.updateAigcPipelineThumbnail).toHaveBeenCalledWith(
        "pipeline-1",
        { asset_id: "asset-image-1" }
      );
    });
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
          schemaVersion: 2,
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
