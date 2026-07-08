import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../../_lib/auth";

/**
 * 管理API共通の認可: users.isAdmin=true を要求。
 */
export async function requireAdmin(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, auth.user.id))
    .limit(1);
  if (!rows[0]?.isAdmin) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "admin_required" }, { status: 403 }),
    };
  }
  return { ok: true as const, user: auth.user };
}
