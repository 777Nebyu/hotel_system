import { randomBytes } from 'crypto';
import { mkdir, rm, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { v2 as cloudinary } from 'cloudinary';

export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface StoredFile {
  url: string;
  publicId: string | null;
}

export interface StorageService {
  upload(file: UploadedFile, folder: string): Promise<StoredFile>;
  remove(file: StoredFile): Promise<void>;
}

export class LocalStorageService implements StorageService {
  private readonly root = join(process.cwd(), 'uploads');

  async upload(file: UploadedFile, folder: string): Promise<StoredFile> {
    const name = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(
      file.originalname || '',
    )}`;
    const dir = join(this.root, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, name), file.buffer);
    return { url: `/uploads/${folder}/${name}`, publicId: null };
  }

  async remove(file: StoredFile): Promise<void> {
    if (!file.url.startsWith('/uploads/')) return;
    try {
      await rm(join(this.root, file.url.replace('/uploads/', '')), {
        force: true,
      });
    } catch {
      /* best-effort cleanup */
    }
  }
}

export class CloudinaryStorageService implements StorageService {
  constructor(
    private readonly cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  async upload(file: UploadedFile, folder: string): Promise<StoredFile> {
    this.configure();
    const result = await new Promise<{
      secure_url: string;
      public_id: string;
    }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'image' },
        (err, res) =>
          err
            ? reject(new Error(err.message ?? 'Upload failed'))
            : resolve(res as never),
      );
      stream.end(file.buffer);
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async remove(file: StoredFile): Promise<void> {
    if (!file.publicId) return;
    this.configure();
    await cloudinary.uploader.destroy(file.publicId);
  }

  private configure(): void {
    cloudinary.config({
      cloud_name: this.cloudName,
      api_key: this.apiKey,
      api_secret: this.apiSecret,
    });
  }
}
