import { signIn } from "@/lib/auth";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Beverage Business Management
        </p>

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
