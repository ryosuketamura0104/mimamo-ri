#!/bin/sh
# 実測の進捗をざっと見る。引数で日数を指定できる(既定 7)。
DAYS="${1:-7}"
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "
select type, count(*) as 件数,
       to_char(min(observed_at at time zone 'Asia/Tokyo'),'MM/DD HH24:MI') as 最初,
       to_char(max(observed_at at time zone 'Asia/Tokyo'),'MM/DD HH24:MI') as 最後
  from signals where observed_at > now() - interval '$DAYS days'
 group by type order by 2 desc;"
echo '--- ロック解除: 常駐イベント vs サンプリング ---'
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "
select
  count(*) filter (where type='unlock_event') as 常駐イベント,
  count(*) filter (where type='unlock_probe') as サンプリング,
  count(*) filter (where type='widget_probe') as widget発火,
  count(*) filter (where type='charging_start') as 充電開始
  from signals where observed_at > now() - interval '$DAYS days';"
echo '--- アプリ非前面で拾えたロック解除(常駐が効いている証拠) ---'
docker exec mimamori-postgres psql -U mimamori -d mimamori -c "
select to_char(u.observed_at at time zone 'Asia/Tokyo','MM/DD HH24:MI:SS') as 解除時刻
  from signals u
 where u.type='unlock_event'
   and not exists (select 1 from signals a where a.type='app_open'
                     and abs(extract(epoch from (a.observed_at - u.observed_at))) < 20)
 order by u.observed_at desc limit 10;"
