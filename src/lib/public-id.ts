import "server-only";

import { randomBytes } from "crypto";

const PUBLIC_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const PUBLIC_ID_LENGTH = 10;
export const PUBLIC_ID_MAX_ATTEMPTS = 5;

export function generatePublicId() {
  const bytes = randomBytes(PUBLIC_ID_LENGTH);
  let publicId = "";

  for (const byte of bytes) {
    publicId += PUBLIC_ID_ALPHABET[byte % PUBLIC_ID_ALPHABET.length];
  }

  return publicId;
}
