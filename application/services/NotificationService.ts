/**
 * NotificationService.ts
 *
 * Handles all local push-notification logic for medicine reminders.
 * Uses expo-notifications to schedule daily repeating alerts
 * at the exact time the user set for each medicine schedule entry.
 *
 * Time format expected: "HH:MM AM/PM"  e.g. "08:00 AM" or "03:30 PM"
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// How notifications look when they arrive
// ---------------------------------------------------------------------------
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------------------------------------------------------------------------
// Request notification permissions (call once on app start)
// ---------------------------------------------------------------------------
export async function registerForPushNotificationsAsync(): Promise<boolean> {
  if (!Device.isDevice) {
    // Simulator / emulator – local notifications still work on Android emulators
    console.log("[Notifications] Running on simulator.");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("medicine-reminders", {
      name: "Medicine Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#10b981",
      sound: "default",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[Notifications] Permission not granted.");
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Parse "08:00 AM" / "08:00" → { hour, minute } in 24h
// ---------------------------------------------------------------------------
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  if (!timeStr) return null;

  // Try "HH:MM AM/PM"
  const ampmMatch = timeStr
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === "AM" && hour === 12) hour = 0;
    if (period === "PM" && hour !== 12) hour += 12;
    return { hour, minute };
  }

  // Try "HH:MM" (24h)
  const h24Match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return {
      hour: parseInt(h24Match[1], 10),
      minute: parseInt(h24Match[2], 10),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Schedule a daily repeating notification for a single medicine schedule entry
// Returns the notification identifier (store it to cancel later)
// ---------------------------------------------------------------------------
export async function scheduleMedicineReminder(
  medicineId: string,
  medicineName: string,
  dosage: string,
  timeStr: string,
  scheduleIndex: number = 0,
): Promise<string | null> {
  const parsed = parseTime(timeStr);
  if (!parsed) {
    console.warn(
      `[Notifications] Could not parse time: "${timeStr}" for ${medicineName}`,
    );
    return null;
  }

  // Cancel any existing notification for this medicine+scheduleIndex
  await cancelMedicineReminder(medicineId, scheduleIndex);

  const notifId = await Notifications.scheduleNotificationAsync({
    identifier: buildNotifId(medicineId, scheduleIndex),
    content: {
      title: "💊 Medicine Reminder",
      body: `Time to take ${medicineName} – ${dosage}`,
      data: { medicineId, scheduleIndex, medicineName },
      sound: "default",
      // Android channel
      ...(Platform.OS === "android" && {
        channelId: "medicine-reminders",
        color: "#10b981",
        sticky: false,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });

  console.log(
    `[Notifications] Scheduled "${medicineName}" daily at ${parsed.hour}:${String(parsed.minute).padStart(2, "0")} → id:${notifId}`,
  );
  return notifId;
}

// ---------------------------------------------------------------------------
// Cancel notification for a specific medicine + scheduleIndex
// ---------------------------------------------------------------------------
export async function cancelMedicineReminder(
  medicineId: string,
  scheduleIndex: number = 0,
): Promise<void> {
  const id = buildNotifId(medicineId, scheduleIndex);
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ---------------------------------------------------------------------------
// Cancel ALL notifications linked to a medicine (all schedule entries)
// ---------------------------------------------------------------------------
export async function cancelAllRemindersForMedicine(
  medicineId: string,
): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const prefix = `med-${medicineId}-`;
  await Promise.all(
    all
      .filter((n) => n.identifier.startsWith(prefix))
      .map((n) =>
        Notifications.cancelScheduledNotificationAsync(n.identifier),
      ),
  );
}

// ---------------------------------------------------------------------------
// Schedule reminders for all entries in a medicine's schedule array
// ---------------------------------------------------------------------------
export async function scheduleAllRemindersForMedicine(
  medicineId: string,
  medicineName: string,
  dosage: string,
  schedule: Array<{ time: string; status?: string }>,
): Promise<void> {
  // Cancel existing first
  await cancelAllRemindersForMedicine(medicineId);

  for (let i = 0; i < schedule.length; i++) {
    await scheduleMedicineReminder(
      medicineId,
      medicineName,
      dosage,
      schedule[i].time,
      i,
    );
  }
}

// ---------------------------------------------------------------------------
// Internal: build a stable notification identifier
// ---------------------------------------------------------------------------
function buildNotifId(medicineId: string, scheduleIndex: number): string {
  return `med-${medicineId}-${scheduleIndex}`;
}
