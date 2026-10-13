import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";
import { type App, accessTokenFor } from "../../test/helpers.ts";

let app: App;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const inThirtyDays = () =>
	Temporal.Now.instant()
		.add({ hours: 24 * 30 })
		.toString();

const eventPayload = (overrides: Record<string, unknown> = {}) => ({
	title: "Show de teste",
	description: "Descrição",
	location: "Opinião",
	city: "Porto Alegre",
	state: "RS",
	startsAt: inThirtyDays(),
	capacity: 100,
	minAge: 18,
	ticketPriceCents: 5000,
	...overrides,
});

const createEvent = (accessToken: string | undefined, payload: object = eventPayload()) =>
	app.inject({
		method: "POST",
		url: "/events",
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
		payload,
	});

// Este arquivo faz 4 logins (limite: 5 por arquivo, ver test/helpers.ts).
describe("POST /events", () => {
	it("creates a draft event owned by the caller", async () => {
		const token = await accessTokenFor(app);
		const startsAt = "2099-12-01T21:00:00-03:00";

		const res = await createEvent(token, eventPayload({ startsAt, description: undefined }));

		expect(res.statusCode).toBe(201);
		const event = res.json();
		expect(event.status).toBe("draft");
		expect(event.soldTickets).toBe(0);
		expect(event.description).toBeNull();
		// mesmo instante, normalizado para UTC
		expect(Temporal.Instant.from(event.startsAt).equals(Temporal.Instant.from(startsAt))).toBe(
			true,
		);
	});

	it("enforces the free tier limit of 2 active events", async () => {
		const token = await accessTokenFor(app);

		expect((await createEvent(token)).statusCode).toBe(201);
		expect((await createEvent(token)).statusCode).toBe(201);
		const third = await createEvent(token);
		expect(third.statusCode).toBe(403);
		expect(third.json().message).toContain("free");
	});

	it("does not exceed the tier limit under concurrent requests", async () => {
		const token = await accessTokenFor(app);

		const results = await Promise.all([createEvent(token), createEvent(token), createEvent(token)]);

		const statuses = results.map((r) => r.statusCode).sort();
		expect(statuses).toEqual([201, 201, 403]);
	});

	it("rejects invalid bodies", async () => {
		const token = await accessTokenFor(app);

		const cases = [
			{ startsAt: "2020-01-01T10:00:00Z" }, // passado
			{ startsAt: "2099-12-01T21:00:00" }, // sem fuso
			{ title: "   " }, // só espaços
			{ state: "XX" },
			{ capacity: 0 },
			{ capacity: 2 ** 31 }, // não cabe em int4
		];
		for (const override of cases) {
			const res = await createEvent(token, eventPayload(override));
			expect(res.statusCode, JSON.stringify(override)).toBe(400);
		}
	});

	it("requires authentication", async () => {
		expect((await createEvent(undefined)).statusCode).toBe(401);
	});
});
