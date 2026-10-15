import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod/v4";
import { authenticate } from "../../common/auth.ts";
import { errorResponse } from "../../common/schemas.ts";
import { ticketResponse } from "./tickets.schemas.ts";
import { listTicketsByOwner } from "./tickets.service.ts";

export const ticketsRoutes: FastifyPluginAsyncZod = async (app) => {
	app.get(
		"/mine",
		{
			schema: {
				response: { 200: z.array(ticketResponse), 401: errorResponse },
				security: [{ bearerAuth: [] }],
			},
			onRequest: authenticate,
		},
		async (request) => listTicketsByOwner(request.user.sub),
	);
};
