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
	return email;
};

export const login = (app: App, email: string, pass = password) =>
	app.inject({ method: "POST", url: "/auth/login", payload: { email, password: pass } });

// Rate limit do login é 5/min por IP, e todo inject vem de 127.0.0.1.
// O contador é por instância do app, ou seja, por arquivo de teste.
export const accessTokenFor = async (app: App) => {
	const res = await login(app, await createUser(app));
	expect(res.statusCode).toBe(200);
	return res.json().accessToken as string;
};
