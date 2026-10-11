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
	const refreshToken = await issueRefreshToken(user.id);
	return { userId: user.id, refreshToken };
};

export const issueRefreshToken = async (userId: string) => {
	const expiresAt = Temporal.Now.instant().add({ hours: REFRESH_TOKEN_TTL_HOURS }).toString();
	const token = generateRefreshToken();
	await db.orm.public.RefreshToken.create({
		userId,
		tokenHash: hashToken(token),
		expiresAt,
	});
	return token;
};

export const refreshSession = async (token: string) => {
	const hash = hashToken(token);
	const now = Temporal.Now.instant().toString();
	const revoked = await db.orm.public.RefreshToken.where((t) => t.tokenHash.eq(hash))
		.where((t) => t.revokedAt.isNull())
		.where((t) => t.expiresAt.gt(now))
		.select("userId")
		.update({ revokedAt: now });
	if (!revoked) {
		const existing = await db.orm.public.RefreshToken.where((t) => t.tokenHash.eq(hash))
			.select("userId", "revokedAt")
			.first();
		if (existing?.revokedAt) {
			await db.orm.public.RefreshToken.where((t) => t.userId.eq(existing.userId))
				.where((t) => t.revokedAt.isNull())
				.updateAndCount({ revokedAt: now });
		}
		throw Object.assign(new Error("Invalid refresh token"), { statusCode: 401 });
	}
	const refreshToken = await issueRefreshToken(revoked.userId);
	return { userId: revoked.userId, refreshToken };
};
