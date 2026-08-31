import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db/client";
import { postMedia } from "@/db/schema";
import { readLocalMediaFile } from "@/storage/local";

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const storageKey = path.join("/");
  const rows = await db
    .select({ contentType: postMedia.contentType, thumbnailUrl: postMedia.thumbnailUrl })
    .from(postMedia)
    .where(or(eq(postMedia.storageKey, storageKey), eq(postMedia.thumbnailUrl, `/uploads/${storageKey}`)))
    .limit(1);

  if (!rows[0]) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  try {
    const file = await readLocalMediaFile(storageKey);
    return new Response(file, {
      headers: {
        "Content-Type":
          rows[0].thumbnailUrl === `/uploads/${storageKey}`
            ? "image/webp"
            : rows[0].contentType ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
}
