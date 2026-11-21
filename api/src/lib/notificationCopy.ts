/**
 * Hinglish notification copy — the single source of truth for every
 * notification title/body the server creates.
 *
 * Language rule: every user-facing notification is Hinglish (roman
 * Hindi + English, the way our users speak). Titles are short; bodies
 * are one line that tells the user exactly what to do right now.
 *
 * The Capacitor APK (local notifications) uses the same wording — see
 * src/lib/localNotifications.ts on the frontend, kept in sync by hand.
 * If you change a string here, change it there too.
 */

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export type NotificationCopy = { title: string; body: string };

/* ------------------------------------------------------------------ */
/* Prayer                                                              */
/* ------------------------------------------------------------------ */

export function prayerStart(prayer: PrayerName): NotificationCopy {
  return {
    title: `${prayer} ka waqt ho gaya`,
    body: `Wuzu karo aur ${prayer} ki namaz abhi padho — waqt nikalne se pehle.`,
  };
}

export function prayerDeadlineWarning(prayer: PrayerName): NotificationCopy {
  return {
    title: `${prayer} ka waqt khatam ho raha hai`,
    body: `${prayer} ki namaz ke liye sirf 15 minute bache hain — abhi padh lo, warna qaza ho jayegi.`,
  };
}

export function prayerMissed(prayer: PrayerName): NotificationCopy {
  if (prayer === 'Asr') {
    return {
      title: 'Asr ki namaz reh gayi',
      body:
        'Quran 2:238 — beech wali namaz (Asr) ki khaas hifazat karo. Bukhari 552: Asr miss karna jaise ghar-maal kho dena; Bukhari 553: Asr chhodne se amal zaya ho jate hain.\n' +
        'Qaza abhi padh lo — der mat karo.',
    };
  }
  if (prayer === 'Fajr') {
    return {
      title: 'Fajr ki namaz reh gayi',
      body:
        'Quran 19:59 — namaz bhoolne wale bhatak jate hain. Quran 74:42-43 — "Saqar me kya le gaya?" — "Hum namaz nahi padhte the."\n' +
        'Qaza abhi padh lo — der mat karo.',
    };
  }
  return {
    title: `${prayer} ki namaz reh gayi`,
    body: `${prayer} ki namaz miss ho gayi — Qaza padh lo, abhi bhi waqt hai.`,
  };
}

export function prayerQazaReminder(missed: PrayerName[]): NotificationCopy {
  return {
    title: 'Kal ki qaza namaz baaki hai',
    body: `Kal ${missed.join(', ')} reh gayi thi — aaj Qaza padh lo, hisaab poora karo.`,
  };
}

/* ------------------------------------------------------------------ */
/* Study / focus                                                       */
/* ------------------------------------------------------------------ */

export function taskDueSoon(taskTitle: string, startTime: string): NotificationCopy {
  return {
    title: `${taskTitle} ka time aa raha hai`,
    body: `${startTime} ko shuru karna hai — taiyaar ho jao, abhi kar lo.`,
  };
}

export function taskOverdue(taskTitle: string, dueDate: string): NotificationCopy {
  return {
    title: `${taskTitle} abhi bhi baaki hai`,
    body: `Ye task ${dueDate} ko due tha — aaj hi khatam kar lo.`,
  };
}

export function plannerStart(): NotificationCopy {
  return {
    title: 'Padhne ka time ho gaya',
    body: 'Aaj ka plan shuru karo — pehla task abhi kar lo.',
  };
}

export function focusComplete(minutes: number): NotificationCopy {
  return {
    title: 'Focus session poora!',
    body: `Shabaash! ${minutes} minute ka focus session poora hua — +10 points mile.`,
  };
}

export function streakMilestone(days: number): NotificationCopy {
  return {
    title: `${days} din ki streak!`,
    body: `${days} din se lagatar padh rahe ho — rukna mat, kal bhi karna hai.`,
  };
}

export function badgeStudyStreak7(): NotificationCopy {
  return {
    title: 'Badge mila!',
    body: '7-Day Study Streak badge mil gaya — aise hi lagatar padhte raho.',
  };
}

