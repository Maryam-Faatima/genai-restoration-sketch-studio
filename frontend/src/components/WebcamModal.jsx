import React, { useState, useRef, useEffect } from 'react';
import { Camera, RefreshCw, AlertCircle, X } from 'lucide-react';

export default function WebcamModal({ isOpen, onClose, onCapture, onError }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setIsLoading(true);
    setCameraError(null);

    // Check secure context
    if (window.isSecureContext === false && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const err = "Webcam access requires a secure origin (HTTPS or localhost).";
      setCameraError(err);
      if (onError) onError(err);
      setIsLoading(false);
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = "Camera API is not supported in this browser.";
      setCameraError(err);
      if (onError) onError(err);
      setIsLoading(false);
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: "user"
        },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      let friendly = "Camera error: could not access camera.";
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendly = "Camera permission was denied. Please allow camera access in browser settings.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendly = "No camera found on this device.";
      }
      setCameraError(friendly);
      if (onError) onError(friendly);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    // Ensure square crop from center
    const size = Math.min(video.videoWidth, video.videoHeight) || 480;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const startX = (video.videoWidth - size) / 2;
    const startY = (video.videoHeight - size) / 2;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `webcam_${Date.now()}.png`, { type: 'image/png' });
        stopCamera();
        onCapture(file);
      }
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-purple-950/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-purple-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-studio-purple-950 text-base">Webcam Photo Capture</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-full text-purple-400 hover:text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cameraError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>Camera Unavailable</span>
            </div>
            <p>{cameraError}</p>
            <p className="text-rose-600 font-medium">Note: Camera capture only works on localhost or HTTPS.</p>
            <button
              onClick={startCamera}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="relative aspect-square w-full bg-black rounded-xl overflow-hidden flex items-center justify-center border border-purple-200">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-900/40 text-white gap-2">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <span className="text-xs">Initializing camera...</span>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-purple-200 text-purple-700 text-sm font-medium hover:bg-purple-50 transition-colors"
          >
            Cancel
          </button>
          {!cameraError && (
            <button
              type="button"
              onClick={handleCapture}
              disabled={isLoading || !stream}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 text-white text-sm font-semibold shadow hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              Capture Frame
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
