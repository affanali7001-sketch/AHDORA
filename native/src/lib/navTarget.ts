/**
 * Cross-screen targets for the state-based nav (which carries no
 * route params). A screen sets a target, then calls goTo(); the
 * destination screen consumes it once on mount with take*() and
 * the value clears itself, so it never fires twice.
 *
 * - Challenge user: Friends / Study / Search pick a person to
 *   challenge → Challenges opens its invite picker for them.
 * - Quran surah: Search picks a surah → Quran Book opens it.
 */
export type ChallengeUserTarget = { id: string; name: string };

let challengeUser: ChallengeUserTarget | null = null;
let quranSurah: number | null = null;
let quranPage: number | null = null;

export function setChallengeUserTarget(user: ChallengeUserTarget): void {
  challengeUser = user;
}

export function takeChallengeUserTarget(): ChallengeUserTarget | null {
  const target = challengeUser;
  challengeUser = null;
  return target;
}

export function setQuranSurahTarget(surahNumber: number): void {
  quranSurah = surahNumber;
}

export function takeQuranSurahTarget(): number | null {
  const target = quranSurah;
  quranSurah = null;
  return target;
}

export function setQuranPageTarget(page: number): void {
  quranPage = page;
}

export function takeQuranPageTarget(): number | null {
  const target = quranPage;
  quranPage = null;
  return target;
}
