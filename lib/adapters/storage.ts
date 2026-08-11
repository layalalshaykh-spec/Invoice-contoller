export interface StoredFile { key: string; url: string; size: number; contentType: string }
export interface StorageAdapter {
  save(input: { name: string; bytes: Uint8Array; contentType: string }): Promise<StoredFile>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

/** Demo-safe in-memory implementation. Replace with S3/Azure without changing consumers. */
export class MemoryStorageAdapter implements StorageAdapter {
  private files = new Map<string, Uint8Array>();
  async save(input: { name: string; bytes: Uint8Array; contentType: string }): Promise<StoredFile> {
    const key = `${Date.now()}-${input.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    this.files.set(key, input.bytes);
    return { key, url: `/api/files/${encodeURIComponent(key)}`, size: input.bytes.byteLength, contentType: input.contentType };
  }
  async get(key: string) { return this.files.get(key) ?? null }
  async remove(key: string) { this.files.delete(key) }
}
export const storageAdapter: StorageAdapter = new MemoryStorageAdapter();
