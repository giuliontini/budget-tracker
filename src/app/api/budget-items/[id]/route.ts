// src/app/api/budget-items/[id]/route.ts
import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/auth";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<Response> {
  const user = await getUser(req);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { id } = await ctx.params;
  if (!id) return new Response("Missing id", { status: 400 });

  // Optionally: ensure the item belongs to the user (add userId to model if present)
  // await prisma.budgetItem.delete({ where: { id, userId: user.id } });

  await prisma.budgetItem.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
