import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: 'Electronics', slug: 'electronics', description: 'Phones, laptops, gadgets' },
    { name: 'Fashion', slug: 'fashion', description: 'Clothing and accessories' },
    { name: 'Home', slug: 'home', description: 'Furniture and decor' },
    { name: 'Collectibles', slug: 'collectibles', description: 'Rare and collectible items' },
  ];
  for (const c of categories) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      create: c,
      update: {},
    });
  }
  console.log('Seeded categories');

  // Create a demo admin (password: admin123)
  const adminEmail = 'admin@bidhub.local';
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 12);
    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin',
        passwordHash: hash,
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    console.log('Created admin user:', user.email);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
