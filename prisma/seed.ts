import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { hashPassword } from "../lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function main() {
  const email = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");
  const fullName = process.env.SUPER_ADMIN_NAME?.trim() || "PharmaCloud Super Admin";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SUPER_ADMIN_EMAIL must be a valid email address");
  }
  if (password.length < 5) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 5 characters long");
  }

  await prisma.$transaction(async (tx) => {
    // A platform tenant is required by the application's tenant-scoped user model.
    const tenant = await tx.tenant.upsert({
      where: { slug: "pharmacloud-platform" },
      create: { name: "PharmaCloud Platform", slug: "pharmacloud-platform" },
      update: { name: "PharmaCloud Platform", isActive: true },
    });

    const group = await tx.adminGroup.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Platform Super Admin" } },
      create: { tenantId: tenant.id, name: "Platform Super Admin" },
      update: {},
    });

    await tx.userProfile.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      create: {
        tenantId: tenant.id,
        groupId: group.id,
        email,
        fullName,
        passwordHash: hashPassword(password),
        role: "SUPER_ADMIN",
        isActive: true,
      },
      update: {
        groupId: group.id,
        fullName,
        passwordHash: hashPassword(password),
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });

    const platformSubscription = await tx.subscription.findFirst({
      where: { tenantId: tenant.id, plan: "PLATFORM" },
      select: { id: true },
    });
    if (platformSubscription) {
      await tx.subscription.update({
        where: { id: platformSubscription.id },
        data: { status: "ACTIVE", trialEnds: null },
      });
    } else {
      await tx.subscription.create({
        data: { tenantId: tenant.id, plan: "PLATFORM", status: "ACTIVE" },
      });
    }
  });

  console.log(`Seed complete. Super-admin account ensured for ${email}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
