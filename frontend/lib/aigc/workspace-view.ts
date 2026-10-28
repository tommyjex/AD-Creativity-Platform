export function parseAigcView(
  view: string | string[] | undefined
): "templates" | "pipelines" {
  return view === "pipelines" ? "pipelines" : "templates";
}
