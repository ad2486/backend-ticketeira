import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { errorResponse } from "../../common/schemas.ts";
import { loginBody, loginResponse } from "./auth.schemas.ts";
import { userLogin } from "./auth.service.ts";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/login",
		{
			schema: {
				body: loginBody,
				response: { 200: loginResponse, 401: errorResponse },
			},
		},
		async (request) => {
			const { userId, refreshToken } = await userLogin(request.body.email, request.body.password);
			const accessToken = app.jwt.sign({ sub: userId });
			return { accessToken, refreshToken };
		},
	);
};
