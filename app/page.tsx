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
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 py-12 mb-8 shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]"></div>
        <div className="absolute inset-0 animate-shimmer"></div>
        <div className="relative max-w-5xl mx-auto px-4 text-center">
          <div className="inline-block animate-float mb-4">
            <span className="text-6xl">🌱</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-green-300 to-emerald-400 bg-clip-text text-transparent">SproutML</span>
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto font-medium">
            Transform your data into intelligent insights with our advanced ML platform
          </p>
        </div>
      </div>
      
      <div className="max-w-5xl mx-auto px-4 py-6">

      <div className="mt-8">
        <div className="glass rounded-2xl p-8 shadow-xl hover-lift">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            <span className="text-3xl">📊</span>
            Upload Your Dataset
          </h2>
          <p className="text-gray-600 mb-6">Support for CSV files with intelligent preprocessing</p>
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-10 border-3 border-dashed transition-all duration-300 rounded-2xl hover-lift ${
              files?.[0] 
                ? "border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 shadow-lg" 
                : "border-gray-300 hover:cursor-pointer hover:border-blue-500 bg-gradient-to-br from-white to-blue-50/30 hover:to-blue-50/60 shadow-md"
            }`}
          >
          {files?.[0] ? (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg animate-pulse-glow">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-xl text-green-900">{files[0].name}</p>
                <p className="text-base text-green-700 mt-1">{(files[0].size / 1024).toFixed(1)} KB uploaded successfully ✨</p>
              </div>
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles(undefined);
                  setColumns([]);
                  setRows([]);
                  setTargetCol("");
                }}
                className="text-sm font-semibold text-green-700 hover:text-green-900 underline cursor-pointer transition-colors hover:scale-105 inline-block"
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
          <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg animate-in slide-in-from-top-2 duration-300">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-2" role="alert">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}
        </div>
      </div>
      {/* Target column */}
      {columns.length > 0 && (
        <div className="mt-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="glass rounded-2xl p-8 shadow-xl hover-lift">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🎯</span>
              <div>
                <label className="text-xl font-bold text-gray-900 block">Select Target Column</label>
                <p className="text-sm text-gray-600">Choose the column you want to predict</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {columns.map((c) => (
                <button
                  key={c}
                  onClick={() => setTargetCol(c)}
                  className={`flex items-center gap-2 px-5 py-3 hover:cursor-pointer rounded-xl text-sm font-semibold transition-all duration-300 hover-scale ${
                    targetCol === c
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg border-2 border-blue-500 scale-105"
                      : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 shadow-md"
                  }`}
                >
                  {targetCol === c && (
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
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
        <div className="mt-8 animate-in fade-in duration-700">
          <div className="glass rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">👀</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Data Preview</h2>
                <p className="text-sm text-gray-600">First {previewRows.length} rows of your dataset</p>
              </div>
            </div>
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
          </div>
        </div>
      )}

      {/* Begin training */}
      <div className="mt-8">
        <div className="glass rounded-2xl p-8 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🚀</span>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Ready to Train</h3>
                <p className="text-sm text-gray-600">Start the ML training process</p>
              </div>
            </div>
            <Button
              onClick={handleBeginTraining}
              disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold px-8 py-3 text-base shadow-xl hover-scale"
              size="lg"
            >
              {submitStatus === "loading" 
                ? "🔄 Submitting..." 
                : submitStatus === "processing" 
                ? "⚡ Training..." 
                : "🎯 Begin Training"}
            </Button>
          </div>
        {submitStatus !== "idle" && (
          <div className="mt-6 flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 animate-in slide-in-from-bottom-2 duration-300">
            {submitStatus === "processing" && (
              <div className="animate-spin h-6 w-6 border-3 border-blue-600 border-t-transparent rounded-full"></div>
            )}
            <div className="flex-1">
              <span className={
                submitStatus === "success"
                  ? "text-green-700 text-base font-semibold"
                  : submitStatus === "error"
                  ? "text-red-700 text-base font-semibold"
                  : submitStatus === "processing"
                  ? "text-blue-700 text-base font-semibold"
                  : "text-gray-700 text-base font-semibold"
              }>
                {submitMessage}
              </span>
              {jobId && (
                <span className="text-sm text-gray-600 ml-3 font-mono bg-white px-3 py-1 rounded-lg inline-block mt-2">
                  Job ID: {jobId.slice(0, 8)}...
                </span>
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Live updates */}
      {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
        <div className="mt-8 glass rounded-2xl p-8 shadow-xl border-2 border-blue-300 animate-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl animate-pulse">⚡</span>
            <h3 className="text-2xl font-bold text-blue-900">Live Updates</h3>
          </div>
          {latestPreOutput && (
            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 mb-6 shadow-lg hover-lift">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <span>🔄</span> Preprocessing Output
              </h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg max-h-64 overflow-auto border border-gray-200 font-mono">{latestPreOutput}</pre>
            </div>
          )}
          {latestModelResult && (
            <div className="bg-white p-6 rounded-xl border-2 border-gray-200 shadow-lg hover-lift">
              <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
                <span>📊</span> Latest Model Result
              </h4>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-indigo-50 p-4 rounded-lg max-h-64 overflow-auto border border-gray-200 font-mono">{JSON.stringify(latestModelResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      {/* Training Results */}
      {trainingResults && (
        <div className="mt-8 glass rounded-2xl p-8 shadow-2xl border-2 border-green-400 animate-in zoom-in-95 duration-700">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl animate-bounce">🎉</span>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">Training Complete!</h3>
          </div>
          <div className="bg-white p-6 rounded-xl border-2 border-green-200 shadow-lg hover-lift">
            <h4 className="font-bold text-lg text-gray-900 mb-3 flex items-center gap-2">
              <span>📋</span> Training Summary
            </h4>
            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-green-50 p-4 rounded-lg border border-gray-200 font-mono">
              {trainingResults.orchestrator_output || "No detailed output available."}
            </pre>
          </div>
          {jobId && (
            <div className="mt-6 bg-white p-6 rounded-xl border-2 border-gray-200 shadow-lg">
              <h4 className="font-bold text-xl text-gray-900 mb-4 flex items-center gap-2">
                <span>📦</span> Training Artifacts
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <p className="text-sm text-gray-600 mb-1">Latest Dataset</p>
                  <p className="text-base font-bold text-gray-900">{artifacts?.latest_csv || "N/A"}</p>
                </div>
                {artifacts?.model_files_ready && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-200">
                    <p className="text-sm text-gray-600 mb-1">🤖 Trained Models</p>
                    <p className="text-base font-bold text-purple-700">{artifacts.model_files?.length || 0} model(s) ready</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <Button
                  onClick={async () => {
                    const res = await fetch(`/api/job/${jobId}/artifacts`);
                    if (res.ok) setArtifacts(await res.json());
                  }}
                  className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 font-semibold shadow-lg hover-scale"
                  size="sm"
                >
                  🔄 Refresh Artifacts
                </Button>
                {artifacts?.latest_csv && (
                  <a
                    href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                    className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download CSV
                  </a>
                )}
              </div>
               <div className="bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl p-6 max-h-80 overflow-auto border-2 border-gray-200">
                 {!artifacts?.files?.length ? (
                   <div className="text-center py-12 animate-pulse">
                     <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-200 to-gray-300 rounded-2xl flex items-center justify-center shadow-lg">
                       <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                       </svg>
                     </div>
                     <p className="text-base font-semibold text-gray-600">No files available yet</p>
                     <p className="text-sm text-gray-500 mt-2">Files will appear here once training is complete</p>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                     {artifacts.files.map((filename) => {
                       const getFileIcon = (filename: string) => {
                         const ext = filename.toLowerCase().split('.').pop();
                         switch (ext) {
                           case 'csv':
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                           case 'json':
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
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
                               <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center shadow-md">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                 </svg>
                               </div>
                             );
                           case 'py':
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-yellow-500 rounded-xl flex items-center justify-center shadow-md">
                                 <span className="text-white font-bold text-lg">Py</span>
                               </div>
                             );
                           case 'txt':
                           case 'log':
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl flex items-center justify-center shadow-md">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                           case 'pkl':
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                 </svg>
                               </div>
                             );
                           default:
                             return (
                               <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                                 <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                 </svg>
                               </div>
                             );
                         }
                       };

                       return (
                         <div key={filename} className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-xl transition-all duration-300 group hover-lift">
                           <div className="flex items-start gap-3 mb-3">
                             {getFileIcon(filename)}
                             <div className="flex-1 min-w-0">
                               <p className="text-sm font-bold text-gray-900 truncate" title={filename}>
                                 {filename}
                               </p>
                               <p className="text-xs font-semibold text-gray-500 mt-1 bg-gray-100 px-2 py-0.5 rounded inline-block">
                                 {filename.split('.').pop()?.toUpperCase()}
                               </p>
                             </div>
                           </div>
                           <div className="flex justify-end">
                             <a
                               href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                               className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all duration-300 group-hover:scale-105 shadow-md hover:shadow-lg"
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
    </div>
  );
}
