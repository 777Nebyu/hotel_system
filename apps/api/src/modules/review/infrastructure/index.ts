export interface ReviewMediaStore {
  store(file: Buffer): Promise<string>;
}
