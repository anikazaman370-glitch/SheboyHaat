# Database

The backend uses **PostgreSQL** with the **Prisma ORM**. The data models (`users`, `workers`, `bookings`, `reviews`, `reports`) are defined in `backend/prisma/schema.prisma`.

Local setup now points at a PostgreSQL connection string (for example a free Neon database or a local PostgreSQL server). Set `DATABASE_URL` in `backend/.env`, then run once:

```bash
cd backend
npm run db:push   # create/update tables from the Prisma schema
npm run db:seed   # insert sample workers and the demo admin
```

No SQLite file is used anymore.
