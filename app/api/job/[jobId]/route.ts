import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    // Check job status from Railway backend
    const railwayUrl = `https://sproutml-agents-production.up.railway.app/job/${jobId}`;
    
    console.log(`Checking job status: ${jobId}`);

    const railwayResponse = await fetch(railwayUrl, {
      method: "GET",
    });

    if (!railwayResponse.ok) {
      if (railwayResponse.status === 404) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      const errorText = await railwayResponse.text();
      console.error("Railway API error:", errorText);
      return NextResponse.json(
        { error: `Training service error: ${railwayResponse.status}` },
        { status: 500 }
      );
    }

    const jobStatus = await railwayResponse.json();
    
    console.log(`Job ${jobId} status: ${jobStatus.status}`);

    return NextResponse.json(jobStatus);
  } catch (e) {
    const err = e as Error;
    console.error("Frontend API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
