import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";
import { db } from "../../prisma/db.ts";
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

describe("GET /events/mine", () => {
	const listMine = (accessToken?: string) =>
		app.inject({
			method: "GET",
			url: "/events/mine",
			headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
		});

	it("lists only the caller's events, soonest first", async () => {
		const token = await accessTokenFor(app);
		// criados fora de ordem para provar o orderBy
		await createEvent(token, eventPayload({ title: "Depois", startsAt: "2099-06-01T20:00:00Z" }));
		await createEvent(token, eventPayload({ title: "Antes", startsAt: "2099-01-01T20:00:00Z" }));

		const res = await listMine(token);

		expect(res.statusCode).toBe(200);
		// o banco de teste tem eventos de outros usuários: só os 2 do caller podem vir
		expect(res.json().map((e: { title: string }) => e.title)).toEqual(["Antes", "Depois"]);
		expect(res.json()[0].startsAt).toBe("2099-01-01T20:00:00Z");
	});

	it("requires authentication", async () => {
		expect((await listMine()).statusCode).toBe(401);
	});
});

describe("PATCH /events/:id", () => {
	const patch = (accessToken: string, id: string, payload: object) =>
		app.inject({
			method: "PATCH",
			url: `/events/${id}`,
			headers: { authorization: `Bearer ${accessToken}` },
			payload,
		});

	const newEvent = async (token: string) => (await createEvent(token)).json().id as string;

	it("updates only the given fields", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);

		const res = await patch(token, id, { title: "Novo título" });

		expect(res.statusCode).toBe(200);
		expect(res.json().title).toBe("Novo título");
		// .partial() do Zod mantém .default(): sem cuidado, isto voltaria 0
		expect(res.json().minAge).toBe(18);
	});

	it("rejects empty and unknown-only bodies", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);

		expect((await patch(token, id, {})).statusCode).toBe(400);
		// status não está no schema: o Zod descarta e sobra {}
		expect((await patch(token, id, { status: "published" })).statusCode).toBe(400);
	});

	it("rejects a non-uuid id", async () => {
		const token = await accessTokenFor(app);
		expect((await patch(token, "abc", { title: "x" })).statusCode).toBe(400);
	});

	it("returns 404 for missing events and for other users' events", async () => {
		const owner = await accessTokenFor(app);
		const intruder = await accessTokenFor(app);
		const id = await newEvent(owner);

		const missing = await patch(intruder, "00000000-0000-0000-0000-000000000000", { title: "x" });
		const notMine = await patch(intruder, id, { title: "x" });

		expect(missing.statusCode).toBe(404);
		expect(notMine.statusCode).toBe(404);
		// mesma resposta: não revela que o evento existe
		expect(notMine.json().message).toBe(missing.json().message);
	});

	it("returns 409 when the event is canceled", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);
		// sem rota de cancel ainda: prepara o estado direto no banco
		await db.orm.public.Event.where((e) => e.id.eq(id)).update({ status: "canceled" });

		expect((await patch(token, id, { title: "x" })).statusCode).toBe(409);
	});

	it("returns 409 when capacity would drop below tickets sold", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);
		// sem compra ainda: simula vendas direto no banco
		await db.orm.public.Event.where((e) => e.id.eq(id)).update({ soldTickets: 50 });

		const res = await patch(token, id, { capacity: 10 });

		expect(res.statusCode).toBe(409);
		expect(res.json().message).toContain("Capacity");
	});
});

describe("POST /events/:id/publish and /cancel", () => {
	const action = (accessToken: string | undefined, id: string, name: "publish" | "cancel") =>
		app.inject({
			method: "POST",
			url: `/events/${id}/${name}`,
			headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
		});

	const newEvent = async (token: string) => (await createEvent(token)).json().id as string;

	it("publishes a draft once", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);

		const first = await action(token, id, "publish");
		expect(first.statusCode).toBe(200);
		expect(first.json().status).toBe("published");

		expect((await action(token, id, "publish")).statusCode).toBe(409);
	});

	it("cancels a published event once", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);
		await action(token, id, "publish");

		const first = await action(token, id, "cancel");
		expect(first.statusCode).toBe(200);
		expect(first.json().status).toBe("canceled");

		expect((await action(token, id, "cancel")).statusCode).toBe(409);
		expect((await action(token, id, "publish")).statusCode).toBe(409);
	});

	it("frees a tier slot when an event is canceled", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);
		await newEvent(token);
		expect((await createEvent(token)).statusCode).toBe(403);

		await action(token, id, "cancel");

		expect((await createEvent(token)).statusCode).toBe(201);
	});

	it("refuses to publish an event that already started", async () => {
		const token = await accessTokenFor(app);
		const id = await newEvent(token);
		// o schema não aceita startsAt no passado: prepara direto no banco
		await db.orm.public.Event.where((e) => e.id.eq(id)).update({
			startsAt: "2020-01-01T00:00:00Z",
		});

		expect((await action(token, id, "publish")).statusCode).toBe(409);
	});

	it("returns 404 for other users' events and 401 without token", async () => {
		const owner = await accessTokenFor(app);
		const intruder = await accessTokenFor(app);
		const id = await newEvent(owner);

		expect((await action(intruder, id, "publish")).statusCode).toBe(404);
		expect((await action(intruder, id, "cancel")).statusCode).toBe(404);
		expect((await action(undefined, id, "publish")).statusCode).toBe(401);
	});
});
