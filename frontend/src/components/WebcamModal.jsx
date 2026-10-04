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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(30,0,60,0.6)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Webcam capture modal"
    >
      <div
        className="rounded-3xl max-w-md w-full p-6 border space-y-4 shadow-2xl"
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(250,245,255,0.92) 100%)',
          borderColor: 'rgba(216,180,254,0.6)',
          boxShadow: '0 25px 60px rgba(147,51,234,0.2)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-600" />
            <h3 className="font-extrabold text-studio-purple-950 text-base font-serif">Webcam Photo Capture</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-purple-400 hover:text-purple-700 hover:bg-purple-100/60 transition-colors"
            aria-label="Close webcam"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cameraError ? (
          <div
            className="p-4 border border-rose-200/80 rounded-2xl text-xs text-rose-900 space-y-2"
            style={{ background: 'rgba(255,241,242,0.9)' }}
          >
            <div className="flex items-center gap-2 font-bold text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Camera Unavailable</span>
            </div>
            <p className="leading-relaxed">{cameraError}</p>
            <p className="text-rose-600 font-semibold text-[11px]">Note: Camera capture only works on localhost or HTTPS.</p>
            <button
              onClick={startCamera}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="relative aspect-square w-full bg-black/90 rounded-2xl overflow-hidden flex items-center justify-center border border-purple-200/60 shadow-inner">
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-950/60 text-white gap-2 backdrop-blur-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-300" />
                <span className="text-xs font-semibold">Initializing camera...</span>
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

        <div className="flex justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-purple-200/80 text-purple-700 text-xs font-bold hover:bg-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.7)' }}
          >
            Cancel
          </button>
          {!cameraError && (
            <button
              type="button"
              onClick={handleCapture}
              disabled={isLoading || !stream}
              className="px-5 py-2.5 rounded-xl text-white text-xs font-extrabold shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #db2777 100%)' }}
            >
              <Camera className="w-4 h-4" />
              Capture Frame
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
