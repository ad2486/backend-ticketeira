import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { authenticate } from "../../common/auth.ts";
import { errorResponse } from "../../common/schemas.ts";
import { createUserBody, userResponse } from "./users.schemas.ts";
import { createUser, getUserById } from "./users.service.ts";

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/",
		{
			schema: {
				body: createUserBody,
				response: {
					201: userResponse,
					409: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const user = await createUser(request.body);
			return reply.code(201).send(user);
		},
	);

	app.get(
		"/me",
		{
			onRequest: authenticate,
			schema: {
				response: {
					200: userResponse,
					401: errorResponse,
					404: errorResponse,
				},
			},
		},
		async (request) => getUserById(request.user.sub),
	);
};
