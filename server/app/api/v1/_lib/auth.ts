import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/app/db/schema";
import { db } from "@/lib/db";
import { verifyIdToken } from "@/lib/firebase-admin";

/**
 * API ルート認証ラッパー。
 * Authorization: Bearer <IDトークン> を検証し、DB の users を返す。
 * トークン未検証・ユーザー未登録は 401。role が期待と異なる場合は 403。
 */

export interface AuthedUser {
  id: string;
  firebaseUid: string;
  role: "watcher" | "watched";
  name: string;
  email: string | null;
  timezone: string;
}

export type AuthResult =
  | { ok: true; user: AuthedUser }
  | { ok: false; response: NextResponse };

export async function authenticate(
  request: Request,
  opts?: { requireRole?: "watcher" | "watched" },
): Promise<AuthResult> {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "Bearer トークンが必要です" },
        { status: 401 },
      ),
    };
  }
  const idToken = header.substring(7).trim();
  const decoded = await verifyIdToken(idToken);
  if (!decoded) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "unauthorized", message: "IDトークンが不正です" },
        { status: 401 },
      ),
    };
  }

  const rows = await db
    .select({
      id: users.id,
      firebaseUid: users.firebaseUid,
      role: users.role,
      name: users.name,
      email: users.email,
      timezone: users.timezone,
    })
    .from(users)
    .where(eq(users.firebaseUid, decoded.uid))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "not_registered", message: "ユーザー未登録です" },
        { status: 401 },
      ),
    };
  }

  const authed: AuthedUser = {
    id: row.id,
    firebaseUid: row.firebaseUid,
    role: row.role as "watcher" | "watched",
    name: row.name,
    email: row.email,
    timezone: row.timezone,
  };

  if (opts?.requireRole && authed.role !== opts.requireRole) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden", message: `${opts.requireRole} ロールが必要です` },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: authed };
}
