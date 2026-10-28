export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024 * 1024;

function failure(status: number, message: string) {
  return Response.json({ detail: { code: "validation_error", message } }, { status });
}

// A route handler streams this tool's upload without the generic 200 MB rewrite buffer.
export async function POST(request: Request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) {
    return failure(413, "Video exceeds 512 MiB or upload length is invalid.");
  }
  if (!request.body) return failure(422, "Upload a video file.");
  const incoming = new URL(request.url);
  const base = (process.env.BACKEND_INTERNAL_BASE_URL?.trim() || "http://127.0.0.1:8000").replace(/\/+$/, "");
  const headers = new Headers();
  for (const name of ["cookie", "origin", "content-type", "content-length"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  let bytes = 0;
  let tooLarge = false;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > MAX_BYTES) {
        tooLarge = true;
        controller.error(new Error("upload_limit"));
      } else controller.enqueue(chunk);
    }
  }));
  const options: RequestInit & { duplex: "half" } = {
    method: "POST", body, headers, duplex: "half", signal: request.signal, redirect: "error"
  };
  try {
    const response = await fetch(`${base}/api/tools/subtitle-translation/upload-video${incoming.search}`, options);
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store" }
    });
  } catch {
    return tooLarge ? failure(413, "Video exceeds 512 MiB.") : failure(502, "Video upload could not reach the backend; retry.");
  }
}
