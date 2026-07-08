import { desc, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { users } from "@/app/db/schema";
import { db } from "@/lib/db";
import { requireAdmin } from "../_lib/require-admin";

/**
 * GET /api/v1/admin/users?q=xxx&limit=100
 * ユーザー検索(名前/メールの部分一致)。
 */
export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);

  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      q
        ? or(ilike(users.name, `%${q}%`), ilike(users.email, `%${q}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(limit);
  return NextResponse.json({ users: rows });
}
