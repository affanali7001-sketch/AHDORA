/**
 * Phase 13 — language choice (English / Hinglish).
 *
 * The choice lives in localStorage only. It is NOT saved to the
 * profile via the API: POST /api/profile validates its body with a
 * strict zod schema (api/src/routes/profile.ts, `.strict()`), so a
 * `language` field would need a Profile model change, a schema
 * change and new API tests — out of scope for this phase. The
 * language screen itself says the choice is remembered on this
 * device, which is exactly what localStorage does.
 *
 * All bilingual strings below are copied verbatim from the approved
 * preview (~/workspace/your_files/ahdora-new-ui-preview/
 * ahdora-new-ui-preview.html): the #language screen, the #login
 * screen's data-en / data-hi pairs, and the onboarding `steps` /
 * `stepsEn` arrays. Nothing here is a fresh translation.
 */

export type AppLanguage = 'en' | 'hi';

export const LANGUAGE_STORAGE_KEY = 'ahdora-language';

/** The stored choice, or null when the user has never picked one. */
export function readStoredLanguage(): AppLanguage | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return value === 'en' || value === 'hi' ? value : null;
  } catch {
    // Storage unavailable (e.g. private mode): treat as "not chosen".
    return null;
  }
}

export function storeLanguage(language: AppLanguage): void {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage unavailable: the choice still applies for this tab
    // through App state; it just won't survive a reload.
  }
}

export type BilingualText = { en: string; hi: string };

/**
 * Split a bilingual pair into the line shown big (the chosen
 * language) and the smaller line shown alongside it (the other
 * language). Login → Onboarding always shows BOTH lines.
 */
export function pickText(
  text: BilingualText,
  language: AppLanguage,
): { primary: string; secondary: string } {
  return language === 'hi'
    ? { primary: text.hi, secondary: text.en }
    : { primary: text.en, secondary: text.hi };
}

/** First-open language screen (preview section #language). */
export const LANGUAGE_SCREEN = {
  title: { en: 'Choose your language', hi: 'Apni bhasha chuno' },
  description:
    'Jo bhasha chuno ge, wahi Login se lekar details bharne tak chalegi. Baad me Profile se badal bhi sakte ho.',
  english: {
    name: 'English',
    detail: 'Everything in English — login, forms and buttons',
  },
  hinglish: {
    name: 'Hinglish',
    detail: 'Hindi + English mix — jaise hum roz baat karte hain',
  },
  // Adapted from the preview's status lines (which pointed at the
  // preview's own screens below); the meaning is the same.
  status: {
    en: 'English is selected — Login to details-filling will be in English.',
    hi: 'Hinglish chuna hua hai — Login se lekar details bharne tak Hinglish me rahega.',
  },
  continueLabel: 'Aage badho →',
  note: 'Ye chunav yaad rahega — agli baar app khule to wahi bhasha milegi. Quran ki aayaton me Hinglish + English dono tarjume hamesha rahenge; baaki tarjume sirf Hinglish me.',
} as const;

/** Login screen (preview section #login). */
export const LOGIN_STRINGS = {
  headingLogin: { en: 'Welcome back.', hi: 'Wapas khush-aamdeed.' },
  headingSignup: { en: 'Create your account.', hi: 'Apna account banao.' },
  subLogin: {
    en: 'Pick up where you left off.',
    hi: 'Jahan chhoda tha, wahin se shuru karo.',
  },
  // No Hinglish line for this one in the preview — shown English-only.
  subSignup: 'Create your personal AHDORA space.',
  tabCreate: { en: 'Create account', hi: 'Naya account banao' },
  nameLabel: { en: 'Full name', hi: 'Poora naam' },
  forgot: { en: 'Forgot your password?', hi: 'Password bhool gaye?' },
  notice: {
    en: 'Your secure session is handled by the AHDORA API. Never share your password with anyone — a verification email will be sent to you.',
    hi: 'Secure session AHDORA API se handle hota hai. Apna password kisi ke saath share mat karo — email verification ke liye mail bheja jayega.',
  },
  submitSignup: { en: 'Create account', hi: 'Account banao' },
} as const;

/**
 * Onboarding step headings + hints (preview section #onboarding:
 * `steps` for Hinglish, `stepsEn` for English). The real form's
 * field labels and validation messages stay as they are — only the
 * step title, hint and the Back / Next / Save / Skip buttons are
 * bilingual.
 */
export const ONBOARDING_STEPS: { title: BilingualText; hint: BilingualText }[] = [
  {
    title: { en: 'About you', hi: 'Tumhare baare me' },
    hint: {
      en: 'Your name and basic details — only for your account.',
      hi: 'Naam aur basic details — ye sirf tumhare account ke liye hai.',
    },
  },
  {
    title: { en: 'Where do you study?', hi: 'Padhai kahan chal rahi hai?' },
    hint: {
      en: 'Course and college — the study planner is built from this.',
      hi: 'Course aur college — study planner isi se banta hai.',
    },
  },
  {
    title: { en: 'College timings', hi: 'College ka time' },
    hint: {
      en: 'When is college, from what time to what time? No study task will be placed in this time.',
      hi: 'College kab se kab tak? Is time me study task nahi lagega.',
    },
  },
  {
    title: { en: 'How much will you study daily?', hi: 'Roz kitna padhoge?' },
    hint: {
      en: 'Keep a target you can really hit — a small target finished daily is better than a big fake one.',
      hi: 'Sach wala target rakho — chhota target roz poora karna, bade jhoothe target se behtar hai.',
    },
  },
  {
    title: { en: 'Where do prayer times come from?', hi: 'Namaz ka hisab kahan se?' },
    hint: {
      en: 'Fill the city carefully — a wrong city means wrong prayer times. (The earlier "MAHARSTRA" mistake happened right here.)',
      hi: 'City sahi bharna — galat city matlab galat namaz time. (Pehle "MAHARSTRA" wali galti yahin hui thi.)',
    },
  },
  {
    title: { en: 'Your own time for each prayer', hi: 'Har namaz ka apna time' },
    hint: {
      en: 'If you want, set your own time for any prayer — leave it empty and it comes automatically from your city, and the time you set is the one that will be shown.',
      hi: 'Chaaho to kisi namaz ka time khud set karo — khali chhodo to city ke hisab se apne aap ayega, aur tumhara set kiya time hi dikhega.',
    },
  },
  {
    title: { en: 'Sleep time', hi: 'Neend ka time' },
    hint: {
      en: 'Default 6 hours — change it as you like. The reminder will come at this time.',
      hi: 'Default 6 ghante — apne hisab se badal sakte ho. Reminder isi time pe ayega.',
    },
  },
  {
    title: { en: 'Everything right? Check it', hi: 'Sab sahi hai? Check kar lo' },
    hint: {
      en: 'The moment you press Save, these details are saved in your account — you can change them anytime later from Profile.',
      hi: 'Save dabate hi ye details tumhare account me save ho jayengi — baad me Profile se kabhi bhi badal sakte ho.',
    },
  },
];

/** Onboarding buttons (preview #onboarding). */
export const ONBOARDING_STRINGS = {
  back: { en: 'Back', hi: 'Peeche' },
  next: 'Next',
  skip: { en: 'Fill it later — Skip', hi: 'Baad me bharenge — Skip karo' },
  save: { en: "✓ Save — Let's Start", hi: '✓ Save — Shuru Karo' },
} as const;
