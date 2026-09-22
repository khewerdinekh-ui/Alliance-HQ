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
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{t("onboarding.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("onboarding.subtitle")}</p>
          </div>
          <LanguageSwitcher initialLocale={initialLocale} />
        </div>

        <div className="mt-6 flex rounded-full bg-slate-100 p-1 text-sm font-medium">
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

            {joinError && <p className="text-sm text-red-600">{joinError}</p>}

            <button
              type="submit"
              disabled={!ready || joinPending}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
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

            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
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
              <p className="mt-3 text-xs text-teal-800">{t("onboarding.becomeR5")}</p>
            </div>

            <Field
              label={t("onboarding.alliancePassword")}
              name="password"
              type="password"
              placeholder={t("onboarding.createPasswordPlaceholder")}
              required
              minLength={8}
            />

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <button
              type="submit"
              disabled={!ready || createPending}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {createPending ? t("onboarding.creating") : t("onboarding.enterButton")}
            </button>
          </form>
        )}
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
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}
