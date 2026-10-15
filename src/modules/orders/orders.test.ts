import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";
import { db } from "../../prisma/db.ts";
import { type App, accessTokenFor, authenticatedUser } from "../../test/helpers.ts";

let app: App;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const SP = "America/Sao_Paulo";
const inThirtyDays = () =>
	Temporal.Now.instant()
		.add({ hours: 24 * 30 })
		.toString();

// Cria um evento com um organizador novo (limite do tier free) e publica.
const publishedEvent = async (overrides: Record<string, unknown> = {}) => {
	const token = await accessTokenFor(app);
	const created = await app.inject({
		method: "POST",
		url: "/events",
		headers: { authorization: `Bearer ${token}` },
		payload: {
			title: "Show",
			location: "Opinião",
			city: "Porto Alegre",
			state: "RS",
			startsAt: inThirtyDays(),
			capacity: 100,
			minAge: 0,
			ticketPriceCents: 5000,
			...overrides,
		},
	});
	expect(created.statusCode).toBe(201);
	const id = created.json().id as string;
	await app.inject({
		method: "POST",
		url: `/events/${id}/publish`,
		headers: { authorization: `Bearer ${token}` },
	});
	return { id, token };
};

// IP aleatório por padrão: o rate limit da compra é 10/min por IP.
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

const buy = (accessToken: string | undefined, eventId: string, remoteAddress = nextIp()) =>
	app.inject({
		method: "POST",
		url: `/events/${eventId}/orders`,
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
		remoteAddress,
	});

const soldTickets = async (eventId: string) =>
	(
		await db.orm.public.Event.where((e) => e.id.eq(eventId))
			.select("soldTickets")
			.first()
	)?.soldTickets;

describe("POST /events/:id/orders", () => {
	it("buys one ticket at the current price", async () => {
		const { id } = await publishedEvent({ ticketPriceCents: 7500 });
		const buyer = await accessTokenFor(app);

		const res = await buy(buyer, id);

		expect(res.statusCode).toBe(201);
		const order = res.json();
		expect(order.status).toBe("paid");
		expect(order.unitPriceCents).toBe(7500);
		expect(order.ticket.uniqueCode).toMatch(/^[0-9a-f-]{36}$/);
		expect(await soldTickets(id)).toBe(1);
	});

	it("lets the organizer buy a ticket to their own event", async () => {
		const { id, token } = await publishedEvent();
		expect((await buy(token, id)).statusCode).toBe(201);
	});

	it("allows only one ticket per user per event", async () => {
		const { id } = await publishedEvent();
		const buyer = await accessTokenFor(app);

		expect((await buy(buyer, id)).statusCode).toBe(201);
		const second = await buy(buyer, id);

		expect(second.statusCode).toBe(409);
		expect(second.json().message).toContain("already have a ticket");
		expect(await soldTickets(id)).toBe(1);
	});

	it("returns 404 for drafts and unknown events", async () => {
		const token = await accessTokenFor(app);
		const draft = await app.inject({
			method: "POST",
			url: "/events",
			headers: { authorization: `Bearer ${token}` },
			payload: {
				title: "Rascunho",
				location: "x",
				city: "Porto Alegre",
				state: "RS",
				startsAt: inThirtyDays(),
				capacity: 10,
				ticketPriceCents: 0,
			},
		});
		const buyer = await accessTokenFor(app);

		expect((await buy(buyer, draft.json().id)).statusCode).toBe(404);
		expect((await buy(buyer, "00000000-0000-0000-0000-000000000000")).statusCode).toBe(404);
	});

	it("returns 409 when the event already started", async () => {
		const { id } = await publishedEvent();
		await db.orm.public.Event.where((e) => e.id.eq(id)).update({
			startsAt: "2020-01-01T00:00:00Z",
		});

		expect((await buy(await accessTokenFor(app), id)).statusCode).toBe(409);
	});

	it("returns 409 when sold out", async () => {
		const { id } = await publishedEvent({ capacity: 1 });

		expect((await buy(await accessTokenFor(app), id)).statusCode).toBe(201);
		const second = await buy(await accessTokenFor(app), id);

		expect(second.statusCode).toBe(409);
		expect(second.json().message).toContain("sold out");
	});

	it("checks the minimum age on the event's local date", async () => {
		// 23:30 em São Paulo já é o dia seguinte em UTC: a idade tem que usar o dia local.
		const eventDay = Temporal.Now.plainDateISO(SP).add({ days: 30 });
		const startsAt = eventDay
			.toZonedDateTime({ timeZone: SP, plainTime: "23:30" })
			.toInstant()
			.toString();
		const { id } = await publishedEvent({ minAge: 18, startsAt });

		const turns18OnEventDay = await authenticatedUser(app, {
			birthDate: eventDay.subtract({ years: 18 }).toString(),
		});
		const turns18NextDay = await authenticatedUser(app, {
			birthDate: eventDay.subtract({ years: 18 }).add({ days: 1 }).toString(),
		});

		expect((await buy(turns18OnEventDay.token, id)).statusCode).toBe(201);
		const tooYoung = await buy(turns18NextDay.token, id);
		expect(tooYoung.statusCode).toBe(403);
		expect(tooYoung.json().message).toContain("18");
	});

	it("never sells beyond capacity under concurrent purchases", async () => {
		const { id } = await publishedEvent({ capacity: 5 });
		const buyers = await Promise.all(Array.from({ length: 10 }, () => accessTokenFor(app)));

		const results = await Promise.all(buyers.map((token) => buy(token, id)));

		const statuses = results.map((r) => r.statusCode);
		expect(statuses.filter((s) => s === 201)).toHaveLength(5);
		expect(statuses.filter((s) => s === 409)).toHaveLength(5);
		expect(await soldTickets(id)).toBe(5);
		const tickets = await db.orm.public.Ticket.where((t) => t.eventId.eq(id))
			.select("id")
			.all();
		expect(tickets).toHaveLength(5);
	});

	it("does not sell two tickets to the same user under concurrent purchases", async () => {
		const { id } = await publishedEvent();
		const buyer = await accessTokenFor(app);

		const results = await Promise.all([buy(buyer, id), buy(buyer, id), buy(buyer, id)]);

		expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409, 409]);
		expect(await soldTickets(id)).toBe(1);
	});

	it("requires authentication", async () => {
		const { id } = await publishedEvent();
		expect((await buy(undefined, id)).statusCode).toBe(401);
	});

	it("rate limits purchases per IP", async () => {
		const { id } = await publishedEvent();
		const ip = "192.0.2.1";
		const token = await accessTokenFor(app);

		const results = [];
		for (let i = 0; i < 11; i++) results.push((await buy(token, id, ip)).statusCode);

		expect(results.slice(0, 10)).not.toContain(429);
		expect(results[10]).toBe(429);
	});
});
