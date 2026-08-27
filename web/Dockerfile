FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time NEXT_PUBLIC_* values get baked into the client bundle here.
# Next.js only inlines these via a literal build-time replacement, so they
# can't come from the platform's *runtime* env var UI (EasyPanel's
# "Ambiente" tab only feeds `docker run`, not `docker build` — verified via
# its deploy log, which only passes `--build-arg GIT_SHA=...`). None of
# these four are secret, so hardcoding real values here — rather than
# leaving them as unfillable ARGs — is the correct fix, not a shortcut.
# To change one: edit here and redeploy.
ENV NEXT_PUBLIC_SUPABASE_URL=http://kong:8000
ENV NEXT_PUBLIC_R2_PUBLIC_URL=https://pub-5e8d8563144a49b689989e38b1b2b92f.r2.dev
ENV NEXT_PUBLIC_SITE_URL=https://clicka.orcamidias.com
ENV NEXT_PUBLIC_PHOTO_PRICE_CENTS=1500
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
# No `public/` dir exists in this project (create-next-app@14 --no-src-dir
# never generated one) — if you add static assets under web/public later,
# add `COPY --from=builder /app/public ./public` back here.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
