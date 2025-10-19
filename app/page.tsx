"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Upload, 
  Table as TableIcon, 
  Target, 
  Zap, 
  CheckCircle2, 
  AlertCircle,
  Download,
  TrendingUp,
  BarChart3,
  Sparkles,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DataTable } from "@/components/data-table";
import { ResultsCharts } from "@/components/results-charts";
import { LoadingDots } from "@/components/loading-dots";
import { StatsCard } from "@/components/stats-card";

type CsvRow = Record<string, unknown>;

type Step = "upload" | "preview" | "target" | "train" | "results";

export default function Home() {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
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
  const [trainingProgress, setTrainingProgress] = useState(0);

  const previewRows = useMemo(() => rows.slice(0, 10), [rows]);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      handleFiles(selectedFiles);
    }
  }, []);

  const handleFiles = (fileList: File[]) => {
    setError("");
    setColumns([]);
    setRows([]);
    setTargetCol("");

    if (!fileList || fileList.length === 0) return;

    const file = fileList[0];
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
        setCurrentStep("preview");
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
        setTrainingProgress(100);
        setCurrentStep("results");
        try {
          const artRes = await fetch(`/api/job/${jobId}/artifacts`);
          if (artRes.ok) setArtifacts(await artRes.json());
        } catch {}
        return;
      } else if (jobData.status === "failed") {
        setSubmitStatus("error");
        setSubmitMessage(`Training failed: ${jobData.error || "Unknown error"}`);
        setTrainingProgress(0);
        return;
      } else if (jobData.status === "processing" || jobData.status === "preprocessing" || jobData.status === "training") {
        setSubmitMessage("ML agents are processing your data...");
        setTrainingProgress(60);
        if (jobData.latest_output) setLatestPreOutput(jobData.latest_output);
        if (jobData.latest_model_result) setLatestModelResult(jobData.latest_model_result);
        try {
          const artRes = await fetch(`/api/job/${jobId}/artifacts`);
          if (artRes.ok) setArtifacts(await artRes.json());
        } catch {}
        setTimeout(() => pollJobStatus(jobId), 5000);
      } else if (jobData.status === "daytona") {
        setSubmitMessage("Setting up cloud infrastructure...");
        setTrainingProgress(30);
        setTimeout(() => pollJobStatus(jobId), 3000);
      } else if (jobData.status === "queued") {
        setSubmitMessage("Job queued, waiting to start...");
        setTrainingProgress(10);
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
      setTrainingProgress(5);
      setCurrentStep("train");
      
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

  const steps = [
    { id: "upload", label: "Upload", icon: Upload },
    { id: "preview", label: "Preview", icon: TableIcon },
    { id: "target", label: "Target", icon: Target },
    { id: "train", label: "Train", icon: Zap },
    { id: "results", label: "Results", icon: BarChart3 },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 glass-effect">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">SproutML</h1>
                <p className="text-xs text-muted-foreground">AutoML Made Simple</p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Ready
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Progress Steps */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between relative">
            {/* Progress bar background */}
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-border -z-10" />
            <div 
              className="absolute top-5 left-0 h-0.5 bg-primary transition-all duration-500 ease-out -z-10"
              style={{ width: `${(stepIndex / (steps.length - 1)) * 100}%` }}
            />
            
            {steps.map((step, index) => {
              const isActive = index === stepIndex;
              const isCompleted = index < stepIndex;
              const Icon = step.icon;
              
              return (
                <div key={step.id} className="flex flex-col items-center gap-2 relative">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      backgroundColor: isCompleted || isActive ? "rgb(34, 197, 94)" : "rgb(26, 31, 46)",
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-colors ${
                      isCompleted || isActive 
                        ? "border-primary shadow-lg shadow-primary/20" 
                        : "border-border"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-primary-foreground" />
                    ) : (
                      <Icon className={`w-5 h-5 ${isActive ? "text-primary-foreground" : "text-muted-foreground"}`} />
                    )}
                  </motion.div>
                  <span className={`text-xs font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {currentStep === "upload" && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  <CardTitle>Upload Your Dataset</CardTitle>
                  <CardDescription>
                    Upload a CSV file to start training your model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-12 text-center transition-all cursor-pointer group hover:bg-card/50"
                  >
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                          <Upload className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <p className="text-lg font-medium">Drop your CSV file here</p>
                          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                        </div>
                        <Badge variant="secondary" className="mt-2">
                          Supports .csv files only
                        </Badge>
                      </div>
                    </label>
                  </div>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-sm text-destructive"
                    >
                      <AlertCircle className="w-4 h-4" />
                      {error}
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === "preview" && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dataset Preview</CardTitle>
                      <CardDescription className="mt-1.5">
                        {files?.[0]?.name} • {rows.length.toLocaleString()} rows • {columns.length} columns
                      </CardDescription>
                    </div>
                    <Badge variant="success" className="gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Loaded
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DataTable columns={columns} data={previewRows} />
                  <div className="flex justify-between items-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing first {previewRows.length} of {rows.length.toLocaleString()} rows
                    </p>
                    <Button onClick={() => setCurrentStep("target")} className="gap-2">
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === "target" && (
            <motion.div
              key="target"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="max-w-3xl mx-auto">
                <CardHeader>
                  <CardTitle>Select Target Column</CardTitle>
                  <CardDescription>
                    Choose the column you want to predict
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {columns.map((col) => (
                      <motion.button
                        key={col}
                        onClick={() => setTargetCol(col)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          targetCol === col
                            ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                            : "border-border hover:border-primary/50 bg-card"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{col}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {typeof rows[0]?.[col]} type
                            </p>
                          </div>
                          {targetCol === col && (
                            <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 ml-2" />
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <Button variant="outline" onClick={() => setCurrentStep("preview")}>
                      Back
                    </Button>
                    <Button 
                      onClick={handleBeginTraining} 
                      disabled={!targetCol}
                      className="gap-2"
                    >
                      <Zap className="w-4 h-4" />
                      Start Training
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === "train" && (
            <motion.div
              key="train"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="max-w-3xl mx-auto">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <LoadingDots />
                        <span className="ml-2">Training in Progress</span>
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        {submitMessage}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      Processing
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{trainingProgress}%</span>
                    </div>
                    <Progress value={trainingProgress} className="h-2" />
                  </div>

                  {jobId && (
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground mb-1">Job ID</p>
                      <code className="text-sm font-mono">{jobId}</code>
                    </div>
                  )}

                  {latestPreOutput && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Live Updates</h4>
                      <div className="p-4 rounded-lg bg-card border border-border max-h-64 overflow-auto">
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">
                          {latestPreOutput}
                        </pre>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {currentStep === "results" && trainingResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard 
                  title="Total Rows"
                  value={rows.length.toLocaleString()}
                  icon={TableIcon}
                  delay={0}
                />
                <StatsCard 
                  title="Features"
                  value={columns.length}
                  icon={Target}
                  delay={0.1}
                />
                <StatsCard 
                  title="Target Column"
                  value={targetCol}
                  icon={Zap}
                  delay={0.2}
                />
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-primary" />
                        Training Complete!
                      </CardTitle>
                      <CardDescription className="mt-1.5">
                        Your model has been trained successfully
                      </CardDescription>
                    </div>
                    <Badge variant="success" className="gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      Success
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-lg bg-card border border-border">
                    <h4 className="text-sm font-medium mb-3">Output Summary</h4>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                      {trainingResults.orchestrator_output || "No detailed output available."}
                    </pre>
                  </div>

                  {latestModelResult && (
                    <ResultsCharts data={latestModelResult} />
                  )}

                  {artifacts?.files && artifacts.files.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Downloadable Artifacts</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {artifacts.files.map((filename) => (
                          <div key={filename} className="p-4 rounded-lg bg-card border border-border flex items-center justify-between group hover:border-primary/50 transition-colors">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {filename.split('.').pop()?.toUpperCase()} file
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              asChild
                              className="ml-3"
                            >
                              <a href={`/api/job/${jobId}/download?file=${encodeURIComponent(filename)}`}>
                                <Download className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setCurrentStep("upload");
                        setFiles(undefined);
                        setColumns([]);
                        setRows([]);
                        setTargetCol("");
                        setTrainingResults(null);
                        setSubmitStatus("idle");
                        setJobId("");
                      }}
                      className="gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Train New Model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
