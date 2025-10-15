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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Navigation Header */}
      <nav className="glass-effect sticky top-0 z-50 border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 via-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <span className="text-white text-xl font-bold">S</span>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                SproutML
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">ML Platform</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">About</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="gradient-bg animate-gradient py-24 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col items-center text-center fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 mb-6">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-sm text-white font-medium">AI-Powered Machine Learning</span>
              </div>
              <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
                Transform Your Data
                <br />
                <span className="bg-gradient-to-r from-cyan-200 via-blue-200 to-purple-200 bg-clip-text text-transparent">
                  Into Intelligence
                </span>
              </h1>
              <p className="text-xl text-blue-100 max-w-2xl mb-8 leading-relaxed">
                Upload your dataset and let our AI agents build, train, and optimize machine learning models automatically
              </p>
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer">
                  AutoML
                </span>
                <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer">
                  Data Analysis
                </span>
                <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer">
                  Model Training
                </span>
                <span className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-all cursor-pointer">
                  Cloud Ready
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">125k+</div>
                  <div className="text-sm text-blue-200">Models Trained</div>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">98%</div>
                  <div className="text-sm text-blue-200">Accuracy Rate</div>
                </div>
                <div className="w-px h-12 bg-white/30"></div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">24/7</div>
                  <div className="text-sm text-blue-200">AI Processing</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-50 to-transparent"></div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-12 -mt-16 relative z-10 fade-in"">
        <div className="glass-effect rounded-3xl p-8 shadow-xl border border-gray-200/50"">

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                  1
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Upload Dataset</h2>
              </div>
              <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
            </div>
            
            <Dropzone
              accept={{ "text/csv": [".csv"] }}
              onDrop={handleDrop}
              onError={(e) => setError(e.message)}
              src={files}
              maxFiles={1}
              className={`p-10 border-2 border-dashed transition-all duration-500 rounded-2xl hover-lift ${
                files?.[0] 
                  ? "border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg shadow-emerald-100" 
                  : "border-gray-300 hover:cursor-pointer hover:border-blue-400 bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 hover:shadow-lg"
              }`}
            >
              {files?.[0] ? (
                <div className="flex flex-col items-center text-center space-y-4 slide-in">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 animate-in zoom-in-50 duration-500">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-emerald-900">{files[0].name}</p>
                    <p className="text-sm text-emerald-600 mt-1">
                      <span className="font-medium">{(files[0].size / 1024).toFixed(1)} KB</span> • Successfully uploaded
                    </p>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(undefined);
                      setColumns([]);
                      setRows([]);
                      setTargetCol("");
                    }}
                    className="mt-2 px-4 py-2 text-sm font-medium text-emerald-700 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-all duration-200"
                  >
                    Upload different file
                  </button>
                </div>
              ) : (
                <>
                  <DropzoneEmptyState />
                  <DropzoneContent />
                </>
              )}
            </Dropzone>
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 slide-in">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700 font-medium" role="alert">{error}</p>
              </div>
            )}
          </div>
          
          {/* Target column */}
          {columns.length > 0 && (
            <div className="mb-8 fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    2
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Select Target Column</h2>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
              </div>
              
              <div className="flex flex-wrap gap-3">
                {columns.map((c, index) => (
                  <button
                    key={c}
                    onClick={() => setTargetCol(c)}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className={`flex items-center gap-2 px-5 py-3 hover:cursor-pointer rounded-xl text-sm font-medium transition-all duration-300 hover-lift slide-in ${
                      targetCol === c
                        ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-200"
                        : "bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:shadow-md"
                    }`}
                  >
                    {targetCol === c && (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    )}
                    <span>{c}</span>
                    {targetCol === c && (
                      <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                        🎯
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview rows */}
          {previewRows.length > 0 && (
            <div className="mb-8 fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-semibold">
                    3
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Data Preview</h2>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
              </div>
              
              <div className="overflow-x-auto rounded-xl border-2 border-gray-200 bg-white shadow-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100">
                      {columns.map((c) => (
                        <TableHead 
                          key={c}
                          className={`transition-all duration-300 font-semibold ${
                            c === targetCol 
                              ? "bg-gradient-to-br from-blue-100 to-purple-100 text-blue-900 border-l-4 border-blue-500" 
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {c}
                            {c === targetCol && (
                              <span className="text-xs bg-gradient-to-r from-blue-500 to-purple-600 text-white px-2 py-1 rounded-full animate-in zoom-in-50 duration-200 shadow-sm">
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
                      <TableRow key={i} className="hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 transition-all duration-200">
                        {columns.map((c) => (
                          <TableCell 
                            key={c}
                            className={`transition-all duration-300 ${
                              c === targetCol 
                                ? "bg-blue-50/50 font-medium text-blue-900 border-l-4 border-blue-300" 
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
              <div className="text-center mt-4 flex items-center justify-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-gray-500">
                  Showing first {previewRows.length} rows of your dataset
                </span>
              </div>
            </div>
          )}

          {/* Begin training */}
          {files?.[0] && targetCol && (
            <div className="mb-8 fade-in">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white font-semibold">
                    4
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Start Training</h2>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent"></div>
              </div>
              
              <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 rounded-2xl p-6 border-2 border-emerald-200">
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to train your model</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Our AI agents will analyze your data, select the best algorithms, and train multiple models to find the optimal solution.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 flex-wrap">
                  <Button
                    onClick={handleBeginTraining}
                    disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold px-8 py-6 text-base shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 transition-all duration-300 hover-lift disabled:opacity-50 disabled:cursor-not-allowed"
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
                      )
                    }
                  </Button>
                  
                  {submitStatus !== "idle" && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-sm slide-in">
                      {submitStatus === "processing" && (
                        <div className="animate-spin h-5 w-5 border-3 border-blue-600 border-t-transparent rounded-full"></div>
                      )}
                      {submitStatus === "success" && (
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {submitStatus === "error" && (
                        <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${
                          submitStatus === "success"
                            ? "text-green-700"
                            : submitStatus === "error"
                            ? "text-red-700"
                            : submitStatus === "processing"
                            ? "text-blue-700"
                            : "text-gray-700"
                        }`}>
                          {submitMessage}
                        </span>
                        {jobId && (
                          <span className="text-xs text-gray-500 mt-0.5">
                            Job ID: {jobId.slice(0, 8)}...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live updates */}
          {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
            <div className="mb-8 fade-in">
              <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-200 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">Live Updates</h3>
                  </div>
                  <span className="px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full animate-pulse">
                    PROCESSING
                  </span>
                </div>
                
                {latestPreOutput && (
                  <div className="bg-white rounded-xl border-2 border-blue-100 p-5 mb-4 shadow-md hover-lift">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h4 className="font-semibold text-gray-900">Preprocessing Output</h4>
                    </div>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg max-h-64 overflow-auto border border-gray-200 font-mono">{latestPreOutput}</pre>
                  </div>
                )}
                
                {latestModelResult && (
                  <div className="bg-white rounded-xl border-2 border-indigo-100 p-5 shadow-md hover-lift">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <h4 className="font-semibold text-gray-900">Latest Model Result</h4>
                    </div>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-indigo-50 p-4 rounded-lg max-h-64 overflow-auto border border-gray-200 font-mono">{JSON.stringify(latestModelResult, null, 2)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Training Results */}
          {trainingResults && (
            <div className="mb-8 fade-in">
              <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-2xl p-6 border-2 border-emerald-200 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg animate-in zoom-in-50">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">🎉 Training Complete!</h3>
                    <p className="text-sm text-emerald-700 mt-0.5">Your model has been successfully trained</p>
                  </div>
                </div>
                
                <div className="bg-white rounded-xl border-2 border-emerald-100 p-5 mb-4 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h4 className="font-semibold text-gray-900">Orchestrator Output</h4>
                  </div>
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-emerald-50 p-4 rounded-lg border border-gray-200 font-mono max-h-96 overflow-auto">
                    {trainingResults.orchestrator_output || "No detailed output available."}
                  </pre>
                </div>
                {jobId && (
                  <div className="bg-white rounded-xl border-2 border-purple-100 p-5 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <h4 className="font-semibold text-gray-900">📦 Training Artifacts</h4>
                      </div>
                      {artifacts?.model_files_ready && (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                          🤖 {artifacts.model_files?.length || 0} Model{(artifacts.model_files?.length || 0) > 1 ? 's' : ''} Ready
                        </span>
                      )}
                    </div>
                    
                    {artifacts?.latest_csv && (
                      <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm text-gray-700 font-medium">Latest CSV:</span>
                            <span className="text-sm text-blue-700">{artifacts.latest_csv}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-4">
                      <Button
                        onClick={async () => {
                          const res = await fetch(`/api/job/${jobId}/artifacts`);
                          if (res.ok) setArtifacts(await res.json());
                        }}
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all hover-lift"
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
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white text-sm font-medium shadow-md hover:shadow-lg transition-all hover-lift"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Download Latest CSV
                        </a>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-gray-50 to-purple-50 rounded-lg p-4 max-h-80 overflow-auto border border-gray-200">
                      {!artifacts?.files?.length ? (
                        <div className="text-center py-12">
                          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center shadow-inner">
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <p className="text-sm text-gray-500 font-medium">No files available yet</p>
                          <p className="text-xs text-gray-400 mt-1">Artifacts will appear here once training completes</p>
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
                            <div key={filename} className="bg-white rounded-xl border-2 border-gray-200 p-4 hover:shadow-lg hover:border-blue-300 transition-all duration-300 hover-lift group">
                              <div className="flex items-start gap-3 mb-3">
                                {getFileIcon(filename)}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate" title={filename}>
                                    {filename}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                    <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                                    {filename.split('.').pop()?.toUpperCase()} file
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 text-blue-700 text-xs font-semibold rounded-lg transition-all border border-blue-200 hover:border-blue-300 group-hover:shadow-md"
                                title={`Download ${filename}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Download
                              </a>
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
      
      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            Powered by <span className="font-semibold bg-gradient-to-r from-teal-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">SproutML</span> • Intelligent Machine Learning Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
