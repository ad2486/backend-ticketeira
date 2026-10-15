import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { authenticate } from "../../common/auth.ts";
import { errorResponse, idParams } from "../../common/schemas.ts";
import { orderResponse } from "./orders.schemas.ts";
import { createOrder } from "./orders.service.ts";

export const ordersRoutes: FastifyPluginAsyncZod = async (app) => {
	app.post(
		"/events/:id/orders",
		{
			schema: {
				params: idParams,
				response: {
					201: orderResponse,
					401: errorResponse,
					403: errorResponse,
					404: errorResponse,
					409: errorResponse,
					429: errorResponse,
				},
				security: [{ bearerAuth: [] }],
			},
			onRequest: authenticate,
			config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
		},
		async (request, reply) => {
			const order = await createOrder(request.params.id, request.user.sub);
			return reply.code(201).send(order);
		},
	);
};
