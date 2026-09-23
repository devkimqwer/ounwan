import "server-only";

import { NextRequest } from "next/server";

export function getAppOrigin(request: NextRequest) {
    const configuredOrigin = process.env.OUNWAN_APP_ORIGIN?.trim();
    return configuredOrigin || request.nextUrl.origin;
  }