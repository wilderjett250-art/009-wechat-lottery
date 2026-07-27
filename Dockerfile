FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=5177
EXPOSE 5177
CMD ["npm", "start"]
