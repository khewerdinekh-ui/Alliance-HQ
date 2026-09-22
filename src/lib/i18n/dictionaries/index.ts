import type { Locale } from "../locales";
import en from "./en";
import es from "./es";
import fr from "./fr";
import ar from "./ar";
import it from "./it";
import pl from "./pl";
import cs from "./cs";

export const dictionaries: Record<Locale, typeof en> = { en, es, fr, ar, it, pl, cs };

export type TranslationKey = keyof typeof en;
