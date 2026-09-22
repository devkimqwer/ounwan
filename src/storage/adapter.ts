import { localStorageAdapter } from "./local";
import { createS3StorageAdapter } from "./s3";
import type { StorageAdapter, StorageProvider } from "./types";

export function getConfiguredStorageProvider(): StorageProvider {
  const provider = process.env.OUNWAN_STORAGE_PROVIDER?.trim() || "local";
  if (provider === "local" || provider === "s3") {
    return provider;
  }
  throw new Error("OUNWAN_STORAGE_PROVIDER must be local or s3.");
}

export function getConfiguredStorageAdapter(): StorageAdapter {
  switch (getConfiguredStorageProvider()) {
    case "local":
      return localStorageAdapter;
    case "s3":
      return createS3StorageAdapter();
  }
}
