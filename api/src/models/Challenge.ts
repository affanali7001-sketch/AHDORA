import mongoose, { Schema } from 'mongoose';

export const challengeCategories = [
  'prayers',
  'quran',
  'study',
  'focus',
  'sleep',
  'discipline',
] as const;

export type ChallengeCategory = (typeof challengeCategories)[number];

/**
 * A challenge. Templates from code are materialised as Challenge documents
 * with kind 'template' and a unique templateId when first joined; users
 * can also create their own with kind 'custom'. Friends/invites are
 * Phase 4 — this phase is solo challenges only.
 */
const challengeSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 140,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  category: {
    type: String,
    enum: challengeCategories,
    required: true,
  },
  /** Length in days. 30 or 365 for templates; user-chosen for custom ones. */
  durationDays: {
    type: Number,
    required: true,
    min: 1,
    max: 365,
  },
  kind: {
    type: String,
    enum: ['template', 'custom'],
    required: true,
  },
  /** Set for template challenges; null for user-created ones. */
  templateId: {
    type: String,
    trim: true,
    maxlength: 80,
    default: null,
  },
  /** Rules shown to the user BEFORE joining. Stored as plain lines. */
  rules: {
    type: [String],
    default: [],
    validate: {
      validator: (items: string[]) =>
        items.length <= 12 && items.every((item) => item.length <= 300),
      message: 'Maximum 12 rules, 300 characters each.',
    },
  },
  /** Who created it; null for built-in templates. */
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true, versionKey: false });

challengeSchema.index({ templateId: 1 }, { unique: true, sparse: true });
challengeSchema.index({ category: 1, kind: 1 });

export const Challenge = mongoose.model('Challenge', challengeSchema);
