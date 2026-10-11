import { z } from "zod/v4";

export const loginBody = z.object({
	email: z.email().toLowerCase(),
	password: z.string().min(1).max(128),
});

export const loginResponse = z.object({ accessToken: z.string(), refreshToken: z.string() });
