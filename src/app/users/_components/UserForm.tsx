"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { CaptionLabel } from "@/components/ui";
import { cn } from "@/lib/cn";
import { createUser, updateUser } from "@/lib/users/actions";

type ChannelOption = { id: string; name: string; slug: string };

type EditUser = {
  id: string;
  name: string;
  phone: string;
  role: "OWNER" | "SELLER";
  active: boolean;
  allowedChannelIds: string[];
};

type Mode =
  | { kind: "create" }
  | { kind: "edit"; user: EditUser };

const FIELD =
  "mt-1.5 block h-11 w-full rounded-panel border border-rule bg-surface px-3 text-sm text-ink focus:border-rule-active focus:outline-none focus:ring-1 focus:ring-rule-active";

export function UserForm({
  mode,
  channels,
}: {
  mode: Mode;
  channels: ChannelOption[];
}) {
  const router = useRouter();
  const t = useTranslations("users");
  const tf = useTranslations("users.form");
  const tc = useTranslations("common");

  const initial =
    mode.kind === "edit"
      ? mode.user
      : {
          name: "",
          phone: "+250",
          role: "SELLER" as const,
          active: true,
          allowedChannelIds: [] as string[],
        };

  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [pin, setPin] = useState("");
  const [resetPin, setResetPin] = useState(false);
  const [role, setRole] = useState<"OWNER" | "SELLER">(initial.role);
  const [active, setActive] = useState(initial.active);
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(
    () => new Set(initial.allowedChannelIds),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );

  function toggleChannel(id: string) {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    setError(null);

    const allowedChannelIds = Array.from(selectedChannels);

    const data: Record<string, unknown> = {
      name,
      role,
      allowedChannelIds,
    };
    if (mode.kind === "create") {
      data.phone = phone;
      data.pin = pin;
    } else {
      data.active = active;
      if (resetPin && pin) data.resetPin = pin;
    }

    startTransition(async () => {
      const result =
        mode.kind === "create"
          ? await createUser(idempotencyKey, data)
          : await updateUser(idempotencyKey, mode.user.id, data);

      if (!result.ok) {
        setError(result.error);
        setIdempotencyKey(crypto.randomUUID());
        return;
      }

      if (mode.kind === "create") {
        router.push(`/users/${result.data.id}`);
      } else {
        setPin("");
        setResetPin(false);
        router.refresh();
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      {error && (
        <div className="rounded-panel bg-error-wash px-3.5 py-2.5 text-sm font-semibold text-error">
          {error}
        </div>
      )}

      <label className="block">
        <CaptionLabel>{tf("name")}</CaptionLabel>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={FIELD}
        />
      </label>

      <label className="block">
        <CaptionLabel>{tf("phone")}</CaptionLabel>
        {mode.kind === "edit" ? (
          <input
            value={mode.user.phone}
            disabled
            className={cn(FIELD, "num bg-ground text-ink-2")}
          />
        ) : (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="+250788000000"
            className={cn(FIELD, "num")}
          />
        )}
        <span className="mt-1 block text-xs text-ink-2">
          {tf("phoneHint")}
        </span>
      </label>

      {mode.kind === "create" ? (
        <label className="block">
          <CaptionLabel>{tf("pinLabel")}</CaptionLabel>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            className={cn(FIELD, "num")}
          />
          <span className="mt-1 block text-xs text-ink-2">
            {tf("pinHint")}
          </span>
        </label>
      ) : (
        <fieldset className="rounded-panel bg-ground px-3.5 py-3">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              checked={resetPin}
              onChange={(e) => setResetPin(e.target.checked)}
              className="h-4 w-4 rounded border-rule"
            />
            {tf("resetPin")}
          </label>
          {resetPin && (
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={tf("resetPinPlaceholder")}
              className={cn(FIELD, "num mt-2")}
            />
          )}
        </fieldset>
      )}

      <label className="block">
        <CaptionLabel>{tf("role")}</CaptionLabel>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "OWNER" | "SELLER")}
          className={FIELD}
        >
          <option value="SELLER">{t("roleSeller")}</option>
          <option value="OWNER">{t("roleOwner")}</option>
        </select>
        <span className="mt-1 block text-xs text-ink-2">
          {tf("roleHint")}
        </span>
      </label>

      {role === "SELLER" && (
        <fieldset className="rounded-panel bg-ground px-3.5 py-3">
          <legend className="sr-only">{tf("channelsLabel")}</legend>
          <CaptionLabel>{tf("channelsLabel")}</CaptionLabel>
          {channels.length === 0 ? (
            <p className="mt-2 text-xs text-ink-2">
              {tf("createNoChannelWarn")}
            </p>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {channels.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2.5 text-sm font-semibold text-ink"
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(c.id)}
                    onChange={() => toggleChannel(c.id)}
                    className="h-4 w-4 rounded border-rule"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          {role === "SELLER" && selectedChannels.size === 0 && (
            <p className="mt-2.5 flex items-center gap-1.5 rounded-panel bg-warning-wash px-3 py-2 text-xs font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
              {tf("noChannelWarn")}
            </p>
          )}
        </fieldset>
      )}

      {mode.kind === "edit" && (
        <label className="flex items-center gap-2.5 rounded-panel bg-ground px-3.5 py-3 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-rule"
          />
          {tf("activeLabel")}
        </label>
      )}

      <div className="flex gap-2.5 pt-1">
        <Link
          href="/users"
          className="flex h-12 flex-1 items-center justify-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 ring-1 ring-inset ring-rule"
        >
          {tc("cancel")}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="h-12 flex-1 rounded-full bg-fab px-4 text-sm font-bold text-white shadow-fab active:translate-y-[2px] disabled:opacity-60"
        >
          {isPending
            ? tf("saving")
            : mode.kind === "create"
              ? tf("create")
              : tc("save")}
        </button>
      </div>
    </form>
  );
}
