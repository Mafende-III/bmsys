import { getLocale, getTranslations } from "next-intl/server";
import { signIn } from "@/lib/auth";
import { getSettings } from "@/lib/settings/queries";
import type { Locale } from "@/i18n/config";
import { LanguageToggle } from "../_components/LanguageToggle";

export default async function LoginPage() {
  const { companyName, logoUrl } = await getSettings();
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
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
                {t("login.subtitle")}
              </p>
            </div>
          </div>
          <LanguageToggle current={locale} />
        </div>

        <form
          action={async (formData: FormData) => {
            "use server";
            await signIn("credentials", {
              phone: formData.get("phone"),
              pin: formData.get("pin"),
              remember: formData.get("remember") === "on" ? "on" : "",
              redirectTo: "/dashboard",
            });
          }}
          className="mt-6 space-y-4"
        >
          <label className="block">
            <span className="text-sm font-medium">{t("login.phone")}</span>
            <input
              type="tel"
              name="phone"
              required
              autoComplete="tel"
              placeholder={t("login.phonePlaceholder")}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t("login.pin")}</span>
            <input
              type="password"
              name="pin"
              required
              inputMode="numeric"
              autoComplete="off"
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
            />
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="remember"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300"
            />
            <span>
              <span className="font-medium">{t("login.rememberMe")}</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                {t("login.rememberMeHint")}
              </span>
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {t("common.signIn")}
          </button>
        </form>
      </div>
    </main>
  );
}
