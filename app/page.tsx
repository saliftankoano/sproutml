"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Target, Play, CheckCircle2, AlertCircle, Loader2, Download, FileText, Sparkles } from "lucide-react";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Button } from "@/components/ui/button";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";

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

  // TanStack Table setup
  const columnHelper = createColumnHelper<CsvRow>();
  const tableColumns = useMemo(() => {
    return columns.map((col) =>
      columnHelper.accessor(col, {
        header: col,
        cell: (info) => String(info.getValue() ?? ""),
      })
    );
  }, [columns, columnHelper]);

  const table = useReactTable({
    data: previewRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50"
      >
        <div className="max-w-[1080px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22C55E] to-[#16A34A] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">SproutML</h1>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-[1080px] mx-auto px-6 py-16">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Train ML Models in Minutes
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your dataset, select a target column, and let our platform handle the rest.
            No code required.
          </p>
        </motion.div>

        {/* Step 1: Upload Dataset */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground">Upload Dataset</h3>
              <p className="text-sm text-muted-foreground">Start by uploading your CSV file</p>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.005 }}
            transition={{ duration: 0.2 }}
          >
            <Dropzone
              accept={{ "text/csv": [".csv"] }}
              onDrop={handleDrop}
              onError={(e) => setError(e.message)}
              src={files}
              maxFiles={1}
              className={`relative overflow-hidden transition-all duration-300 rounded-xl border ${
                files?.[0]
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/30 bg-card/50"
              }`}
            >
              {files?.[0] ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center space-y-4 p-8"
                >
                  <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-background" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{files[0].name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {(files[0].size / 1024).toFixed(1)} KB • {rows.length} rows
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
                    className="text-sm text-primary hover:text-primary/80 underline underline-offset-4 transition-colors"
                  >
                    Upload different file
                  </button>
                </motion.div>
              ) : (
                <>
                  <DropzoneEmptyState />
                  <DropzoneContent />
                </>
              )}
            </Dropzone>
          </motion.div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>

        {/* Step 2: Preview & Select Target */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Select Target Column</h3>
                  <p className="text-sm text-muted-foreground">Choose the column you want to predict</p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border border-border mb-6">
                <p className="text-sm text-muted-foreground mb-4">Available columns:</p>
                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <motion.button
                      key={col}
                      onClick={() => setTargetCol(col)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                        targetCol === col
                          ? "bg-primary text-background shadow-lg shadow-primary/25"
                          : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                      }`}
                    >
                      {col}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Data Preview */}
              {previewRows.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-border overflow-hidden bg-card/30"
                >
                  <div className="p-4 border-b border-border bg-card/50">
                    <h4 className="text-sm font-medium text-foreground">Data Preview</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Showing first {previewRows.length} of {rows.length} rows
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id} className="border-b border-border bg-secondary/30">
                            {headerGroup.headers.map((header) => (
                              <th
                                key={header.id}
                                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider transition-colors ${
                                  header.column.id === targetCol
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {header.column.id === targetCol && (
                                    <span className="px-2 py-0.5 rounded-full bg-primary text-background text-[10px] font-bold">
                                      TARGET
                                    </span>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody>
                        {table.getRowModel().rows.map((row, idx) => (
                          <motion.tr
                            key={row.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="border-b border-border/50 hover:bg-secondary/20 transition-colors"
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className={`px-4 py-3 text-sm ${
                                  cell.column.id === targetCol
                                    ? "font-medium text-primary bg-primary/5"
                                    : "text-foreground"
                                }`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </motion.section>
          )}
        </AnimatePresence>

        {/* Step 3: Train Model */}
        <AnimatePresence>
          {files?.[0] && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Play className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Train Model</h3>
                  <p className="text-sm text-muted-foreground">Start the training process</p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border border-border">
                <Button
                  onClick={handleBeginTraining}
                  disabled={!targetCol || submitStatus === "loading" || submitStatus === "processing"}
                  className={`w-full h-12 text-base font-medium rounded-lg transition-all duration-200 ${
                    !targetCol || submitStatus === "loading" || submitStatus === "processing"
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : "bg-primary text-background hover:bg-primary/90 shadow-lg shadow-primary/25"
                  }`}
                >
                  {submitStatus === "loading" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Submitting...
                    </span>
                  ) : submitStatus === "processing" ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Training in Progress...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Play className="w-5 h-5" />
                      Begin Training
                    </span>
                  )}
                </Button>

                <AnimatePresence>
                  {submitStatus !== "idle" && submitMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-4 rounded-lg bg-secondary/50 border border-border"
                    >
                      <div className="flex items-start gap-3">
                        {submitStatus === "processing" && (
                          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0 mt-0.5" />
                        )}
                        {submitStatus === "success" && (
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        )}
                        {submitStatus === "error" && (
                          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className={`text-sm ${
                            submitStatus === "success" ? "text-primary" :
                            submitStatus === "error" ? "text-destructive" :
                            "text-foreground"
                          }`}>
                            {submitMessage}
                          </p>
                          {jobId && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Job ID: {jobId.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Live Updates */}
        <AnimatePresence>
          {(submitStatus === "processing" && (latestPreOutput || latestModelResult)) && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="mb-12"
            >
              <div className="rounded-xl border border-border overflow-hidden bg-card/30">
                <div className="p-4 border-b border-border bg-card/50">
                  <h4 className="text-sm font-medium text-foreground">Live Updates</h4>
                  <p className="text-xs text-muted-foreground mt-1">Real-time training progress</p>
                </div>
                <div className="p-6 space-y-4">
                  {latestPreOutput && (
                    <div>
                      <h5 className="text-sm font-medium text-foreground mb-2">Preprocessing Output</h5>
                      <pre className="text-xs text-muted-foreground bg-secondary/50 p-4 rounded-lg overflow-auto max-h-64 font-mono">
                        {latestPreOutput}
                      </pre>
                    </div>
                  )}
                  {latestModelResult && (
                    <div>
                      <h5 className="text-sm font-medium text-foreground mb-2">Latest Model Result</h5>
                      <pre className="text-xs text-muted-foreground bg-secondary/50 p-4 rounded-lg overflow-auto max-h-64 font-mono">
                        {JSON.stringify(latestModelResult, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Training Results */}
        <AnimatePresence>
          {trainingResults && submitStatus === "success" && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <div className="rounded-xl border border-primary/30 overflow-hidden bg-gradient-to-br from-primary/5 to-transparent">
                <div className="p-6 border-b border-primary/20 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                    <div>
                      <h4 className="text-lg font-semibold text-foreground">Training Complete</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">Your models are ready</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Orchestrator Output */}
                  <div>
                    <h5 className="text-sm font-medium text-foreground mb-3">Training Summary</h5>
                    <pre className="text-xs text-muted-foreground bg-secondary/50 p-4 rounded-lg overflow-auto max-h-64 font-mono border border-border">
                      {trainingResults.orchestrator_output || "No detailed output available."}
                    </pre>
                  </div>

                  {/* Artifacts */}
                  {jobId && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-sm font-medium text-foreground">Artifacts & Downloads</h5>
                        <Button
                          onClick={async () => {
                            const res = await fetch(`/api/job/${jobId}/artifacts`);
                            if (res.ok) setArtifacts(await res.json());
                          }}
                          className="h-8 px-3 text-xs bg-secondary hover:bg-secondary/80 text-foreground rounded-lg"
                        >
                          Refresh
                        </Button>
                      </div>

                      {artifacts?.model_files_ready && (
                        <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm text-primary font-medium">
                            🤖 {artifacts.model_files?.length || 0} trained model(s) ready for download
                          </p>
                        </div>
                      )}

                      {!artifacts?.files?.length ? (
                        <div className="text-center py-12 rounded-lg bg-secondary/30 border border-border">
                          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                          <p className="text-sm text-muted-foreground">No files available yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {artifacts.files.map((filename) => (
                            <motion.div
                              key={filename}
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.02 }}
                              className="p-4 rounded-lg bg-card border border-border hover:border-primary/30 transition-all group"
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate" title={filename}>
                                    {filename}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {filename.split('.').pop()?.toUpperCase()} file
                                  </p>
                                </div>
                              </div>
                              <a
                                href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                                className="flex items-center justify-center gap-2 w-full h-9 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </a>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="border-t border-border/50 mt-24"
      >
        <div className="max-w-[1080px] mx-auto px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            Built with Next.js, TailwindCSS, and Framer Motion
          </p>
        </div>
      </motion.footer>
    </div>
  );
}
