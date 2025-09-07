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

    // Forward to Railway backend (async job submission)
    const railwayUrl = "https://sproutml-agents-production.up.railway.app/train";
    
    // Create FormData for Railway API
    const railwayForm = new FormData();
    railwayForm.append("file", file);
    railwayForm.append("target_column", targetCol);

    console.log(`Submitting training job to Railway: ${file.name}, target: ${targetCol}`);

    // Send request to Railway backend (returns job ID immediately)
    const railwayResponse = await fetch(railwayUrl, {
      method: "POST",
      body: railwayForm,
    });

    if (!railwayResponse.ok) {
      const errorText = await railwayResponse.text();
      console.error("Railway API error:", errorText);
      return NextResponse.json(
        { error: `Training service error: ${railwayResponse.status}` },
        { status: 500 }
      );
    }

    const railwayResult = await railwayResponse.json();
    
    console.log("Full Railway response:", JSON.stringify(railwayResult, null, 2));
    console.log("Training job submitted:", railwayResult.job_id);

    // Check if job_id exists in the response
    if (!railwayResult.job_id) {
      console.error("No job_id in Railway response:", railwayResult);
      return NextResponse.json(
        { error: "Invalid response from training service - missing job ID" },
        { status: 500 }
      );
    }

    // Return job information for frontend polling
    return NextResponse.json({
      ok: true,
      filename: file.name,
      size: file.size,
      targetCol,
      contentType: file.type || "text/csv",
      jobId: railwayResult.job_id,
      status: "queued",
      message: "Training job submitted successfully. Use the job ID to check status.",
      statusUrl: `https://sproutml-agents-production.up.railway.app/job/${railwayResult.job_id}`,
      debug: railwayResult // Include full response for debugging
    });
  } catch (e) {
    const err = e as Error;
    console.error("Frontend API error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}


