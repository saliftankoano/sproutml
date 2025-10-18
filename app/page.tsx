"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileCheck2, Target, Sparkles, TrendingUp, Download, BarChart3, Activity } from "lucide-react";
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
  const [latestPreOutput, setLatestPreOutput] = useState<string>("");
  type ModelResult = Record<string, unknown> | null;
  const [latestModelResult, setLatestModelResult] = useState<ModelResult>(null);
  const [dragActive, setDragActive] = useState(false);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;

    const file = droppedFiles[0];
    processFile(file);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    processFile(file);
  }, []);

  const processFile = (file: File) => {
    setError("");
    setColumns([]);
    setRows([]);
    setTargetCol("");
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

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/job/${jobId}`);
      const jobData = await res.json();
      
      if (!res.ok) {
        setSubmitStatus("error");
        setSubmitMessage("Failed to check job status.");
        return;
      }

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
        try {
          const artRes = await fetch(`/api/job/${jobId}/artifacts`);
          if (artRes.ok) setArtifacts(await artRes.json());
        } catch {}
        setTimeout(() => pollJobStatus(jobId), 5000);
      } else if (jobData.status === "daytona") {
        setSubmitMessage("Setting up cloud infrastructure...");
        setTimeout(() => pollJobStatus(jobId), 3000);
      } else if (jobData.status === "queued") {
        setSubmitMessage("Job queued, waiting to start...");
        setTimeout(() => pollJobStatus(jobId), 3000);
      } else {
        setSubmitMessage(`Job status: ${jobData.status}`);
        setTimeout(() => pollJobStatus(jobId), 5000);
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

      const newJobId = json.jobId;
      setJobId(newJobId);
      setSubmitStatus("processing");
      setSubmitMessage("Training job submitted. Starting processing...");
      
      setTimeout(() => pollJobStatus(newJobId), 2000);
      
    } catch (e) {
      const err = e as Error;
      setSubmitStatus("error");
      setSubmitMessage(err.message || "Unexpected error starting training.");
    }
  }, [files, targetCol, pollJobStatus]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative max-w-[1080px] mx-auto px-6 py-12">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass glass-border mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">AutoML Made Simple</span>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Welcome to SproutML
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your dataset, select a target column, and let our AI train the perfect model for you.
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
            className={`relative rounded-2xl glass glass-border p-12 transition-all duration-200 ${
              dragActive ? "border-primary bg-primary/5" : ""
            } ${files?.[0] ? "border-primary/50" : ""}`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            <AnimatePresence mode="wait">
              {files?.[0] ? (
                <motion.div
                  key="uploaded"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <FileCheck2 className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{files[0].name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(files[0].size / 1024).toFixed(1)} KB • {rows.length.toLocaleString()} rows • {columns.length} columns
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(undefined);
                      setColumns([]);
                      setRows([]);
                      setTargetCol("");
                    }}
                    className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    Change file
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse from your computer
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-destructive mt-3"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        {/* Column Selection */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-8"
            >
              <div className="rounded-2xl glass glass-border p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Select Target Column</h3>
                    <p className="text-sm text-muted-foreground">Choose the column you want to predict</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {columns.map((col, idx) => (
                    <motion.button
                      key={col}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setTargetCol(col)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        targetCol === col
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                          : "glass glass-border hover:border-primary/50"
                      }`}
                    >
                      {col}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Data Preview */}
        <AnimatePresence>
          {previewRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="mt-8"
            >
              <div className="rounded-2xl glass glass-border overflow-hidden">
                <div className="p-6 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">Data Preview</h3>
                      <p className="text-sm text-muted-foreground">First {previewRows.length} rows of your dataset</p>
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {columns.map((col) => (
                          <th
                            key={col}
                            className={`px-6 py-4 text-left text-sm font-semibold transition-all ${
                              col === targetCol
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {col}
                              {col === targetCol && (
                                <span className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                                  Target
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border-b border-border/50 hover:bg-secondary/50 transition-colors"
                        >
                          {columns.map((col) => (
                            <td
                              key={col}
                              className={`px-6 py-4 text-sm ${
                                col === targetCol
                                  ? "bg-primary/5 font-medium"
                                  : ""
                              }`}
                            >
                              {String((row as CsvRow)[col] ?? "")}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Button */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-8 flex items-center gap-4"
            >
              <Button
                onClick={handleBeginTraining}
                disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
                className="gradient-primary text-primary-foreground px-8 py-6 text-lg rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitStatus === "loading" || submitStatus === "processing" ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                    {submitStatus === "processing" ? "Training..." : "Submitting..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Begin Training
                  </>
                )}
              </Button>
              
              <AnimatePresence>
                {submitMessage && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2"
                  >
                    {submitStatus === "processing" && (
                      <Activity className="w-4 h-4 text-primary animate-pulse" />
                    )}
                    <span className={`text-sm ${
                      submitStatus === "success" ? "text-primary" :
                      submitStatus === "error" ? "text-destructive" :
                      "text-muted-foreground"
                    }`}>
                      {submitMessage}
                    </span>
                    {jobId && (
                      <span className="text-xs text-muted-foreground/60 ml-2">
                        ID: {jobId.slice(0, 8)}
                      </span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Updates */}
        <AnimatePresence>
          {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <div className="rounded-2xl glass glass-border p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-500 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Live Training Updates</h3>
                    <p className="text-sm text-muted-foreground">Real-time progress from your training job</p>
                  </div>
                </div>
                
                {latestPreOutput && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-secondary p-4 mb-4"
                  >
                    <h4 className="font-medium mb-2 text-sm">Preprocessing Output</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                      {latestPreOutput}
                    </pre>
                  </motion.div>
                )}
                
                {latestModelResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl bg-secondary p-4"
                  >
                    <h4 className="font-medium mb-2 text-sm">Latest Model Result</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                      {JSON.stringify(latestModelResult, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {trainingResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mt-8"
            >
              <div className="rounded-2xl glass glass-border overflow-hidden gradient-card">
                <div className="p-8 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Training Complete!</h3>
                      <p className="text-sm text-muted-foreground">Your model has been successfully trained</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-8">
                  <div className="rounded-xl bg-secondary p-6 mb-6">
                    <h4 className="font-semibold mb-3">Model Output</h4>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                      {trainingResults.orchestrator_output || "No detailed output available."}
                    </pre>
                  </div>
                  
                  {artifacts && (
                    <div className="rounded-xl bg-secondary p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">Artifacts & Downloads</h4>
                        <Button
                          onClick={async () => {
                            const res = await fetch(`/api/job/${jobId}/artifacts`);
                            if (res.ok) setArtifacts(await res.json());
                          }}
                          className="text-sm"
                          variant="outline"
                        >
                          Refresh
                        </Button>
                      </div>
                      
                      {artifacts.latest_csv && (
                        <div className="flex items-center justify-between p-4 rounded-lg bg-card/50 mb-4">
                          <div className="flex items-center gap-3">
                            <FileCheck2 className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium text-sm">Latest CSV</p>
                              <p className="text-xs text-muted-foreground">{artifacts.latest_csv}</p>
                            </div>
                          </div>
                          <a
                            href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </a>
                        </div>
                      )}
                      
                      {artifacts.model_files_ready && artifacts.model_files && artifacts.model_files.length > 0 && (
                        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 mb-4">
                          <p className="text-sm font-medium text-primary mb-2">
                            🤖 {artifacts.model_files.length} trained model(s) ready
                          </p>
                        </div>
                      )}
                      
                      {artifacts.files && artifacts.files.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {artifacts.files.map((filename) => (
                            <motion.div
                              key={filename}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="p-4 rounded-lg bg-card/50 hover:bg-card transition-colors group"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{filename}</p>
                                  <p className="text-xs text-muted-foreground">{filename.split('.').pop()?.toUpperCase()}</p>
                                </div>
                                <a
                                  href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                                  className="ml-3 p-2 rounded-lg hover:bg-secondary transition-colors"
                                  title={`Download ${filename}`}
                                >
                                  <Download className="w-4 h-4" />
                                </a>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
