FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json vitest.config.ts ./
COPY src/ src/
COPY tests/ tests/
RUN npm run build

# Default action: generate the dictionary. Override the command to run the test suites.
CMD ["node", "dist/index.js"]
