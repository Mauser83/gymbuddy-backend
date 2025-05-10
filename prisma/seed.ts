import { prisma } from '../src/lib/prisma';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !password) {
    console.error('ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set.');
    process.exit(1);
  }

  const existingUser = await prisma.user.findUnique({
    where: {
      email: process.env.ADMIN_EMAIL,
    },
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email,
        username: username,
        password: hashedPassword,
        appRole: 'ADMIN',
        userRole: 'USER'
      },
    });

    console.log(`Created user with id: ${user.id}`);
  } else {
    console.log(`User with username ${username} already exists`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })