FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY index.js automod.js ./

ENV NODE_ENV=production
CMD ["node", "index.js"]
