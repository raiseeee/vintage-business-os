"use client";

import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/business/constants";
import { createClient } from "@/lib/supabase/client";
import { registerPhoto } from "./actions";

/**
 * Carica le foto direttamente nello storage dal browser (nessun limite di dimensione
 * delle richieste verso il server), poi le registra nel database.
 * Percorso: <user_id>/<capo>/<id casuale>.<estensione>
 */
export async function uploadPhotos(
  itemId: string,
  userId: string,
  files: File[],
): Promise<{ uploaded: number; problems: string[] }> {
  const supabase = createClient();
  const problems: string[] = [];
  let uploaded = 0;

  for (const file of files) {
    const ext = PHOTO_TYPES[file.type];
    if (!ext) {
      problems.push(`${file.name}: formato non supportato (usa JPG, PNG o WebP).`);
      continue;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      problems.push(`${file.name}: supera i ${PHOTO_MAX_BYTES / 1024 / 1024} MB.`);
      continue;
    }

    const path = `${userId}/${itemId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      problems.push(`${file.name}: caricamento non riuscito.`);
      continue;
    }

    const result = await registerPhoto(itemId, path);
    if (result.error) {
      // Il file non è stato registrato: lo si toglie per non lasciare file orfani.
      await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      problems.push(`${file.name}: ${result.error}`);
      continue;
    }
    uploaded += 1;
  }

  return { uploaded, problems };
}
