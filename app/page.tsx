"use client";

import { useMemo, useState, useCallback } from "react";
import Papa, { ParseResult } from "papaparse";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/ui/shadcn-io/dropzone";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type CsvRow = Record<string, unknown>;

export default function Home() {
  const [files, setFiles] = useState<File[] | undefined>();
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [targetCol, setTargetCol] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

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
      error: (err: Error, _file: unknown) => {
        setError(err.message || "Failed to parse CSV.");
      },
    });
  };

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
      setSubmitMessage("");
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
      setSubmitStatus("success");
      setSubmitMessage("Training started successfully.");
    } catch (e) {
      const err = e as Error;
      setSubmitStatus("error");
      setSubmitMessage(err.message || "Unexpected error starting training.");
    }
  }, [files, targetCol]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex flex-col items-center justify-center">
        <h1 className="text-4xl font-bold">Welcome to SproutML 🌱</h1>
        <p className="text-lg text-muted-foreground mt-1">Upload your dataset to get started.</p>
      </div>

      <div className="mt-6">
        <Dropzone
          accept={{ "text/csv": [".csv"] }}
          onDrop={handleDrop}
          onError={(e) => setError(e.message)}
          src={files}
          maxFiles={1}
          className="p-6"
        >
          <DropzoneEmptyState />
          <DropzoneContent />
        </Dropzone>
        {error && (
          <p className="text-sm text-red-600 mt-2" role="alert">{error}</p>
        )}
      </div>

      {columns.length > 0 && (
        <div className="mt-8">
          <label className="font-medium mr-3">Target column:</label>
          <select
            className="border rounded-md px-3 py-2 text-sm"
            value={targetCol}
            onChange={(e) => setTargetCol(e.target.value)}
          >
            <option value="" disabled>
              Select a column
            </option>
            {columns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {previewRows.length > 0 && (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c}>{String((row as CsvRow)[c] ?? "")}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
            <TableCaption>Showing first {previewRows.length} rows</TableCaption>
          </Table>
        </div>
      )}

      <div className="mt-8 flex items-center gap-3">
        <Button
          onClick={handleBeginTraining}
          disabled={!files?.[0] || !targetCol || submitStatus === "loading"}
          className="bg-green-600"
        >
          {submitStatus === "loading" ? "Starting…" : "Begin training"}
        </Button>
        {submitStatus !== "idle" && (
          <span className={
            submitStatus === "success"
              ? "text-green-600 text-sm"
              : submitStatus === "error"
              ? "text-red-600 text-sm"
              : "text-muted-foreground text-sm"
          }>
            {submitMessage}
          </span>
        )}
      </div>
    </div>
  );
}
