FROM python:3.10-slim

WORKDIR /app

# Install system libraries needed for XGBoost and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements from root
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . /app/backend

# Expose FastAPI port
EXPOSE 8000

ENV PYTHONPATH=/app

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
