import React, { useRef } from 'react';
import { Upload, Image as ImageIcon, X } from 'lucide-react';

export default function ImagePicker({
  selectedFile,
  previewUrl,
  onImageSelected,
  onError,
  samples = [],
  sampleType = 'pet', // 'pet' or 'face'
  disabled = false,
  customTitle = null,
}) {
  const fileInputRef = useRef(null);

  const filteredSamples = samples.filter((s) => {
    if (sampleType === 'pet') return s.name.startsWith('pet_');
    if (sampleType === 'face') return s.name.startsWith('face_');
    return true;
  });

  const validateAndSelectFile = (file) => {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      if (onError) onError('Invalid file type. Only PNG, JPEG, or WEBP images are allowed.');
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      if (onError) onError('File too large. Maximum allowed size is 10 MB.');
      return;
    }

    if (onError) onError(null);
    onImageSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleSampleClick = async (sample) => {
    if (disabled) return;
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error('Failed to load sample image');
      const blob = await response.blob();
      const file = new File([blob], sample.name, { type: blob.type || 'image/png' });
      validateAndSelectFile(file);
    } catch (err) {
      if (onError) onError(`Could not load sample: ${err.message}`);
    }
  };

  const handleClear = () => {
    if (disabled) return;
    onImageSelected(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-3xl border border-[#2D2424]/10 bg-white p-6 space-y-5 shadow-scafos">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-[#2D2424]/10 pb-3">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-[#C24B38]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase text-[#2D2424]">
            {customTitle || 'Select Input Image'}
          </h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-[#7C6F6F] border border-[#2D2424]/15 px-2.5 py-0.5 rounded-full bg-[#F8E7E3]">
          PNG, JPEG or WEBP · Max 10 MB
        </span>
      </div>

      {/* Drag & Drop Area / Active Preview */}
      {previewUrl ? (
        <div className="relative rounded-2xl border-2 border-[#C24B38]/30 bg-[#FFF7F4] p-3 flex flex-col items-center">
          <div className="relative w-44 h-44 bg-white rounded-xl flex items-center justify-center border border-[#2D2424]/10 overflow-hidden shadow-xs">
            <img
              src={previewUrl}
              alt="Selected preview"
              className="w-full h-full object-contain"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between w-full px-2">
            <span className="text-[11px] font-mono text-[#7C6F6F] truncate max-w-[180px]">
              {selectedFile?.name || 'Selected Image'}
            </span>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C24B38] hover:text-[#A63827] uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Change Photo</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed border-[#C24B38]/30 hover:border-[#C24B38] bg-[#FFF7F4] hover:bg-white transition-all duration-300 p-8 text-center cursor-pointer ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                validateAndSelectFile(e.target.files[0]);
              }
            }}
            disabled={disabled}
          />
          <div className="w-12 h-12 rounded-full bg-[#F8E7E3] text-[#C24B38] flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Upload className="w-5 h-5 text-[#C24B38]" />
          </div>
          <p className="text-xs uppercase tracking-widest font-bold text-[#2D2424]">
            Drag & drop or tap to browse
          </p>
          <p className="text-[10px] text-[#7C6F6F] mt-1 font-mono">
            PNG, JPEG or WEBP (Max 10 MB)
          </p>
        </div>
      )}

      {/* Samples Thumbnails Gallery */}
      {filteredSamples.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest font-bold text-[#7C6F6F]">
            <span>Or Pick a Studio Sample</span>
            <span className="font-handwriting text-2xl text-[#C24B38]">{filteredSamples.length} cute swatches</span>
          </div>
          <div className="grid grid-cols-4 gap-2.5 max-h-36 overflow-y-auto pr-1">
            {filteredSamples.map((sample) => (
              <button
                key={sample.name}
                type="button"
                onClick={() => handleSampleClick(sample)}
                disabled={disabled}
                className="group relative rounded-xl border border-[#2D2424]/15 hover:border-[#C24B38] bg-white p-1 transition-all duration-200 flex flex-col items-center disabled:opacity-50 hover:shadow-xs"
              >
                <img
                  src={sample.url}
                  alt={sample.name}
                  className="w-full aspect-square object-cover rounded-lg"
                  loading="lazy"
                />
                <span className="text-[9px] font-mono text-[#7C6F6F] truncate w-full text-center mt-1 group-hover:text-[#C24B38] font-semibold">
                  {sample.name.replace(/^(pet_|face_)/, '').replace(/\.png$/, '')}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
