FROM node:22-slim
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.mjs ./
ENV PORT=8080
USER node
CMD ["npm", "start"]
