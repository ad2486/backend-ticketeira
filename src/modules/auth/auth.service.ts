import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { db } from "../../prisma/db.ts";

const REFRESH_TOKEN_TTL_HOURS = 24 * 30;

export const generateRefreshToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const userLogin = async (email: string, password: string) => {
	const user = await db.orm.public.User.where((u) => u.email.eq(email))
		.select("id", "passwordHash")
		.first();
	if (!user || !(await argon2.verify(user.passwordHash, password))) {
		throw Object.assign(new Error("Invalid email or password"), { statusCode: 401 });
	}
	const expiresAt = Temporal.Now.instant().add({ hours: REFRESH_TOKEN_TTL_HOURS }).toString();
	const token = generateRefreshToken();
	await db.orm.public.RefreshToken.create({
		userId: user.id,
		tokenHash: hashToken(token),
		expiresAt,
	});
	return { userId: user.id, refreshToken: token };
};
