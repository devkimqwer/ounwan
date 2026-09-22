export type StorageProvider = "local" | "s3";

export type StoredMediaFile = {
  mediaType: "image" | "video";
  storageKey: string;
  fileSizeBytes: bigint;
  contentType?: string;
  thumbnailStorageKey?: string;
};

export type StoredFile = {
  body: Buffer;
  contentType?: string;
};

export type StorageObject = {
  storageKey: string;
  lastModified: Date;
  size: number;
  etag?: string;
  versionId?: string;
};

export interface StorageAdapter {
  provider: StorageProvider;
  put(input: { storageKey: string; body: Buffer | string; contentType?: string }): Promise<void>;
  get(storageKey: string): Promise<StoredFile>;
  delete(storageKey: string): Promise<void>;
  list(): AsyncIterable<StorageObject>;
  deleteIfUnchanged(object: StorageObject): Promise<boolean>;
}
