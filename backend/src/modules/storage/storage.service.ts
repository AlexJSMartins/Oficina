import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Ffmpeg from 'fluent-ffmpeg';
import * as dotenv from 'dotenv';

dotenv.config();

export interface OptimizedMediaResult {
  buffer: Buffer;
  mimetype: string;
  extension: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT as string,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
      },
    });
  }

  // =====================================================================
  // UPLOAD DO BUFFER DIRETO DO BACKEND PARA O CLOUDFLARE R2 (SEM CORS!)
  // =====================================================================
  async uploadBufferToR2(
    buffer: Buffer,
    mimetype: string,
    filename: string,
    folder: string = 'os-medias',
  ): Promise<string> {
    try {
      const key = `${folder}/${filename}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME as string,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
        }),
      );

      const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').trim();
      const publicUrlBase = r2PublicUrl.endsWith('/')
        ? r2PublicUrl.slice(0, -1)
        : r2PublicUrl;

      return `${publicUrlBase}/${key}`;
    } catch (error) {
      this.logger.error(`Erro ao fazer upload para o R2: ${error}`);
      throw error;
    }
  }

  // =====================================================================
  // 1. COMPRESSOR DE IMAGENS (SHARP)
  // =====================================================================
  async optimizeImageBuffer(
    buffer: Buffer,
    originalMime: string,
    originalExt: string,
  ): Promise<OptimizedMediaResult> {
    try {
      const fileSizeInMegabytes = buffer.length / (1024 * 1024);

      if (fileSizeInMegabytes > 1.0) {
        this.logger.log(
          `Comprimindo foto da OS na memória (${fileSizeInMegabytes.toFixed(2)}MB)...`,
        );

        const optimizedBuffer = await sharp(buffer)
          .resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();

        this.logger.log('✅ Foto comprimida e padronizada para JPEG com sucesso!');
        return {
          buffer: optimizedBuffer,
          mimetype: 'image/jpeg',
          extension: '.jpg',
        };
      }

      return { buffer, mimetype: originalMime, extension: originalExt || '.jpg' };
    } catch (error) {
      this.logger.error('Erro ao comprimir imagem, prosseguindo com original.', error);
      return { buffer, mimetype: originalMime, extension: originalExt || '.jpg' };
    }
  }

  // =====================================================================
  // 2. COMPRESSOR DE VÍDEOS (FFMPEG)
  // =====================================================================
  async optimizeVideoBuffer(
    buffer: Buffer,
    originalMime: string,
    originalExt: string,
  ): Promise<OptimizedMediaResult> {
    const fileSizeInMegabytes = buffer.length / (1024 * 1024);

    if (fileSizeInMegabytes > 10.0) {
      this.logger.log(
        `🎥 Comprimindo vídeo pesado (${fileSizeInMegabytes.toFixed(2)}MB)...`,
      );

      const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      const tempInputPath = path.join(os.tmpdir(), `input-${uniqueId}${originalExt || '.mp4'}`);
      const tempOutputPath = path.join(os.tmpdir(), `output-${uniqueId}.mp4`);

      fs.writeFileSync(tempInputPath, buffer);

      return new Promise((resolve) => {
        Ffmpeg(tempInputPath)
          .size('?x480')
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-crf 28', '-preset veryfast'])
          .on('end', () => {
            try {
              const optimizedBuffer = fs.readFileSync(tempOutputPath);
              this.logger.log('✅ Vídeo comprimido e otimizado para MP4 com sucesso!');
              resolve({
                buffer: optimizedBuffer,
                mimetype: 'video/mp4',
                extension: '.mp4',
              });
            } catch {
              resolve({ buffer, mimetype: originalMime, extension: originalExt || '.mp4' });
            } finally {
              if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
              if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            }
          })
          .on('error', (err) => {
            this.logger.error('⚠️ Erro ao comprimir vídeo (enviando original):', err);
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
            resolve({ buffer, mimetype: originalMime, extension: originalExt || '.mp4' });
          })
          .save(tempOutputPath);
      });
    }

    return { buffer, mimetype: originalMime, extension: originalExt || '.mp4' };
  }
}