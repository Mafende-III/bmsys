"use client";

import { Download } from "lucide-react";

/**
 * Downloads a pre-built CSV string. The CSV is assembled server-side
 * (same data as the rendered table) so what the accountant opens in
 * Excel always matches what's on screen. UTF-8 BOM so Excel detects
 * the encoding.
 */
export function CsvButton({
  csv,
  filename,
  label,
}: {
  csv: string;
  filename: string;
  label: string;
}) {
  function download() {
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 text-xs font-bold text-primary ring-1 ring-inset ring-rule"
    >
      <Download className="h-3.5 w-3.5" strokeWidth={2.2} />
      {label}
    </button>
  );
}
