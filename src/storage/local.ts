import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { getLocalUploadRoot } from "./settings";
import type { StorageAdapter } from "./types";

export const localStorageAdapter: StorageAdapter = {
  provider: "local",
  async put(input) {
    const root = await getLocalUploadRoot();
    const absolutePath = resolveLocalStoragePath(root, input.storageKey);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.body);
  },
  async get(storageKey) {
    const root = await getLocalUploadRoot();
    const absolutePath = resolveLocalStoragePath(root, storageKey);
    return { body: await readFile(absolutePath) };
  },
  async delete(storageKey) {
    const root = await getLocalUploadRoot();
    await rm(resolveLocalStoragePath(root, storageKey), { force: true });
  },
};

function resolveLocalStoragePath(root: string, storageKey: string) {
  const rootPath = path.resolve(root);
  const targetPath = path.resolve(rootPath, ...storageKey.split("/"));
  const relativePath = path.relative(rootPath, targetPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid storage key.");
  }

  return targetPath;
}
