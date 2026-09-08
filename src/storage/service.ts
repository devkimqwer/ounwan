import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";

import { buildUserAvatarStorageKey, buildWorkoutPostMediaStorageKey, buildWorkoutPostThumbnailStorageKey } from "./paths";
import { localStorageAdapter } from "./local";
import { createS3StorageAdapter } from "./s3";
import type { StorageAdapter, StorageProvider, StoredMediaFile } from "./types";

export async function saveWorkoutPostMediaFiles(input: {
  files: File[];
  groupId: string;
  seasonId: string;
  postId: string;
}) {
  const adapter = getConfiguredStorageAdapter();
  const savedFiles: StoredMediaFile[] = [];

  try {
    for (const [index, file] of input.files.entries()) {
      const sortOrder = index + 1;
      const fileId = randomUUID();
      const mediaType = getMediaType(file);
      const storageKey = buildWorkoutPostMediaStorageKey({
        groupId: input.groupId,
        seasonId: input.seasonId,
        postId: input.postId,
        sortOrder,
        fileId,
        originalName: file.name,
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      await adapter.put({ storageKey, body: buffer, contentType: file.type || undefined });

      let thumbnailStorageKey: string | undefined;
      if (mediaType === "image") {
        thumbnailStorageKey = buildWorkoutPostThumbnailStorageKey({
          groupId: input.groupId,
          seasonId: input.seasonId,
          postId: input.postId,
          sortOrder,
          fileId,
        });
        const thumbnailBuffer = await sharp(buffer)
          .rotate()
          .resize({ width: 720, height: 720, fit: "cover", withoutEnlargement: true })
          .webp({ quality: 78 })
          .toBuffer();
        await adapter.put({ storageKey: thumbnailStorageKey, body: thumbnailBuffer, contentType: "image/webp" });
      }

      savedFiles.push({
        mediaType,
        storageKey,
        fileSizeBytes: BigInt(file.size),
        contentType: file.type || undefined,
        thumbnailStorageKey,
      });
    }
  } catch (error) {
    await deleteStorageFiles(savedFiles.flatMap((file) => [file.storageKey, file.thumbnailStorageKey]));
    throw error;
  }

  return savedFiles;
}

export async function saveUserAvatarSvg(userId: string) {
  const avatarApiUrl = process.env.OUNWAN_AVATAR_API_URL;
  if (!avatarApiUrl) {
    throw new Error("OUNWAN_AVATAR_API_URL is required.");
  }

  const response = await fetch(avatarApiUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Avatar API request failed: ${response.status}`);
  }

  const svg = await response.text();
  if (!svg.includes("<svg")) {
    throw new Error("Avatar API response must be SVG.");
  }

  const adapter = getConfiguredStorageAdapter();
  const storageKey = buildUserAvatarStorageKey(userId);
  await adapter.put({ storageKey, body: svg, contentType: "image/svg+xml; charset=utf-8" });
  return storageKey;
}

export async function deleteStorageFiles(storageKeys: Array<string | undefined>) {
  const adapter = getConfiguredStorageAdapter();
  await Promise.allSettled(
    storageKeys
      .filter((storageKey): storageKey is string => Boolean(storageKey))
      .map((storageKey) => adapter.delete(storageKey)),
  );
}

export async function readStorageFile(storageKey: string) {
  return getConfiguredStorageAdapter().get(storageKey);
}

function getConfiguredStorageAdapter() {
  return getStorageAdapter(getConfiguredStorageProvider());
}

function getStorageAdapter(provider: StorageProvider): StorageAdapter {
  switch (provider) {
    case "local":
      return localStorageAdapter;
    case "s3":
      return createS3StorageAdapter();
    default:
      provider satisfies never;
      throw new Error("Unsupported storage provider.");
  }
}

export function getConfiguredStorageProvider(): StorageProvider {
  const provider = process.env.OUNWAN_STORAGE_PROVIDER?.trim() || "local";
  if (provider === "local" || provider === "s3") {
    return provider;
  }
  throw new Error("OUNWAN_STORAGE_PROVIDER must be local or s3.");
}

function getMediaType(file: File) {
  return file.type.startsWith("video/") || /\.(mov|m4v|mp4)$/i.test(file.name) ? "video" : "image";
}
