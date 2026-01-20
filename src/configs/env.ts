import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),

  mongodbUri: required("MONGODB_URI"),
  clientOrigin: required("CLIENT_ORIGIN"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),

  accessTokenTtlMin: Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),

  cookieName: process.env.COOKIE_NAME ?? "rt",

  seedAdminEmail: process.env.SEED_ADMIN_EMAIL ?? "admin@company.com",
  seedAdminUsername: process.env.SEED_ADMIN_USERNAME ?? "admin",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234",
};