import { z } from "zod/v4";

export const loginBody = z.object({
	email: z.email().toLowerCase(),
	password: z.string().min(1).max(128),
});

export const tokensResponse = z.object({ accessToken: z.string(), refreshToken: z.string() });

export const refreshBody = z.object({ refreshToken: z.string().min(1) });
