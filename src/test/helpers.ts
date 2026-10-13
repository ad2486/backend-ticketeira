import { randomInt, randomUUID } from "node:crypto";
import { expect } from "vitest";
import type { buildApp } from "../app.ts";

export type App = Awaited<ReturnType<typeof buildApp>>;

export const password = "senha12345";

// Email e CPF únicos por chamada: dispensa limpar o banco entre execuções.
export const createUser = async (app: App) => {
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
			birthDate: "2000-01-01",
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
export const authenticatedUser = async (app: App) => {
	const user = await createUser(app);
	return { ...user, token: app.jwt.sign({ sub: user.id }) };
};

export const accessTokenFor = async (app: App) => (await authenticatedUser(app)).token;
