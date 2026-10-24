import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod/v4";
import { errorResponse } from "../../common/schemas.ts";
import { accessTokenResponse, loginBody } from "./auth.schemas.ts";
import { refreshSession, revokeRefreshToken, userLogin } from "./auth.service.ts";

const REFRESH_COOKIE = "refreshToken";
const refreshCookieOptions = {
	httpOnly: true,
	secure: "auto",
	sameSite: "strict",
	path: "/auth",
	maxAge: 60 * 60 * 24 * 30,
} as const;

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/login",
		{
			schema: {
				body: loginBody,
				response: { 200: accessTokenResponse, 401: errorResponse, 429: errorResponse },
			},
			config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
		},
		async (request, reply) => {
			const { userId, refreshToken } = await userLogin(request.body.email, request.body.password);
			reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
			return { accessToken: app.jwt.sign({ sub: userId }) };
		},
	);

	app.post(
		"/refresh",
		{
			schema: {
				response: { 200: accessTokenResponse, 401: errorResponse },
			},
		},
		async (request, reply) => {
			const token = request.cookies[REFRESH_COOKIE];
			if (!token) {
				throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
			}
			const { userId, refreshToken } = await refreshSession(token);
			reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);
			return { accessToken: app.jwt.sign({ sub: userId }) };
		},
	);

	app.post("/logout", { schema: { response: { 204: z.null() } } }, async (request, reply) => {
		const token = request.cookies[REFRESH_COOKIE];
		if (token) await revokeRefreshToken(token);
		reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions);
		return reply.code(204).send(null);
	});
};
