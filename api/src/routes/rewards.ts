import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { BADGE_DEFINITIONS } from '../lib/points.js';
import { PointTransaction } from '../models/PointTransaction.js';
import { UserBadge } from '../models/UserBadge.js';
import { UserPoints } from '../models/UserPoints.js';

export const rewardsRouter = Router();

rewardsRouter.use(requireAuth);

/**
 * Read-only points and badges. There is deliberately NO endpoint here
 * that awards points — awards happen only inside server code when a
 * real event occurs (see api/src/lib/points.ts).
 */

rewardsRouter.get('/summary', async (req, res, next) => {
  try {
    const userId = req.authUser!.id;
    const [points, badges, recent] = await Promise.all([
      UserPoints.findOne({ userId }).select('total').lean(),
      UserBadge.find({ userId }).sort({ awardedAt: -1 }).lean(),
      PointTransaction.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    res.json({
      total: points?.total ?? 0,
      badges: badges.map((b) => ({
        badgeId: b.badgeId,
        title: BADGE_DEFINITIONS[b.badgeId as keyof typeof BADGE_DEFINITIONS]?.title ?? b.badgeId,
        description:
          BADGE_DEFINITIONS[b.badgeId as keyof typeof BADGE_DEFINITIONS]?.description ?? '',
        awardedAt: b.awardedAt,
      })),
      recent: recent.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        reason: t.reason,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

rewardsRouter.get('/history', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(String(req.query.limit ?? '20'), 10) || 20));
    const total = await PointTransaction.countDocuments({ userId: req.authUser!.id });
    const transactions = await PointTransaction.find({ userId: req.authUser!.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    res.json({
      transactions: transactions.map((t) => ({
        id: String(t._id),
        amount: t.amount,
        reason: t.reason,
        refType: t.refType,
        createdAt: t.createdAt,
      })),
      page,
      limit,
      total,
    });
  } catch (error) {
    next(error);
  }
});
