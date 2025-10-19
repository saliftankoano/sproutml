"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type CsvRow = Record<string, unknown>;

export default function Home() {
  const [files, setFiles] = useState<File[] | undefined>();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [targetCol, setTargetCol] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "processing" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [trainingResults, setTrainingResults] = useState<{ orchestrator_output?: string } | null>(null);
  const [artifacts, setArtifacts] = useState<{ workspace: string; listing: string; files?: string[]; latest_csv?: string | null; model_files?: string[]; model_files_ready?: boolean; trained_models?: Record<string, unknown>[] } | null>(null);
  // Live update states
  const [latestPreOutput, setLatestPreOutput] = useState<string>("");
  type ModelResult = Record<string, unknown> | null;
  const [latestModelResult, setLatestModelResult] = useState<ModelResult>(null);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const handleDrop = (accepted: File[]) => {
    setError("");
    setColumns([]);
    setRows([]);
    setTargetCol("");

    if (!accepted || accepted.length === 0) {
      return;
    }

    const file = accepted[0];
    setFiles([file]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: true,
      complete: (results: ParseResult<CsvRow>) => {
        const data = (results.data || []).filter(Boolean) as CsvRow[];
        if (!data.length) {
          setError("No rows found in the CSV.");
          return;
        }
        const keys = Object.keys(data[0] ?? {});
        setColumns(keys);
        setRows(data);
      },
      error: (err: Error) => {
        setError(err.message || "Failed to parse CSV.");
      },
    });
  };

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const jobData = await res.json();
      
      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMessage("Failed to check job status.");
        return;
      }

      console.log("Job status:", jobData.status);

      if (jobData.status === "completed") {
        setSubmitStatus("success");
        setSubmitMessage("Training completed successfully!");
        setTrainingResults(jobData.result);
        setLatestPreOutput(jobData.latest_output || "");
        setLatestModelResult(jobData.latest_model_result || null);
        try {
          const artRes = await fetch(`/api/job/${jobId}/artifacts`);
          if (artRes.ok) setArtifacts(await artRes.json());
        } catch {}
        return;
      } else if (jobData.status === "failed") {
        setSubmitStatus("error");
        setSubmitMessage(`Training failed: ${jobData.error || "Unknown error"}`);
        return;
      } else if (jobData.status === "processing" || jobData.status === "preprocessing" || jobData.status === "training") {
        setSubmitMessage("ML agents are processing your data...");
        if (jobData.latest_output) setLatestPreOutput(jobData.latest_output);
        if (jobData.latest_model_result) setLatestModelResult(jobData.latest_model_result);
        // Periodically refresh artifacts while running
        try {
          const artRes = await fetch(`/api/job/${jobId}/artifacts`);
          if (artRes.ok) setArtifacts(await artRes.json());
        } catch {}
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 5000); // Poll every 5 seconds
      } else if (jobData.status === "daytona") {
        setSubmitMessage("Setting up cloud infrastructure...");
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 3000); // Poll every 3 seconds
      } else if (jobData.status === "queued") {
        setSubmitMessage("Job queued, waiting to start...");
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 3000); // Poll every 3 seconds
      } else {
        // Handle any other statuses by continuing to poll
        setSubmitMessage(`Job status: ${jobData.status}`);
        setTimeout(() => pollJobStatus(jobId), 5000); // Poll every 5 seconds
      }
    } catch (e) {
      console.error("Error polling job status:", e);
      setSubmitStatus("error");
      setSubmitMessage("Error checking training status.");
    }
  }, []);

  const handleBeginTraining = useCallback(async () => {
    if (!files?.[0]) {
      setSubmitStatus("error");
      setSubmitMessage("Please upload a CSV first.");
      return;
    }
    if (!targetCol) {
      setSubmitStatus("error");
      setSubmitMessage("Please select a target column.");
      return;
    }
    try {
      setSubmitStatus("loading");
      setSubmitMessage("Submitting training job...");
      setTrainingResults(null);
      setLatestPreOutput("");
      setLatestModelResult(null);
      
      const form = new FormData();
      form.append("file", files[0]);
      form.append("targetCol", targetCol);
      
      const res = await fetch("/api/train", {
        method: "POST",
        body: form,
      });
      const json = await res.json();
      
      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMessage(json?.error || "Training request failed.");
        return;
      }

      // Job submitted successfully, start polling
      const newJobId = json.jobId;
      setJobId(newJobId);
      setSubmitStatus("processing");
      setSubmitMessage("Training job submitted. Starting processing...");
      
      // Start polling for status
      setTimeout(() => pollJobStatus(newJobId), 2000); // Start polling after 2 seconds
      
    } catch (e) {
      const err = e as Error;
      setSubmitStatus("error");
      setSubmitMessage(err.message || "Unexpected error starting training.");
    }
  }, [files, targetCol, pollJobStatus]); // Deliberately not depending on live states; polling reads fresh values

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-surface">
        <div className="max-w-[1080px] mx-auto px-6 py-4">
          <h1 className="text-lg font-semibold text-text">SproutML</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1080px] mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="mb-12 animate-fade-in">
          <h2 className="text-3xl font-semibold text-text mb-2 tracking-tight">Train your model</h2>
          <p className="text-base text-subtext">Upload a CSV dataset to automatically train and evaluate machine learning models.</p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 animate-slide-up">
          <label className="block text-sm font-medium text-text mb-3">Dataset</label>
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-8 border transition-all duration-200 rounded-md ${
              files?.[0] 
                ? "border-border bg-surface shadow-sm" 
                : "border-dashed border-border hover:border-accent hover:bg-surface/50"
            }`}
          >
          {files?.[0] ? (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-md flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text text-sm truncate">{files[0].name}</p>
                <p className="text-xs text-subtext mt-0.5">{(files[0].size / 1024).toFixed(1)} KB</p>
              </div>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles(undefined);
                  setColumns([]);
                  setRows([]);
                  setTargetCol("");
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    setFiles(undefined);
                    setColumns([]);
                    setRows([]);
                    setTargetCol("");
                  }
                }}
                className="text-xs text-subtext hover:text-text px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer"
              >
                Remove
              </span>
            </div>
          ) : (
            <>
              <DropzoneEmptyState />
              <DropzoneContent />
            </>
          )}
        </Dropzone>
        {error && (
          <p className="text-sm text-destructive mt-2" role="alert">{error}</p>
        )}
        </div>
      {/* Target column */}
      {columns.length > 0 && (
        <div className="mb-8 animate-slide-up">
          <label className="block text-sm font-medium text-text mb-3">Target column</label>
          <div className="flex flex-wrap gap-2">
            {columns.map((c) => (
              <button
                key={c}
                onClick={() => setTargetCol(c)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  targetCol === c
                    ? "bg-accent text-white shadow-sm"
                    : "bg-surface text-text border border-border hover:border-accent hover:bg-accent/5"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview rows */}
      {previewRows.length > 0 && (
        <div className="mb-8 animate-slide-up">
          <label className="block text-sm font-medium text-text mb-3">Data preview</label>
          <div className="bg-surface border border-border rounded-md overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border bg-muted/30">
                    {columns.map((c) => (
                      <TableHead 
                        key={c}
                        className={`text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${
                          c === targetCol 
                            ? "bg-accent/5 text-accent" 
                            : "text-subtext"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {c}
                          {c === targetCol && (
                            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-accent text-white rounded">
                              TARGET
                            </span>
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors duration-150">
                      {columns.map((c) => (
                        <TableCell 
                          key={c}
                          className={`text-sm transition-colors duration-200 ${
                            c === targetCol 
                              ? "font-medium text-text bg-accent/5" 
                              : "text-subtext"
                          }`}
                        >
                          {String((row as CsvRow)[c] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <p className="text-xs text-subtext mt-3 text-center">
            Showing first {previewRows.length} of {rows.length} rows
          </p>
        </div>
      )}

      {/* Begin training */}
      <div className="mb-8">
        <Button
          onClick={handleBeginTraining}
          disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
          className="h-10 px-6 bg-accent hover:bg-accent-hover text-white font-medium rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitStatus === "loading" 
            ? "Submitting..." 
            : submitStatus === "processing" 
            ? "Training in progress..." 
            : "Start training"}
        </Button>
        
        {submitStatus !== "idle" && (
          <div className="mt-4 flex items-start gap-3 p-4 rounded-md border border-border bg-surface">
            {submitStatus === "processing" && (
              <div className="animate-spin h-4 w-4 border-2 border-accent border-t-transparent rounded-full mt-0.5 flex-shrink-0"></div>
            )}
            {submitStatus === "success" && (
              <div className="w-4 h-4 bg-accent/10 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <svg className="w-3 h-3 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {submitStatus === "error" && (
              <div className="w-4 h-4 bg-destructive/10 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <svg className="w-3 h-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${
                submitStatus === "success"
                  ? "text-accent"
                  : submitStatus === "error"
                  ? "text-destructive"
                  : "text-text"
              }`}>
                {submitMessage}
              </p>
              {jobId && (
                <p className="text-xs text-subtext mt-1">
                  Job ID: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{jobId.slice(0, 8)}...</code>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Live updates */}
      {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
        <div className="mb-8 animate-slide-up">
          <h3 className="text-base font-semibold text-text mb-4">Live updates</h3>
          <div className="space-y-4">
            {latestPreOutput && (
              <div className="bg-surface border border-border rounded-md overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h4 className="text-sm font-medium text-text">Preprocessing output</h4>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-subtext whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-md max-h-64 overflow-auto">{latestPreOutput}</pre>
                </div>
              </div>
            )}
            {latestModelResult && (
              <div className="bg-surface border border-border rounded-md overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-muted/30">
                  <h4 className="text-sm font-medium text-text">Latest model result</h4>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-subtext whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-md max-h-64 overflow-auto">{JSON.stringify(latestModelResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Training Results */}
      {trainingResults && (
        <div className="mb-8 animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text">Training complete</h3>
          </div>
          
          <div className="bg-surface border border-border rounded-md overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-medium text-text">Results</h4>
            </div>
            <div className="p-4">
              <pre className="text-xs text-subtext whitespace-pre-wrap font-mono bg-muted/50 p-4 rounded-md max-h-96 overflow-auto">
                {trainingResults.orchestrator_output || "No detailed output available."}
              </pre>
            </div>
          </div>
          {jobId && (
            <div className="bg-surface border border-border rounded-md overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-text">Artifacts</h4>
                  {artifacts?.latest_csv && (
                    <p className="text-xs text-subtext mt-1">Latest CSV: {artifacts.latest_csv}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={async () => {
                      const res = await fetch(`/api/job/${jobId}/artifacts`);
                      if (res.ok) setArtifacts(await res.json());
                    }}
                    className="h-8 px-3 text-xs bg-surface border border-border hover:bg-muted text-text font-medium rounded-md"
                  >
                    <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </Button>
                  {artifacts?.latest_csv && (
                    <a
                      href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                      className="h-8 px-3 text-xs bg-accent hover:bg-accent-hover text-white font-medium rounded-md inline-flex items-center"
                    >
                      <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download CSV
                    </a>
                  )}
                </div>
              </div>
               <div className="p-4 bg-muted/20 max-h-96 overflow-auto">
                 {!artifacts?.files?.length ? (
                   <div className="text-center py-12">
                     <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-md flex items-center justify-center">
                       <svg className="w-6 h-6 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                     </div>
                     <p className="text-sm text-subtext">No files available yet</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                     {artifacts.files.map((filename) => {
                       const getFileIcon = (filename: string) => {
                         const ext = filename.toLowerCase().split('.').pop();
                         const iconClass = "w-8 h-8 rounded-md flex items-center justify-center";
                         
                         switch (ext) {
                           case 'csv':
                             return (
                               <div className={`${iconClass} bg-accent/10`}>
                                 <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                 </svg>
                               </div>
                             );
                           case 'json':
                             return (
                               <div className={`${iconClass} bg-subtext/10`}>
                                 <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                 </svg>
                               </div>
                             );
                           case 'png':
                           case 'jpg':
                           case 'jpeg':
                           case 'gif':
                             return (
                               <div className={`${iconClass} bg-accent/10`}>
                                 <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                 </svg>
                               </div>
                             );
                           case 'py':
                             return (
                               <div className={`${iconClass} bg-accent/10`}>
                                 <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                 </svg>
                               </div>
                             );
                           case 'txt':
                           case 'log':
                             return (
                               <div className={`${iconClass} bg-subtext/10`}>
                                 <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                           case 'pkl':
                             return (
                               <div className={`${iconClass} bg-accent/10`}>
                                 <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                 </svg>
                               </div>
                             );
                           default:
                             return (
                               <div className={`${iconClass} bg-muted`}>
                                 <svg className="w-4 h-4 text-subtext" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                         }
                       };

                       return (
                         <a
                           key={filename}
                           href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                           className="group flex items-center gap-3 p-3 bg-surface border border-border rounded-md hover:border-accent hover:bg-accent/5 transition-all duration-200"
                           title={`Download ${filename}`}
                         >
                           {getFileIcon(filename)}
                           <div className="flex-1 min-w-0">
                             <p className="text-sm font-medium text-text truncate group-hover:text-accent transition-colors">
                               {filename}
                             </p>
                             <p className="text-xs text-subtext">
                               {filename.split('.').pop()?.toUpperCase()}
                             </p>
                           </div>
                           <svg className="w-4 h-4 text-subtext group-hover:text-accent flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                           </svg>
                         </a>
                       );
                     })}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      )}
      </main>
    </div>
  );
}
