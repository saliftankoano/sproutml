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
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 border border-green-200 rounded-full mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <span className="text-2xl animate-bounce">🌱</span>
            <span className="text-sm font-medium text-green-800">AI-Powered ML Platform</span>
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent mb-4 animate-in fade-in slide-in-from-top-5 duration-700 delay-150">
            Welcome to SproutML
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl animate-in fade-in slide-in-from-top-6 duration-700 delay-300">
            Transform your data into insights with automated machine learning.
            <br />
            <span className="text-base text-gray-500 mt-2 inline-block">Upload your CSV dataset to get started in seconds.</span>
          </p>
        </div>

        {/* Upload Section */}
        <div className="mt-8 mb-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Dataset
            </h2>
            <p className="text-sm text-gray-500 mt-1">Drag and drop your CSV file or click to browse</p>
          </div>
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-10 border-2 border-dashed transition-all duration-300 rounded-xl backdrop-blur-sm ${
              files?.[0] 
                ? "border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-lg scale-100 hover:scale-[1.01]" 
                : "border-gray-300 hover:cursor-pointer hover:border-blue-400 bg-gradient-to-br from-gray-50 to-blue-50/30 hover:shadow-xl hover:scale-[1.02]"
            }`}
          >
            {files?.[0] ? (
              <div className="flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-500">
                <div className="relative">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-lg text-green-900">{files[0].name}</p>
                  <p className="text-sm text-green-700 mt-1 flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    {(files[0].size / 1024).toFixed(1)} KB uploaded successfully
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
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Upload Different File
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-base font-medium text-gray-700">Drop your CSV file here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse from your computer</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Accepts CSV files only
                </div>
              </div>
            )}
          </Dropzone>
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2 duration-300">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </div>
        {/* Target Column Selection */}
        {columns.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Select Target Column
              </h2>
              <p className="text-sm text-gray-500 mt-1">Choose the column you want to predict</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {columns.map((c, idx) => (
                <button
                  key={c}
                  onClick={() => setTargetCol(c)}
                  className={`group relative flex items-center gap-2.5 px-5 py-3 hover:cursor-pointer rounded-xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md animate-in fade-in zoom-in-95 ${
                    targetCol === c
                      ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white border-2 border-transparent scale-105 shadow-lg"
                      : "bg-gradient-to-r from-gray-50 to-gray-100 text-gray-700 border-2 border-gray-200 hover:border-blue-300 hover:from-blue-50 hover:to-purple-50 hover:text-blue-700 hover:scale-105"
                  }`}
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {targetCol === c ? (
                    <>
                      <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-lg"></div>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-semibold">{c}</span>
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">Target</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{c}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
            {!targetCol && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-amber-800">Please select a target column to continue with training</p>
              </div>
            )}
          </div>
        )}

        {/* Data Preview */}
        {previewRows.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Data Preview
              </h2>
              <p className="text-sm text-gray-500 mt-1">First {previewRows.length} rows of your dataset</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100">
                      {columns.map((c, idx) => (
                        <TableHead 
                          key={c}
                          className={`transition-all duration-300 first:rounded-tl-xl last:rounded-tr-xl ${
                            c === targetCol 
                              ? "bg-gradient-to-r from-blue-500 to-purple-600 font-bold text-white border-l-4 border-yellow-400 animate-in slide-in-from-left-1" 
                              : "hover:bg-gray-100 font-semibold text-gray-700"
                          }`}
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          <div className="flex items-center gap-2 py-1">
                            {c === targetCol && (
                              <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span>{c}</span>
                            {c === targetCol && (
                              <span className="text-xs bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full animate-in zoom-in-50 duration-200 font-semibold flex items-center gap-1">
                                <span>🎯</span> Target
                              </span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow 
                        key={i} 
                        className={`transition-all duration-200 hover:bg-gradient-to-r ${
                          i % 2 === 0 
                            ? "bg-white hover:from-blue-50 hover:to-purple-50" 
                            : "bg-gray-50/50 hover:from-blue-50 hover:to-purple-50"
                        }`}
                      >
                        {columns.map((c) => (
                          <TableCell 
                            key={c}
                            className={`transition-all duration-300 ${
                              c === targetCol 
                                ? "bg-gradient-to-r from-blue-50 to-purple-50 font-semibold text-blue-900 border-l-4 border-blue-400" 
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
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Showing first {previewRows.length} rows • {rows.length} total rows • {columns.length} columns
            </div>
          </div>
        )}

        {/* Begin Training */}
        <div className="mb-8 bg-white rounded-2xl shadow-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Training
              </h2>
              <p className="text-sm text-gray-500 mt-1">Launch the ML pipeline to train your model</p>
            </div>
            <Button
              onClick={handleBeginTraining}
              disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-8 py-6 text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {submitStatus === "loading" ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : submitStatus === "processing" ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Training in Progress...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Begin Training
                </>
              )}
            </Button>
          </div>
          
          {submitStatus !== "idle" && (
            <div className="mt-6 p-5 rounded-xl border-2 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-4">
                {submitStatus === "processing" || submitStatus === "loading" ? (
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-600 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                ) : submitStatus === "success" ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0 animate-in zoom-in-50 duration-500">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : submitStatus === "error" ? (
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : null}
                
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold text-base ${
                    submitStatus === "success"
                      ? "text-green-700"
                      : submitStatus === "error"
                      ? "text-red-700"
                      : "text-blue-700"
                  }`}>
                    {submitStatus === "success" ? "Training Complete!" : submitStatus === "error" ? "Training Failed" : "Training Status"}
                  </p>
                  <p className={`text-sm mt-1 ${
                    submitStatus === "success"
                      ? "text-green-600"
                      : submitStatus === "error"
                      ? "text-red-600"
                      : "text-blue-600"
                  }`}>
                    {submitMessage}
                  </p>
                  {jobId && (
                    <div className="mt-3 flex items-center gap-2 text-xs font-mono bg-gray-100 px-3 py-2 rounded-lg w-fit">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-gray-600">Job ID:</span>
                      <span className="text-gray-800 font-semibold">{jobId.slice(0, 12)}...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Updates */}
        {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
          <div className="mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg border-2 border-blue-200 p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                {submitStatus === "processing" && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-white"></div>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
                  Live Updates
                  {submitStatus === "processing" && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white animate-pulse">
                      Active
                    </span>
                  )}
                </h3>
                <p className="text-sm text-blue-700 mt-1">Real-time training progress</p>
              </div>
            </div>
            
            {latestPreOutput && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-4 animate-in fade-in slide-in-from-left-2 duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg">Preprocessing Output</h4>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">{latestPreOutput}</pre>
                </div>
              </div>
            )}
            
            {latestModelResult && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 animate-in fade-in slide-in-from-right-2 duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg">Latest Model Result</h4>
                </div>
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                  <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">{JSON.stringify(latestModelResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Training Results */}
        {trainingResults && (
          <div className="mb-8 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl shadow-xl border-2 border-green-300 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-700">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg animate-bounce">
                  <span className="text-3xl">🎉</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                  <svg className="w-4 h-4 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                  Training Complete!
                </h3>
                <p className="text-sm text-green-700 mt-1">Your models have been successfully trained</p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="font-bold text-gray-900 text-lg">Orchestrator Output</h4>
              </div>
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono max-h-96 overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
                  {trainingResults.orchestrator_output || "No detailed output available."}
                </pre>
              </div>
            </div>
            {jobId && (
              <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">📦</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg">Artifacts & Downloads</h4>
                      <p className="text-xs text-gray-500">Your trained models and processed data</p>
                    </div>
                  </div>
                </div>
                
                {artifacts?.latest_csv && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <p className="font-semibold text-blue-900">Latest CSV File</p>
                          <p className="text-sm text-blue-700">{artifacts.latest_csv}</p>
                        </div>
                      </div>
                      <a
                        href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg hover:scale-105"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download CSV
                      </a>
                    </div>
                  </div>
                )}
                
                {artifacts?.model_files_ready && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                      <div>
                        <p className="font-semibold text-purple-900">Trained Models Ready</p>
                        <p className="text-sm text-purple-700">{artifacts.model_files?.length || 0} model file(s) available for download</p>
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
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Artifacts
                  </Button>
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
