import { Expo } from "expo-server-sdk";
import User from "../models/User.js";
import Notification from "../models/Notification.js";

const expo = new Expo();

/**
 * Send a push notification to a user and store it in the DB.
 *
 * @param {string} userId - The MongoDB user ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body text
 * @param {string} type - "approved" | "rejected" | "updated"
 * @param {string} [formId] - Optional form ID for deep linking
 */
export const sendPushNotification = async (userId, title, body, type, formId = "") => {
  try {
    // 1. Save notification to DB (always, even if push fails)
    await Notification.create({
      user: userId,
      title,
      body,
      type,
      formId,
    });

    // 2. Get user's push token
    const user = await User.findById(userId).select("pushToken").lean();

    if (!user?.pushToken) {
      console.log(`⚠️ No push token for user ${userId}, notification saved to DB only.`);
      return;
    }

    // 3. Validate token
    if (!Expo.isExpoPushToken(user.pushToken)) {
      console.warn(`⚠️ Invalid Expo push token for user ${userId}: ${user.pushToken}`);
      return;
    }

    // 4. Send push notification
    const messages = [
      {
        to: user.pushToken,
        sound: "default",
        title,
        body,
        data: { type, formId, screen: "Notifications" },
        priority: "high",
        channelId: "default",
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        console.log("✅ Push notification sent:", ticketChunk);
      } catch (error) {
        console.error("❌ Error sending push notification chunk:", error);
      }
    }
  } catch (error) {
    console.error("❌ sendPushNotification error:", error);
  }
};

export default sendPushNotification;
