import { z } from "zod/v4";

export const errorResponse = z.object({
	statusCode: z.number(),
	error: z.string(),
	message: z.string(),
});

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

export const timestamptz = z.codec(z.iso.datetime(), z.string(), {
	decode: (iso) => iso,
	encode: (pg) => Temporal.Instant.from(pg).toString(),
});

// Params de rotas /:id (eventos, pedidos...).
export const idParams = z.object({ id: z.uuid() });
