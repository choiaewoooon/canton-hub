# Canton Hub backend — FastAPI + APScheduler + Playwright
#
# This image runs the web backend only (api/ + collectors/ + scheduler).
# The telegram bot lives in a separate sibling repo (canton-telegram-bot/)
# and runs independently on the user's home Mac via LaunchAgent.

FROM python:3.12-slim

# System deps for Playwright (Chromium) + build tools + fonts for image generator
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (cached layer)
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install only Chromium for Playwright (avoids full browser suite)
RUN playwright install chromium --with-deps

# Copy the application
COPY api/ ./api/
COPY collectors/ ./collectors/
COPY config.py ./
COPY run_api.py ./
# tweet_summarizer is imported by api/scheduler.py collect_feed.
# On Linux it has no `claude` CLI so it falls back to raw tweet listing
# (set ANTHROPIC_API_KEY later for real AI summaries).
COPY tweet_summarizer.py ./

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

EXPOSE 8000

# Run uvicorn directly (no reload in production)
CMD ["sh", "-c", "uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
