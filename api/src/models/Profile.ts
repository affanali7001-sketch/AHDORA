import mongoose, { Schema } from 'mongoose';

const profileSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },

  education: {
    type: String,
    trim: true,
    maxlength: 80,
    default: '',
  },

  course: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },

  collegeName: {
    type: String,
    trim: true,
    maxlength: 140,
    default: '',
  },

  classYear: {
    type: String,
    trim: true,
    maxlength: 40,
    default: '',
  },

  branch: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },

  semester: {
    type: String,
    trim: true,
    maxlength: 40,
    default: '',
  },

  subjects: {
    type: [String],
    default: [],
    validate: {
      validator: (items: string[]) =>
        items.length <= 30 &&
        items.every((item) => item.length <= 80),
      message: 'Maximum 30 subjects are allowed, with 80 characters each.',
    },
  },

  collegeStartTime: {
    type: String,
    default: '',
  },

  collegeEndTime: {
    type: String,
    default: '',
  },

  collegeDays: {
    type: [String],
    default: [],
  },

  weeklyOffDays: {
    type: [String],
    default: [],
  },

  studyStartTime: {
    type: String,
    default: '',
  },

  studyEndTime: {
    type: String,
    default: '',
  },

  dailyStudyTarget: {
    type: String,
    trim: true,
    maxlength: 20,
    default: '',
  },

  preferredStudyDays: {
    type: [String],
    default: [],
  },

  city: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },

  prayerCalculationMethod: {
    type: String,
    trim: true,
    maxlength: 60,
    default: '',
  },

  asrMethod: {
    type: String,
    enum: ['', 'standard', 'hanafi'],
    default: '',
  },

  sleepTime: {
    type: String,
    default: '',
  },

  sleepStartTime: {
    type: String,
    default: '',
  },

  sleepEndTime: {
    type: String,
    default: '',
  },

  onboardingCompleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  versionKey: false,
});

export const Profile = mongoose.model('Profile', profileSchema);