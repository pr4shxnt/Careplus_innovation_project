/**
 * medicineCron.ts
 *
 * Runs every minute. Finds medicines whose schedule time matches
 * the current HH:MM (in 12h or 24h format) and sends Expo Push
 * Notifications to the registered device.
 *
 * Push tokens are stored on the User model (expoPushToken field).
 * If a user has no push token the notification is silently skipped.
 */

import cron from "node-cron";
import { Medicine } from "../medicine/medicineModel.ts";
import { User } from "../user/userModel.ts";

// ---------------------------------------------------------------------------
// Expo Push Notification sender
// ---------------------------------------------------------------------------
interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  priority?: "default" | "normal" | "high";
  channelId?: string;
}

async function sendExpoPushNotifications(
  messages: ExpoPushMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json() as { data?: unknown[] };
    const sent = result?.data?.length ?? 0;
    console.log(`[Cron] 📤 Sent ${sent} Expo push notification(s).`);
  } catch (error) {
    console.error("[Cron] Failed to send Expo push notifications:", error);
  }
}

// ---------------------------------------------------------------------------
// Time parser: "08:00 AM" | "08:00 am" | "08:00" | "8:00 AM"
// Returns "HH:MM" in 24-hour format, or null if unparseable
// ---------------------------------------------------------------------------
function parseTimeTo24h(timeStr: string): string | null {
  if (!timeStr) return null;

  // Match "H:MM AM/PM"
  const ampm = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const p = ampm[3].toUpperCase();
    if (p === "AM" && h === 12) h = 0;
    if (p === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // Match "HH:MM" (24-hour)
  const h24 = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const m = parseInt(h24[2], 10);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return null; // Can't parse – skip
}

// ---------------------------------------------------------------------------
// Start the cron job
// ---------------------------------------------------------------------------
export function startMedicineCron() {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

      console.log(`[Cron] ⏰ Checking medicine reminders for ${nowHHMM}...`);

      // Fetch all medicines with at least one pending schedule slot
      const medicines = await Medicine.find({ "schedule.status": "pending" });

      const pushMessages: ExpoPushMessage[] = [];

      for (const med of medicines) {
        let shouldNotify = false;

        for (const slot of med.schedule) {
          if (slot.status !== "pending") continue;

          const parsed = parseTimeTo24h(slot.time);
          if (parsed === nowHHMM) {
            shouldNotify = true;
            break;
          }
        }

        if (!shouldNotify) continue;

        // Look up the user's Expo push token
        const user = await User.findOne({ _id: med.userId }).lean() as any;
        const pushToken: string | undefined = user?.expoPushToken;

        if (!pushToken || !pushToken.startsWith("ExponentPushToken[")) {
          console.log(
            `[Cron] ⚠️  User ${med.userId} has no valid Expo push token – skipping "${med.name}"`,
          );
          continue;
        }

        pushMessages.push({
          to: pushToken,
          title: "💊 Medicine Reminder",
          body: `Time to take ${med.name} – ${med.dosage}`,
          data: { medicineId: String(med._id), medicineName: med.name },
          sound: "default",
          priority: "high",
          channelId: "medicine-reminders",
          badge: 1,
        });

        console.log(
          `[Cron] 🔔 Queued notification: "${med.name}" → ${pushToken}`,
        );
      }

      await sendExpoPushNotifications(pushMessages);
    } catch (error) {
      console.error("[Cron] Error running medicine cron:", error);
    }
  });

  console.log("[Cron] ✅ Medicine reminder cron job started (runs every minute).");
}
