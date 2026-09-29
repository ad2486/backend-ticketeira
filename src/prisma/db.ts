import postgres from "@prisma/orm-postgres/runtime";
import { env } from "../env.ts";

import "temporal-polyfill/global";
import "temporal-polyfill/types/global";

import service from "../../service.ts";
import type { Contract } from "./contract.d.ts";
import contractJson from "./contract.json" with { type: "json" };

function loadComposerDatabase() {
	try {
		return service.load().database.client;
	} catch {
		return undefined;
	}
}

export const db =
	loadComposerDatabase() ?? postgres<Contract>({ contractJson, url: env.DATABASE_URL });

let connection: Promise<void> | undefined;

export function connectDatabase(): Promise<void> {
	connection ??= db
		.connect()
		.then(() => undefined)
		.catch((error: unknown) => {
			connection = undefined;
			throw error;
		});
	return connection;
}
