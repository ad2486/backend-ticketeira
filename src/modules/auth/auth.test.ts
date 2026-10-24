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

const createUser = async () => (await helpers.createUser(app)).email;
const login = (email: string, pass?: string) => helpers.login(app, email, pass);

// O refresh token viaja só em cookie httpOnly (path /auth), nunca no corpo.
const refreshCookieOf = (res: Awaited<ReturnType<helpers.App["inject"]>>) =>
	res.cookies.find((c) => c.name === "refreshToken");

const refresh = (refreshToken?: string) =>
	app.inject({
		method: "POST",
		url: "/auth/refresh",
		cookies: refreshToken ? { refreshToken } : {},
	});

const logout = (refreshToken?: string) =>
	app.inject({
		method: "POST",
		url: "/auth/logout",
		cookies: refreshToken ? { refreshToken } : {},
	});

const me = (accessToken?: string) =>
	app.inject({
		method: "GET",
		url: "/users/me",
		headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
	});

// Este arquivo faz 5 logins: exatamente o rate limit do login (5/min por app, ver test/helpers.ts).
describe("auth", () => {
	it("logs in, sets the refresh cookie and accesses /users/me", async () => {
		const email = await createUser();

		const res = await login(email);

		expect(res.statusCode).toBe(200);
		expect(res.json()).toEqual({ accessToken: expect.any(String) });
		const cookie = refreshCookieOf(res);
		expect(cookie).toMatchObject({ httpOnly: true, path: "/auth", maxAge: 60 * 60 * 24 * 30 });
		expect(cookie?.sameSite).toMatch(/strict/i);

		const meRes = await me(res.json().accessToken);
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

	it("rotates the refresh cookie and revokes everything on reuse", async () => {
		const email = await createUser();
		const tokenA = refreshCookieOf(await login(email))?.value;

		const first = await refresh(tokenA);
		expect(first.statusCode).toBe(200);
		expect(first.json()).toEqual({ accessToken: expect.any(String) });
		const tokenB = refreshCookieOf(first)?.value;
		expect(tokenB).toEqual(expect.any(String));
		expect(tokenB).not.toBe(tokenA);
		expect((await me(first.json().accessToken)).statusCode).toBe(200);

		// A já foi usado: reuso derruba A e B
		expect((await refresh(tokenA)).statusCode).toBe(401);
		expect((await refresh(tokenB)).statusCode).toBe(401);
	});

	it("rejects a missing or unknown refresh cookie with the same message", async () => {
		const missing = await refresh();
		const unknown = await refresh("inventado");

		expect(missing.statusCode).toBe(401);
		expect(unknown.statusCode).toBe(401);
		expect(missing.json().message).toBe(unknown.json().message);
	});

	it("logs out: revokes the token and clears the cookie", async () => {
		const email = await createUser();
		const token = refreshCookieOf(await login(email))?.value;

		const res = await logout(token);

		expect(res.statusCode).toBe(204);
		// clearCookie: mesmo nome e path, expiração no passado
		const cleared = refreshCookieOf(res);
		expect(cleared).toMatchObject({ path: "/auth", value: "" });
		expect(cleared?.expires?.getTime()).toBeLessThan(Date.now());
		// o token não vale mais, mesmo que alguém tenha copiado o cookie antes
		expect((await refresh(token)).statusCode).toBe(401);
	});

	it("logout is idempotent", async () => {
		expect((await logout()).statusCode).toBe(204);
		expect((await logout("inventado")).statusCode).toBe(204);
	});
});
