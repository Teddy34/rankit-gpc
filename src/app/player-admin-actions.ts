"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export type PlayerAdminState = { status?: "error" | "success"; message?: string };
const allowedActions = new Set(["retire", "unretire", "make_admin", "remove_admin"]);

export async function updatePlayerAdministration(_state: PlayerAdminState, formData: FormData): Promise<PlayerAdminState> {
  const actor = await requireUser();
  if (!actor.isAdmin) return { status: "error", message: "Only administrators can manage players." };

  const targetId = Number(formData.get("playerId"));
  const action = String(formData.get("action") ?? "");
  if (!Number.isInteger(targetId) || !allowedActions.has(action)) return { status: "error", message: "Invalid player action." };
  if (targetId === actor.id) return { status: "error", message: "You cannot change your own account here." };
  const target = await db.select().from(users).where(eq(users.id, targetId)).get();
  if (!target || target.deletedAt) return { status: "error", message: "Player not found." };

  const changes = action === "retire" ? { retiredAt: new Date() }
    : action === "unretire" ? { retiredAt: null }
    : action === "make_admin" ? { isAdmin: true }
    : { isAdmin: false };
  const actionName = action === "retire" ? "player.retired"
    : action === "unretire" ? "player.unretired"
    : action === "make_admin" ? "administrator.granted"
    : "administrator.revoked";

  await db.transaction(async (tx) => {
    await tx.update(users).set(changes).where(eq(users.id, targetId)).run();
    await tx.insert(auditLog).values({
      actorId: actor.id,
      action: actionName,
      entityType: "user",
      entityId: String(targetId),
      details: {
        displayName: target.displayName,
        previousRetired: Boolean(target.retiredAt),
        previousAdmin: target.isAdmin,
      },
    }).run();
  });
  revalidatePath("/");
  return { status: "success", message: "Updated." };
}
