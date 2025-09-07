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
        return;
      } else if (jobData.status === "failed") {
        setSubmitStatus("error");
        setSubmitMessage(`Training failed: ${jobData.error || "Unknown error"}`);
        return;
      } else if (jobData.status === "processing") {
        setSubmitMessage("ML agents are processing your data...");
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 5000); // Poll every 5 seconds
      } else if (jobData.status === "queued") {
        setSubmitMessage("Job queued, waiting to start...");
        // Continue polling
        setTimeout(() => pollJobStatus(jobId), 3000); // Poll every 3 seconds
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
  }, [files, targetCol, pollJobStatus]);

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
          className="bg-green-600"
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
        </div>
      )}
    </div>
  );
}
