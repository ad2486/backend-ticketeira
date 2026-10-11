import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const password = "senha12345";

const createUser = async () => {
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

const login = (email: string, pass = password) =>
	app.inject({ method: "POST", url: "/auth/login", payload: { email, password: pass } });

const refresh = (refreshToken: string) =>
	app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

const me = (accessToken?: string) =>
	app.inject({
		method: "GET",
		url: "/users/me",
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
	});

// Rate limit do login é 5/min por IP e todo inject vem de 127.0.0.1:
// este arquivo faz 4 logins. Passou de 5, o próximo vira 429.
describe("auth", () => {
	it("logs in and accesses /users/me", async () => {
		const email = await createUser();

		const res = await login(email);
		expect(res.statusCode).toBe(200);
		const { accessToken, refreshToken } = res.json();
		expect(accessToken).toEqual(expect.any(String));
		expect(refreshToken).toEqual(expect.any(String));

		const meRes = await me(accessToken);
		expect(meRes.statusCode).toBe(200);
		expect(meRes.json().email).toBe(email);
		expect(meRes.json()).not.toHaveProperty("passwordHash");
		expect(meRes.json()).not.toHaveProperty("cpf");
	});

	it("returns the same 401 for wrong password and unknown email", async () => {
		const email = await createUser();

		const wrongPassword = await login(email, "senha-errada");
		const unknownEmail = await login(`${randomUUID()}@test.com`);

		expect(wrongPassword.statusCode).toBe(401);
		expect(unknownEmail.statusCode).toBe(401);
		expect(wrongPassword.json().message).toBe(unknownEmail.json().message);
	});

	it("rejects /users/me without or with a tampered token", async () => {
		expect((await me()).statusCode).toBe(401);
		expect((await me("not.a.jwt")).statusCode).toBe(401);
	});

	it("rotates the refresh token and revokes everything on reuse", async () => {
		const email = await createUser();
		const tokenA = (await login(email)).json().refreshToken;

		const first = await refresh(tokenA);
		expect(first.statusCode).toBe(200);
		const tokenB = first.json().refreshToken;
		expect(tokenB).not.toBe(tokenA);
		expect((await me(first.json().accessToken)).statusCode).toBe(200);

		// A já foi usado: reuso derruba A e B
		expect((await refresh(tokenA)).statusCode).toBe(401);
		expect((await refresh(tokenB)).statusCode).toBe(401);
	});

	it("rejects an unknown refresh token", async () => {
		expect((await refresh("inventado")).statusCode).toBe(401);
	});
});
