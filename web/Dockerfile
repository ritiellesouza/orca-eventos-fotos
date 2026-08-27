FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time NEXT_PUBLIC_* values get baked into the client bundle here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_R2_PUBLIC_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_PHOTO_PRICE_CENTS
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_R2_PUBLIC_URL=$NEXT_PUBLIC_R2_PUBLIC_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_PHOTO_PRICE_CENTS=$NEXT_PUBLIC_PHOTO_PRICE_CENTS
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
