FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY deployment/frontend/package.json deployment/frontend/package-lock.json ./
RUN npm ci --include=dev
COPY deployment/frontend/ ./
ENV VITE_API_BASE_URL=/api VITE_USE_MOCK=false VITE_DEMO_MODE=false
RUN npm run build

FROM python:3.11-slim-bookworm
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt ./
COPY deployment/requirements.txt ./deployment/requirements.txt
RUN pip install --no-cache-dir -r deployment/requirements.txt
COPY app/ ./app/
COPY config/ ./config/
COPY datasets/ ./datasets/
COPY deployment/ ./deployment/
COPY --from=frontend /build/dist/ ./dist/
EXPOSE 10000
CMD ["python", "-m", "deployment.start"]
