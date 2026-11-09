# ── Stage: build & run ───────────────────────────────────────────────────────
FROM python:3.12-slim

# OpenShift runs containers as an arbitrary non-root UID in the root group (0).
# Setting group ownership to 0 and making the dir group-writable satisfies that.
WORKDIR /app

# Install dependencies first (layer-cached)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

# Create the SQLite DB directory and ensure it's writable by any UID
RUN mkdir -p /app/data && \
    chown -R 1001:0 /app && \
    chmod -R g+rwX /app

# OpenShift requires a non-root user
USER 1001

# OpenShift uses port 8080 for unprivileged containers
EXPOSE 8080

# Pass port via env so app.py picks it up with os.environ.get('PORT', 5000)
ENV PORT=8080
ENV FLASK_ENV=production
ENV DB_PATH=/app/data/homeserve.db

CMD ["python", "app.py"]
