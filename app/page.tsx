"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "next/image";
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
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col items-center justify-center mb-6">
        <h1 className="text-3xl font-bold">Welcome to SproutML 🌱</h1>
        <p className="text-base text-muted-foreground mt-1">Upload your dataset to get started.</p>
      </div>

      <div className="mt-6">
        <Dropzone
          accept={{ "text/csv": [".csv"] }}
          onDrop={handleDrop}
          onError={(e) => setError(e.message)}
          src={files}
          maxFiles={1}
          className={`p-8 border-2 border-dashed transition-all duration-300 rounded-xl ${
            files?.[0] 
              ? "border-green-400 bg-green-50 hover:bg-green-100" 
              : "border-gray-300 hover:cursor-pointer hover:border-blue-400 bg-gray-50/50 hover:bg-blue-50/50"
          }`}
        >
          {files?.[0] ? (
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-green-800">{files[0].name}</p>
                <p className="text-sm text-green-600">{(files[0].size / 1024).toFixed(1)} KB uploaded successfully</p>
              </div>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles(undefined);
                  setColumns([]);
                  setRows([]);
                  setTargetCol("");
                }}
                className="text-sm text-green-700 hover:text-green-900 underline cursor-pointer"
              >
                Upload different file
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
          <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>
        )}
      </div>
      {/* Target column */}
      {columns.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium text-gray-700">Target column:</label>
            <div className="flex flex-wrap gap-2">
              {columns.map((c) => (
                <button
                  key={c}
                  onClick={() => setTargetCol(c)}
                  className={`flex items-center gap-2 px-3 py-1 hover:cursor-pointer rounded-full text-sm transition-all duration-200 ${
                    targetCol === c
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-blue-50 hover:text-blue-600"
                  }`}
                >
                  {targetCol === c && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                  {targetCol === c ? `Target: ${c}` : c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview rows */}
      {previewRows.length > 0 && (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead 
                    key={c}
                    className={`transition-all duration-300 ${
                      c === targetCol 
                        ? "bg-blue-100 font-semibold text-blue-900 border-l-4 border-blue-500 animate-in slide-in-from-left-1" 
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {c}
                      {c === targetCol && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full animate-in zoom-in-50 duration-200">
                          🎯 Target
                        </span>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => (
                <TableRow key={i} className="hover:bg-gray-50/50 transition-colors">
                  {columns.map((c) => (
                    <TableCell 
                      key={c}
                      className={`transition-all duration-300 ${
                        c === targetCol 
                          ? "bg-blue-50 font-medium text-blue-900 border-l-4 border-blue-300" 
                          : ""
                      }`}
                    >
                      {String((row as CsvRow)[c] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="text-center text-muted-foreground mt-4 text-sm">
            Showing first {previewRows.length} rows
          </div>
        </div>
      )}

      {/* Begin training */}
      <div className="mt-8 flex items-center gap-3">
        <Button
          onClick={handleBeginTraining}
          disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
          className="bg-green-600 hover:cursor-pointer"
        >
          {submitStatus === "loading" 
            ? "Submitting..." 
            : submitStatus === "processing" 
            ? "Training..." 
            : "Begin training"}
        </Button>
        {submitStatus !== "idle" && (
          <div className="flex items-center gap-2">
            {submitStatus === "processing" && (
              <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            )}
            <span className={
              submitStatus === "success"
                ? "text-green-600 text-sm"
                : submitStatus === "error"
                ? "text-red-600 text-sm"
                : submitStatus === "processing"
                ? "text-blue-600 text-sm"
                : "text-muted-foreground text-sm"
            }>
              {submitMessage}
            </span>
            {jobId && (
              <span className="text-xs text-gray-500 ml-2">
                Job ID: {jobId.slice(0, 8)}...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Live updates */}
      {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">Live updates</h3>
          {latestPreOutput && (
            <div className="bg-white p-4 rounded border mb-4">
              <h4 className="font-medium text-gray-800 mb-2">Preprocessing step output</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-64 overflow-auto">{latestPreOutput}</pre>
            </div>
          )}
          {latestModelResult && (
            <div className="bg-white p-4 rounded border">
              <h4 className="font-medium text-gray-800 mb-2">Latest model result</h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded max-h-64 overflow-auto">{JSON.stringify(latestModelResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Training Results */}
      {trainingResults && (
        <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-lg font-semibold text-green-800 mb-4">🎉 Training Results</h3>
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium text-gray-800 mb-2">Orchestrator Output:</h4>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded">
              {trainingResults.orchestrator_output || "No detailed output available."}
            </pre>
          </div>
          {jobId && (
            <div className="mt-6 bg-white p-4 rounded border">
              <h4 className="font-medium text-gray-800 mb-2">📦 Artifacts</h4>
              <div className="text-sm text-gray-700 mb-2">Latest CSV: {artifacts?.latest_csv || "N/A"}</div>
              {artifacts?.model_files_ready && (
                <div className="text-sm text-purple-700 mb-2 font-medium">
                  🤖 Trained Models: {artifacts.model_files?.length || 0} model(s) ready for download
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <Button
                  onClick={async () => {
                    const res = await fetch(`/api/job/${jobId}/artifacts`);
                    if (res.ok) setArtifacts(await res.json());
                  }}
                  className="bg-blue-600 hover:cursor-pointer"
                >
                  Refresh Artifacts
                </Button>
                {artifacts?.latest_csv && (
                  <a
                    href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                    className="px-3 py-2 rounded bg-green-600 text-white text-sm"
                  >
                    Download Latest CSV
                  </a>
                )}
              </div>
               <div className="bg-gray-50 rounded-lg p-4 max-h-80 overflow-auto">
                 {!artifacts?.files?.length ? (
                   <div className="text-center py-8">
                     <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                       <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                     </div>
                     <p className="text-sm text-gray-500">No files available yet</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                     {artifacts.files.map((filename) => {
                       const getFileIcon = (filename: string) => {
                         const ext = filename.toLowerCase().split('.').pop();
                         switch (ext) {
                           case 'csv':
                             return (
                               <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                                 <Image src="/csv.svg" alt="CSV file" width={40} height={40} className="object-contain" />
                               </div>
                             );
                           case 'json':
                             return (
                               <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                 </svg>
                               </div>
                             );
                           case 'png':
                           case 'jpg':
                           case 'jpeg':
                           case 'gif':
                             return (
                               <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                                 <Image src="/png.svg" alt="Image file" width={40} height={40} className="object-contain" />
                               </div>
                             );
                           case 'py':
                             return (
                               <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                                 <Image src="/py.svg" alt="Python file" width={40} height={40} className="object-contain" />
                               </div>
                             );
                           case 'txt':
                           case 'log':
                             return (
                               <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
                                 <Image src="/txt.svg" alt="Text file" width={40} height={40} className="object-contain" />
                               </div>
                             );
                           case 'pkl':
                             return (
                               <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                 </svg>
                               </div>
                             );
                           default:
                             return (
                               <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                         }
                       };

                       return (
                         <div key={filename} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow group">
                           <div className="flex items-start gap-3">
                             {getFileIcon(filename)}
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-medium text-gray-900 truncate" title={filename}>
                                 {filename}
                               </p>
                               <p className="text-xs text-gray-500 mt-1">
                                 {filename.split('.').pop()?.toUpperCase()} file
                               </p>
                             </div>
                           </div>
                           <div className="mt-3 flex justify-end">
                             <a
                               href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                               className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium rounded-lg transition-colors group-hover:bg-blue-100"
                               title={`Download ${filename}`}
                             >
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                               </svg>
                               Download
                             </a>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
