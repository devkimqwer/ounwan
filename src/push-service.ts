import "server-only";

import { and, inArray, isNull } from "drizzle-orm";
import webpush, { type PushSubscription } from "web-push";

import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";

export type NotificationPushPayload = {
  recipientUserId: bigint;
  notificationId: bigint;
  message: string;
  actionType?: string | null;
  actionTargetId?: string | null;
};

type StoredPushSubscription = typeof pushSubscriptions.$inferSelect;

let configured = false;

export async function sendPushForNotifications(notifications: NotificationPushPayload[]) {
  if (notifications.length === 0 || !configureWebPush()) {
    return;
  }

  const recipientUserIds = [...new Set(notifications.map((notification) => notification.recipientUserId))];
  const rows = await db
    .select()
    .from(pushSubscriptions)
    .where(and(inArray(pushSubscriptions.userId, recipientUserIds), isNull(pushSubscriptions.disabledAt)));

  if (rows.length === 0) {
    return;
  }

  const rowsByUserId = new Map<string, StoredPushSubscription[]>();
  for (const row of rows) {
    const userId = row.userId.toString();
    rowsByUserId.set(userId, [...(rowsByUserId.get(userId) ?? []), row]);
  }

  for (const notification of notifications) {
    const subscriptionRows = rowsByUserId.get(notification.recipientUserId.toString()) ?? [];
    await Promise.all(subscriptionRows.map((subscription) => sendPush(subscription, notification)));
  }
}

function configureWebPush() {
  if (configured) {
    return true;
  }

  const publicKey = process.env.OUNWAN_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.OUNWAN_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.OUNWAN_VAPID_SUBJECT?.trim() || process.env.OUNWAN_APP_ORIGIN?.trim() || "mailto:admin@ounwan.net";

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

async function sendPush(subscription: StoredPushSubscription, notification: NotificationPushPayload) {
  try {
    await webpush.sendNotification(toWebPushSubscription(subscription), JSON.stringify(toPushPayload(notification)));
  } catch (error) {
    if (isExpiredSubscriptionError(error)) {
      await db
        .update(pushSubscriptions)
        .set({ disabledAt: new Date(), updatedAt: new Date() })
        .where(and(isNull(pushSubscriptions.disabledAt), inArray(pushSubscriptions.id, [subscription.id])));
      return;
    }

    console.error("[ounwan push error]", error);
  }
}

function toWebPushSubscription(subscription: StoredPushSubscription): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

function toPushPayload(notification: NotificationPushPayload) {
  return {
    title: "오운완",
    body: notification.message,
    url: getNotificationActionUrl(notification),
    notificationId: notification.notificationId.toString(),
  };
}

function getNotificationActionUrl(notification: NotificationPushPayload) {
  if (notification.actionType === "post_detail" && notification.actionTargetId) {
    return `/?postId=${encodeURIComponent(notification.actionTargetId)}`;
  }

  if (notification.actionType === "group_member_management") {
    return "/?more=group-member-management";
  }

  if (notification.actionType === "settlement_detail" && notification.actionTargetId) {
    return `/?settlementId=${encodeURIComponent(notification.actionTargetId)}`;
  }

  return "/";
}

function isExpiredSubscriptionError(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error && [404, 410].includes(Number(error.statusCode));
}