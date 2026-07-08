"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { getFirebaseAuthClient } from "@/lib/firebase-client";

/**
 * Firebase Auth のセッション状態と IDトークン取得を提供する。
 */

export function useAuthUser(): { user: User | null; loading: boolean } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getFirebaseAuthClient();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { user, loading };
}

/**
 * SWR fetcher: fetch のたびに IDトークンを付与。
 * 引数は URL 文字列。
 */
export async function authedFetcher<T>(url: string): Promise<T> {
  const auth = getFirebaseAuthClient();
  const u = auth.currentUser;
  if (!u) throw new Error("unauthenticated");
  const token = await u.getIdToken();
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function authedRequest<T>(
  url: string,
  init: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const auth = getFirebaseAuthClient();
  const u = auth.currentUser;
  if (!u) throw new Error("unauthenticated");
  const token = await u.getIdToken();
  const { body, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
