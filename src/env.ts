import { z } from "zod/v4";

try {
	process.loadEnvFile();
} catch (error) {
	if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
		throw error;
	}
}

const envSchema = z.object({
	DATABASE_URL: z.url(),
	PORT: z.coerce.number().int().default(3000),
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
	console.error(z.prettifyError(result.error));
	process.exit(1);
}

export const env = result.data;
