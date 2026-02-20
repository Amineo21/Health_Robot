FROM python:3.11-slim

WORKDIR /app

# Copier requirements et installer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code source
COPY . .

# Exposer le port FastAPI
EXPOSE 4000

# Commande pour lancer l'app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4000"]
