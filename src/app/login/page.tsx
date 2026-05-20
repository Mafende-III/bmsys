import { signIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings/queries";

export default async function LoginPage() {
  const { companyName, logoUrl } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-lg object-contain"
            />
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">{companyName}</h1>
            <p className="mt-0.5 text-sm text-zinc-600">
              Sign in to manage sales and stock
            </p>
          </div>
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("credentials", {
              phone: formData.get("phone"),
              pin: formData.get("pin"),
              redirectTo: "/dashboard",
            });
          }}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium">Phone</span>
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              placeholder="+250 7XX XXX XXX"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">PIN</span>
            <input
              type="password"
              name="pin"
              required
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
