import Link from "next/link";
import { requireOwner } from "@/lib/auth-guards";
import { ChannelForm } from "../_components/ChannelForm";

export default async function NewChannelPage() {
  await requireOwner();

  return (
    <main className="mx-auto max-w-xl p-4 sm:p-6">
      <header className="mb-4">
        <Link
          href="/channels"
          className="text-sm text-zinc-600 hover:underline"
        >
          ← Channels
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">New channel</h1>
        <p className="text-sm text-zinc-600">
          A sales channel (e.g. retail, wholesale, delivery, online).
        </p>
      </header>
      <ChannelForm mode={{ kind: "create" }} />
    </main>
  );
}
