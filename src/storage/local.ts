import { lstat, mkdir, opendir, readFile, realpath, rm, unlink, writeFile } from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";

import { getLocalUploadRoot } from "./settings";
import type { StorageAdapter, StorageObject } from "./types";

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
  async *list() {
    const root = await getCleanupRoot();
    yield* listLocalObjects(root, root);
  },
  async deleteIfUnchanged(object) {
    const root = await getCleanupRoot();
    const target = resolveLocalStoragePath(root, object.storageKey);
    try {
      // 심볼릭 링크를 통한 저장소 외부 접근은 허용하지 않는다.
      if (await realpath(target) !== target) {
        return false;
      }
      const stats = await lstat(target);
      if (!stats.isFile() || localObjectTag(stats) !== object.etag) {
        return false;
      }
      await unlink(target);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
  },
};

async function getCleanupRoot() {
  const root = await realpath(await getLocalUploadRoot());
  if (root === path.parse(root).root) {
    throw new Error("Storage cleanup cannot use a filesystem root.");
  }
  return root;
}

async function* listLocalObjects(root: string, directory: string): AsyncGenerator<StorageObject> {
  const entries = await opendir(directory);
  for await (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    try {
      if (await realpath(target) !== target) {
        continue;
      }
      const stats = await lstat(target);
      if (stats.isDirectory()) {
        yield* listLocalObjects(root, target);
      } else if (stats.isFile()) {
        yield {
          storageKey: path.relative(root, target).split(path.sep).join("/"),
          lastModified: stats.mtime,
          size: stats.size,
          etag: localObjectTag(stats),
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }
}

function localObjectTag(stats: Stats) {
  return [stats.dev, stats.ino, stats.size, stats.mtimeMs, stats.ctimeMs].join(":");
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
