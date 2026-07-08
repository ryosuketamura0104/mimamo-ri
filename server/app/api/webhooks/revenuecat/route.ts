import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { newId } from "@/app/api/v1/_lib/id";
import { subscriptions, users } from "@/app/db/schema";
import { db } from "@/lib/db";
import { getRevenueCatWebhookSecret } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * POST /api/webhooks/revenuecat
 * RevenueCat の Webhook を受信し、subscriptions テーブルを更新する。
 * Authorization ヘッダで検証(RevenueCat側のダッシュボードで設定した固定トークン)。
 *
 * 参考: https://www.revenuecat.com/docs/webhooks
 * イベント種別: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, PRODUCT_CHANGE, BILLING_ISSUE 等
 */

interface RcEvent {
  type: string;
  id: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  expiration_at_ms?: number | null;
  store?: string; // "APP_STORE" | "PLAY_STORE" | "STRIPE" 等
}

function normalizeStore(s: string | undefined): string {
  switch (s) {
    case "APP_STORE":
      return "app_store";
    case "PLAY_STORE":
      return "play_store";
    case "STRIPE":
      return "stripe";
    default:
      return (s ?? "unknown").toLowerCase();
  }
}

function statusFromEventType(type: string): string {
  switch (type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "TRANSFER":
      return "active";
    case "CANCELLATION":
      return "cancelled";
    case "EXPIRATION":
      return "expired";
    case "BILLING_ISSUE":
      return "in_grace_period";
    default:
      return "unknown";
  }
}

export async function POST(request: Request) {
  const expected = getRevenueCatWebhookSecret();
  if (!expected) {
    return NextResponse.json({ error: "webhook_disabled" }, { status: 503 });
  }
  const header = request.headers.get("authorization");
  if (header !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    event?: RcEvent;
  } | null;
  const event = payload?.event;
  if (!event) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  // app_user_id は RevenueCat 側で Firebase UID として設定される想定
  const firebaseUid = event.app_user_id ?? event.original_app_user_id;
  if (!firebaseUid) {
    return NextResponse.json({ error: "no_app_user_id" }, { status: 400 });
  }
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    logger.warn("RevenueCat webhook: 未登録ユーザー", {
      firebaseUid,
      eventId: event.id,
    });
    // 200 を返して RevenueCat のリトライを止める(ユーザーは後で登録される可能性)
    return NextResponse.json({ ignored: "user_not_found" });
  }

  const entitlements =
    event.entitlement_ids ??
    (event.entitlement_id ? [event.entitlement_id] : []);
  if (entitlements.length === 0) {
    // エンタイトルメント非依存イベント(TEST等)は無視
    return NextResponse.json({ ignored: "no_entitlements" });
  }

  const status = statusFromEventType(event.type);
  const store = normalizeStore(event.store);
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : null;

  for (const ent of entitlements) {
    await db
      .insert(subscriptions)
      .values({
        id: newId(),
        userId: user.id,
        entitlement: ent,
        productId: event.product_id ?? null,
        status,
        store,
        expiresAt,
        revenuecatEventId: event.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [subscriptions.userId, subscriptions.entitlement],
        set: {
          productId: event.product_id ?? null,
          status,
          store,
          expiresAt,
          revenuecatEventId: event.id,
          updatedAt: new Date(),
        },
      });
  }

  logger.info("RevenueCat webhook 処理", {
    eventId: event.id,
    type: event.type,
    userId: user.id,
    entitlements,
    status,
  });

  return NextResponse.json({ ok: true });
}
