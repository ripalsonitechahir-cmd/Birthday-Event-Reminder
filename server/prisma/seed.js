const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SYSTEM_CATEGORIES = ['Birthday', 'Anniversary', 'Appointment', 'Holiday', 'Meeting', 'Reminder', 'Other'];

async function main() {
  for (const name of SYSTEM_CATEGORIES) {
    const exists = await prisma.category.findFirst({ where: { userId: null, name } });
    if (!exists) await prisma.category.create({ data: { name } });
  }
  console.log('System categories ready');
}

main().finally(() => prisma.$disconnect());
