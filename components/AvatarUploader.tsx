"use client";

import { Camera, CheckCircle2, Loader2, RotateCcw, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import type { Profile } from "@/lib/types";

type AvatarUploaderProps = {
  profile: Profile;
  onUploaded: (profile: Profile) => void;
};

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "da52mpv3g";
const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "institut-apologetique-unsigned";

async function uploadToCloudinary(file: Blob, fileName: string) {
  const form = new FormData();
  form.append("file", file, fileName);
  form.append("upload_preset", uploadPreset);
  form.append("folder", "institut-apologetique/avatars");
  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "L'envoi de la photo a échoué.");
  return data as { secure_url: string; public_id: string };
}

export function AvatarUploader({ profile, onUploaded }: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function saveUploaded(file: Blob, fileName: string) {
    setSaving(true);
    setDone(false);
    setError("");
    try {
      const uploaded = await uploadToCloudinary(file, fileName);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: profile.id, avatar_url: uploaded.secure_url, avatar_public_id: uploaded.public_id }),
      });
      const data = await response.json();
      if (!response.ok || data.verified !== true) throw new Error(data.error || "La photo n'a pas pu être enregistrée.");
      onUploaded(data.data as Profile);
      setDone(true);
      stopCamera();
      window.setTimeout(() => setDone(false), 1600);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "La photo n'a pas pu être enregistrée.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await saveUploaded(file, file.name);
    event.target.value = "";
  }

  async function openCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setError("La caméra n'est pas disponible sur cet appareil.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) return;
    await saveUploaded(blob, `avatar-${profile.id}.jpg`);
  }

  return (
    <div className="avatar-uploader">
      <div className="avatar-actions">
        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={chooseFile} />
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => fileInputRef.current?.click()}>
          {saving ? <Loader2 className="action-spin" size={18} /> : <Upload size={18} />} Importer une photo
        </button>
        <button type="button" className="btn btn-outline" disabled={saving} onClick={cameraOpen ? stopCamera : openCamera}>
          {cameraOpen ? <X size={18} /> : <Camera size={18} />} {cameraOpen ? "Fermer la caméra" : "Prendre une photo"}
        </button>
        {done && <span className="avatar-done"><CheckCircle2 size={18} /> Photo mise à jour</span>}
        {error && <span className="avatar-error">{error}</span>}
      </div>
      {cameraOpen && (
        <div className="camera-panel">
          <video ref={videoRef} autoPlay playsInline muted />
          <div className="camera-actions">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={capture}><Camera size={18} /> Utiliser cette photo</button>
            <button type="button" className="btn btn-outline" disabled={saving} onClick={openCamera}><RotateCcw size={18} /> Réessayer</button>
          </div>
        </div>
      )}
    </div>
  );
}
