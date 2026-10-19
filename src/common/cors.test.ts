import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import type { App } from "../test/helpers.ts";

let app: App;

beforeAll(async () => {
	app = await buildApp();
});

afterAll(async () => {
	await app.close();
});

const preflight = (origin: string, method: string) =>
	app.inject({
		method: "OPTIONS",
		url: "/events/x",
		headers: { origin, "access-control-request-method": method },
	});

describe("CORS", () => {
	it("allows the frontend origin with credentials and PATCH", async () => {
		const res = await preflight("http://localhost:5173", "PATCH");

		expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
		expect(res.headers["access-control-allow-credentials"]).toBe("true");
		// o default do plugin é só GET, HEAD, POST: sem isto o PATCH /events/:id é bloqueado
		expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
	});

	it("does not allow other origins", async () => {
		const res = await preflight("https://evil.example", "POST");
		expect(res.headers["access-control-allow-origin"]).not.toBe("https://evil.example");
	});
});
