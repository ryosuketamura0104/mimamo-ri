import { NextResponse } from "next/server";
import { hasEntitlement } from "@/lib/entitlement";
import {
  getWatcherFreeTierPairLimit,
  WATCHER_PREMIUM_ENTITLEMENT,
} from "@/lib/env";
import { authenticate } from "../../_lib/auth";

/**
 * GET /api/v1/entitlement/me
 * 自分の課金状態と無料枠の情報を返す。
 * クライアント側で「サブスク画面を出すか」の判定に使う。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const active = await hasEntitlement(auth.user.id);
  return NextResponse.json({
    entitlement: WATCHER_PREMIUM_ENTITLEMENT,
    active,
    freeTierPairLimit: getWatcherFreeTierPairLimit(),
  });
}
