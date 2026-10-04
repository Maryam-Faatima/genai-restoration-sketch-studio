# Restoration & Sketch Studio

A multi-task deep learning studio for image restoration and artistic face-to-sketch generation, backed by trained ONNX models and served via a FastAPI backend with a React + Tailwind CSS web interface.

## Project Overview

Restoration & Sketch Studio provides four unified interactive workspaces:
1. **Universal Restoration**: A single autoencoder trained to reconstruct clean, noisy (salt-and-pepper), blurred (Gaussian blur), and occluded images with before/after interactive comparison and quality metrics.
2. **Hard-Routed Restoration**: An image quality classifier detects corruption type and routes the input either to specialized expert autoencoders (salt, blur, occlusion) or directly through an identity bypass for clean images, with support for predicted vs. oracle routing modes.
3. **Soft Mixture-of-Experts Restoration**: A gating network blends the identity branch and all three restoration experts with continuous weights at a fixed gate temperature ($T = 1.26$), displaying active ensemble contributions.
4. **Face-to-Sketch Generator**: A conditional GAN generating high-contrast pencil-style sketches from human portrait photographs across 3 distinct style presets, with support for file upload and live webcam capture.

## Repository Layout

```text
├── backend/                  # FastAPI backend service
│   ├── app/                  # Application code (main, corruptions, models, etc.)
│   ├── tests/                # Pytest test suite
│   ├── Dockerfile            # Container configuration for backend
│   └── requirements.txt      # Python dependencies for backend
├── configs/                  # Model and training configuration files
├── frontend/                 # React 18 + Tailwind CSS single-page application
│   ├── src/                  # Components, workspaces, styles, API client
│   ├── Dockerfile            # Multi-stage container build (Node.js -> Nginx)
│   ├── nginx.conf            # Nginx proxy configuration (/api/ -> backend)
│   ├── package.json          # Pinned exact NPM dependencies
│   └── vite.config.js        # Vite dev server configuration with /api proxy
├── models/                   # ONNX model files (downloaded via script)
├── samples/                  # Preloaded pet and portrait sample images
├── scripts/                  # Helper scripts (download_models.py, etc.)
├── docker-compose.yml        # Multi-container orchestration (backend + frontend)
└── README.md                 # Project documentation
```

## Prerequisites

- **Git**
- **Docker Desktop** (or Docker Engine with Docker Compose)
- **Python 3.10+** (required to run `scripts/download_models.py` before container startup)

## Quickstart

### 1. Clone the repository
```bash
git clone https://github.com/Maryam-Faatima/genai-restoration-sketch-studio.git
cd genai-restoration-sketch-studio
```

### 2. Download the trained models
Download the 7 required ONNX models into `./models` (fetches automatically from the [GitHub Release v1.0](https://github.com/Maryam-Faatima/genai-restoration-sketch-studio/releases/tag/v1.0) with Google Drive fallback):
```bash
python scripts/download_models.py
```
Models can also be downloaded manually from:
- **GitHub Release v1.0**: [Download Release Assets](https://github.com/Maryam-Faatima/genai-restoration-sketch-studio/releases/tag/v1.0)
- **Google Drive Folder**: [Shared Drive Folder](https://drive.google.com/drive/folders/13eGF6sR4aGR4N7InPVb21RzuSDKLAre3)

*(Verifies presence of `task1_universal.onnx`, `task2_classifier.onnx`, `task2_spec_salt.onnx`, `task2_spec_blur.onnx`, `task2_spec_occ.onnx`, `task3_softmoe.onnx`, and `task4_generator.onnx`)*.

### 3. Build and launch with Docker Compose
```bash
docker compose up --build
```

### 4. Open the Web Application
Open your web browser and navigate to:
```text
http://localhost:8080
```

### Stopping the Studio
To stop the running containers:
```bash
docker compose down
```

---

## Running Backend Tests

To run the backend test suite locally:
```bash
cd backend
pip install -r requirements.txt pytest httpx
pytest
```

---

## Running the Frontend in Dev Mode

To develop and test the frontend with Vite hot-reloading:
```bash
# In terminal 1 (start backend on port 8000):
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# In terminal 2 (start frontend dev server on port 5173):
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173`. Vite proxies all `/api/*` requests directly to `http://localhost:8000`.

---

## Troubleshooting

- **Models missing / Degraded health chip**:
  If the header displays a "Degraded" status chip or indicates models are not loaded, run `python scripts/download_models.py` to ensure all 7 `.onnx` files exist in `./models`.
- **Webcam access in Face-to-Sketch**:
  Camera capture (`navigator.mediaDevices.getUserMedia`) requires a secure origin (HTTPS or `http://localhost`). If accessing from an IP or non-localhost domain without SSL, browser security will prevent camera access.
- **Port 8080 already in use**:
  If port 8080 is occupied, change the port mapping in `docker-compose.yml` under `frontend` (e.g. `"8081:80"`).

---

- **YouTube Demo**: [Watch the walkthrough](https://youtu.be/hl0AEWOZavM?si=2v_Tvvj9xiunxTBJ)
- **Project Report**: [`reports/report.pdf`](reports/report.pdf)
