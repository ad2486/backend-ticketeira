import { db } from "../../prisma/db.ts";

const events = db.sql.public.events;

export const createOrder = async (eventId: string, userId: string) => {
	return db.transaction(async (tx) => {
		const plan = db.raw
			.sql`SELECT status, starts_at AS "startsAt", capacity, sold_tickets AS "soldTickets", ticket_price_cents AS "ticketPriceCents", min_age AS "minAge"
         FROM events WHERE id = ${eventId} FOR UPDATE`
			.returnsRow({
				status: events.columns.status,
				startsAt: events.columns.starts_at,
				capacity: events.columns.capacity,
				soldTickets: events.columns.sold_tickets,
				ticketPriceCents: events.columns.ticket_price_cents,
				minAge: events.columns.min_age,
			})
			.build();
		const rows = await tx.query(plan);
		const event = rows[0];
		if (event?.status !== "published") {
			throw Object.assign(new Error("Event not found"), { statusCode: 404 });
		}
		if (
			Temporal.Instant.compare(Temporal.Instant.from(event.startsAt), Temporal.Now.instant()) <= 0
		) {
			throw Object.assign(new Error("Event has already started"), { statusCode: 409 });
		}
		const user = await tx.orm.public.User.where((u) => u.id.eq(userId))
			.select("birthDate")
			.first();
		if (!user) {
			throw Object.assign(new Error("User not found"), { statusCode: 404 });
		}
		const eventDate = Temporal.Instant.from(event.startsAt)
			.toZonedDateTimeISO("America/Sao_Paulo")
			.toPlainDate();

		if (Temporal.PlainDate.compare(user.birthDate.add({ years: event.minAge }), eventDate) > 0) {
			throw Object.assign(new Error(`This event requires age ${event.minAge}+`), {
				statusCode: 403,
			});
		}

		const existing = await tx.orm.public.Order.where((o) => o.userId.eq(userId))
			.where((o) => o.eventId.eq(eventId))
			.where((o) => o.status.eq("paid"))
			.select("id")
			.first();
		if (existing) {
			throw Object.assign(new Error("You already have a ticket for this event"), {
				statusCode: 409,
			});
		}

		if (event.soldTickets >= event.capacity) {
			throw Object.assign(new Error("Event is sold out"), { statusCode: 409 });
		}

		await tx.orm.public.Event.where((e) => e.id.eq(eventId)).update({
			soldTickets: event.soldTickets + 1,
		});

		const order = await tx.orm.public.Order.select(
			"id",
			"eventId",
			"status",
			"unitPriceCents",
			"createdAt",
		).create({
			userId,
			eventId,
			quantity: 1,
			unitPriceCents: event.ticketPriceCents,
			status: "paid",
		});

		const ticket = await tx.orm.public.Ticket.select("id", "uniqueCode").create({
			orderId: order.id,
			eventId,
			userId,
		});

		return { ...order, ticket };
	});
};
