import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const url = new URL(req.url);
    const { jobId } = await params;
    const filename = url.searchParams.get("file");

    if (!jobId || !filename) {
      return NextResponse.json(
        { error: "Missing job ID or file parameter" },
        { status: 400 }
      );
    }

    const railwayUrl = `https://sproutml-agents-production.up.railway.app/job/${encodeURIComponent(
      jobId
    )}/artifact/${encodeURIComponent(filename)}`;

    const resp = await fetch(railwayUrl);
    if (!resp.ok) {
      const text = await resp.text();
      console.error("Railway download error:", text);
      return NextResponse.json(
        { error: `Download failed: ${resp.status}` },
        { status: 500 }
      );
    }

    const headers = new Headers(resp.headers);
    headers.set("Cache-Control", "no-store");
    return new NextResponse(resp.body, {
      status: 200,
      headers,
    });
  } catch (e) {
    const err = e as Error;
    console.error("Frontend download API error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}


