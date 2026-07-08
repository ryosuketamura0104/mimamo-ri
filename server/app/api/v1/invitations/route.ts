import { NextResponse } from "next/server";
import { invitations } from "@/app/db/schema";
import { db } from "@/lib/db";
import { authenticate } from "../_lib/auth";
import { newId, newInvitationCode } from "../_lib/id";

/**
 * POST /api/v1/invitations
 * 見守られる側が招待コードを発行する。有効期限48h。
 */
export async function POST(request: Request) {
  const auth = await authenticate(request, { requireRole: "watched" });
  if (!auth.ok) return auth.response;

  // 衝突時は最大5回まで再生成
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = newInvitationCode();
    try {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const inserted = await db
        .insert(invitations)
        .values({
          id: newId(),
          watchedId: auth.user.id,
          code,
          expiresAt,
        })
        .returning();
      return NextResponse.json(
        {
          code: inserted[0].code,
          expiresAt: inserted[0].expiresAt,
        },
        { status: 201 },
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("duplicate") || msg.includes("unique")) {
        continue;
      }
      throw error;
    }
  }
  return NextResponse.json(
    { error: "code_generation_failed" },
    { status: 500 },
  );
}
