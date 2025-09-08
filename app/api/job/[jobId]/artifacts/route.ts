import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    const railwayUrl = `https://sproutml-agents-production.up.railway.app/job/${encodeURIComponent(
      jobId
    )}/artifacts`;

    const resp = await fetch(railwayUrl, { method: "GET" });
    if (!resp.ok) {
      const text = await resp.text();
      console.error("Railway artifacts error:", text);
      return NextResponse.json(
        { error: `Artifacts fetch failed: ${resp.status}` },
        { status: 500 }
      );
    }

    const json = await resp.json();
    return NextResponse.json(json);
  } catch (e) {
    const err = e as Error;
    console.error("Frontend artifacts API error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 }
    );
  }
}


