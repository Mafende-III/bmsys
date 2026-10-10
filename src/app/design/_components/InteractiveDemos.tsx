"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import {
  BottomSheet,
  CaptionLabel,
  FilterChips,
  MoneyField,
  Stepper,
} from "@/components/ui";

export function StepperDemo() {
  const [md, setMd] = useState(12);
  const [lg, setLg] = useState(2);
  return (
    <div className="space-y-4">
      <Stepper value={md} onChange={setMd} min={1} />
      <Stepper value={lg} onChange={setLg} min={1} size="lg" />
    </div>
  );
}

export function FilterChipsDemo() {
  const [value, setValue] = useState<"all" | "low" | "out">("all");
  return (
    <FilterChips
      value={value}
      onChange={setValue}
      options={[
        { value: "all", label: "All" },
        { value: "low", label: "Low", count: 1, tone: "warning" },
        { value: "out", label: "Out", count: 1, tone: "error" },
      ]}
    />
  );
}

export function BottomSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 items-center gap-2 rounded-full bg-fab px-5 text-sm font-bold text-white shadow-fab active:translate-y-[2px]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        New product
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="New product"
        headerExtra={
          <span className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="h-2 w-2 rounded-full bg-rule-hair" />
            <span className="h-2 w-2 rounded-full bg-rule-hair" />
          </span>
        }
      >
        <div className="space-y-4">
          <div>
            <CaptionLabel className="mb-1.5">Name</CaptionLabel>
            <input
              defaultValue="AMATA 500ML"
              className="block h-12 w-full rounded-sheet border border-rule bg-surface px-3.5 text-base font-semibold text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active"
            />
          </div>
          <MoneyField label="You buy a carton at" defaultValue={3600} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-12 w-full rounded-full bg-fab text-base font-bold text-white shadow-fab active:translate-y-[2px]"
          >
            Next
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
