import type { ReactNode } from "react";

import type { Role, User } from "@/domain/models";

export function getUserById(users: User[], userId: string) {
  return users.find((user) => user.id === userId) ?? users[0];
}
export function formatPostDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

export function getDisplayRoles(isAdmin: boolean, isTreasurer: boolean): Role[] {
  const roles: Role[] = [];
  if (isAdmin) {
    roles.push("admin");
  }
  if (isTreasurer) {
    roles.push("treasurer");
  }

  return roles.length > 0 ? roles : ["member"];
}

export function getRoleLabel(role: Role) {
  return { admin: "관리자", treasurer: "총무", member: "멤버" }[role];
}

export function getRoleBadgeTone(role: Role) {
  return role === "admin" ? "green" : role === "treasurer" ? "amber" : "slate";
}
export function Avatar({
  name,
  imageUrl,
  size = "md",
}: {
  name: string;
  imageUrl?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClassName = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-20 w-20 text-sm" : "h-10 w-10 text-sm";

  return (
    <span
      className={`grid ${sizeClassName} shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 font-extrabold text-slate-500`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name[0]
      )}
    </span>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone: "green" | "amber" | "red" | "slate" }) {
  const className = {
    green: "bg-[#F2F0FA] text-[#51438f] border-[#DDD8F1]",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-600 border-red-100",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold leading-none ${className}`}>
      {children}
    </span>
  );
}

export function MenuBlock({ title, rows }: { title?: string; rows: ReactNode[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {title && <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-extrabold">{title}</h2>}
      {rows.map((row, idx) => (
        <div key={idx} className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 last:border-b-0">
          {row}
        </div>
      ))}
    </section>
  );
}
