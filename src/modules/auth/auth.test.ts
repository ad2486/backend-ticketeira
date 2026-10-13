import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../app.ts";
import * as helpers from "../../test/helpers.ts";

let app: helpers.App;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const createUser = () => helpers.createUser(app);
const login = (email: string, pass?: string) => helpers.login(app, email, pass);

const refresh = (refreshToken: string) =>
	app.inject({ method: "POST", url: "/auth/refresh", payload: { refreshToken } });

const me = (accessToken?: string) =>
	app.inject({
		method: "GET",
		url: "/users/me",
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
	});

// Este arquivo faz 4 logins (limite: 5 por arquivo, ver test/helpers.ts).
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
