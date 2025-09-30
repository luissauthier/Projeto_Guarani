// src/utils/upload.ts
import { supabase } from '../lib/supabase';

export async function uploadImageToBucket(localUri: string, prefix: string) {
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = 'jpg';
  const filename = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('jogadores').upload(filename, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return filename; // armazenamos o path no banco
}
