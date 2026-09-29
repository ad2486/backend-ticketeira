import { module } from "@prisma/composer";
import { postgres } from "@prisma/composer-prisma-cloud/orm";
import app from "./service.ts";
import { appContract } from "./src/prisma/composer.ts";

export default module("backend", ({ provision }) => {
	const database = provision(
		postgres({
			name: "database",
			contract: appContract,
			config: "./prisma.config.ts",
		}),
		{ id: "database" },
	);

	provision(app, { deps: { database } });
});
