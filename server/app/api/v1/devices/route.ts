import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { devices } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../_lib/auth";
import { newId } from "../_lib/id";

/**
 * POST /api/v1/devices
 * 端末登録・更新。同一 pushToken の再登録は同じ device 行を上書き。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const body = (await request.json().catch(() => null)) as {
    platform?: "ios" | "android";
    pushToken?: string;
    locationPushToken?: string;
    appVersion?: string;
    osVersion?: string;
  } | null;
  if (!body || (body.platform !== "ios" && body.platform !== "android")) {
    return NextResponse.json({ error: "invalid_platform" }, { status: 400 });
  }
  if (!body.pushToken) {
    return NextResponse.json({ error: "push_token_required" }, { status: 400 });
  }

  const now = new Date();
  const existing = await db
    .select()
    .from(devices)
    .where(eq(devices.pushToken, body.pushToken))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(devices)
      .set({
        userId: user.id,
        platform: body.platform,
        locationPushToken:
          body.locationPushToken ?? existing[0].locationPushToken,
        appVersion: body.appVersion ?? existing[0].appVersion,
        osVersion: body.osVersion ?? existing[0].osVersion,
        lastSeenAt: now,
      })
      .where(eq(devices.id, existing[0].id))
      .returning();
    return NextResponse.json({ device: updated[0], created: false });
  }

  const id = newId();
  const inserted = await db
    .insert(devices)
    .values({
      id,
      userId: user.id,
      platform: body.platform,
      pushToken: body.pushToken,
      locationPushToken: body.locationPushToken ?? null,
      appVersion: body.appVersion ?? null,
      osVersion: body.osVersion ?? null,
      lastSeenAt: now,
    })
    .returning();
  return NextResponse.json(
    { device: inserted[0], created: true },
    { status: 201 },
  );
}
