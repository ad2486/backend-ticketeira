import { z } from "zod/v4";

export const stateEnum = z.enum([
	"AC",
	"AL",
	"AP",
	"AM",
	"BA",
	"CE",
	"DF",
	"ES",
	"GO",
	"MA",
	"MT",
	"MS",
	"MG",
	"PA",
	"PB",
	"PR",
	"PE",
	"PI",
	"RJ",
	"RN",
	"RS",
	"RO",
	"RR",
	"SC",
	"SP",
	"SE",
	"TO",
]);

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

export const createUserResponse = z.object({
	id: z.uuid(),
	name: z.string(),
	email: z.email(),
	city: z.string(),
	tier: z.enum(["free", "verified", "pro"]),
	state: stateEnum,
	createdAt: z.codec(z.iso.datetime(), z.string(), {
		decode: (iso) => iso,
		encode: (pg) => Temporal.Instant.from(pg).toString(),
	}),
});

export type CreateUserInput = z.output<typeof createUserBody>;
