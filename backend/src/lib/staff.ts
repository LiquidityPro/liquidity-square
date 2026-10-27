import { prisma } from "./prisma";

/** Comma-separated emails in STAFF_EMAILS become staff the next time they call the API. */
export function staffEmailSet(): Set<string> {
  return new Set(
    (process.env.STAFF_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Promote a listed account once. A taken-down account stays off the desk until it is restored. */
export async function promoteListedStaff(user: { id: string; email: string; staff: boolean; suspendedAt: Date | null }) {
  if (user.suspendedAt || user.staff || !staffEmailSet().has(user.email.toLowerCase())) return false;
  const updated = await prisma.user.updateMany({
    where: { id: user.id, staff: false, suspendedAt: null },
    data: { staff: true },
  });
  if (updated.count !== 1) return false;
  await prisma.moderationEvent.create({
    data: {
      actorId: user.id,
      action: "grant_staff",
      targetUserId: user.id,
      note: "Listed in STAFF_EMAILS",
    },
  });
  return true;
}
