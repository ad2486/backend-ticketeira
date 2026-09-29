import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from "@fastify/type-provider-zod";
import Fastify from "fastify";
import { z } from "zod/v4";
import { env } from "./env.ts";
import { usersRoutes } from "./modules/users/users.routes.ts";

const app = Fastify({
	logger: {
		level: env.LOG_LEVEL,
		transport: env.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
	},
}).withTypeProvider<ZodTypeProvider>();

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

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

try {
	await app.listen({ port: env.PORT });
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
