import { z } from "zod/v4";
import { timestamptz } from "../../common/schemas.ts";

export const orderResponse = z.object({
	id: z.uuid(),
	eventId: z.uuid(),
	status: z.enum(["pending", "paid", "expired", "canceled"]),
	unitPriceCents: z.int(),
	createdAt: timestamptz,
	ticket: z.object({
		id: z.uuid(),
		uniqueCode: z.uuid(),
	}),
});
