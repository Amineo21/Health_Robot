# Étape 1 : builder l'app React
FROM node:20 AS builder
WORKDIR /app
COPY health-robot-front/package*.json ./
RUN npm install
COPY health-robot-front/ ./
RUN npm run build

# Étape 2 : serveur léger pour servir le build
FROM node:20-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=builder /app/build ./build
EXPOSE 80
CMD ["serve", "-s", "build", "-l", "80"]
