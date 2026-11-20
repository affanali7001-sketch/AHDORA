import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { Feedback, feedbackTypes } from '../models/Feedback.js';

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

export const feedbackSchema = z.object({
  type: z.enum(feedbackTypes),
  subject: z.string().trim().min(3).max(140),
  message: z.string().trim().min(3).max(2000),
}).strict();

function isObjectId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

type FeedbackDoc = {
  _id: mongoose.Types.ObjectId;
  type: string;
  subject: string;
  message: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeFeedback(doc: FeedbackDoc) {
  return {
    id: String(doc._id),
    type: doc.type,
    subject: doc.subject,
    message: doc.message,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/* ------------------------------------------------------------------ */
/* Create — a user files their own feedback or complaint. Status is    */
/* always 'open' on creation; only support/admin may change it.        */
/* ------------------------------------------------------------------ */

feedbackRouter.post('/', async (req, res, next) => {
  try {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Invalid feedback details',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }
    const row = await Feedback.create({
      userId: req.authUser!.id,
      ...parsed.data,
    });
    res.status(201).json({ feedback: serializeFeedback(row as unknown as FeedbackDoc) });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* List own feedback/complaints, newest first. Per-user only.          */
/* ------------------------------------------------------------------ */

feedbackRouter.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const filter = { userId: req.authUser!.id };
    const total = await Feedback.countDocuments(filter);
    const rows = (await Feedback.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()) as unknown as FeedbackDoc[];
    res.json({
      feedback: rows.map(serializeFeedback),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Get one of your own.                                                */
/* ------------------------------------------------------------------ */

feedbackRouter.get('/:id', async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid feedback id' });
      return;
    }
    const row = (await Feedback.findOne({
      _id: req.params.id,
      userId: req.authUser!.id,
    }).lean()) as unknown as FeedbackDoc | null;
    if (!row) {
      res.status(404).json({ error: 'Feedback not found' });
      return;
    }
    res.json({ feedback: serializeFeedback(row) });
  } catch (error) {
    next(error);
  }
});
