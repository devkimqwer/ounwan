import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { postMedia, users } from "@/db/schema";
import { readStorageFile } from "@/storage/service";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const storageKey = path.join("/");
  const rows = await db
    .select({ contentType: postMedia.contentType, thumbnailUrl: postMedia.thumbnailUrl })
    .from(postMedia)
    .where(or(eq(postMedia.storageKey, storageKey), eq(postMedia.thumbnailUrl, `/uploads/${storageKey}`)))
    .limit(1);

  let contentType = rows[0]
    ? rows[0].thumbnailUrl === `/uploads/${storageKey}`
      ? "image/webp"
      : rows[0].contentType ?? "application/octet-stream"
    : undefined;

  if (!contentType) {
    const userRows = await db
      .select({ avatarStorageKey: users.avatarStorageKey })
      .from(users)
      .where(eq(users.avatarStorageKey, storageKey))
      .limit(1);

    if (userRows[0]) {
      contentType = "image/svg+xml; charset=utf-8";
    }
  }

  if (!contentType) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const file = await readStorageFile(storageKey);
    return new Response(new Uint8Array(file.body), {
      headers: {
        "Content-Type": file.contentType ?? contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}
