FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY public ./public
COPY src ./src
COPY README.md ./
COPY .env.example ./

ENV NODE_ENV=production
ENV PORT=10000
ENV HEADLESS=true

EXPOSE 10000

CMD ["npm", "start"]
