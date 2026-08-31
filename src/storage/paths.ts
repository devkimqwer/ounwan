import "server-only";

import path from "node:path";

export function buildWorkoutPostMediaDirectoryKey(groupId: string, seasonId: string, postId: string) {
  return path.posix.join("workout-posts", groupId, seasonId, postId);
}

export function buildWorkoutPostMediaStorageKey(input: {
  groupId: string;
  seasonId: string;
  postId: string;
  sortOrder: number;
  fileId: string;
  originalName: string;
}) {
  const extension = getSafeExtension(input.originalName);
  const fileName = `${String(input.sortOrder).padStart(2, "0")}_${input.fileId}${extension}`;

  return path.posix.join(
    buildWorkoutPostMediaDirectoryKey(input.groupId, input.seasonId, input.postId),
    fileName,
  );
}


export function buildWorkoutPostThumbnailStorageKey(input: {
  groupId: string;
  seasonId: string;
  postId: string;
  sortOrder: number;
  fileId: string;
}) {
  const fileName = `thumb_${String(input.sortOrder).padStart(2, "0")}_${input.fileId}.webp`;

  return path.posix.join(
    buildWorkoutPostMediaDirectoryKey(input.groupId, input.seasonId, input.postId),
    fileName,
  );
}

function getSafeExtension(fileName: string) {
  const extension = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return extension.length > 0 && extension.length <= 12 ? extension : "";
}
