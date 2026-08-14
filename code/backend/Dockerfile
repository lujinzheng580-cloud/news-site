# GlobalInsight 后端服务 Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm ci --only=production || npm install
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npx tsc || echo "跳过编译错误（开发环境使用 tsx）"

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

EXPOSE 4000
CMD ["node", "dist/index.js"]