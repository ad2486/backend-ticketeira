import { db } from "../../prisma/db.ts";
import type { CreateEventInput } from "./events.schemas.ts";

const TIER_EVENT_LIMIT = { free: 2, verified: 10, pro: 50 };

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
		return tx.orm.public.Event.select(
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
		).create({ ...data, creatorId });
	});
};
