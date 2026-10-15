import { randomInt, randomUUID } from "node:crypto";
import { expect } from "vitest";
import type { buildApp } from "../app.ts";

export type App = Awaited<ReturnType<typeof buildApp>>;

export const password = "senha12345";

// Email e CPF únicos por chamada: dispensa limpar o banco entre execuções.
export const createUser = async (app: App, { birthDate = "2000-01-01" } = {}) => {
	const email = `${randomUUID()}@test.com`;
	const res = await app.inject({
		method: "POST",
		url: "/users",
		payload: {
			name: "Teste",
			email,
			cpf: String(randomInt(1e10, 1e11)),
			city: "Porto Alegre",
			state: "RS",
			birthDate,
			password,
		},
	});
	expect(res.statusCode).toBe(201);
	return { id: res.json().id as string, email };
};

export const login = (app: App, email: string, pass = password) =>
	app.inject({ method: "POST", url: "/auth/login", payload: { email, password: pass } });

// Assina o token direto, sem passar pelo /auth/login: o rate limit do login
// (5/min por IP, e todo inject vem de 127.0.0.1) travaria os outros arquivos.
// O login de verdade é testado em auth.test.ts.
export const authenticatedUser = async (app: App, options?: { birthDate?: string }) => {
	const user = await createUser(app, options);
	return { ...user, token: app.jwt.sign({ sub: user.id }) };
};

export const accessTokenFor = async (app: App) => (await authenticatedUser(app)).token;

// Evento publicado por um organizador novo (cada um tem o limite do tier free).
export const publishedEvent = async (app: App, overrides: Record<string, unknown> = {}) => {
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
			startsAt: Temporal.Now.instant()
				.add({ hours: 24 * 30 })
				.toString(),
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

// IP diferente por compra: o rate limit da compra é 10/min por IP.
let ipCounter = 0;
const nextIp = () => `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

export const buyTicket = (
	app: App,
	accessToken: string | undefined,
	eventId: string,
	remoteAddress = nextIp(),
) =>
	app.inject({
		method: "POST",
		url: `/events/${eventId}/orders`,
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
		remoteAddress,
	});
