-- 既存の重複行を除去してから NULLS NOT DISTINCT 制約を張る
-- (旧 UNIQUE インデックスは NULL 同士を別値扱いするため、device_id が NULL の
--  シグナルは dedup されず重複が存在し得る)
DELETE FROM "signals" a USING "signals" b
  WHERE a.id > b.id
    AND a.watched_id = b.watched_id
    AND a.type = b.type
    AND a.observed_at = b.observed_at
    AND a.device_id IS NOT DISTINCT FROM b.device_id;--> statement-breakpoint
DROP INDEX "signals_dedup_key";--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_dedup_key" UNIQUE NULLS NOT DISTINCT("watched_id","type","observed_at","device_id");
