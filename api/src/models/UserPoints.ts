import mongoose, { Schema } from 'mongoose';

/** Running points total per user. Only ever changed server-side. */
const userPointsSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  total: {
    type: Number,
    default: 0,
    min: 0,
  },
}, { timestamps: true, versionKey: false });

export const UserPoints = mongoose.model('UserPoints', userPointsSchema);
