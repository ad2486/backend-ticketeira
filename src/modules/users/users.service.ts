import argon2 from 'argon2';
import type { CreateUserInput } from "./users.schemas.ts";
import { db }  from '../../prisma/db.ts';

const uniqueMessages: Record<string, string> = {
    users_email_key: "Email already registered",
    users_cpf_key: "CPF already registered",
}

export const createUser = async (data: CreateUserInput) => {
    const { password, ...rest } = data;
    const passwordHash = await argon2.hash(password);

    try {
        return await db.orm.public.User.select("id", "name", "email", "city", "state", "tier", "createdAt").create({ ...rest, passwordHash });
    } catch (error) {
        if (error instanceof Error && "sqlState" in error && error.sqlState === "23505") {
            const message = "constraint" in error && typeof error.constraint === "string"
            ? uniqueMessages[error.constraint]
                : undefined;
            if (message) {
                throw Object.assign(new Error(message), { statusCode: 409 });
            }
        }
        throw error;
    }


}


