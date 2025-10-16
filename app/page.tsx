"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, CheckCircle2, Sparkles, Download, RefreshCw, Target, TrendingUp, FileText, Image as ImageIcon, Code, Package } from "lucide-react";
import { Dropzone } from "@/components/ui/shadcn-io/dropzone";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        setSubmitMessage("Your model's ready 🎉");
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

  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    const iconClass = "w-5 h-5";
    
    switch (ext) {
      case 'csv':
        return <FileText className={iconClass} />;
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <ImageIcon className={iconClass} />;
      case 'py':
      case 'json':
        return <Code className={iconClass} />;
      case 'pkl':
        return <Package className={iconClass} />;
      default:
        return <FileText className={iconClass} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50/30 to-emerald-50/40">
      {/* Header */}
      <header className="border-b border-slate-200/60 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-3xl"
            >
              🌱
            </motion.div>
            <h1 className="text-xl font-semibold text-slate-900">SproutML</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">
            Drop your dataset here —
            <br />
            <span className="text-[#22C55E]">we&apos;ll handle the rest</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Transform your data into insights with our thoughtful, human-crafted ML platform
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-12"
        >
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-12 border-2 border-dashed transition-all duration-300 rounded-2xl ${
              files?.[0]
                ? "border-[#22C55E] bg-[#E8F8ED] hover:bg-[#E8F8ED]/80 shadow-lg shadow-green-100/50"
                : "border-slate-300 hover:border-[#22C55E] bg-white hover:bg-green-50/30 shadow-sm"
            }`}
          >
            <AnimatePresence mode="wait">
              {files?.[0] ? (
                <motion.div
                  key="uploaded"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center text-center space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 bg-[#22C55E] rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30"
                  >
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-slate-900 text-lg">{files[0].name}</p>
                    <p className="text-sm text-slate-600 mt-1">
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
                    className="text-sm text-[#22C55E] hover:text-[#16A34A] underline font-medium transition-colors"
                  >
                    Upload different file
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Upload className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-lg mb-1">Drop your CSV file here</p>
                    <p className="text-sm text-slate-500">or click to browse</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </Dropzone>
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-sm text-red-600 mt-3 text-center"
                role="alert"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Target Column Selection */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-12"
            >
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60">
                <div className="flex items-center gap-2 mb-6">
                  <Target className="w-5 h-5 text-[#22C55E]" />
                  <h3 className="text-lg font-semibold text-slate-900">Choose your target column</h3>
                </div>
                <p className="text-sm text-slate-600 mb-4">Select the column you want to predict</p>
                <div className="flex flex-wrap gap-3">
                  {columns.map((c) => (
                    <motion.button
                      key={c}
                      onClick={() => setTargetCol(c)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        targetCol === c
                          ? "bg-[#22C55E] text-white shadow-lg shadow-green-500/30"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                      }`}
                    >
                      {c}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview Table */}
        <AnimatePresence>
          {previewRows.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-12"
            >
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 overflow-hidden">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">Dataset Preview</h3>
                <div className="overflow-x-auto -mx-8 px-8">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((c) => (
                          <TableHead
                            key={c}
                            className={`transition-all duration-200 font-semibold ${
                              c === targetCol
                                ? "bg-[#E8F8ED] text-[#16A34A]"
                                : "text-slate-700"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {c}
                              {c === targetCol && (
                                <span className="text-xs bg-[#22C55E] text-white px-2 py-0.5 rounded-full">
                                  Target
                                </span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i} className="hover:bg-slate-50/50">
                          {columns.map((c) => (
                            <TableCell
                              key={c}
                              className={`${
                                c === targetCol
                                  ? "bg-[#E8F8ED]/30 font-medium text-slate-900"
                                  : "text-slate-700"
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
                <p className="text-center text-slate-500 mt-6 text-sm">
                  Showing first {previewRows.length} of {rows.length} rows
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Button */}
        <AnimatePresence>
          {files?.[0] && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="mb-12"
            >
              <div className="flex items-center gap-4">
                <motion.button
                  onClick={handleBeginTraining}
                  disabled={!targetCol || submitStatus === "loading" || submitStatus === "processing"}
                  whileHover={{ scale: targetCol ? 1.02 : 1 }}
                  whileTap={{ scale: targetCol ? 0.98 : 1 }}
                  className={`px-8 py-4 rounded-xl font-semibold text-white transition-all duration-200 flex items-center gap-2 ${
                    !targetCol || submitStatus === "loading" || submitStatus === "processing"
                      ? "bg-slate-300 cursor-not-allowed"
                      : "bg-[#22C55E] hover:bg-[#16A34A] shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40"
                  }`}
                >
                  {submitStatus === "loading" || submitStatus === "processing" ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshCw className="w-5 h-5" />
                      </motion.div>
                      Training...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Begin Training
                    </>
                  )}
                </motion.button>
                
                {submitMessage && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <span className={`text-sm font-medium ${
                      submitStatus === "success" ? "text-[#22C55E]" :
                      submitStatus === "error" ? "text-red-600" :
                      submitStatus === "processing" ? "text-blue-600" :
                      "text-slate-600"
                    }`}>
                      {submitMessage}
                    </span>
                    {jobId && (
                      <span className="text-xs text-slate-400">
                        Job: {jobId.slice(0, 8)}...
                      </span>
                    )}
                  </motion.div>
                )}
              </div>
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
              className="mb-12"
            >
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-200/50 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-5 h-5 text-blue-600" />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-blue-900">Live Updates</h3>
                </div>
                
                {latestPreOutput && (
                  <div className="bg-white rounded-xl p-6 mb-4 border border-blue-100">
                    <h4 className="font-medium text-slate-900 mb-3 text-sm">Preprocessing Output</h4>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg max-h-64 overflow-auto font-mono">
                      {latestPreOutput}
                    </pre>
                  </div>
                )}
                
                {latestModelResult && (
                  <div className="bg-white rounded-xl p-6 border border-blue-100">
                    <h4 className="font-medium text-slate-900 mb-3 text-sm">Latest Model Result</h4>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg max-h-64 overflow-auto font-mono">
                      {JSON.stringify(latestModelResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
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
              className="mb-12"
            >
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border border-green-200/50 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    <TrendingUp className="w-6 h-6 text-[#22C55E]" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-green-900">Training Complete! 🎉</h3>
                </div>
                
                <div className="bg-white rounded-xl p-6 border border-green-100">
                  <h4 className="font-semibold text-slate-900 mb-4">Model Results</h4>
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg font-mono max-h-96 overflow-auto">
                    {trainingResults.orchestrator_output || "No detailed output available."}
                  </pre>
                </div>

                {/* Artifacts */}
                {jobId && (
                  <div className="mt-6 bg-white rounded-xl p-6 border border-green-100">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-[#22C55E]" />
                        Artifacts
                      </h4>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          const res = await fetch(`/api/job/${jobId}/artifacts`);
                          if (res.ok) setArtifacts(await res.json());
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </motion.button>
                    </div>

                    {artifacts?.model_files_ready && (
                      <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <p className="text-sm font-medium text-purple-900">
                          🤖 {artifacts.model_files?.length || 0} trained model(s) ready for download
                        </p>
                      </div>
                    )}

                    {!artifacts?.files?.length ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-2xl flex items-center justify-center">
                          <FileText className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500">No artifacts available yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {artifacts.files.map((filename) => {
                          const ext = filename.split('.').pop()?.toUpperCase() || 'FILE';
                          const isModel = filename.includes('.pkl') || filename.includes('model');
                          
                          return (
                            <motion.div
                              key={filename}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ y: -4 }}
                              className="bg-slate-50 rounded-xl p-5 border border-slate-200 hover:border-[#22C55E] hover:shadow-lg transition-all group"
                            >
                              <div className="flex items-start gap-3 mb-4">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                                  isModel ? 'bg-purple-100 text-purple-600' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {getFileIcon(filename)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate" title={filename}>
                                    {filename}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-0.5">{ext} file</p>
                                </div>
                              </div>
                              <a
                                href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                                className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-white hover:bg-[#22C55E] text-slate-700 hover:text-white rounded-lg text-sm font-medium transition-colors group-hover:shadow-md"
                              >
                                <Download className="w-4 h-4" />
                                Download
                              </a>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/60 bg-white/80 backdrop-blur-xl mt-24">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-center text-sm text-slate-500">
            Built with care by the SproutML team 🌱
          </p>
        </div>
      </footer>
    </div>
  );
}
