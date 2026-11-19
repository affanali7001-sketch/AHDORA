import mongoose, { Schema } from 'mongoose';

export const subjectColours = ['mint', 'gold', 'blue', 'rose', 'violet'] as const;
export type SubjectColour = (typeof subjectColours)[number];

const studySubjectSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    trim: true,
    required: true,
    maxlength: 80,
  },
  /** Optional short label/code shown under the subject name, e.g. "312301". */
  label: {
    type: String,
    trim: true,
    maxlength: 40,
    default: '',
  },
  colour: {
    type: String,
    enum: subjectColours,
    default: 'mint',
  },
}, { timestamps: true, versionKey: false });

studySubjectSchema.index({ userId: 1, createdAt: 1 });

export const StudySubject = mongoose.model('StudySubject', studySubjectSchema);
