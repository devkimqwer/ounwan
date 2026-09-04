import { redirect } from "next/navigation";

import { getCurrentUserId, getPendingKakaoId } from "@/auth/session";
import { ProfileSetupForm } from "./profile-setup-form";

export const dynamic = "force-dynamic";

export default async function ProfileSetupPage() {
  const currentUserId = await getCurrentUserId();
  if (currentUserId) {
    redirect("/");
  }

  const pendingKakaoId = await getPendingKakaoId();
  if (!pendingKakaoId) {
    redirect("/");
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-sm flex-col justify-center">
        <ProfileSetupForm />
      </div>
    </main>
  );
}