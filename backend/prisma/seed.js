import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const workerSeed = [
  { name: 'Md. Rahim Uddin', service: 'Plumber', area: 'Mirpur', rating: 4.9, reviewCount: 128, price: '৳500', verified: true, avatar: 'RU', jobs: 312, bio: 'Experienced plumber for pipes, taps and bathroom repairs.' },
  { name: 'Abdul Karim', service: 'Electrician', area: 'Uttara', rating: 4.8, reviewCount: 96, price: '৳450', verified: true, avatar: 'AK', jobs: 241, bio: 'Electrical repairs, wiring, switches and fans.' },
  { name: 'Shila Akter', service: 'Home Cleaner', area: 'Dhanmondi', rating: 4.9, reviewCount: 84, price: '৳700', verified: true, avatar: 'SA', jobs: 198, bio: 'Home, kitchen and deep cleaning.' },
  { name: 'Hasan Mahmud', service: 'AC Technician', area: 'Mohammadpur', rating: 4.7, reviewCount: 73, price: '৳800', verified: true, avatar: 'HM', jobs: 176, bio: 'AC servicing, installation and maintenance.' },
  { name: 'Rashed Mia', service: 'Electrician', area: 'Mirpur', rating: 4.8, reviewCount: 64, price: '৳500', verified: true, avatar: 'RM', jobs: 154, bio: 'Home electrical maintenance.' },
  { name: 'Nusrat Jahan', service: 'Home Cleaner', area: 'Banani', rating: 4.9, reviewCount: 55, price: '৳750', verified: true, avatar: 'NJ', jobs: 143, bio: 'Careful home cleaning service.' },
];

const ADMIN_EMAIL = 'admin@sheboyhaat.local';
const ADMIN_PASSWORD = 'sheboyhaat123#';

async function main() {
  const workerCount = await prisma.worker.count();
  if (workerCount === 0) {
    await prisma.worker.createMany({ data: workerSeed });
    console.log(`Seeded ${workerSeed.length} demo workers.`);
  } else {
    console.log(`Workers already present (${workerCount}); skipping worker seed.`);
  }

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10), role: 'admin' },
    create: {
      name: 'Demo Admin',
      email: ADMIN_EMAIL,
      passwordHash: bcrypt.hashSync(ADMIN_PASSWORD, 10),
      role: 'admin',
    },
  });
  console.log(`Admin ready: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
