import { Transaction, StreakDay, AppSettings } from '../types';

/**
 * Calculates current streak and updates it.
 * It traces back day by day from today.
 * If a day has no transaction activity, it attempts to use a Streak Freeze (if available).
 */
export function processStreaks(
  transactions: Transaction[],
  streakDays: StreakDay[],
  settings: AppSettings,
  saveStreakDayFn: (sd: StreakDay) => Promise<void>,
  saveSettingsFn: (s: AppSettings) => Promise<void>
): {
  currentStreak: number;
  weeklyProgress: boolean[]; // Mon-Sun progress for the current week
  freezeCount: number;
  streakTriggeredMilestone: boolean;
  milestoneTier: string;
} {
  // Get date strings in local timezone YYYY-MM-DD
  const getLocalDateString = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const todayStr = getLocalDateString(today);
  
  // Set of all dates with transactions
  const txDates = new Set(transactions.map(t => t.date));

  // Determine current streak
  let currentStreak = 0;
  let freezeCount = settings.freezeCount;
  let hasBroken = false;
  let dateToCheck = new Date(today);
  let streakTriggeredMilestone = false;

  // We start checking from today or yesterday depending on whether today has activity
  const todayHasActivity = txDates.has(todayStr);

  // Helper to subtract 1 day
  const previousDay = (d: Date) => {
    const newD = new Date(d);
    newD.setDate(newD.getDate() - 1);
    return newD;
  };

  let checkStr = getLocalDateString(dateToCheck);
  
  // If today has no activity, we start checking from yesterday for the streak chain.
  // Today's lack of activity doesn't break the streak yet until the day is completely over (or until tomorrow).
  if (!todayHasActivity) {
    dateToCheck = previousDay(today);
    checkStr = getLocalDateString(dateToCheck);
  }

  // Set of frozen dates we have recorded in DB to avoid double-deducting freezes
  const frozenDates = new Set(
    streakDays.filter(sd => !sd.hasActivity && sd.streakCount > 0).map(sd => sd.date)
  );

  // Let's trace back
  let daysInStreak = 0;
  while (!hasBroken) {
    checkStr = getLocalDateString(dateToCheck);
    
    if (txDates.has(checkStr)) {
      currentStreak++;
      daysInStreak++;
      // Move to previous day
      dateToCheck = previousDay(dateToCheck);
    } else {
      // No transaction activity on this day. Can we use/did we use a freeze?
      if (frozenDates.has(checkStr)) {
        // Already recorded as a frozen day, preserve streak count
        daysInStreak++;
        dateToCheck = previousDay(dateToCheck);
      } else if (freezeCount > 0) {
        // Consume a freeze!
        freezeCount--;
        // Save this day as a frozen day in the database
        saveStreakDayFn({
          date: checkStr,
          hasActivity: false,
          streakCount: currentStreak // Keep current streak count
        });
        frozenDates.add(checkStr);
        daysInStreak++;
        dateToCheck = previousDay(dateToCheck);
      } else {
        // No freeze available, streak is broken here!
        hasBroken = true;
      }
    }

    // Safeguard to prevent infinite loops (max 365 days check)
    if (daysInStreak > 365) {
      break;
    }
  }

  // If today actually has activity, make sure today is counted if it wasn't already in the loop
  if (todayHasActivity && !txDates.has(getLocalDateString(today))) {
    // Already covered in loop since dateToCheck started at today
  }

  // Let's update settings if freezeCount changed or if user reached a multiple of 7 milestone
  let updatedSettings = { ...settings };
  let settingsChanged = false;

  if (freezeCount !== settings.freezeCount) {
    updatedSettings.freezeCount = freezeCount;
    settingsChanged = true;
  }

  // Check if milestone (multiple of 7) is reached and reward a freeze
  // We check if we have a recorded milestone for this streak in settings (or just reward it when they hit it)
  // Let's grant a freeze if currentStreak > 0, currentStreak % 7 === 0 and we haven't rewarded it yet today
  // To keep it simple, we store streak counts that already got rewards or we just reward when they transition
  const lastStreakRecord = streakDays.find(s => s.date === todayStr);
  if (currentStreak > 0 && currentStreak % 7 === 0 && (!lastStreakRecord || lastStreakRecord.streakCount < currentStreak)) {
    // Reward a freeze (max 3 caps)
    if (updatedSettings.freezeCount < 3) {
      updatedSettings.freezeCount += 1;
      settingsChanged = true;
      streakTriggeredMilestone = true;
    }
  }

  if (settingsChanged) {
    saveSettingsFn(updatedSettings);
  }

  // Record today's streak in DB if it has activity or if there's no record
  const recordedToday = streakDays.find(sd => sd.date === todayStr);
  if (!recordedToday || (recordedToday.hasActivity !== todayHasActivity) || recordedToday.streakCount !== currentStreak) {
    saveStreakDayFn({
      date: todayStr,
      hasActivity: todayHasActivity,
      streakCount: currentStreak
    });
  }

  // Calculate Mon-Sun progress of the current week
  // Get start of week (Monday)
  const currentDayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
  const daysToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);

  const weeklyProgress = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = getLocalDateString(day);
    return txDates.has(dayStr);
  });

  // Determine milestone tier
  let milestoneTier = 'Pemula';
  if (currentStreak >= 30) {
    milestoneTier = 'Master';
  } else if (currentStreak >= 7) {
    milestoneTier = 'Konsisten';
  }

  return {
    currentStreak,
    weeklyProgress,
    freezeCount: updatedSettings.freezeCount,
    streakTriggeredMilestone,
    milestoneTier
  };
}
