import { prisma } from "@/lib/prisma";

export async function listUsersWithChannels() {
  return prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      createdAt: true,
      channels: {
        select: {
          channel: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

export async function getUserWithChannels(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      active: true,
      createdAt: true,
      channels: {
        select: {
          channel: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
}

export async function countOwners(): Promise<number> {
  return prisma.user.count({ where: { role: "OWNER", active: true } });
}
