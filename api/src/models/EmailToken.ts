import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const emailTokenSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['email_verification', 'password_reset'], required: true },
  // SHA-256 hash of the raw token — the raw value is never stored.
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

// Expired tokens are removed by MongoDB itself.
emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailTokenDocument = InferSchemaType<typeof emailTokenSchema>;
export const EmailToken = mongoose.model('EmailToken', emailTokenSchema);
