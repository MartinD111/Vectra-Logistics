'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, X, CheckCircle2, Upload, ImageIcon } from 'lucide-react';

interface CameraCaptureProps {
  shipmentId: string;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
}

export function CameraCapture({ shipmentId, onSubmit, isSubmitting }: CameraCaptureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleRetake = useCallback(() => {
    setPreview(null);
    setFile(null);
    // Reset the input so the same file can be reselected
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  const handleSubmit = useCallback(() => {
    if (!file) return;
    const fd = new FormData();
    fd.append('document', file);
    fd.append('shipment_id', shipmentId);
    onSubmit(fd);
  }, [file, shipmentId, onSubmit]);

  return (
    <div className="flex flex-col gap-4">

      {/* Section heading */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-primary-300">
          Proof of Delivery
        </span>
      </div>

      {/* Preview area */}
      <div className="relative w-full rounded-2xl overflow-hidden bg-slate-800 border-2 border-dashed border-slate-600 aspect-[4/3] flex items-center justify-center">
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Proof of delivery preview"
              className="w-full h-full object-cover"
            />
            {/* Retake button overlay */}
            <button
              onClick={handleRetake}
              aria-label="Retake photo"
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white active:bg-slate-700"
            >
              <X size={20} />
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-500 px-6 text-center">
            <ImageIcon size={40} strokeWidth={1.4} />
            <p className="text-sm leading-snug">
              Tap the button below to photograph the signed delivery document
            </p>
          </div>
        )}
      </div>

      {/* Hidden native file input — triggers device camera */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        className="sr-only"
        aria-label="Camera input"
      />

      {/* Action buttons */}
      {!preview ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="
            w-full flex items-center justify-center gap-3
            h-20 rounded-2xl
            bg-primary-600 active:bg-primary-700
            text-white font-black text-xl
            transition-colors duration-100
          "
        >
          <Camera size={28} strokeWidth={2.5} />
          Take Photo
        </button>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={handleRetake}
            className="
              flex-1 flex items-center justify-center gap-2
              h-16 rounded-2xl
              bg-slate-700 active:bg-slate-600
              text-white font-bold text-base
            "
          >
            <Camera size={20} />
            Retake
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="
              flex-[2] flex items-center justify-center gap-2
              h-16 rounded-2xl
              bg-primary-500 active:bg-primary-600
              disabled:opacity-50 disabled:cursor-not-allowed
              text-white font-black text-lg
              transition-colors duration-100
            "
          >
            {isSubmitting ? (
              <>
                <Upload size={20} className="animate-bounce" />
                Uploading…
              </>
            ) : (
              <>
                <CheckCircle2 size={22} strokeWidth={2.5} />
                Submit POD
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
