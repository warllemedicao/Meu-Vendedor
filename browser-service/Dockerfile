FROM mcr.microsoft.com/playwright/python:v1.56.0-noble
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DISPLAY=:99
ENV VIRTUAL_ENV=/opt/mv-browser-venv
ENV PATH="/opt/mv-browser-venv/bin:$PATH"
RUN apt-get update && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify fluxbox supervisor python3-venv && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt ./
RUN python -m venv "$VIRTUAL_ENV" && "$VIRTUAL_ENV/bin/python" -m pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --create-home --uid 10001 browser && mkdir -p /data/browser && chown -R browser:browser /data/browser /app
USER browser
EXPOSE 7860
CMD ["/usr/bin/supervisord", "-c", "/app/supervisord.conf"]
