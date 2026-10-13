import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod/v4";
import { authenticate } from "../../common/auth.ts";
import { errorResponse } from "../../common/schemas.ts";
import { eventBody, eventParams, eventResponse, updateEventBody } from "./events.schemas.ts";
import { createEvent, listEventsByCreator, updateEvent } from "./events.service.ts";

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

	app.get(
		"/mine",
		{
			schema: {
				response: { 200: z.array(eventResponse), 401: errorResponse },
				security: [{ bearerAuth: [] }],
			},
			onRequest: authenticate,
		},
		async (request) => listEventsByCreator(request.user.sub),
	);

	app.patch(
		"/:id",
		{
			schema: {
				params: eventParams,
				body: updateEventBody,
				response: {
					200: eventResponse,
					401: errorResponse,
					404: errorResponse,
					409: errorResponse,
				},
				security: [{ bearerAuth: [] }],
			},
			onRequest: authenticate,
		},
		async (request) => updateEvent(request.params.id, request.user.sub, request.body),
	);
};
