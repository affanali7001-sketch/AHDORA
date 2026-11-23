import mongoose, { Schema } from 'mongoose';

const prayerSettingSchema = new Schema({
  timeOverride: { type: String, trim: true, maxlength: 5, default: '' },
  endTime: { type: String, trim: true, maxlength: 5, default: '' },
  reminder: { type: Boolean, default: true },
}, { _id: false });

const profileSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },

  dateOfBirth: {
    type: String,
    trim: true,
    maxlength: 10,
    default: '',
  },

  gender: {
    type: String,
    enum: ['', 'female', 'male', 'prefer-not-to-say'],
    default: '',
  },

  profilePictureUrl: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
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

  weekendSchedule: {
    type: String,
    trim: true,
    maxlength: 200,
    default: '',
  },

  scheduleNote: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
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

  dailyStudyHours: {
    type: String,
    trim: true,
    maxlength: 10,
    default: '',
  },

  studyBreakMinutes: {
    type: String,
    trim: true,
    maxlength: 10,
    default: '',
  },

  subjectTargets: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },

  preferredStudyDays: {
    type: [String],
    default: [],
  },

  country: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'India',
  },

  state: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },

  city: {
    type: String,
    trim: true,
    maxlength: 100,
    default: '',
  },

  timezone: {
    type: String,
    trim: true,
    maxlength: 60,
    default: 'Asia/Kolkata',
  },

  locationPermission: {
    type: Boolean,
    default: false,
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

  prayerSettings: {
    Fajr: { type: prayerSettingSchema, default: () => ({}) },
    Dhuhr: { type: prayerSettingSchema, default: () => ({}) },
    Asr: { type: prayerSettingSchema, default: () => ({}) },
    Maghrib: { type: prayerSettingSchema, default: () => ({}) },
    Isha: { type: prayerSettingSchema, default: () => ({}) },
  },

  /**
   * Optional Tahajjud time (HH:mm). Empty = unset: it is never shown,
   * never assumed, and never counted as a prayer. It is a plain
   * user-chosen time, not a calculated prayer time.
   */
  tahajjudTime: {
    type: String,
    trim: true,
    maxlength: 5,
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

  sleepReminder: {
    type: Boolean,
    default: true,
  },

  focusStartTime: {
    type: String,
    default: '',
  },

  focusEndTime: {
    type: String,
    default: '',
  },

  hijriDayOffset: {
    type: Number,
    min: -2,
    max: 2,
    default: 0,
  },

  quranDailyTarget: {
    type: Number,
    min: 0,
    max: 500,
    default: 10,
  },

  onboardingCompleted: {
    type: Boolean,
    default: false,
  },

  onboardingSkipped: {
    type: Boolean,
    default: false,
  },

  onboardingStep: {
    type: Number,
    min: 0,
    max: 8,
    default: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
});

export const Profile = mongoose.model('Profile', profileSchema);