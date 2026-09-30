import { z } from "zod/v4";

export const errorResponse = z.object({
	statusCode: z.number(),
	error: z.string(),
	message: z.string(),
});
