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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">🌱</span>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">SproutML</h1>
                <p className="text-xs text-gray-500">Machine Learning Made Simple</p>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Home</a>
              <a href="#" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Documentation</a>
              <a href="#" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Examples</a>
              <button className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105">
                Get Started
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 border border-emerald-200 rounded-full text-emerald-700 text-sm font-medium mb-6 shadow-sm">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            AI-Powered Machine Learning Platform
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 bg-clip-text text-transparent leading-tight">
            Transform Your Data
            <br />
            <span className="text-4xl md:text-5xl">Into Insights</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Upload your dataset and let our AI agents train powerful machine learning models for you.
            <br />
            <span className="text-emerald-600 font-medium">No coding required.</span>
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700" style={{animationDelay: '200ms'}}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Upload Your Dataset</h2>
              <p className="text-sm text-gray-500">CSV files only, up to 100MB</p>
            </div>
          </div>
          
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-10 border-2 border-dashed transition-all duration-300 rounded-xl ${
              files?.[0] 
                ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100" 
                : "border-gray-300 hover:cursor-pointer hover:border-emerald-400 bg-gradient-to-br from-gray-50 to-blue-50/30 hover:from-emerald-50 hover:to-teal-50"
            }`}
          >
            {files?.[0] ? (
              <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-500">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-emerald-900 text-lg">{files[0].name}</p>
                  <p className="text-sm text-emerald-600 mt-1">{(files[0].size / 1024).toFixed(1)} KB • Uploaded successfully</p>
                </div>
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    setFiles(undefined);
                    setColumns([]);
                    setRows([]);
                    setTargetCol("");
                  }}
                  className="inline-flex items-center gap-2 text-sm text-emerald-700 hover:text-emerald-900 font-medium cursor-pointer transition-colors group"
                >
                  <svg className="w-4 h-4 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
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
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2" role="alert">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
        {/* Target column */}
        {columns.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700" style={{animationDelay: '400ms'}}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Select Target Column</h2>
                <p className="text-sm text-gray-500">Choose the column you want to predict</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-3">
              {columns.map((c, idx) => (
                <button
                  key={c}
                  onClick={() => setTargetCol(c)}
                  className={`group flex items-center gap-2 px-4 py-2.5 hover:cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 animate-in fade-in zoom-in-95 ${
                    targetCol === c
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg scale-105"
                      : "bg-gray-100 text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 hover:scale-105 hover:shadow-md"
                  }`}
                  style={{animationDelay: `${idx * 50}ms`}}
                >
                  {targetCol === c && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {c}
                  {targetCol === c && (
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">🎯</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview rows */}
        {previewRows.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700" style={{animationDelay: '600ms'}}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Data Preview</h2>
                <p className="text-sm text-gray-500">First {previewRows.length} rows of your dataset</p>
              </div>
            </div>
            
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-50 to-blue-50/30">
                  {columns.map((c) => (
                    <TableHead 
                      key={c}
                      className={`transition-all duration-300 font-semibold text-xs uppercase tracking-wider ${
                        c === targetCol 
                          ? "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900 border-l-4 border-blue-500 animate-in slide-in-from-left-1" 
                          : "hover:bg-gray-100/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {c}
                        {c === targetCol && (
                          <span className="text-xs bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-1 rounded-full animate-in zoom-in-50 duration-200 shadow-sm">
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
                  <TableRow key={i} className="hover:bg-gradient-to-r hover:from-emerald-50/30 hover:to-blue-50/30 transition-all duration-200 group">
                    {columns.map((c) => (
                      <TableCell 
                        key={c}
                        className={`transition-all duration-300 text-sm ${
                          c === targetCol 
                            ? "bg-blue-50/50 font-semibold text-blue-900 border-l-4 border-blue-400" 
                            : "text-gray-700"
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
        {files?.[0] && targetCol && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl shadow-xl border border-emerald-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700" style={{animationDelay: '800ms'}}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Ready to Train</h3>
                  <p className="text-sm text-gray-600">Your dataset is configured and ready for training</p>
                  {jobId && (
                    <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-white rounded-lg text-xs text-gray-600 border border-gray-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Job ID: <span className="font-mono">{jobId.slice(0, 8)}...</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-stretch md:items-end gap-3 w-full md:w-auto">
                <Button
                  onClick={handleBeginTraining}
                  disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
                  className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 px-8 py-6 text-base"
                >
                  {submitStatus === "loading" 
                    ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Submitting...
                      </span>
                    )
                    : submitStatus === "processing" 
                    ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Training in Progress...
                      </span>
                    )
                    : (
                      <span className="flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Begin Training
                      </span>
                    )}
                </Button>
                
                {submitStatus !== "idle" && (
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium animate-in slide-in-from-right-2 ${
                    submitStatus === "success"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                      : submitStatus === "error"
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : submitStatus === "processing"
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-gray-100 text-gray-800 border border-gray-200"
                  }`}>
                    {submitStatus === "processing" && (
                      <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    )}
                    {submitStatus === "success" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {submitStatus === "error" && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span>{submitMessage}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Live updates */}
        {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-xl border border-blue-200 p-8 mb-8 animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg animate-pulse">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-blue-900">Live Training Updates</h3>
                <p className="text-sm text-blue-700">Real-time progress from our ML agents</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {latestPreOutput && (
                <div className="bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden animate-in slide-in-from-left-2">
                  <div className="bg-gradient-to-r from-blue-100 to-indigo-100 px-4 py-3 border-b border-blue-200">
                    <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Preprocessing Output
                    </h4>
                  </div>
                  <div className="p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-64 overflow-auto font-mono border border-gray-200">{latestPreOutput}</pre>
                  </div>
                </div>
              )}
              {latestModelResult && (
                <div className="bg-white rounded-xl shadow-md border border-purple-100 overflow-hidden animate-in slide-in-from-right-2">
                  <div className="bg-gradient-to-r from-purple-100 to-pink-100 px-4 py-3 border-b border-purple-200">
                    <h4 className="font-semibold text-purple-900 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Latest Model Result
                    </h4>
                  </div>
                  <div className="p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-64 overflow-auto font-mono border border-gray-200">{JSON.stringify(latestModelResult, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Training Results */}
        {trainingResults && (
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl shadow-xl border border-emerald-200 p-8 mb-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-900">Training Complete! 🎉</h3>
                <p className="text-sm text-emerald-700">Your model has been successfully trained</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md border border-emerald-100 overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-emerald-100 to-green-100 px-4 py-3 border-b border-emerald-200">
                <h4 className="font-semibold text-emerald-900 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Training Summary
                </h4>
              </div>
              <div className="p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg font-mono border border-gray-200">
                  {trainingResults.orchestrator_output || "No detailed output available."}
                </pre>
              </div>
            </div>
            
            {jobId && (
              <div className="mt-6 bg-white rounded-xl shadow-md border border-indigo-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 px-4 py-3 border-b border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Model Artifacts
                  </h4>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap gap-4 mb-4">
                    {artifacts?.latest_csv && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                        <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-gray-700 font-medium">Latest CSV:</span>
                        <span className="text-blue-700 font-mono text-xs">{artifacts.latest_csv}</span>
                      </div>
                    )}
                    {artifacts?.model_files_ready && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-sm">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="text-gray-700 font-medium">Trained Models:</span>
                        <span className="text-purple-700 font-semibold">{artifacts.model_files?.length || 0} ready</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <Button
                      onClick={async () => {
                        const res = await fetch(`/api/job/${jobId}/artifacts`);
                        if (res.ok) setArtifacts(await res.json());
                      }}
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                    >
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh Artifacts
                      </span>
                    </Button>
                    {artifacts?.latest_csv && (
                      <a
                        href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download CSV
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
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="mt-16 border-t bg-white/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm">
              <span className="text-2xl">🌱</span>
              <span>© 2025 SproutML. Powered by AI.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-emerald-600 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
