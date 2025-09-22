import { hash } from 'bcrypt';
import * as dotenv from 'dotenv';

import { prisma } from '../src/prisma';

dotenv.config();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    console.error(
      'ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.',
    );
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: process.env.ADMIN_EMAIL,
    },
  });

  if (!existingUser) {
    const hashedPassword = await hash(password, 10);

    await prisma.user.create({
      data: {
        email: email,
        username: username,
        password: hashedPassword,
        appRole: 'ADMIN',
        userRole: 'USER',
      },
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Created demo user');
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.log('Demo user already exists');
    }
  }

  await prisma.experienceLevel.createMany({
    data: [
      {
        name: 'Beginner',
        key: 'beginner',
        isDefault: true,
      },
      {
        name: 'Intermediate',
        key: 'intermediate',
        isDefault: false,
      },
      {
        name: 'Advanced',
        key: 'advanced',
        isDefault: false,
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