export function badgeFirstFocus(): NotificationCopy {
  return {
    title: 'Badge mila!',
    body: 'First Focus badge mil gaya — pehla focus session poora kar liya.',
  };
}

/* ------------------------------------------------------------------ */
/* Challenges                                                          */
/* ------------------------------------------------------------------ */

export function challengeDayComplete(
  challengeTitle: string,
  dayNumber: number,
  durationDays: number,
): NotificationCopy {
  return {
    title: 'Challenge ka din poora!',
    body: `"${challengeTitle}" — Day ${dayNumber} of ${durationDays} poora hua. +10 points mile.`,
  };
}

export function challengeComplete(
  challengeTitle: string,
  durationDays: number,
  bonus: number,
  badge: boolean,
): NotificationCopy {
  return {
    title: 'Challenge poora kar liya!',
    body: `"${challengeTitle}" — ${durationDays} din poore! +${bonus} bonus points${badge ? ' aur naya badge' : ''} mile.`,
  };
}

export function badgeChallenger(durationDays: number): NotificationCopy {
  return {
    title: 'Badge mila!',
    body: `${durationDays}-Day Challenger badge mil gaya — kamaal kar diya!`,
  };
}

export function challengeCheckinReminder(challengeTitle: string): NotificationCopy {
  return {
    title: 'Aaj ka challenge din baaki hai',
    body: `"${challengeTitle}" ka aaj ka din abhi poora nahi hua — abhi kar lo, streak bachao.`,
  };
}

export function challengeStreakAtRisk(challengeTitle: string, streak: number): NotificationCopy {
  return {
    title: 'Streak tootne wala hai!',
    body: `"${challengeTitle}" me ${streak} din ki streak hai — aaj ka din poora karo, warna streak toot jayegi.`,
  };
}

export function challengeInviteReceived(fromName: string, challengeTitle: string): NotificationCopy {
  return {
    title: 'Challenge ka invite aaya!',
    body: `${fromName} ne tumhe "${challengeTitle}" join karne ke liye bulaya hai — dekho aur join karo.`,
  };
}

export function challengeInviteAccepted(byName: string, challengeTitle: string): NotificationCopy {
  return {
    title: 'Invite accept ho gaya!',
    body: `${byName} ne tumhara "${challengeTitle}" ka invite accept kar liya — saath me khelo.`,
  };
}

export function challengeInviteDeclined(byName: string, challengeTitle: string): NotificationCopy {
  return {
    title: 'Invite decline ho gaya',
    body: `${byName} ne "${challengeTitle}" ka invite decline kar diya.`,
  };
}

/* ------------------------------------------------------------------ */
/* Friends                                                             */
/* ------------------------------------------------------------------ */

export function friendRequestReceived(fromName: string): NotificationCopy {
  return {
    title: 'Friend request aayi!',
    body: `${fromName} tumhara dost banna chahta hai — accept karo ya reject karo.`,
  };
}

export function friendRequestAccepted(byName: string): NotificationCopy {
  return {
    title: 'Friend request accept ho gayi!',
    body: `${byName} ne tumhari friend request accept kar li — ab saath me challenge khelo.`,
  };
}

/* ------------------------------------------------------------------ */
/* Sleep                                                               */
/* ------------------------------------------------------------------ */

export function sleepBedtime(): NotificationCopy {
  return {
    title: 'Sone ka waqt ho gaya',
    body: 'Sone ka time hai — phone rakh do, kal Fajr ke liye fresh uthna hai.',
  };
}

export function sleepWakeup(): NotificationCopy {
  return {
    title: 'Uthne ka waqt ho gaya',
    body: 'Subah ho gayi — utho, Fajr padho aur din shuru karo.',
  };
}

/* ------------------------------------------------------------------ */
/* System                                                              */
/* ------------------------------------------------------------------ */

export function welcome(name: string): NotificationCopy {
  return {
    title: 'AHDORA me swagat hai!',
    body: `Assalamu Alaikum ${name} — onboarding poora karo aur aaj se shuruaat karo.`,
  };
}

export function onboardingIncomplete(): NotificationCopy {
  return {
    title: 'Onboarding adhoora hai',
    body: 'Bas kuch steps baaki hain — onboarding poora karo, tabhi namaz aur study track honge.',
  };
}
