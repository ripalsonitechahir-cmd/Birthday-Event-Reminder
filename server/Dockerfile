FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN node node_modules/prisma/build/index.js generate
COPY src ./src
COPY docker-entrypoint.sh ./
RUN mkdir -p /data && chown -R node:node /data /app
USER node
ENV DATABASE_URL=file:/data/app.db PORT=4717
EXPOSE 4717
VOLUME /data
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s CMD node -e "fetch('http://localhost:4717/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "docker-entrypoint.sh"]
