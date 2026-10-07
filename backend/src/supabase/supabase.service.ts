import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

/** Nombre apto para Supabase Storage: sin tildes, espacios ni símbolos (una "ñ" o un "#" hacen fallar la subida) */
function safeFileName(original: string): string {
  const dot = original.lastIndexOf('.');
  const ext = dot > 0 ? original.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : '';
  const base = (dot > 0 ? original.slice(0, dot) : original)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${Date.now()}-${randomBytes(3).toString('hex')}-${base || 'foto'}${ext ? `.${ext}` : ''}`;
}

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient | null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    this.client = url && key ? createClient(url, key) : null;
  }

  /** Sube la imagen y devuelve su URL pública. Si no se puede, falla con un mensaje claro (antes guardaba un enlace falso). */
  async uploadImage(file: Express.Multer.File, folder: string) {
    if (!file?.buffer) {
      return '';
    }

    if (!this.client) {
      throw new ServiceUnavailableException(
        'No se pueden guardar fotografías: faltan SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env',
      );
    }

    const path = `${folder}/${safeFileName(file.originalname)}`;
    const { error } = await this.client.storage.from('casos-fotos').upload(path, file.buffer, {
      contentType: file.mimetype || 'application/octet-stream',
      upsert: false,
    });

    if (error) {
      throw new BadGatewayException(
        `No se pudo subir la fotografía a Supabase (${error.message}). Verifica que exista el bucket "casos-fotos" y su permiso de subida.`,
      );
    }

    const { data } = this.client.storage.from('casos-fotos').getPublicUrl(path);
    return data.publicUrl;
  }

  /** Borra del bucket los archivos de estas URLs públicas. Es "mejor esfuerzo": un fallo no debe impedir la operación principal. */
  async removeByUrls(urls: string[]) {
    if (!this.client || urls.length === 0) return;
    const marca = '/casos-fotos/';
    const rutas = urls
      .map((url) => {
        const i = url.indexOf(marca);
        return i >= 0 ? decodeURIComponent(url.slice(i + marca.length).split('?')[0]) : null;
      })
      .filter((r): r is string => Boolean(r));
    if (rutas.length === 0) return;
    const { error } = await this.client.storage.from('casos-fotos').remove(rutas);
    if (error) console.warn(`No se pudieron borrar ${rutas.length} archivo(s) de Storage: ${error.message}`);
  }
}
