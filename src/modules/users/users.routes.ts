import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { errorResponse } from "../../common/schemas.ts";
import { createUserBody, createUserResponse } from "./users.schemas.ts";
import { createUser } from "./users.service.ts";

export const usersRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/",
		{
			schema: {
				body: createUserBody,
				response: {
					201: createUserResponse,
					409: errorResponse,
				},
			},
		},
		async (request, reply) => {
			const user = await createUser(request.body);
			return reply.code(201).send(user);
		},
	);
};
