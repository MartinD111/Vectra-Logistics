'use client';

// Public, login-free Proof-of-Delivery capture page for drivers. Opened from a
// single-use link (/pod/<token>) sent to the driver's phone. Uses the native
// camera via <input type="file" accept="image/*" capture="environment"> — no
// getUserMedia, works on every mobile browser — then posts the photo to the
// public token endpoint which attaches it to the shipment.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

type Info = { label: string; status: string; expired: boolean; pod_url: string | null };

export default function PodPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token as string;
  const [info, setInfo] = useState<Info | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/pod/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'This link is invalid.');
        return r.json();
      })
      .then((data: Info) => { setInfo(data); if (data.status === 'delivered') setDone(true); })
      .catch((e) => setLoadError(e.message));
  }, [token]);

  const onPick = (f: File | null) => {
    setFile(f);
    setUploadError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`${API}/api/pod/${token}`, { method: 'POST', body: fd });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Upload failed.');
      setDone(true);
    } catch (e) {
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gray-50 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary-600 text-white text-2xl mb-3">📸</div>
          <h1 className="text-xl font-black text-gray-900">Proof of Delivery</h1>
          {info && <p className="text-sm text-gray-500 mt-1">{info.label}</p>}
        </div>

        {loadError ? (
          <Card><p className="text-center text-red-600 text-sm py-6">{loadError}</p></Card>
        ) : !info ? (
          <Card><p className="text-center text-gray-400 text-sm py-6">Loading…</p></Card>
        ) : done ? (
          <Card>
            <div className="text-center py-6">
              <div className="text-4xl mb-2">✅</div>
              <p className="font-bold text-emerald-600">Delivery confirmed</p>
              <p className="text-xs text-gray-500 mt-1">Thank you. The proof of delivery has been recorded.</p>
              {(preview || info.pod_url) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview ?? `${API}${info.pod_url}`} alt="POD" className="mt-4 rounded-xl w-full object-cover max-h-64" />
              )}
            </div>
          </Card>
        ) : info.expired ? (
          <Card><p className="text-center text-amber-600 text-sm py-6">This delivery link has expired. Please contact dispatch for a new one.</p></Card>
        ) : (
          <Card>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)} />

            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Selected" className="rounded-xl w-full object-cover max-h-72 mb-3" />
            ) : (
              <button onClick={() => inputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-12 flex flex-col items-center gap-2 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors">
                <span className="text-3xl">📷</span>
                <span className="text-sm font-semibold">Tap to take a photo</span>
              </button>
            )}

            {uploadError && <p className="text-xs text-red-600 mb-2">{uploadError}</p>}

            <div className="flex gap-2">
              {preview && (
                <button onClick={() => inputRef.current?.click()}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm">Retake</button>
              )}
              <button onClick={upload} disabled={!file || uploading}
                className="flex-1 py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm disabled:opacity-50">
                {uploading ? 'Uploading…' : 'Submit proof of delivery'}
              </button>
            </div>
          </Card>
        )}

        <p className="text-center text-[11px] text-gray-400 mt-4">Secure single-use link · VECTRA</p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">{children}</div>;
}
