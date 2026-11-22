import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Profile } from '../models/Profile.js';
import { QuranBookmark } from '../models/QuranBookmark.js';
import { QuranDayLog } from '../models/QuranDayLog.js';
import { QuranReading } from '../models/QuranReading.js';
import {
  ARABIC_SOURCE,
  RECITERS,
  TRANSLATION_EDITION,
  TRANSLATION_NAME,
  TRANSLITERATION_EDITION,
  audioFallbackUrl,
  audioUrl,
  fetchSurah,
  fetchSurahList,
  searchAyahText,
} from '../lib/quranUpstream.js';
import { addDays, dateKeyInTimezone } from '../lib/timezone.js';

/**
 * Quran reading — verified text only.
 *
 * Arabic (Tanzil Uthmani), transliteration and the Saheeh
 * International translation are fetched live from AlQuran Cloud
 * (see lib/quranUpstream.ts for the live verification notes). The
 * four curated duas in the frontend are kept exactly as they were
 * and are NOT served from here. Nothing here invents, edits, or
 * caches Quranic text as user data. Any upstream failure is a 502.
 *
 * Reading the Quran (surah list, surah text, search) is public —
 * it needs no account. Bookmarks, reading history and the daily
 * target are per-user data and stay behind authentication.
 */

export const quranRouter = Router();

const ARABIC_EDITION = 'quran-uthmani';

function upstreamError(res: { status: (code: number) => { json: (body: unknown) => void } }): void {
  res
    .status(502)
    .json({ error: 'Quran text could not be loaded from the verified source. Please try again later.' });
}

function requireUserId(req: { authUser?: { id: string } }): string | null {
  return req.authUser?.id ?? null;
}

/** GET /api/quran/surahs — all 114 surahs with metadata. */
quranRouter.get('/surahs', async (_req, res, next) => {
  try {
    const surahs = await fetchSurahList();
    res.json({
      source: ARABIC_SOURCE,
      count: surahs.length,
      surahs: surahs.map((surah) => ({
        number: surah.number,
        name: surah.name,
        englishName: surah.englishName,
        englishNameTranslation: surah.englishNameTranslation,
        numberOfAyahs: surah.numberOfAyahs,
        revelationType: surah.revelationType,
      })),
    });
  } catch {
    upstreamError(res);
    return;
  }
});

/**
 * GET /api/quran/surahs/:number — one surah with Arabic +
 * transliteration + translation, merged by ayah number.
 * Query: ?translation=en.sahih (only this verified edition is
 * offered) and ?reciter=<EveryAyah folder id>.
 */
quranRouter.get('/surahs/:number', async (req, res, next) => {
  try {
    const surahNumber = Number(req.params.number);
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      res.status(400).json({ error: 'Surah number must be between 1 and 114.' });
      return;
    }
    const translation =
      typeof req.query.translation === 'string' && req.query.translation
        ? req.query.translation
        : TRANSLATION_EDITION;
    if (translation !== TRANSLATION_EDITION) {
      res.status(400).json({ error: `Only the ${TRANSLATION_NAME} translation is offered.` });
      return;
    }
    const reciterId =
      typeof req.query.reciter === 'string' && req.query.reciter
        ? req.query.reciter
        : RECITERS[0]?.id ?? 'Alafasy_128kbps';
    const reciter = RECITERS.find((item) => item.id === reciterId) ?? RECITERS[0];
    if (!reciter) {
      res.status(400).json({ error: 'Unknown reciter.' });
      return;
    }

    const [arabic, transliteration, translationData] = await Promise.all([
      fetchSurah(surahNumber, ARABIC_EDITION),
      fetchSurah(surahNumber, TRANSLITERATION_EDITION),
      fetchSurah(surahNumber, TRANSLATION_EDITION),
    ]);

    const translationByAyah = new Map(
      translationData.ayahs.map((ayah) => [ayah.numberInSurah, ayah.text]),
    );
    const transliterationByAyah = new Map(
      transliteration.ayahs.map((ayah) => [ayah.numberInSurah, ayah.text]),
    );

    res.json({
      source: ARABIC_SOURCE,
      translation: { edition: TRANSLATION_EDITION, name: TRANSLATION_NAME },
      transliteration: { edition: TRANSLITERATION_EDITION, name: 'Transliteration' },
      audio: {
        reciter: { id: reciter.id, name: reciter.name, bitrate: reciter.bitrate },
        source: 'EveryAyah',
        reciters: RECITERS.map((item) => ({ id: item.id, name: item.name })),
      },
      surah: {
        number: arabic.number,
        name: arabic.name,
        englishName: arabic.englishName,
        englishNameTranslation: arabic.englishNameTranslation,
        revelationType: arabic.revelationType,
        numberOfAyahs: arabic.numberOfAyahs,
        ayahs: arabic.ayahs.map((ayah) => ({
          number: ayah.number,
          numberInSurah: ayah.numberInSurah,
          text: ayah.text,
          transliteration: transliterationByAyah.get(ayah.numberInSurah) ?? '',
          translation: translationByAyah.get(ayah.numberInSurah) ?? '',
          juz: ayah.juz,
          page: ayah.page,
          sajda: ayah.sajda,
          audioUrl: audioUrl(reciter.id, surahNumber, ayah.numberInSurah),
          // Same reciter, AlQuran Cloud CDN, global ayah number —
          // the client tries this if EveryAyah fails to load.
          audioFallbackUrl: audioFallbackUrl(reciter.id, ayah.number),
        })),
      },
    });
  } catch {
    upstreamError(res);
    return;
  }
});

