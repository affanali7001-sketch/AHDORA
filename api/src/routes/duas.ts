import { Router } from 'express';
import {
  DUAS,
  DUA_TOPICS,
  filterDuasByTopic,
  isDuaTopic,
} from '../lib/duasData.js';

/**
 * Daily duas — verified text only, public by design (like Quran
 * reading: no account needed to read a dua). No auth, no user data,
 * no database: the list is the static verified data in
 * lib/duasData.ts. Every entry carries its exact hadith source.
 *
 * GET /api/duas — all duas, with the topic list.
 * GET /api/duas?topic=sleep — duas for one topic (400 otherwise).
 */

export const duasRouter = Router();

const SOURCE_NOTE =
  'Har dua ke saath uska exact source diya gaya hai (Quran, Sahih al-Bukhari, Sahih Muslim, Sunan Abi Dawud, Jami’ at-Tirmidhi, Musnad Ahmad). Koi dua apni taraf se nahi banayi gayi.';

duasRouter.get('/', (req, res) => {
  const topic = typeof req.query.topic === 'string' ? req.query.topic.trim() : '';
  if (topic) {
    if (!isDuaTopic(topic)) {
      res.status(400).json({
        error: 'Unknown topic.',
        topics: DUA_TOPICS.map((item) => item.id),
      });
      return;
    }
    const duas = filterDuasByTopic(DUAS, topic);
    res.json({ source: SOURCE_NOTE, count: duas.length, topics: DUA_TOPICS, duas });
    return;
  }
  res.json({ source: SOURCE_NOTE, count: DUAS.length, topics: DUA_TOPICS, duas: DUAS });
});
