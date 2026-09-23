import "server-only";

import type { oauthProviderEnum } from "@/db/schema";
import { unlinkKakaoAccount, validateKakaoUnlinkConfiguration } from "./kakao";

type OAuthProvider = typeof oauthProviderEnum.enumValues[number];
type UnlinkHandler = {
  validateConfiguration: () => void;
  // 이미 연결해제된 계정에 대한 재시도도 성공으로 처리해야 한다.
  unlink: (providerUserId: string) => Promise<void>;
};

const unlinkHandlers: Record<OAuthProvider, UnlinkHandler> = {
  kakao: { validateConfiguration: validateKakaoUnlinkConfiguration, unlink: unlinkKakaoAccount },
};

export function getOAuthUnlinkHandler(provider: OAuthProvider): UnlinkHandler {
  const handler = unlinkHandlers[provider];
  if (!handler) {
    throw new Error("Unsupported OAuth unlink provider.");
  }
  return handler;
}
