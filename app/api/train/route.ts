import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const targetCol = form.get("targetCol");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    if (typeof targetCol !== "string" || !targetCol) {
      return NextResponse.json({ error: "Missing targetCol" }, { status: 400 });
    }

    // Read the file contents as ArrayBuffer or text for forwarding/storage
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // TODO: forward to your training service or queue here.
    // Example placeholder: pretend we enqueue a job and return an id
    const jobId = Math.random().toString(36).slice(2);

    // For now, just return basic metadata
    return NextResponse.json({
      ok: true,
      jobId,
      filename: file.name,
      size: bytes.byteLength,
      targetCol,
      contentType: file.type || "text/csv",
    });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}


