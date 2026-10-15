import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";
import { type App, accessTokenFor, buyTicket, publishedEvent } from "../../test/helpers.ts";

let app: App;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const listMine = (accessToken?: string) =>
	app.inject({
		method: "GET",
		url: "/tickets/mine",
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
	});

describe("GET /tickets/mine", () => {
	it("lists the caller's tickets with event data, soonest event first", async () => {
		const later = await publishedEvent(app, { title: "Depois", startsAt: "2099-06-01T20:00:00Z" });
		const sooner = await publishedEvent(app, { title: "Antes", startsAt: "2099-01-01T20:00:00Z" });
		const buyer = await accessTokenFor(app);
		const other = await accessTokenFor(app);

		// comprado fora de ordem, para provar a ordenação por data do evento
		const laterOrder = (await buyTicket(app, buyer, later.id)).json();
		await buyTicket(app, buyer, sooner.id);
		await buyTicket(app, other, sooner.id);

		const res = await listMine(buyer);

		expect(res.statusCode).toBe(200);
		const tickets = res.json();
		expect(tickets.map((t: { event: { title: string } }) => t.event.title)).toEqual([
			"Antes",
			"Depois",
		]);
		expect(tickets[1].uniqueCode).toBe(laterOrder.ticket.uniqueCode);
		expect(tickets[1].checkedInAt).toBeNull();
		expect(tickets[0].event.startsAt).toBe("2099-01-01T20:00:00Z");
		expect(tickets[0].event).not.toHaveProperty("capacity");
	});

	it("shows when an event was canceled", async () => {
		const event = await publishedEvent(app);
		const buyer = await accessTokenFor(app);
		await buyTicket(app, buyer, event.id);
		await app.inject({
			method: "POST",
			url: `/events/${event.id}/cancel`,
			headers: { authorization: `Bearer ${event.token}` },
		});

		const [ticket] = (await listMine(buyer)).json();

		expect(ticket.event.status).toBe("canceled");
	});

	it("returns an empty list for users without tickets", async () => {
		const res = await listMine(await accessTokenFor(app));
		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual([]);
	});

	it("requires authentication", async () => {
		expect((await listMine()).statusCode).toBe(401);
	});
});
