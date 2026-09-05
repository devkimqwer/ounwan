"use server";

import { redirect } from "next/navigation";

import { requestCurrentUserGroupJoin } from "@/db/commands";

export async function requestGroupJoinAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const result = await requestCurrentUserGroupJoin(token);

  if (result.status === "already_member") {
    redirect("/");
  }

  const status = result.status === "requested" ? "requested" : result.status === "pending" ? "pending" : "invalid";
  redirect(`/join/${encodeURIComponent(token)}?status=${status}`);
}