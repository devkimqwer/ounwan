import { getCurrentUserId } from "@/auth/session";
import { ActiveSeasonNotFoundError, CurrentUserMembershipNotFoundError } from "@/db/errors";
import { getCurrentUserPendingGroupJoinRequests, getOunwanAppData } from "@/db/queries";
import { LoginPage, NoActiveSeasonPage, NoGroupPage, PendingGroupJoinPage } from "@/features/auth/auth-pages";
import { OunwanApp } from "@/features/app/ounwan-app";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ authError?: string; devLoginError?: string }> }) {
  const params = await searchParams;
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return <LoginPage authBlocked={params.authError === "blocked"} devLoginFailed={params.devLoginError === "1"} />;
  }

  try {
    const appData = await getOunwanAppData();
    return <OunwanApp appData={appData} />;
  } catch (error) {
    if (error instanceof CurrentUserMembershipNotFoundError) {
      const pendingJoinRequests = await getCurrentUserPendingGroupJoinRequests();
      if (pendingJoinRequests.length > 0) {
        return <PendingGroupJoinPage requests={pendingJoinRequests} />;
      }

      return <NoGroupPage />;
    }

    if (error instanceof ActiveSeasonNotFoundError) {
      return <NoActiveSeasonPage />;
    }

    throw error;
  }
}