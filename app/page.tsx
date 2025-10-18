"use client";

import { useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Papa, { ParseResult } from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Sparkles, CheckCircle2, Loader2, TrendingUp, FileText, Download } from "lucide-react";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/20">
      <div className="max-w-[1080px] mx-auto px-6 py-12">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center justify-center mb-16 text-center"
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/50 rounded-full"
          >
            <Sparkles className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-green-700">Powered by AutoML</span>
          </motion.div>
          <h1 className="text-5xl font-bold bg-gradient-to-br from-slate-900 via-slate-800 to-green-800 bg-clip-text text-transparent mb-4">
            Welcome to SproutML 🌱
          </h1>
          <p className="text-lg text-[#7B8395] max-w-2xl leading-relaxed">
            Drop your dataset here — we&apos;ll handle the rest. Train production-ready models in minutes with intelligent automation.
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-12"
        >
          <Dropzone
            accept={{ "text/csv": [".csv"] }}
            onDrop={handleDrop}
            onError={(e) => setError(e.message)}
            src={files}
            maxFiles={1}
            className={`p-10 border-2 border-dashed transition-all duration-300 rounded-2xl backdrop-blur-sm ${
              files?.[0] 
                ? "border-green-400 bg-gradient-to-br from-green-50/80 to-emerald-50/60 hover:bg-green-50 shadow-lg shadow-green-100/50" 
                : "border-slate-200 hover:cursor-pointer hover:border-green-400 bg-white/60 hover:bg-gradient-to-br hover:from-green-50/40 hover:to-white hover:shadow-xl hover:shadow-green-100/20"
            }`}
          >
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
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
                  >
                    <CheckCircle2 className="w-8 h-8 text-white" />
                  </motion.div>
                  <div>
                    <p className="font-semibold text-green-900 text-lg">{files[0].name}</p>
                    <p className="text-sm text-green-600 mt-1">{(files[0].size / 1024).toFixed(1)} KB • Ready to train</p>
                  </div>
                  <motion.span 
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles(undefined);
                      setColumns([]);
                      setRows([]);
                      setTargetCol("");
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-sm text-green-700 hover:text-green-900 font-medium underline cursor-pointer inline-flex items-center gap-1"
                  >
                    Upload different file
                  </motion.span>
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
          <AnimatePresence>
            {error && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm text-red-600 mt-3 flex items-center gap-2" 
                role="alert"
              >
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full"></span>
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
        {/* Target column selector */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="mb-12"
            >
              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-8 border border-slate-200/60 shadow-lg shadow-slate-100/50">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-slate-900 block">Select Target Column</label>
                      <p className="text-xs text-[#7B8395] mt-0.5">Choose the column you want to predict</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {columns.map((c, index) => (
                      <motion.button
                        key={c}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setTargetCol(c)}
                        className={`flex items-center gap-2 px-4 py-2.5 hover:cursor-pointer rounded-xl text-sm font-medium transition-all duration-200 backdrop-blur-sm ${
                          targetCol === c
                            ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 border border-green-400"
                            : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-gradient-to-r hover:from-green-50 hover:to-emerald-50 hover:text-green-700 hover:border-green-300 hover:shadow-md"
                        }`}
                      >
                        {targetCol === c && (
                          <motion.div 
                            layoutId="targetIndicator"
                            className="w-2 h-2 bg-white rounded-full"
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          />
                        )}
                        <span>{c}</span>
                      </motion.button>
                    ))}
                  </div>
                  {targetCol && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-2 p-3 bg-green-50/50 border border-green-200/50 rounded-lg"
                    >
                      <p className="text-xs text-green-700 font-medium">
                        💡 Tip: We&apos;ll automatically analyze <span className="font-bold">{targetCol}</span> and select the best model for your prediction task.
                      </p>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview table */}
        <AnimatePresence>
          {previewRows.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="mb-12"
            >
              <div className="bg-white/70 backdrop-blur-md rounded-2xl p-6 border border-slate-200/60 shadow-lg shadow-slate-100/50 overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Data Preview</h3>
                    <p className="text-xs text-[#7B8395]">First {previewRows.length} rows of your dataset</p>
                  </div>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200/60 bg-white shadow-inner">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {columns.map((c) => (
                          <TableHead 
                            key={c}
                            className={`transition-all duration-300 ${
                              c === targetCol 
                                ? "bg-gradient-to-r from-green-100 to-emerald-100 font-bold text-green-900 border-l-4 border-green-500" 
                                : "bg-slate-50 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{c}</span>
                              {c === targetCol && (
                                <motion.span 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white px-2 py-1 rounded-full font-semibold shadow-sm"
                                >
                                  🎯 Target
                                </motion.span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="hover:bg-accent/5 border-b transition-all duration-200 even:bg-slate-50/40"
                        >
                          {columns.map((c) => (
                            <TableCell 
                              key={c}
                              className={`transition-all duration-300 ${
                                c === targetCol 
                                  ? "bg-green-50/50 font-semibold text-green-900 border-l-4 border-green-300" 
                                  : ""
                              }`}
                            >
                              {String((row as CsvRow)[c] ?? "")}
                            </TableCell>
                          ))}
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Begin training */}
        <AnimatePresence>
          {columns.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-12"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleBeginTraining}
                    disabled={!files?.[0] || !targetCol || submitStatus === "loading" || submitStatus === "processing"}
                    variant="success"
                    size="lg"
                    className="group relative overflow-hidden"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {submitStatus === "loading" || submitStatus === "processing" ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          {submitStatus === "loading" ? "Submitting..." : "Training in progress..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5" />
                          Begin Training
                        </>
                      )}
                    </span>
                  </Button>
                </motion.div>
                <AnimatePresence>
                  {submitStatus !== "idle" && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200/60 shadow-md"
                    >
                      {submitStatus === "processing" && (
                        <div className="relative">
                          <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                          <motion.div
                            className="absolute inset-0 w-5 h-5 border-2 border-blue-400 rounded-full"
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                          />
                        </div>
                      )}
                      {submitStatus === "success" && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 200 }}
                        >
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </motion.div>
                      )}
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${
                          submitStatus === "success"
                            ? "text-green-700"
                            : submitStatus === "error"
                            ? "text-red-600"
                            : submitStatus === "processing"
                            ? "text-blue-700"
                            : "text-slate-600"
                        }`}>
                          {submitMessage}
                        </span>
                        {jobId && (
                          <span className="text-xs text-[#7B8395] font-mono mt-0.5">
                            Job: {jobId.slice(0, 12)}...
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live updates */}
        <AnimatePresence>
          {(submitStatus === "processing" || latestPreOutput || latestModelResult) && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-12"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-blue-50/80 via-indigo-50/60 to-purple-50/80 backdrop-blur-md border border-blue-200/60 rounded-2xl p-8 shadow-xl shadow-blue-100/50">
                {/* Animated background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 opacity-20"></div>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div 
                      className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30"
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Sparkles className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-xl font-bold text-blue-900">Live Training Updates</h3>
                      <p className="text-sm text-blue-700">Real-time progress from your ML pipeline</p>
                    </div>
                  </div>
                  
                  {latestPreOutput && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mb-4"
                    >
                      <div className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-slate-200/60 shadow-md">
                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          Preprocessing Output
                        </h4>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg max-h-64 overflow-auto font-mono border border-slate-200">{latestPreOutput}</pre>
                      </div>
                    </motion.div>
                  )}
                  
                  {latestModelResult && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <div className="bg-white/80 backdrop-blur-sm p-5 rounded-xl border border-slate-200/60 shadow-md">
                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                          Latest Model Results
                        </h4>
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg max-h-64 overflow-auto font-mono border border-slate-200">{JSON.stringify(latestModelResult, null, 2)}</pre>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Training Results */}
        <AnimatePresence>
          {trainingResults && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-green-50/80 via-emerald-50/60 to-teal-50/80 backdrop-blur-md border border-green-200/60 rounded-2xl p-8 shadow-2xl shadow-green-100/50">
                {/* Celebratory confetti effect */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, 0] }}
                  transition={{ duration: 2, times: [0, 0.5, 1] }}
                  className="absolute inset-0 pointer-events-none"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-teal-400/20"></div>
                </motion.div>
                
                <div className="relative z-10">
                  <motion.div 
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    className="flex items-center gap-4 mb-6"
                  >
                    <motion.div 
                      className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-xl shadow-green-500/30"
                      animate={{ rotate: [0, -10, 10, -10, 0] }}
                      transition={{ duration: 0.5, times: [0, 0.25, 0.5, 0.75, 1] }}
                    >
                      <CheckCircle2 className="w-8 h-8 text-white" />
                    </motion.div>
                    <div>
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-green-700 to-emerald-700 bg-clip-text text-transparent">
                        Your model&apos;s ready! 🎉
                      </h3>
                      <p className="text-sm text-green-700 mt-1">Training completed successfully — accuracy and artifacts below</p>
                    </div>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-slate-200/60 shadow-lg"
                  >
                    <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-lg">
                      <TrendingUp className="w-5 h-5 text-green-600" />
                      Model Performance Summary
                    </h4>
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-5 rounded-lg font-mono border border-slate-200 leading-relaxed">
                      {trainingResults.orchestrator_output || "No detailed output available."}
                    </pre>
                  </motion.div>
                  
                  {jobId && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 bg-white/80 backdrop-blur-sm p-6 rounded-xl border border-slate-200/60 shadow-lg"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-1 flex items-center gap-2 text-lg">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Training Artifacts
                          </h4>
                          <div className="text-sm text-[#7B8395]">
                            Latest dataset: <span className="font-mono text-xs text-slate-700">{artifacts?.latest_csv || "N/A"}</span>
                          </div>
                        </div>
                        {artifacts?.model_files_ready && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200 }}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg shadow-lg shadow-purple-500/30 text-sm font-semibold"
                          >
                            🤖 {artifacts.model_files?.length || 0} Model(s) Ready
                          </motion.div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mb-6">
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            onClick={async () => {
                              const res = await fetch(`/api/job/${jobId}/artifacts`);
                              if (res.ok) setArtifacts(await res.json());
                            }}
                            variant="outline"
                            size="sm"
                            className="font-medium"
                          >
                            <Loader2 className="w-4 h-4 mr-2" />
                            Refresh Artifacts
                          </Button>
                        </motion.div>
                        {artifacts?.latest_csv && (
                          <motion.a
                            href={`/api/job/${jobId}/download?file=${encodeURIComponent(artifacts.latest_csv)}`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 transition-all"
                          >
                            <Download className="w-4 h-4" />
                            Download Latest CSV
                          </motion.a>
                        )}
                      </div>
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl p-4 max-h-96 overflow-auto">
                        {!artifacts?.files?.length ? (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12"
                          >
                            <motion.div 
                              animate={{ y: [0, -10, 0] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-slate-200 to-slate-300 rounded-2xl flex items-center justify-center shadow-lg"
                            >
                              <FileText className="w-10 h-10 text-slate-400" />
                            </motion.div>
                            <p className="text-sm text-slate-500 font-medium">No files available yet</p>
                            <p className="text-xs text-slate-400 mt-1">Artifacts will appear here after training</p>
                          </motion.div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {artifacts.files.map((filename, index) => {
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
                                <motion.div 
                                  key={filename}
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: index * 0.05 }}
                                  whileHover={{ y: -4, scale: 1.02 }}
                                  className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-xl hover:border-green-300 transition-all duration-200 group"
                                >
                                  <div className="flex items-start gap-3 mb-3">
                                    {getFileIcon(filename)}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 truncate mb-1" title={filename}>
                                        {filename}
                                      </p>
                                      <p className="text-xs text-[#7B8395] font-medium">
                                        {filename.split('.').pop()?.toUpperCase()} file
                                      </p>
                                    </div>
                                  </div>
                                  <motion.a
                                    href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-500 hover:to-emerald-600 text-green-700 hover:text-white text-xs font-semibold rounded-lg transition-all duration-200 border border-green-200 hover:border-green-400 shadow-sm hover:shadow-md"
                                    title={`Download ${filename}`}
                                  >
                                    <Download className="w-4 h-4" />
                                    Download
                                  </motion.a>
                                </motion.div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
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
