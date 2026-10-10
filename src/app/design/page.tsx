import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ClipboardCheck,
  Clock,
  Package,
  Wallet,
  X,
} from "lucide-react";
import { requireOwner } from "@/lib/auth-guards";
import {
  CaptionLabel,
  Card,
  Keycap,
  KeycapTile,
  MoneyField,
  StatusPill,
} from "@/components/ui";
import {
  BottomSheetDemo,
  FilterChipsDemo,
  StepperDemo,
} from "./_components/InteractiveDemos";

/**
 * Internal living styleguide for the register redesign. Not linked
 * from any owner workflow (and deliberately not in the guided tour)
 * — it exists so every primitive can be eyeballed on a phone before
 * it reaches a real screen. See docs/design-handout.md.
 */
export default async function DesignPage() {
  await requireOwner();

  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4 pb-16">
      <header className="flex items-end justify-between">
        <div>
          <CaptionLabel>BMSys · Design</CaptionLabel>
          <h1 className="mt-0.5 text-2xl font-bold text-ink">
            Register primitives
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-primary"
        >
          Dashboard →
        </Link>
      </header>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Status pills — color + icon + word</CaptionLabel>
        <div className="flex flex-wrap gap-2">
          <StatusPill
            tone="success"
            icon={<Check className="h-3 w-3" strokeWidth={3} />}
          >
            In stock
          </StatusPill>
          <StatusPill
            tone="warning"
            icon={<Clock className="h-3 w-3" strokeWidth={2.6} />}
          >
            3 days left
          </StatusPill>
          <StatusPill
            tone="error"
            icon={<X className="h-3 w-3" strokeWidth={3} />}
          >
            Out of stock
          </StatusPill>
          <StatusPill
            tone="info"
            icon={<Clock className="h-3 w-3" strokeWidth={2.6} />}
          >
            Till open
          </StatusPill>
          <StatusPill
            tone="warning"
            icon={<AlertTriangle className="h-3 w-3" strokeWidth={2.6} />}
          >
            Reorder now
          </StatusPill>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Keycaps — raised, hold to feel the press</CaptionLabel>
        <div className="flex flex-wrap items-end gap-5">
          <Keycap size="sm" aria-label="Stock sample">
            <Package className="h-5 w-5" strokeWidth={2} />
          </Keycap>
          <Keycap label="Money" aria-label="Money sample">
            <Wallet className="h-[22px] w-[22px]" strokeWidth={2} />
          </Keycap>
          <Keycap pressed label="Money" aria-label="Money selected sample">
            <Wallet className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </Keycap>
          <Keycap size="lg" label="Reports" aria-label="Reports sample">
            <BarChart3 className="h-[22px] w-[22px]" strokeWidth={2} />
          </Keycap>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Matrix tiles</CaptionLabel>
        <div className="grid grid-cols-3 gap-2.5">
          <KeycapTile label="Receive">
            <Package className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile label="Count">
            <ClipboardCheck className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
          <KeycapTile label="Till">
            <Wallet className="h-6 w-6" strokeWidth={2} />
          </KeycapTile>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Money field</CaptionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="You buy a carton at" defaultValue={2800} />
          <MoneyField label="Sell a single at" defaultValue={4000} />
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Stepper</CaptionLabel>
        <StepperDemo />
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Filter chips</CaptionLabel>
        <FilterChipsDemo />
      </Card>

      <Card className="space-y-3 p-4">
        <CaptionLabel>Bottom sheet + FAB button</CaptionLabel>
        <BottomSheetDemo />
      </Card>
    </main>
  );
}
