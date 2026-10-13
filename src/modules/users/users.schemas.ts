import { z } from "zod/v4";
import { stateEnum, timestamptz } from "../../common/schemas.ts";

export const createUserBody = z.object({
	name: z.string().trim().min(1),
	email: z.email().toLowerCase(),
	cpf: z
		.string()
		.trim()
		.regex(/^\d{11}$/),
	city: z.string().trim().min(1),
	state: stateEnum,
	birthDate: z.iso
		.date()
		.transform((s) => Temporal.PlainDate.from(s))
		.refine(
			(d) => Temporal.PlainDate.compare(d, Temporal.Now.plainDateISO()) <= 0,
			"Future birth date is invalid",
		),
	password: z.string().min(8).max(128),
});

export const userResponse = z.object({
	id: z.uuid(),
	name: z.string(),
	email: z.email(),
	city: z.string(),
	tier: z.enum(["free", "verified", "pro"]),
	state: stateEnum,
	createdAt: timestamptz,
});

export type CreateUserInput = z.output<typeof createUserBody>;
