import { db } from "../../prisma/db.ts";
import type { CreateEventInput, EventStatus, UpdateEventInput } from "./events.schemas.ts";

const TIER_EVENT_LIMIT = { free: 2, verified: 10, pro: 50 };
const eventFields = [
	"id",
	"creatorId",
	"title",
	"description",
	"location",
	"city",
	"state",
	"startsAt",
	"capacity",
	"minAge",
	"ticketPriceCents",
	"status",
	"soldTickets",
	"createdAt",
] as const;

const users = db.sql.public.users;

export const createEvent = async (creatorId: string, data: CreateEventInput) => {
	return db.transaction(async (tx) => {
		// FOR UPDATE: locks the user before the commit; simultaneous creations wait and recount.
		const plan = db.raw.sql`SELECT tier FROM users WHERE id = ${creatorId} FOR UPDATE`
			.returnsRow({ tier: users.columns.tier })
			.build();
		const rows = await tx.query(plan);
		const user = rows[0];
		if (!user) {
			throw Object.assign(new Error("User not found"), { statusCode: 404 });
		}
		const limit = TIER_EVENT_LIMIT[user.tier];
		const activeEvents = await tx.orm.public.Event.where((e) => e.creatorId.eq(creatorId))
			.where((e) => e.status.in(["draft", "published"]))
			.aggregate((a) => ({ count: a.count() }));
		if (activeEvents.count >= limit) {
			throw Object.assign(
				new Error(`Active event limit reached for tier ${user.tier} (${limit})`),
				{ statusCode: 403 },
			);
		}
		return tx.orm.public.Event.select(...eventFields).create({ ...data, creatorId });
	});
};

export const listEventsByCreator = async (creatorId: string) => {
	return db.orm.public.Event.where((e) => e.creatorId.eq(creatorId))
		.select(...eventFields)
		.orderBy((e) => e.startsAt.asc())
		.all();
};

export const updateEvent = async (id: string, creatorId: string, data: UpdateEventInput) => {
	const event = await db.orm.public.Event.where((e) => e.id.eq(id))
		.where((e) => e.creatorId.eq(creatorId))
		.where((e) => e.status.in(["draft", "published"]))
		.select(...eventFields)
		.update(data)
		.catch((error: unknown) => {
			if (
				error instanceof Error &&
				"sqlState" in error &&
				error.sqlState === "23514" &&
				"constraint" in error &&
				typeof error.constraint === "string" &&
				error.constraint.startsWith("event_sold_tickets_within_capacity")
			) {
				throw Object.assign(new Error("Capacity cannot be lower than tickets sold"), {
					statusCode: 409,
				});
			}
			throw error;
		});
	if (event) return event;
	return throwWriteFailure(id, creatorId, "Event can no longer be edited");
};

const throwWriteFailure = async (id: string, creatorId: string, conflictMessage: string) => {
	const result = await db.orm.public.Event.where((e) => e.id.eq(id))
		.where((e) => e.creatorId.eq(creatorId))
		.select("status")
		.first();
	if (!result) {
		throw Object.assign(new Error("Event not found"), { statusCode: 404 });
	} else {
		throw Object.assign(new Error(conflictMessage), { statusCode: 409 });
	}
};

const transitionEvent = async (
	id: string,
	creatorId: string,
	from: EventStatus[],
	to: EventStatus,
	conflictMessage: string,
) => {
	const event = await db.orm.public.Event.where((e) => e.id.eq(id))
		.where((e) => e.creatorId.eq(creatorId))
		.where((e) => e.status.in(from))
		.where((e) => e.startsAt.gt(Temporal.Now.instant().toString()))
		.select(...eventFields)
		.update({ status: to });
	if (event) return event;
	return throwWriteFailure(id, creatorId, conflictMessage);
};

export const publishEvent = (id: string, creatorId: string) =>
	transitionEvent(id, creatorId, ["draft"], "published", "Event cannot be published");

export const cancelEvent = (id: string, creatorId: string) =>
	transitionEvent(id, creatorId, ["draft", "published"], "canceled", "Event cannot be canceled");
