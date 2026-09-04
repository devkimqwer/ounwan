import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { buildUserAvatarStorageKey, buildWorkoutPostMediaStorageKey, buildWorkoutPostThumbnailStorageKey } from "./paths";
import { getLocalUploadRoot } from "./settings";

export type StoredMediaFile = {
  mediaType: "image" | "video";
  storageKey: string;
  fileSizeBytes: bigint;
  contentType?: string;
  thumbnailStorageKey?: string;
};

export async function saveWorkoutPostMediaFiles(input: {
  files: File[];
  groupId: string;
  seasonId: string;
  postId: string;
}) {
  const root = await getLocalUploadRoot();
  const savedFiles: Array<StoredMediaFile & { absolutePath: string; thumbnailAbsolutePath?: string }> = [];

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
      const absolutePath = resolveLocalStoragePath(root, storageKey);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(absolutePath, buffer);

      let thumbnailStorageKey: string | undefined;
      let thumbnailAbsolutePath: string | undefined;
      if (mediaType === "image") {
        thumbnailStorageKey = buildWorkoutPostThumbnailStorageKey({
          groupId: input.groupId,
          seasonId: input.seasonId,
          postId: input.postId,
          sortOrder,
          fileId,
        });
        thumbnailAbsolutePath = resolveLocalStoragePath(root, thumbnailStorageKey);
        await mkdir(path.dirname(thumbnailAbsolutePath), { recursive: true });
        await sharp(buffer)
          .rotate()
          .resize({ width: 720, height: 720, fit: "cover", withoutEnlargement: true })
          .webp({ quality: 78 })
          .toFile(thumbnailAbsolutePath);
      }

      savedFiles.push({
        mediaType,
        storageKey,
        fileSizeBytes: BigInt(file.size),
        contentType: file.type || undefined,
        thumbnailStorageKey,
        absolutePath,
        thumbnailAbsolutePath,
      });
    }
  } catch (error) {
    await Promise.allSettled(
      savedFiles.flatMap((file) => [
        rm(file.absolutePath, { force: true }),
        file.thumbnailAbsolutePath ? rm(file.thumbnailAbsolutePath, { force: true }) : Promise.resolve(),
      ]),
    );
    throw error;
  }

  return savedFiles.map(({ absolutePath: _absolutePath, thumbnailAbsolutePath: _thumbnailAbsolutePath, ...file }) => {
    return file;
  });
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

  const root = await getLocalUploadRoot();
  const storageKey = buildUserAvatarStorageKey(userId);
  const absolutePath = resolveLocalStoragePath(root, storageKey);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, svg, "utf8");
  return storageKey;
}
export async function deleteLocalMediaFiles(storageKeys: Array<string | undefined>) {
  const root = await getLocalUploadRoot();
  await Promise.allSettled(
    storageKeys.filter((storageKey): storageKey is string => Boolean(storageKey)).map((storageKey) => {
      return rm(resolveLocalStoragePath(root, storageKey), { force: true });
    }),
  );
}
export async function readLocalMediaFile(storageKey: string) {
  const root = await getLocalUploadRoot();
  const absolutePath = resolveLocalStoragePath(root, storageKey);
  return readFile(absolutePath);
}

function resolveLocalStoragePath(root: string, storageKey: string) {
  const rootPath = path.resolve(root);
  const targetPath = path.resolve(rootPath, ...storageKey.split("/"));
  const relativePath = path.relative(rootPath, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid storage key.");
  }

  return targetPath;
}

function getMediaType(file: File) {
  return file.type.startsWith("video/") || /\.(mov|m4v|mp4)$/i.test(file.name) ? "video" : "image";
}
