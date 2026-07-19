FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_ENV=development
RUN apk add --no-cache g++ make python3
COPY package*.json ./
RUN npm ci --include=dev

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache g++ make python3
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV MERCH_CLAIM_DB_PATH=/data/merch-shipping-claims.sqlite
RUN apk add --no-cache ca-certificates libstdc++ rclone restic sqlite && mkdir -p /data
COPY package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 8080
CMD ["npm", "run", "start"]
