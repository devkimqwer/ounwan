import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildWorkoutPostMediaStorageKey } from "./paths";
import { getLocalUploadRoot } from "./settings";

export type StoredMediaFile = {
  mediaType: "image" | "video";
  storageKey: string;
  fileSizeBytes: bigint;
  contentType?: string;
};

export async function saveWorkoutPostMediaFiles(input: {
  files: File[];
  groupId: string;
  seasonId: string;
  postId: string;
}) {
  const root = await getLocalUploadRoot();
  const savedFiles: Array<StoredMediaFile & { absolutePath: string }> = [];

  try {
    for (const [index, file] of input.files.entries()) {
      const storageKey = buildWorkoutPostMediaStorageKey({
        groupId: input.groupId,
        seasonId: input.seasonId,
        postId: input.postId,
        sortOrder: index + 1,
        fileId: randomUUID(),
        originalName: file.name,
      });
      const absolutePath = resolveLocalStoragePath(root, storageKey);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

      savedFiles.push({
        mediaType: getMediaType(file),
        storageKey,
        fileSizeBytes: BigInt(file.size),
        contentType: file.type || undefined,
        absolutePath,
      });
    }
  } catch (error) {
    await Promise.allSettled(savedFiles.map((file) => rm(file.absolutePath, { force: true })));
    throw error;
  }

  return savedFiles.map(({ absolutePath: _absolutePath, ...file }) => file);
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
