import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";
import { definePrismaConfig } from "prisma/config";
import { env } from "./src/env.ts";

export default definePrismaConfig({
	skills: {
		agents: ["claude", "cursor", "agents", "devin"],
	},
	orm: ormConfig({
		contract: "./src/prisma/contract.prisma",
		db: {
			connection: env.DATABASE_URL,
		},
	}),
	composer: {
		configPath: "./prisma-composer.config.ts",
	},
});
