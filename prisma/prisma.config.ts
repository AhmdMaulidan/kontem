// Prisma 7 config — connection URLs for local PostgreSQL
export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL ||
        "postgresql://postgres:admin123456@localhost:5433/kontem?schema=public",
      directUrl: process.env.DIRECT_URL ||
        "postgresql://postgres:admin123456@localhost:5433/kontem?schema=public",
    },
  },
};
