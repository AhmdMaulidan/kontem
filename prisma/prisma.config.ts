import "dotenv/config";

// Prisma 7 config — connection URLs
const config = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "",
      directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
    },
  },
};

export default config;
