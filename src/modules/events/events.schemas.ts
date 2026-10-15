import { z } from "zod/v4";
import { stateEnum, timestamptz } from "../../common/schemas.ts";

export const eventBody = z.object({
	title: z.string().trim().min(1),
	description: z.string().optional(),
	location: z.string().trim().min(1),
	city: z.string().trim().min(1),
	state: stateEnum,
	startsAt: z.iso
		.datetime({ offset: true, abort: true })
		.refine(
			(s) => Temporal.Instant.compare(Temporal.Instant.from(s), Temporal.Now.instant()) > 0,
			"Event must start in future",
		),
	capacity: z.int32().min(1),
	minAge: z.int32().min(0).optional(),
	ticketPriceCents: z.int32().min(0),
});

export const eventResponse = z.object({
	id: z.uuid(),
	creatorId: z.uuid(),
	title: z.string(),
	description: z.string().nullable(),
	location: z.string(),
	city: z.string(),
	state: stateEnum,
	startsAt: timestamptz,
	capacity: z.int(),
	minAge: z.int(),
	ticketPriceCents: z.int(),
	status: z.enum(["draft", "published", "finished", "canceled"]),
	soldTickets: z.int(),
	createdAt: timestamptz,
});

export const updateEventBody = eventBody
	.partial()
	.refine((body) => Object.keys(body).length > 0, "At least one field must be provided");

export const publicEventsQuery = z.object({
	city: z.string().trim().min(1).optional(),
	state: stateEnum.optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

export type CreateEventInput = z.output<typeof eventBody>;
export type UpdateEventInput = z.output<typeof updateEventBody>;
export type EventStatus = z.output<typeof eventResponse>["status"];
export type PublicEventsQuery = z.output<typeof publicEventsQuery>;
