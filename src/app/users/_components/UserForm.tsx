"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function UserForm({
  mode,
  channels,
}: {
  mode: Mode;
  channels: ChannelOption[];
}) {
  const router = useRouter();

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
    <form action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Phone</span>
        {mode.kind === "edit" ? (
          <input
            value={mode.user.phone}
            disabled
            className="mt-1 block w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
          />
        ) : (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="+250788000000"
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
        )}
        <span className="mt-1 block text-xs text-zinc-500">
          Used for login. Cannot be changed after creation.
        </span>
      </label>

      {mode.kind === "create" ? (
        <label className="block">
          <span className="text-sm font-medium">PIN (4-6 digits)</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="\d{4,6}"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Share this PIN with the user verbally. They can change it
            after first login (coming soon).
          </span>
        </label>
      ) : (
        <fieldset className="rounded-lg border border-zinc-200 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={resetPin}
              onChange={(e) => setResetPin(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            Reset PIN
          </label>
          {resetPin && (
            <input
              type="password"
              inputMode="numeric"
              pattern="\d{4,6}"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="New PIN (4-6 digits)"
              className="mt-2 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono"
            />
          )}
        </fieldset>
      )}

      <label className="block">
        <span className="text-sm font-medium">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "OWNER" | "SELLER")}
          className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="SELLER">Seller</option>
          <option value="OWNER">Owner</option>
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          OWNERs can do everything (and sell on every channel). SELLERs
          can only sell on their assigned channels.
        </span>
      </label>

      {role === "SELLER" && (
        <fieldset className="rounded-lg border border-zinc-200 px-4 py-3">
          <legend className="px-1 text-sm font-medium">
            Allowed channels
          </legend>
          {channels.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No channels exist yet. Create at least one first.
            </p>
          ) : (
            <div className="mt-1 grid grid-cols-2 gap-2">
              {channels.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(c.id)}
                    onChange={() => toggleChannel(c.id)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          )}
          {role === "SELLER" && selectedChannels.size === 0 && (
            <p className="mt-2 text-xs text-amber-700">
              ⚠ A seller with no allowed channels cannot sell anything.
            </p>
          )}
        </fieldset>
      )}

      {mode.kind === "edit" && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300"
          />
          Active (can log in)
        </label>
      )}

      <div className="flex gap-2 pt-2">
        <Link
          href="/users"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-center text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending
            ? "Saving..."
            : mode.kind === "create"
              ? "Create user"
              : "Save changes"}
        </button>
      </div>
    </form>
  );
}
