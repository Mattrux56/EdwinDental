import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export const CASOS_BUCKET = 'casos-fotos';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const key = config.get<string>('SUPABASE_ANON_KEY');

    const isPlaceholder = (v?: string) => !v || v.includes('[');
    if (isPlaceholder(url) || isPlaceholder(key)) {
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_ANON_KEY no configurados: la subida de fotos estará deshabilitada.',
      );
      return;
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Sube una imagen al bucket `casos-fotos` y devuelve su URL pública.
   * @param folder carpeta lógica dentro del bucket (p. ej. "casos/2026")
   */
  async uploadImage(file: Express.Multer.File, folder: string): Promise<string> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Supabase Storage no está configurado. Revisa SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env',
      );
    }

    let ext = extname(file.originalname || '').toLowerCase();
    if (!/^\.[a-z0-9]{2,5}$/.test(ext)) ext = '.jpg';

    const path = `${folder}/${Date.now()}-${randomUUID()}${ext}`;

    const { error } = await this.client.storage
      .from(CASOS_BUCKET)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Error subiendo ${path}: ${error.message}`);
      throw new InternalServerErrorException(
        `No se pudo subir la imagen a Supabase Storage: ${error.message}`,
      );
    }

    const { data } = this.client.storage.from(CASOS_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}
