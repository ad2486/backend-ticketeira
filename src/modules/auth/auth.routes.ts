import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { errorResponse } from "../../common/schemas.ts";
import { loginBody, refreshBody, tokensResponse } from "./auth.schemas.ts";
import { refreshSession, userLogin } from "./auth.service.ts";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/login",
		{
			schema: {
				body: loginBody,
				response: { 200: tokensResponse, 401: errorResponse, 429: errorResponse },
			},
			config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
		},
		async (request) => {
			const { userId, refreshToken } = await userLogin(request.body.email, request.body.password);
			const accessToken = app.jwt.sign({ sub: userId });
			return { accessToken, refreshToken };
		},
	);

	app.post(
		"/refresh",
		{
			schema: {
				body: refreshBody,
				response: { 200: tokensResponse, 401: errorResponse },
			},
		},
		async (request) => {
			const { userId, refreshToken } = await refreshSession(request.body.refreshToken);
			const accessToken = app.jwt.sign({ sub: userId });
			return { accessToken, refreshToken };
		},
	);
};
