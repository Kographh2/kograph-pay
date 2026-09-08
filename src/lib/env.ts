import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Public Supabase config (exposed to the browser).
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .url()
    .refine(
      (u) => !/example\.supabase\.co$/i.test(u) && !/placeholder/i.test(u),
      "NEXT_PUBLIC_SUPABASE_URL is still a placeholder. Set it to your real Supabase project URL.",
    ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .min(20)
    .refine((k) => !/placeholder/i.test(k), "NEXT_PUBLIC_SUPABASE_ANON_KEY is still a placeholder."),

  // Server-only Supabase privileged client (NEVER expose to the browser).
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(20)
    .refine((k) => !/placeholder/i.test(k), "SUPABASE_SERVICE_ROLE_KEY is still a placeholder."),

  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 chars"),

  SAWERIA_USERNAME: z.string().optional(),
  SAWERIA_EMAIL: z.string().optional(),
  SAWERIA_PASSWORD: z.string().optional(),
  SAWERIA_USER_ID: z.string().uuid().optional(),
  SAWERIA_PROXY_URL: z.string().url().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional(),
  PAYMENT_EXPIRATION_MINUTES: z.coerce.number().int().positive().default(15),
  PAYMENT_PROVIDER: z.enum(["saweria", "mock"]).default("saweria"),
  INITIAL_ADMIN_EMAIL: z.string().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export class EnvConfigError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`Invalid environment variables:\n  - ${issues.join("\n  - ")}`);
    this.issues = issues;
  }
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new EnvConfigError(issues);
  }
  cached = parsed.data;
  return cached;
}