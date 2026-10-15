import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod/v4";
import { authenticate } from "../../common/auth.ts";
import { errorResponse, idParams } from "../../common/schemas.ts";
import { eventBody, eventResponse, publicEventsQuery, updateEventBody } from "./events.schemas.ts";
import {
	cancelEvent,
	createEvent,
	getPublicEvent,
	listEventsByCreator,
	listPublicEvent,
	publishEvent,
	updateEvent,
} from "./events.service.ts";

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
				params: idParams,
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

	app.post(
		"/:id/publish",
		{
			schema: {
				params: idParams,
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
		async (request) => publishEvent(request.params.id, request.user.sub),
	);

	app.post(
		"/:id/cancel",
		{
			schema: {
				params: idParams,
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
		async (request) => cancelEvent(request.params.id, request.user.sub),
	);

	app.get(
		"/",
		{
			schema: {
				querystring: publicEventsQuery,
				response: { 200: z.array(eventResponse) },
			},
		},
		async (request) => listPublicEvent(request.query),
	);

	app.get(
		"/:id",
		{
			schema: {
				params: idParams,
				response: { 200: eventResponse, 404: errorResponse },
			},
		},
		async (request) => getPublicEvent(request.params.id),
	);
};
