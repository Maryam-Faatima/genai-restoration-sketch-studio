import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Check } from 'lucide-react';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export default function ImagePicker({
  selectedFile,
  previewUrl,
  onImageSelected,
  onError,
  samples = [],
  sampleType = 'pet', // 'pet' or 'face'
  disabled = false,
  customTitle = "Select or Upload Image"
}) {
  const fileInputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedSampleName, setSelectedSampleName] = useState(null);

  const filterPrefix = sampleType === 'face' ? 'face_' : 'pet_';
  const filteredSamples = samples.filter(s => s.name.startsWith(filterPrefix));

  const validateAndSetFile = (file, sampleName = null) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      onError('Unsupported image type. Use PNG, JPEG or WEBP.');
      return;
    }

    if (file.size > MAX_BYTES) {
      onError('File too large (max 10 MB).');
      return;
    }

    onError(null);
    setSelectedSampleName(sampleName);
    onImageSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleSelectSample = async (sample) => {
    if (disabled) return;
    try {
      onError(null);
      const res = await fetch(sample.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], sample.name, { type: blob.type || 'image/png' });
      validateAndSetFile(file, sample.name);
    } catch (err) {
      onError(`Failed to load sample image: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-studio-border p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-studio-purple-950 text-base flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-purple-600" />
          <span>{customTitle}</span>
        </h3>
        <span className="text-xs text-purple-600/70 font-medium">
          PNG, JPEG or WEBP, max 10 MB
        </span>
      </div>

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center min-h-[140px] ${
          disabled
            ? 'opacity-50 cursor-not-allowed border-purple-200 bg-purple-50/30'
            : isDragging
            ? 'border-purple-500 bg-purple-100/50 scale-[0.99]'
            : 'border-purple-200/80 hover:border-purple-400 bg-purple-50/20 hover:bg-purple-50/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled}
        />

        {previewUrl ? (
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <div className="relative group">
              <img
                src={previewUrl}
                alt="Selected preview"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg border border-purple-200 bg-white shadow-sm"
              />
              <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium">
                Change
              </div>
            </div>
            <div className="text-left text-xs space-y-1">
              <p className="font-medium text-studio-purple-950 truncate max-w-[200px]">
                {selectedFile?.name || 'Selected Image'}
              </p>
              <p className="text-purple-600/70">
                {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : ''}
              </p>
              <span className="inline-block text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[11px] font-medium">
                Click or drag another to replace
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2 shadow-sm">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-studio-purple-950">
              Drag & drop or tap to browse
            </p>
            <p className="text-xs text-purple-500/80 mt-1">
              Allowed: PNG, JPEG or WEBP (Max 10 MB)
            </p>
          </>
        )}
      </div>

      {/* Samples section */}
      {filteredSamples.length > 0 && (
        <div className="pt-2 border-t border-purple-100/60">
          <p className="text-xs font-semibold text-studio-purple-900 uppercase tracking-wider mb-2.5">
            Or pick a {sampleType === 'face' ? 'face portrait' : 'clean pet'} sample:
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2.5">
            {filteredSamples.map((sample, idx) => {
              const isSelected = selectedSampleName === sample.name;
              return (
                <button
                  key={sample.name}
                  type="button"
                  onClick={() => handleSelectSample(sample)}
                  disabled={disabled}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl border text-center transition-all ${
                    isSelected
                      ? 'border-purple-500 bg-purple-100/60 ring-2 ring-purple-400 ring-offset-1'
                      : 'border-purple-200/70 bg-white hover:border-purple-300 hover:bg-purple-50/40'
                  }`}
                >
                  <img
                    src={sample.url}
                    alt={sample.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg bg-purple-50"
                  />
                  <span className="text-[11px] font-medium text-studio-purple-900 mt-1 truncate max-w-full">
                    {sampleType === 'face' ? `Portrait ${idx + 1}` : `Pet ${idx + 1}`}
                  </span>
                  {isSelected && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-purple-600 text-white rounded-full flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
