"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa, { ParseResult } from "papaparse";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Upload, Target, Sparkles, BarChart3, Download, FileText, RefreshCw, Loader2 } from "lucide-react";

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

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const detectColumnType = (columnName: string, data: CsvRow[]): "number" | "text" | "date" => {
    const sample = data.slice(0, 10);
    const values = sample.map(row => row[columnName]);
    
    const numericCount = values.filter(v => typeof v === 'number' || !isNaN(Number(v))).length;
    if (numericCount > values.length * 0.7) return "number";
    
    return "text";
  };

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
    <div className="min-h-screen bg-bg relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-blue-accent/5 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-accent/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative border-b border-border/50 backdrop-blur-sm bg-bg/80"
      >
        <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent/70 rounded-lg flex items-center justify-center">
              <span className="text-lg">🌱</span>
            </div>
            <span className="text-xl font-bold text-text">SproutML</span>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-xs hidden sm:flex">
              v0.1.0
            </Badge>
          </div>
        </div>
      </motion.header>
      
      <div className="relative max-w-[1080px] mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface/50 border border-border rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted">Agentic ML Training Platform</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-br from-text via-text to-muted bg-clip-text text-transparent leading-tight">
            Train production-ready ML models<br />from your data
          </h1>
          <p className="text-lg text-muted max-w-2xl mx-auto">
            Upload your dataset and let our intelligent agents handle preprocessing, feature engineering, and model training — automatically.
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Upload className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-xl">Upload Dataset</CardTitle>
                  <CardDescription>Drop your CSV file to get started</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Dropzone
                accept={{ "text/csv": [".csv"] }}
                onDrop={handleDrop}
                onError={(e) => setError(e.message)}
                src={files}
                maxFiles={1}
                className={`p-8 border-2 border-dashed transition-all duration-300 rounded-xl ${
                  files?.[0] 
                    ? "border-accent/50 bg-accent/5 backdrop-blur-sm" 
                    : "border-border hover:border-accent/30 bg-surface/30 hover:bg-surface/50 backdrop-blur-sm"
                }`}
              >
                <AnimatePresence mode="wait">
                  {files?.[0] ? (
                    <motion.div
                      key="uploaded"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex flex-col items-center text-center space-y-4"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center border border-accent/30"
                      >
                        <CheckCircle2 className="w-8 h-8 text-accent" />
                      </motion.div>
                      <div>
                        <p className="font-semibold text-text text-lg">{files[0].name}</p>
                        <p className="text-sm text-muted mt-1">
                          {(files[0].size / 1024).toFixed(1)} KB • {rows.length} rows • {columns.length} columns
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFiles(undefined);
                          setColumns([]);
                          setRows([]);
                          setTargetCol("");
                        }}
                        className="text-muted hover:text-accent"
                      >
                        Upload different file
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <DropzoneEmptyState />
                      <DropzoneContent />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Dropzone>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive mt-3 flex items-center gap-2"
                  role="alert"
                >
                  <span className="w-1.5 h-1.5 bg-destructive rounded-full" />
                  {error}
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Target Column Selection */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-accent/10 rounded-lg">
                      <Target className="w-5 h-5 text-blue-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Select Target Column</CardTitle>
                      <CardDescription>Choose the column you want to predict</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {columns.map((col, idx) => {
                      const colType = detectColumnType(col, rows);
                      return (
                        <motion.button
                          key={col}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => setTargetCol(col)}
                          className={`group flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                            targetCol === col
                              ? "bg-accent/20 text-accent border-2 border-accent/50 shadow-[0_0_20px_rgba(34,197,94,0.2)]"
                              : "bg-surface border-2 border-border text-text hover:border-accent/30 hover:bg-surface/80"
                          }`}
                        >
                          <Badge variant={colType === "number" ? "number" : colType === "date" ? "date" : "text"} className="text-xs px-2">
                            {colType === "number" ? "123" : colType === "date" ? "📅" : "ABC"}
                          </Badge>
                          <span>{col}</span>
                          {targetCol === col && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 bg-accent rounded-full"
                            />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
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
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-8">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 rounded-lg">
                        <FileText className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">Data Preview</CardTitle>
                        <CardDescription>First {previewRows.length} rows of your dataset</CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-surface/50">
                          {columns.map((col) => {
                            const colType = detectColumnType(col, rows);
                            return (
                              <th
                                key={col}
                                className={`px-4 py-3 text-left font-semibold transition-all ${
                                  col === targetCol
                                    ? "bg-accent/10 text-accent"
                                    : "text-muted"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant={colType === "number" ? "number" : colType === "date" ? "date" : "text"} className="text-xs">
                                    {colType === "number" ? "123" : colType === "date" ? "📅" : "ABC"}
                                  </Badge>
                                  <span className="truncate">{col}</span>
                                  {col === targetCol && (
                                    <Badge variant="success" className="ml-1">
                                      Target
                                    </Badge>
                                  )}
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, rowIdx) => (
                          <motion.tr
                            key={rowIdx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: rowIdx * 0.05 }}
                            className="border-b border-border/50 hover:bg-surface/30 transition-colors"
                          >
                            {columns.map((col) => (
                              <td
                                key={col}
                                className={`px-4 py-3 ${
                                  col === targetCol
                                    ? "bg-accent/5 text-text font-medium"
                                    : "text-muted"
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
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Control */}
        <AnimatePresence>
          {files?.[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-8">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-text mb-1">Ready to train?</h3>
                      <p className="text-sm text-muted">
                        {targetCol ? `Training will predict: ${targetCol}` : "Select a target column to continue"}
                      </p>
                    </div>
                    <Button
                      onClick={handleBeginTraining}
                      disabled={!targetCol || submitStatus === "loading" || submitStatus === "processing"}
                      size="lg"
                      className="min-w-[180px]"
                    >
                      {submitStatus === "loading" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : submitStatus === "processing" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Training...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Begin Training
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {submitStatus !== "idle" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-6 pt-6 border-t border-border"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-2 h-2 rounded-full ${
                          submitStatus === "success" ? "bg-accent" :
                          submitStatus === "error" ? "bg-destructive" :
                          "bg-blue-accent animate-pulse"
                        }`} />
                        <span className={`text-sm font-medium ${
                          submitStatus === "success" ? "text-accent" :
                          submitStatus === "error" ? "text-destructive" :
                          "text-blue-accent"
                        }`}>
                          {submitMessage}
                        </span>
                        {jobId && (
                          <Badge variant="outline" className="ml-auto text-xs">
                            Job: {jobId.slice(0, 8)}
                          </Badge>
                        )}
                      </div>
                      {submitStatus === "processing" && (
                        <Progress value={33} className="h-1.5" />
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
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
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-8 border-blue-accent/20 bg-blue-accent/5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-accent/20 rounded-lg">
                      <Loader2 className="w-5 h-5 text-blue-accent animate-spin" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Live Training Updates</CardTitle>
                      <CardDescription>Real-time progress from our ML agents</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {latestPreOutput && (
                    <div className="bg-surface/50 rounded-xl border border-border p-4">
                      <h4 className="font-medium text-text mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-accent" />
                        Preprocessing Output
                      </h4>
                      <pre className="text-xs text-muted whitespace-pre-wrap bg-bg/50 p-3 rounded-lg max-h-64 overflow-auto font-mono">
                        {latestPreOutput}
                      </pre>
                    </div>
                  )}
                  {latestModelResult && (
                    <div className="bg-surface/50 rounded-xl border border-border p-4">
                      <h4 className="font-medium text-text mb-2 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-accent" />
                        Latest Model Result
                      </h4>
                      <pre className="text-xs text-muted whitespace-pre-wrap bg-bg/50 p-3 rounded-lg max-h-64 overflow-auto font-mono">
                        {JSON.stringify(latestModelResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Results */}
        <AnimatePresence>
          {trainingResults && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="mb-8 border-accent/20 bg-accent/5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Training Complete!</CardTitle>
                      <CardDescription>Your models are ready</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="bg-surface/50 rounded-xl border border-border p-4">
                    <h4 className="font-medium text-text mb-2">Orchestrator Output</h4>
                    <pre className="text-xs text-muted whitespace-pre-wrap bg-bg/50 p-3 rounded-lg max-h-96 overflow-auto font-mono">
                      {trainingResults.orchestrator_output || "No detailed output available."}
                    </pre>
                  </div>

                  {/* Artifacts Section */}
                  {jobId && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-text flex items-center gap-2">
                          <Download className="w-4 h-4 text-accent" />
                          Download Artifacts
                        </h4>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={async () => {
                              const res = await fetch(`/api/job/${jobId}/artifacts`);
                              if (res.ok) setArtifacts(await res.json());
                            }}
                            variant="outline"
                            size="sm"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Refresh
                          </Button>
                          {artifacts?.latest_csv && (
                            <Button
                              asChild
                              size="sm"
                            >
                              <a href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}>
                                <Download className="w-3 h-3" />
                                Latest CSV
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>

                      {artifacts?.model_files_ready && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4"
                        >
                          <p className="text-sm font-medium text-purple-400 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            {artifacts.model_files?.length || 0} trained model(s) ready for download
                          </p>
                        </motion.div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {!artifacts?.files?.length ? (
                          <div className="col-span-full text-center py-12 bg-surface/30 rounded-xl border border-border">
                            <FileText className="w-12 h-12 text-muted mx-auto mb-3 opacity-50" />
                            <p className="text-sm text-muted">No artifacts available yet</p>
                          </div>
                        ) : (
                          artifacts.files.map((filename, idx) => (
                            <motion.div
                              key={filename}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className="group bg-surface border border-border rounded-xl p-4 hover:border-accent/30 hover:shadow-[0_4px_12px_rgba(34,197,94,0.1)] transition-all"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center border border-accent/20">
                                  <FileText className="w-5 h-5 text-accent" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-text truncate" title={filename}>
                                    {filename}
                                  </p>
                                  <p className="text-xs text-muted mt-0.5">
                                    {filename.split('.').pop()?.toUpperCase()}
                                  </p>
                                </div>
                              </div>
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="w-full"
                              >
                                <a href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}>
                                  <Download className="w-3 h-3" />
                                  Download
                                </a>
                              </Button>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
