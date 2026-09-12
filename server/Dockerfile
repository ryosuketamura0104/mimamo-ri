# Cloud Run 用。next.config.ts の output: "standalone" を前提にした多段ビルド。
# firebase-admin が require() と Node 組み込みを使い、pg は TCP、APNs は HTTP/2 を要求するため、
# Edge ランタイムではなくフル Node で動かす。

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# ---- 依存解決 ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
# --ignore-scripts はローカルの状態に合わせている。pnpm 10 は既定で
# esbuild / protobufjs / sharp などの build script を実行せず、
# 非対話環境ではそれをエラーにするため明示的に無効化する。
# next/image を使っていないので sharp のネイティブビルドも不要。
RUN pnpm install --frozen-lockfile --ignore-scripts

# ---- ビルド ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ビルド時に DB へ繋ぎにいかないよう、ダミーの接続文字列を渡す。
# 実際の値は実行時に Cloud Run の環境変数で注入する。
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ---- 実行 ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# public/ は存在しないため COPY しない(追加したらここに戻す)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run は PORT を注入する。standalone の server.js はこれを見る。
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
