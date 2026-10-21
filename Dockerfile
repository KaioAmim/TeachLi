FROM node:22-slim
RUN corepack enable
WORKDIR /app

# Dependências da raiz: o client importa pacotes (radix-ui, trpc, recharts...)
# que só estão no package.json da raiz e são resolvidos a partir de /app/node_modules.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
