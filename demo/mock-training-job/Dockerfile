FROM python:3.11-slim
WORKDIR /app
COPY training_sim.py .
RUN mkdir -p /checkpoints
CMD ["python3", "training_sim.py"]