/**
 * GET /api/quran/search?q=... — surah metadata matches (name /
 * number) plus ayah-text matches from the upstream search
 * endpoint (translation text). Both are real upstream results.
 */
quranRouter.get('/search', async (req, res, next) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length > 100) {
      res.status(400).json({ error: 'Search text is required (max 100 characters).' });
      return;
    }
    const surahs = await fetchSurahList();
    const lowered = query.toLowerCase();
    const numberQuery = Number(query);
    const surahMatches = surahs
      .filter(
        (surah) =>
          surah.englishName.toLowerCase().includes(lowered) ||
          surah.englishNameTranslation.toLowerCase().includes(lowered) ||
          (Number.isInteger(numberQuery) && surah.number === numberQuery),
      )
      .slice(0, 20);

    let ayahMatches: Awaited<ReturnType<typeof searchAyahText>> = [];
    try {
      ayahMatches = await searchAyahText(query);
    } catch {
      // Ayah-text search is a bonus: if it fails, surah matches
      // are still returned and the failure is reported honestly.
      res.json({
        source: ARABIC_SOURCE,
        query,
        surahs: surahMatches,
        ayahs: [],
        ayahSearchError: 'Ayah-text search is unavailable right now. Surah results are shown.',
      });
      return;
    }

    res.json({ source: ARABIC_SOURCE, query, surahs: surahMatches, ayahs: ayahMatches });
  } catch {
    upstreamError(res);
    return;
  }
});

