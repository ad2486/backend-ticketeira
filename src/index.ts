import { buildApp } from "./app.ts";
import { env } from "./env.ts";

const app = await buildApp();

try {
	await app.listen({ port: env.PORT });
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
