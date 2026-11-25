FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server.js ./
COPY public ./public

# Railway injeta PORT em runtime; 3000 é só o padrão local
ENV PORT=3000
EXPOSE 3000

USER node
CMD ["node", "server.js"]
