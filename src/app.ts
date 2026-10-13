import { fastifyJwt } from "@fastify/jwt";
import { fastifyRateLimit } from "@fastify/rate-limit";
import { fastifySwagger } from "@fastify/swagger";
import { fastifySwaggerUi } from "@fastify/swagger-ui";
import {
	jsonSchemaTransform,
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import Fastify from "fastify";
import { z } from "zod/v4";
import { env } from "./env.ts";
import { authRoutes } from "./modules/auth/auth.routes.ts";
import { eventsRoutes } from "./modules/events/events.routes.ts";
import { usersRoutes } from "./modules/users/users.routes.ts";

export const buildApp = async () => {
	const app = Fastify({
		logger: {
			level: env.LOG_LEVEL,
			transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
		},
	}).withTypeProvider<ZodTypeProvider>();

	app.register(fastifySwagger, {
		openapi: {
			info: { title: "Ticketeira API", version: "0.1.0" },
			components: {
				securitySchemes: {
					bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
				},
			},
		},
		transform: jsonSchemaTransform,
	});
	app.register(fastifySwaggerUi, { routePrefix: "/docs" });
	app.register(fastifyJwt, {
		secret: env.JWT_SECRET,
		sign: { expiresIn: "15m" },
	});

	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	await app.register(fastifyRateLimit, { global: false });

	app.get(
		"/health",
		{
			schema: {
				response: {
					200: z.object({ health: z.string() }),
				},
			},
		},
		async () => {
			return { health: "ok" };
		},
	);

	app.setErrorHandler((error, request, reply) => {
		if (
			error instanceof Error &&
			"statusCode" in error &&
			typeof error.statusCode === "number" &&
			error.statusCode < 500
		) {
			return reply.send(error);
		}
		request.log.error(error);
		return reply.code(500).send({
			statusCode: 500,
			error: "Internal Server Error",
			message: "An unexpected error occurred",
		});
	});

	app.register(usersRoutes, { prefix: "/users" });
	app.register(authRoutes, { prefix: "/auth" });
	app.register(eventsRoutes, { prefix: "/events" });

	return app;
};
