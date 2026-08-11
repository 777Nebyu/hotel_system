export interface HotelImageUploader {
  upload(file: Buffer, options?: { folder?: string }): Promise<string>;
}
