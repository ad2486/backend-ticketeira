import { z } from "zod/v4";
import { stateEnum, timestamptz } from "../../common/schemas.ts";

export const ticketResponse = z.object({
	id: z.uuid(),
	uniqueCode: z.uuid(),
	checkedInAt: timestamptz.nullable(),
	event: z.object({
		id: z.uuid(),
		title: z.string(),
		startsAt: timestamptz,
		location: z.string(),
		city: z.string(),
		state: stateEnum,
		status: z.enum(["draft", "published", "finished", "canceled"]),
	}),
});
