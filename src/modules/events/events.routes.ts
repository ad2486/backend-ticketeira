import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { authenticate } from "../../common/auth.ts";
import { errorResponse } from "../../common/schemas.ts";
import { eventBody, eventResponse } from "./events.schemas.ts";
import { createEvent } from "./events.service.ts";

export const eventsRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/",
		{
			schema: {
				body: eventBody,
				response: {
					201: eventResponse,
					401: errorResponse,
					403: errorResponse,
					404: errorResponse,
				},
				security: [{ bearerAuth: [] }],
			},
			onRequest: authenticate,
		},
		async (request, reply) => {
			const event = await createEvent(request.user.sub, request.body);
			return reply.code(201).send(event);
		},
	);
};
