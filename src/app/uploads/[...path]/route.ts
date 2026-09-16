import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { bankBalanceRecords, postMedia, users } from "@/db/schema";
import { readStorageFile } from "@/storage/service";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const storageKey = path.join("/");

  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  const fallbackContentType = await getAllowedFallbackContentType(storageKey, path);
  if (!fallbackContentType) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const file = await readStorageFile(storageKey);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType ?? fallbackContentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}

async function getAllowedFallbackContentType(storageKey: string, path: string[]) {
  const mediaRows = await db
    .select({ contentType: postMedia.contentType, thumbnailUrl: postMedia.thumbnailUrl })
    .from(postMedia)
    .where(or(eq(postMedia.storageKey, storageKey), eq(postMedia.thumbnailUrl, `/uploads/${storageKey}`)))
    .limit(1);

  if (mediaRows[0]) {
    return mediaRows[0].thumbnailUrl === `/uploads/${storageKey}`
      ? "image/webp"
      : mediaRows[0].contentType ?? inferImageContentType(storageKey) ?? "application/octet-stream";
  }

  if (path[0] === "user-avatars") {
    const userRows = await db
      .select({ avatarStorageKey: users.avatarStorageKey })
      .from(users)
      .where(eq(users.avatarStorageKey, storageKey))
      .limit(1);

    return userRows[0] ? "image/svg+xml; charset=utf-8" : null;
  }

  if (path[0] === "bank-records") {
    const bankBalanceRecordRows = await db
      .select({ imageStorageKey: bankBalanceRecords.imageStorageKey })
      .from(bankBalanceRecords)
      .where(eq(bankBalanceRecords.imageStorageKey, storageKey))
      .limit(1);

    return bankBalanceRecordRows[0] ? inferImageContentType(storageKey) ?? "application/octet-stream" : null;
  }

  return null;
}

function isSafeStoragePath(path: string[]) {
  return path.length > 0 && path.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function inferImageContentType(storageKey: string) {
  const lowerKey = storageKey.toLowerCase();

  if (lowerKey.endsWith(".webp")) {
    return "image/webp";
  }

  if (lowerKey.endsWith(".jpg") || lowerKey.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerKey.endsWith(".png")) {
    return "image/png";
  }

  if (lowerKey.endsWith(".gif")) {
    return "image/gif";
  }

  if (lowerKey.endsWith(".svg")) {
    return "image/svg+xml; charset=utf-8";
  }

  if (lowerKey.endsWith(".heic")) {
    return "image/heic";
  }

  if (lowerKey.endsWith(".heif")) {
    return "image/heif";
  }

  return null;
}