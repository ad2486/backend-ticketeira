import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "@fastify/type-provider-zod";
import { z } from "zod/v4";
import {usersRoutes} from "./modules/users/users.routes.ts";

const app = Fastify({
  logger: {
    level: "info",
    transport: { target: "pino-pretty" },
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

app.register(usersRoutes, { prefix: "/users" });

try {
  await app.listen({ port: 3000 });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

