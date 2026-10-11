import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		env: {
			DATABASE_URL: "postgresql://dev:postgresdev@localhost:5432/ticketeira_test",
			LOG_LEVEL: "silent",
		},
	},
});
