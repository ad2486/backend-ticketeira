#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5b0cc1c16eed34e53feafa5dac988e737c440139604f50e1c489cb1679e63db8/contract';
import startContract from '../../snapshots/5b0cc1c16eed34e53feafa5dac988e737c440139604f50e1c489cb1679e63db8/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b5c14721fce89e492b8c18c88d66b25499a5f3e1ad3eb9db96c90fe963ab9622/contract';
import endContract from '../../snapshots/b5c14721fce89e492b8c18c88d66b25499a5f3e1ad3eb9db96c90fe963ab9622/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'refresh_tokens',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('expires_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('uuidv7()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('revoked_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('token_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'refresh_tokens',
        constraint: 'refresh_tokens_token_hash_key',
        columns: ['token_hash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'refresh_tokens',
        index: 'refresh_tokens_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'refresh_tokens',
        foreignKey: {
          name: 'refresh_tokens_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
