# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Yarn 활성화
RUN corepack enable

# package.json과 lock 파일만 먼저 복사 (캐시 활용)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Yarn 활성화
RUN corepack enable

# Dependencies 복사
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 환경 변수 설정 (빌드 시 필요)
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 백엔드 API URL과 API 키를 빌드 타임에 설정
ARG NEXT_PUBLIC_API_URL=https://genova-ai-backend-987680405347.asia-northeast3.run.app
ARG NEXT_PUBLIC_API_KEY
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_KEY=$NEXT_PUBLIC_API_KEY
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ENV NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID

# Next.js 빌드
RUN yarn build

# Stage 3: Runner (최종 이미지)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 보안을 위한 non-root 유저 생성
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Public 파일 복사
COPY --from=builder /app/public ./public

# Standalone 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Cloud Run에서 사용하는 PORT 환경변수 (기본 8080)
EXPOSE 8080
ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# 서버 시작
CMD ["node", "server.js"]