/** GET /api/quran/bookmarks — the user's bookmarks, newest first. */
quranRouter.get('/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const bookmarks = await QuranBookmark.find({ userId }).sort({ createdAt: -1 }).lean();
    res.json({
      bookmarks: bookmarks.map((item) => ({
        id: String(item._id),
        surahNumber: item.surahNumber,
        ayahNumber: item.ayahNumber,
        note: item.note ?? '',
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const bookmarkSchema = z.object({
  surahNumber: z.number().int().min(1).max(114),
  ayahNumber: z.number().int().min(1).max(300),
  note: z.string().trim().max(200).optional(),
});

/** POST /api/quran/bookmarks — bookmark one ayah (idempotent). */
quranRouter.post('/bookmarks', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = bookmarkSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid bookmark' });
      return;
    }
    const bookmark = await QuranBookmark.findOneAndUpdate(
      {
        userId,
        surahNumber: parsed.data.surahNumber,
        ayahNumber: parsed.data.ayahNumber,
      },
      { $set: { note: parsed.data.note ?? '' } },
      { upsert: true, new: true },
    );
    res.status(201).json({
      bookmark: {
        id: String(bookmark._id),
        surahNumber: bookmark.surahNumber,
        ayahNumber: bookmark.ayahNumber,
        note: bookmark.note ?? '',
        createdAt: bookmark.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/quran/bookmarks/:id — only the owner's bookmark. */
quranRouter.delete('/bookmarks/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const deleted = await QuranBookmark.findOneAndDelete({ _id: req.params.id, userId });
    if (!deleted) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }
    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/quran/read — record that the user opened an ayah.
 * "Ayahs opened today" counts forward progress through a surah
 * on the same day only; re-reading an earlier ayah adds nothing.
 * This is a reading log, not a claim of verified recitation.
 */
const readSchema = z.object({
  surahNumber: z.number().int().min(1).max(114),
  ayahNumber: z.number().int().min(1).max(300),
});

quranRouter.post('/read', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = readSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid reading record' });
      return;
    }
    const profile = await Profile.findOne({ userId }).lean();
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const today = dateKeyInTimezone(timezone);
    const existing = await QuranReading.findOne({
      userId,
      surahNumber: parsed.data.surahNumber,
    });
    let added = 0;
    if (!existing) {
      await QuranReading.create({
        userId,
        surahNumber: parsed.data.surahNumber,
        lastAyahNumber: parsed.data.ayahNumber,
        ayahsReadToday: 1,
        dayKey: today,
      });
      added = 1;
    } else if (existing.dayKey !== today) {
      existing.dayKey = today;
      existing.ayahsReadToday = 1;
      existing.lastAyahNumber = parsed.data.ayahNumber;
      await existing.save();
      added = 1;
    } else if (parsed.data.ayahNumber > existing.lastAyahNumber) {
      added = parsed.data.ayahNumber - existing.lastAyahNumber;
      existing.ayahsReadToday += added;
      existing.lastAyahNumber = parsed.data.ayahNumber;
      await existing.save();
    } else {
      existing.lastAyahNumber = Math.max(existing.lastAyahNumber, parsed.data.ayahNumber);
      await existing.save();
    }
    // The per-day log mirrors the same forward progress: ayahs added
    // today also count toward "Quran read today". Re-reading adds
    // nothing here either, because `added` is 0 for it. The
    // QuranReading behaviour and the response shape are unchanged.
    if (added > 0) {
      await QuranDayLog.findOneAndUpdate(
        { userId, dayKey: today },
        { $inc: { ayahsRead: added } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    res.json({ recorded: true, ayahsAddedToday: added });
  } catch (error) {
    next(error);
  }
});

const listenedSchema = z.object({
  minutes: z.number().int().min(0).optional(),
}).strict();

/**
 * POST /api/quran/listened — record that the user listened to Quran
 * recitation today. Sets listened=true for today and adds the
 * minutes to today's total. `minutes` is optional (default 0);
 * listening with 0 minutes still marks the day as listened.
 */
quranRouter.post('/listened', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = listenedSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid listening record' });
      return;
    }
    const profile = await Profile.findOne({ userId }).lean();
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const today = dateKeyInTimezone(timezone);
    const minutes = parsed.data.minutes ?? 0;
    await QuranDayLog.findOneAndUpdate(
      { userId, dayKey: today },
      { $set: { listened: true }, $inc: { listenedMinutes: minutes } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json({ ok: true, listened: true, dayKey: today });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/quran/daily-log — the last N days (default 30, 1–90)
 * including today, newest first. Days with no log row are filled
 * in as "not read / not listened" so the client can show the gap
 * honestly. Day keys follow the user's own timezone.
 */
quranRouter.get('/daily-log', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const rawDays =
      typeof req.query.days === 'string' ? Number.parseInt(req.query.days, 10) : Number.NaN;
    const days = Number.isFinite(rawDays)
      ? Math.min(Math.max(rawDays, 1), 90)
      : 30;
    const profile = await Profile.findOne({ userId }).lean();
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const today = dateKeyInTimezone(timezone);
    const keys = Array.from({ length: days }, (_, i) => addDays(today, -i));
    const rows = await QuranDayLog.find({ userId, dayKey: { $in: keys } }).lean();
    const byDay = new Map(rows.map((row) => [row.dayKey, row]));
    res.json({
      days: keys.map((dayKey) => {
        const row = byDay.get(dayKey);
        return {
          dayKey,
          ayahsRead: row?.ayahsRead ?? 0,
          listened: row?.listened ?? false,
          listenedMinutes: row?.listenedMinutes ?? 0,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

/** GET /api/quran/history — last-read surahs + today's progress. */
quranRouter.get('/history', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const profile = await Profile.findOne({ userId }).lean();
    const timezone = profile?.timezone?.trim() || 'Asia/Kolkata';
    const today = dateKeyInTimezone(timezone);
    const rows = await QuranReading.find({ userId }).sort({ updatedAt: -1 }).limit(20).lean();
    const ayahsOpenedToday = rows
      .filter((row) => row.dayKey === today)
      .reduce((sum, row) => sum + row.ayahsReadToday, 0);
    res.json({
      dailyTarget: profile?.quranDailyTarget ?? 10,
      ayahsOpenedToday,
      date: today,
      history: rows.map((row) => ({
        surahNumber: row.surahNumber,
        lastAyahNumber: row.lastAyahNumber,
        lastReadAt: row.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

const targetSchema = z.object({
  dailyTarget: z.number().int().min(0).max(500),
});

/**
 * PUT /api/quran/target — set the daily reading target (ayahs/day).
 * The target is only a setting; progress is always real history.
 */
quranRouter.put('/target', requireAuth, async (req, res, next) => {
  try {
    const userId = requireUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const parsed = targetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Daily target must be 0–500 ayahs.' });
      return;
    }
    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: { quranDailyTarget: parsed.data.dailyTarget } },
      { new: true, upsert: true },
    );
    res.json({ dailyTarget: profile?.quranDailyTarget ?? parsed.data.dailyTarget });
  } catch (error) {
    next(error);
  }
});
