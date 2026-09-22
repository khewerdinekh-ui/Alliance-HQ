"use client";

import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createOrg, joinOrg } from "./actions";
import type { Locale } from "@/lib/i18n/locales";
import { useTranslations } from "@/lib/i18n/useTranslations";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function OnboardingClient({ initialLocale }: { initialLocale: Locale }) {
  const { t } = useTranslations(initialLocale);
  const [tab, setTab] = useState<"join" | "create">("join");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      setReady(true);
    })();
  }, []);

  const [joinError, joinAction, joinPending] = useActionState(joinOrg, undefined);
  const [createError, createAction, createPending] = useActionState(createOrg, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-teal-900 px-6 pb-9 pt-7 text-white">
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-teal-400/20 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-2xl"
            aria-hidden
          />

          <div className="relative flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/20">
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-teal-300">
                <path
                  d="M12 2.5l7.5 3v5.2c0 4.8-3.1 8.9-7.5 10.3-4.4-1.4-7.5-5.5-7.5-10.3V5.5l7.5-3z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                  fill="currentColor"
                  fillOpacity="0.15"
                />
              </svg>
            </div>
            <LanguageSwitcher initialLocale={initialLocale} />
          </div>

          <p className="relative mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
            {t("onboarding.title")}
          </p>
          <h1 className="relative mt-1 text-2xl font-bold leading-snug text-white">
            {t("onboarding.subtitle")}
          </h1>
        </div>

        <div className="px-6 py-6">
          <div className="flex rounded-full bg-slate-100 p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setTab("join")}
              className={`flex-1 rounded-full py-1.5 transition ${
                tab === "join" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t("onboarding.joinTab")}
            </button>
            <button
              type="button"
              onClick={() => setTab("create")}
              className={`flex-1 rounded-full py-1.5 transition ${
                tab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t("onboarding.createTab")}
            </button>
          </div>

          {tab === "join" ? (
            <form action={joinAction} className="mt-6 space-y-4">
              <Field
                label={t("onboarding.playerName")}
                name="displayName"
                placeholder={t("onboarding.playerNamePlaceholder")}
                required
              />
              <Field
                label={t("onboarding.chiefId")}
                name="chiefId"
                placeholder={t("onboarding.chiefIdPlaceholder")}
                required
              />
              <Field
                label={t("onboarding.allianceName")}
                name="orgName"
                placeholder={t("onboarding.allianceNamePlaceholder")}
                required
              />
              <Field
                label={t("onboarding.state")}
                name="state"
                placeholder={t("onboarding.statePlaceholder")}
                required
              />
              <Field
                label={t("onboarding.alliancePassword")}
                name="password"
                type="password"
                placeholder={t("onboarding.joinPasswordPlaceholder")}
                required
              />

              {joinError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{joinError}</p>
              )}

              <button
                type="submit"
                disabled={!ready || joinPending}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition hover:bg-teal-700 disabled:opacity-60"
              >
                {joinPending ? t("onboarding.entering") : t("onboarding.enterButton")}
              </button>
            </form>
          ) : (
            <form action={createAction} className="mt-6 space-y-4">
              <Field
                label={t("onboarding.playerName")}
                name="displayName"
                placeholder={t("onboarding.playerNamePlaceholder")}
                required
              />
              <Field
                label={t("onboarding.chiefId")}
                name="chiefId"
                placeholder={t("onboarding.chiefIdPlaceholder")}
                required
              />

              <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
                <Field
                  label={t("onboarding.allianceName")}
                  name="orgName"
                  placeholder={t("onboarding.allianceNamePlaceholder")}
                  required
                />
                <div className="mt-3">
                  <Field
                    label={t("onboarding.state")}
                    name="state"
                    placeholder={t("onboarding.statePlaceholder")}
                    required
                  />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-teal-800">
                  {t("onboarding.becomeR5")}
                </p>
              </div>

              <Field
                label={t("onboarding.alliancePassword")}
                name="password"
                type="password"
                placeholder={t("onboarding.createPasswordPlaceholder")}
                required
                minLength={8}
              />

              {createError && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                  {createError}
                </p>
              )}

              <button
                type="submit"
                disabled={!ready || createPending}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition hover:bg-teal-700 disabled:opacity-60"
              >
                {createPending ? t("onboarding.creating") : t("onboarding.enterButton")}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-900 transition focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
      />
    </div>
  );
}
