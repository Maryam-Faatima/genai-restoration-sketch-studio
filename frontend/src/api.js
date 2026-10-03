/**
 * API client module for Restoration & Sketch Studio
 * Uses relative URLs (/api/...) for compatibility with Vite proxy and Nginx reverse proxy.
 */

export async function checkHealth(signal) {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) {
    let msg = `Health check failed with HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export async function getSamples(signal) {
  const res = await fetch('/api/samples', { signal });
  if (!res.ok) {
    let msg = `Failed to fetch samples: HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.detail) msg = err.detail;
    } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}

export async function postUniversal({ imageFile, corruption = 'uploaded', severity = 'medium', seed = null, signal }) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('corruption', corruption);
  formData.append('severity', severity);
  if (seed !== null && seed !== '' && !isNaN(seed)) {
    formData.append('seed', seed);
  }

  const res = await fetch('/api/universal', {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) errorDetail = data.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function postHard({ imageFile, corruption = 'uploaded', severity = 'medium', seed = null, routing = 'predicted', signal }) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('corruption', corruption);
  formData.append('severity', severity);
  formData.append('routing', routing);
  if (seed !== null && seed !== '' && !isNaN(seed)) {
    formData.append('seed', seed);
  }

  const res = await fetch('/api/hard', {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) errorDetail = data.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function postSoft({ imageFile, corruption = 'uploaded', severity = 'medium', seed = null, signal }) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('corruption', corruption);
  formData.append('severity', severity);
  if (seed !== null && seed !== '' && !isNaN(seed)) {
    formData.append('seed', seed);
  }

  const res = await fetch('/api/soft', {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) errorDetail = data.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json();
}

export async function postSketch({ photoFile, style = 1, signal }) {
  const formData = new FormData();
  formData.append('photo', photoFile);
  formData.append('style', style);

  const res = await fetch('/api/sketch', {
    method: 'POST',
    body: formData,
    signal,
  });

  if (!res.ok) {
    let errorDetail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.detail) errorDetail = data.detail;
    } catch (_) {}
    throw new Error(errorDetail);
  }

  return res.json();
}
