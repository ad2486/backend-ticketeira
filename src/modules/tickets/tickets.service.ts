import { db } from "../../prisma/db.ts";

export const listTicketsByOwner = async (userId: string) => {
	const rows = await db.orm.public.Ticket.where((t) => t.userId.eq(userId))
		.select("id", "uniqueCode", "checkedInAt")
		.include("event", (event) =>
			event.select("id", "title", "startsAt", "location", "city", "state", "status"),
		)
		.all();

	// O ORM tipa o include "para um" como nullable; aqui a FK é NOT NULL, então
	// o flatMap só tira o null do tipo (nenhuma linha é descartada na prática).
	const tickets = rows.flatMap(({ event, ...ticket }) => (event ? [{ ...ticket, event }] : []));

	// Ordenar pelo campo de uma relação é mais simples em JS; a lista é pequena.
	tickets.sort((a, b) =>
		Temporal.Instant.compare(
			Temporal.Instant.from(a.event.startsAt),
			Temporal.Instant.from(b.event.startsAt),
		),
	);

	return tickets;
};
