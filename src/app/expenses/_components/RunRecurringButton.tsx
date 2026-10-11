"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card, CaptionLabel } from "@/components/ui";
import { runRecurringNow } from "@/lib/expenses/actions";

type Msg =
  | { kind: "error"; text: string }
  | { kind: "none"; text: string }
  | { kind: "created"; text: string };

export function RunRecurringButton() {
  const router = useRouter();
  const t = useTranslations("expenses.recurring");
  const [msg, setMsg] = useState<Msg | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function handleClick() {
    setMsg(null);
    startTransition(async () => {
      const r = await runRecurringNow(idempotencyKey);
      if (!r.ok) {
        setMsg({ kind: "error", text: r.error });
      } else if (r.data.created === 0) {
        setMsg({ kind: "none", text: t("nothingDue") });
      } else {
        setMsg({
          kind: "created",
          text: t("createdMsg", { count: r.data.created }),
        });
      }
      setIdempotencyKey(crypto.randomUUID());
      router.refresh();
    });
  }

  return (
    <Card className="p-4">
      <CaptionLabel>{t("runTitle")}</CaptionLabel>
      <p className="mt-1 text-xs text-ink-2">{t("runHint")}</p>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-keycap text-sm font-bold text-ink shadow-keycap active:bg-none active:bg-well active:shadow-well disabled:opacity-60 sm:w-auto sm:px-6"
      >
        <Play className="h-4 w-4" strokeWidth={2.4} />
        {isPending ? t("running") : t("runNow")}
      </button>
      {msg &&
        (msg.kind === "error" ? (
          <div className="mt-2.5 rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
            {msg.text}
          </div>
        ) : msg.kind === "created" ? (
          <div className="mt-2.5 flex items-center gap-2 rounded-panel bg-success-wash px-3.5 py-2.5 text-sm font-semibold text-success">
            <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} />
            {msg.text}
          </div>
        ) : (
          <div className="mt-2.5 rounded-panel bg-ground px-3.5 py-2.5 text-[13px] text-ink-2">
            {msg.text}
          </div>
        ))}
    </Card>
  );
}
