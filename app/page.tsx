"use client";

import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Papa, { ParseResult } from "papaparse";
import { 
  Upload, CheckCircle2, Target, Sparkles, Database, 
  TrendingUp, Download, RefreshCw, FileText, Loader2,
  AlertCircle, ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

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
  const [artifacts, setArtifacts] = useState<{ 
    workspace: string; 
    listing: string; 
    files?: string[]; 
    latest_csv?: string | null; 
    model_files?: string[]; 
    model_files_ready?: boolean; 
    trained_models?: Record<string, unknown>[] 
  } | null>(null);
  const [latestPreOutput, setLatestPreOutput] = useState<string>("");
  const [latestModelResult, setLatestModelResult] = useState<Record<string, unknown> | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const previewRows = useMemo(() => rows.slice(0, 5), [rows]);

  const handleDrop = useCallback((acceptedFiles: File[]) => {
    setError("");
    setColumns([]);
    setRows([]);
    setTargetCol("");
    setUploadProgress(0);

    if (!acceptedFiles || acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setFiles([file]);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file.");
      return;
    }

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      worker: true,
      complete: (results: ParseResult<CsvRow>) => {
        clearInterval(progressInterval);
        setUploadProgress(100);
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
        clearInterval(progressInterval);
        setError(err.message || "Failed to parse CSV.");
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "text/csv": [".csv"] },
    onDrop: handleDrop,
    maxFiles: 1,
  });

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
    <div className="max-w-[1080px] mx-auto px-6 py-12 space-y-12">
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-4"
      >
        <h1 className="text-5xl font-bold tracking-tight">
          Train ML Models in{" "}
          <span className="gradient-text">Minutes</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Upload your dataset, select a target column, and let our AI agents train the perfect model for you.
        </p>
      </motion.div>

      {/* Upload Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-accent" />
              Upload Dataset
            </CardTitle>
              <CardDescription>
                Start by uploading your CSV file. We&apos;ll preview the data and help you select a target column.
              </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getRootProps()}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-12 transition-all duration-200 cursor-pointer",
                isDragActive ? "border-accent bg-accent/5 scale-[1.02]" : "border-border/40 hover:border-border/60 hover:bg-surface/50",
                files?.[0] && "border-accent/40 bg-accent/5"
              )}
            >
              <input {...getInputProps()} />
              <AnimatePresence mode="wait">
                {files?.[0] ? (
                  <motion.div
                    key="uploaded"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center text-center space-y-4"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", delay: 0.2 }}
                      className="w-16 h-16 rounded-full bg-accent/10 border-2 border-accent flex items-center justify-center"
                    >
                      <CheckCircle2 className="w-8 h-8 text-accent" />
                    </motion.div>
                    <div className="space-y-2">
                      <p className="font-semibold text-foreground text-lg">{files[0].name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(files[0].size / 1024).toFixed(1)} KB • {rows.length.toLocaleString()} rows • {columns.length} columns
                      </p>
                    </div>
                    {uploadProgress < 100 && (
                      <div className="w-full max-w-xs">
                        <Progress value={uploadProgress} className="mb-2" />
                        <p className="text-xs text-muted-foreground text-center">Processing...</p>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFiles(undefined);
                        setColumns([]);
                        setRows([]);
                        setTargetCol("");
                        setUploadProgress(0);
                      }}
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
                    className="flex flex-col items-center text-center space-y-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-surface border border-border/40 flex items-center justify-center">
                      <Database className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">
                        {isDragActive ? "Drop your file here" : "Drag & drop your CSV file"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse • Max 100MB
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-500">{error}</p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Preview & Target Selection */}
      {columns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-accent" />
                Select Target Column
              </CardTitle>
              <CardDescription>
                Choose the column you want to predict
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {columns.map((col) => (
                  <motion.button
                    key={col}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTargetCol(col)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      targetCol === col
                        ? "bg-accent/20 text-accent border-2 border-accent"
                        : "bg-surface border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/60"
                    )}
                  >
                    {targetCol === col && (
                      <span className="inline-block mr-2">🎯</span>
                    )}
                    {col}
                  </motion.button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-foreground" />
                Data Preview
              </CardTitle>
              <CardDescription>
                First {previewRows.length} rows of your dataset
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className={cn(
                            "px-4 py-3 text-left font-semibold transition-all",
                            col === targetCol
                              ? "bg-accent/10 text-accent"
                              : "text-foreground"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {col}
                            {col === targetCol && (
                              <Badge variant="default" className="text-xs">
                                Target
                              </Badge>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr
                        key={i}
                        className="border-t border-border/20 hover:bg-surface/50 transition-colors"
                      >
                        {columns.map((col) => (
                          <td
                            key={col}
                            className={cn(
                              "px-4 py-3",
                              col === targetCol
                                ? "font-medium text-accent"
                                : "text-muted-foreground"
                            )}
                          >
                            {String((row as CsvRow)[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Train Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              onClick={handleBeginTraining}
              disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
              size="lg"
              className="w-full group"
            >
              {submitStatus === "loading" || submitStatus === "processing" ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {submitStatus === "loading" ? "Submitting..." : "Training in progress..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Begin Training
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* Training Status */}
      {submitStatus !== "idle" && submitMessage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {submitStatus === "processing" && <Loader2 className="w-5 h-5 animate-spin text-blue-accent" />}
                {submitStatus === "success" && <CheckCircle2 className="w-5 h-5 text-accent" />}
                {submitStatus === "error" && <AlertCircle className="w-5 h-5 text-red-500" />}
                Training Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <p className={cn(
                  "text-sm font-medium",
                  submitStatus === "success" && "text-accent",
                  submitStatus === "error" && "text-red-500",
                  submitStatus === "processing" && "text-blue-accent"
                )}>
                  {submitMessage}
                </p>
                {jobId && (
                  <Badge variant="outline" className="text-xs">
                    Job ID: {jobId.slice(0, 8)}
                  </Badge>
                )}
              </div>

              {/* Live Updates */}
              {(latestPreOutput || latestModelResult) && (
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <h4 className="text-sm font-semibold text-foreground">Live Updates</h4>
                  {latestPreOutput && (
                    <div className="rounded-lg bg-surface border border-border/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Preprocessing Output</p>
                      <pre className="text-xs text-foreground overflow-auto max-h-40 font-mono">
                        {latestPreOutput}
                      </pre>
                    </div>
                  )}
                  {latestModelResult && (
                    <div className="rounded-lg bg-surface border border-border/40 p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Model Results</p>
                      <pre className="text-xs text-foreground overflow-auto max-h-40 font-mono">
                        {JSON.stringify(latestModelResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Results */}
      {trainingResults && submitStatus === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 border-2 border-accent mb-4"
            >
              <TrendingUp className="w-8 h-8 text-accent" />
            </motion.div>
            <h2 className="text-3xl font-bold">Your model&apos;s ready 🎉</h2>
            <p className="text-muted-foreground">View results and download artifacts below</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Training Output</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-surface border border-border/40 p-4">
                <pre className="text-sm text-foreground overflow-auto max-h-96 font-mono">
                  {trainingResults.orchestrator_output || "No detailed output available."}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Artifacts */}
          {artifacts && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="w-5 h-5 text-accent" />
                  Artifacts
                </CardTitle>
                <CardDescription>
                  Download your trained models and generated files
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={async () => {
                      const res = await fetch(`/api/job/${jobId}/artifacts`);
                      if (res.ok) setArtifacts(await res.json());
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                  {artifacts.latest_csv && (
                    <Button
                      asChild
                      variant="default"
                      size="sm"
                    >
                      <a href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}>
                        <Download className="w-4 h-4" />
                        Download CSV
                      </a>
                    </Button>
                  )}
                </div>

                {artifacts.files && artifacts.files.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {artifacts.files.map((filename) => (
                      <motion.div
                        key={filename}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.02 }}
                        className="rounded-lg border border-border/40 bg-surface p-4 space-y-3 group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-accent" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate" title={filename}>
                              {filename}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
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
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No artifacts available yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  );
}
