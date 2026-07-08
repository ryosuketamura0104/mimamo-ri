import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users, watchSettings } from "@/app/db/schema";
import { db } from "@/lib/db";
import { verifyIdToken } from "@/lib/firebase-admin";
import { newId } from "../../_lib/id";

/**
 * ユーザー登録。
 * IDトークンで Firebase UID を検証し、users に新規行を作成する。
 * watched ロールなら watch_settings のデフォルト行も同時に作成。
 */
export async function POST(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const decoded = await verifyIdToken(header.substring(7).trim());
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    role?: string;
    name?: string;
    email?: string;
    timezone?: string;
  } | null;
  if (!body || (body.role !== "watcher" && body.role !== "watched")) {
    return NextResponse.json(
      { error: "invalid_role", message: "role は watcher または watched" },
      { status: 400 },
    );
  }
  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, decoded.uid))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ user: existing[0], created: false });
  }

  const userId = newId();
  const tz = body.timezone ?? "Asia/Tokyo";
  const inserted = await db
    .insert(users)
    .values({
      id: userId,
      firebaseUid: decoded.uid,
      role: body.role,
      name: body.name.trim(),
      email: body.email ?? decoded.email ?? null,
      timezone: tz,
    })
    .returning();

  if (body.role === "watched") {
    await db.insert(watchSettings).values({
      id: newId(),
      watchedId: userId,
      timezone: tz,
    });
  }

  return NextResponse.json(
    { user: inserted[0], created: true },
    { status: 201 },
  );
}
