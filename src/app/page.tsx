import { getCurrentUserId } from "@/auth/session";
import { CurrentUserMembershipNotFoundError } from "@/db/errors";
import { getOunwanAppData } from "@/db/queries";
import { LoginPage, NoGroupPage } from "@/features/auth/auth-pages";
import { OunwanApp } from "@/features/app/ounwan-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const currentUserId = await getCurrentUserId();
  if (!currentUserId) {
    return <LoginPage />;
  }

  try {
    const appData = await getOunwanAppData();
    return <OunwanApp appData={appData} />;
  } catch (error) {
    if (error instanceof CurrentUserMembershipNotFoundError) {
      return <NoGroupPage />;
    }

    throw error;
  }
}
