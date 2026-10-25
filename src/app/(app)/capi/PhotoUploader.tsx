"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PHOTO_MAX_BYTES } from "@/lib/business/constants";
import { uploadPhotos } from "./uploadPhotos";

/** Aggiunge foto a un capo già esistente (scheda del capo). */
export function PhotoUploader({ itemId, businessId }: { itemId: string; businessId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(0);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErrors([]);
    setDone(0);

    const { uploaded, problems } = await uploadPhotos(itemId, businessId, Array.from(files));

    setErrors(problems);
    setDone(uploaded);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (uploaded > 0) router.refresh();
  }

  return (
    <div>
      <label htmlFor="photos" className="block text-sm font-medium text-stone-700">
        Aggiungi foto
      </label>
      <input
        ref={inputRef}
        id="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
        className="mt-1 block w-full text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-stone-700 disabled:opacity-60"
      />
      <p className="mt-1 text-xs text-stone-500">JPG, PNG o WebP, fino a {PHOTO_MAX_BYTES / 1024 / 1024} MB ciascuna.</p>
      {busy && <p role="status" className="mt-2 text-sm text-stone-600">Caricamento in corso…</p>}
      {!busy && done > 0 && (
        <p role="status" className="mt-2 text-sm text-green-700">
          {done === 1 ? "1 foto caricata." : `${done} foto caricate.`}
        </p>
      )}
      {errors.map((e) => (
        <p key={e} role="alert" className="mt-1 text-sm text-red-700">
          {e}
        </p>
      ))}
    </div>
  );
}
