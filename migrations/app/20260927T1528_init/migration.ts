#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5b0cc1c16eed34e53feafa5dac988e737c440139604f50e1c489cb1679e63db8/contract';
import endContract from '../../snapshots/5b0cc1c16eed34e53feafa5dac988e737c440139604f50e1c489cb1679e63db8/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'events',
        columns: [
          col('capacity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('city', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('creator_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('uuidv7()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('location', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('min_age', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('sold_tickets', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('starts_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('draft'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('ticket_price_cents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('event_capacity_positive_2e07dccc', 'capacity > 0'),
          checkExpression('event_city_not_blank_dd00f551', 'length(btrim(city)) > 0'),
          checkExpression('event_location_not_blank_6da3d33f', 'length(btrim(location)) > 0'),
          checkExpression('event_min_age_non_negative_f7a38054', 'min_age >= 0'),
          checkExpression('event_sold_tickets_non_negative_ccdc5d6f', 'sold_tickets >= 0'),
          checkExpression(
            'event_sold_tickets_within_capacity_2a5d55d1',
            'sold_tickets <= capacity',
          ),
          checkExpression('event_ticket_price_non_negative_ced1f005', 'ticket_price_cents >= 0'),
          checkExpression('event_title_not_blank_e4be2e72', 'length(btrim(title)) > 0'),
          checkExpression(
            'events_state_check_eed704be',
            "\"state\" IN ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')",
          ),
          checkExpression(
            'events_status_check_2a618994',
            "\"status\" IN ('draft', 'published', 'finished', 'canceled')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'orders',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('event_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('expires_at', 'timestamptz', {
            notNull: true,
            default: fn("(now() + '00:10:00'::interval)"),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('uuidv7()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('payment_id', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('unit_price_cents', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('order_quantity_positive_4402679f', 'quantity > 0'),
          checkExpression('order_unit_price_non_negative_3f57b02c', 'unit_price_cents >= 0'),
          checkExpression(
            'orders_status_check_a7599fa2',
            "\"status\" IN ('pending', 'paid', 'expired', 'canceled')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'tickets',
        columns: [
          col('checked_in_at', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('event_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('uuidv7()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('unique_code', 'uuid', {
            notNull: true,
            default: fn('gen_random_uuid()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'users',
        columns: [
          col('birth_date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('city', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('cpf', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', {
            notNull: true,
            default: fn('uuidv7()'),
            codecRef: { codecId: 'pg/uuid@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('password_hash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('state', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tier', 'text', {
            notNull: true,
            default: lit('free'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updated_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('user_birth_date_sane_a8c202e4', "birth_date > DATE '1900-01-01'"),
          checkExpression('user_cpf_digits_f6d9ff4d', "cpf ~ '^[0-9]{11}$'"),
          checkExpression('user_email_lowercase_9b410a78', 'email = lower(email)'),
          checkExpression('user_name_not_blank_370c3422', 'length(btrim(name)) > 0'),
          checkExpression(
            'users_state_check_eed704be',
            "\"state\" IN ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')",
          ),
          checkExpression('users_tier_check_c2bbe1a7', "\"tier\" IN ('free', 'verified', 'pro')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'orders_payment_id_key',
        columns: ['payment_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'orders',
        constraint: 'orders_id_event_id_key',
        columns: ['id', 'event_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tickets',
        constraint: 'tickets_unique_code_key',
        columns: ['unique_code'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'users',
        constraint: 'users_cpf_key',
        columns: ['cpf'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'events',
        index: 'events_creator_id_idx_c8bab67a',
        columns: ['creator_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_event_id_idx_a0568112',
        columns: ['event_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'orders',
        index: 'orders_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tickets',
        index: 'tickets_event_id_idx_a0568112',
        columns: ['event_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tickets',
        index: 'tickets_order_id_event_id_idx_55b8795c',
        columns: ['order_id', 'event_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tickets',
        index: 'tickets_order_id_idx_39ad19ad',
        columns: ['order_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tickets',
        index: 'tickets_user_id_idx_6c952402',
        columns: ['user_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'events',
        foreignKey: {
          name: 'events_creator_id_fkey',
          columns: ['creator_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orders',
        foreignKey: {
          name: 'orders_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'orders',
        foreignKey: {
          name: 'orders_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tickets',
        foreignKey: {
          name: 'tickets_order_id_event_id_fkey',
          columns: ['order_id', 'event_id'],
          references: { schema: 'public', table: 'orders', columns: ['id', 'event_id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tickets',
        foreignKey: {
          name: 'tickets_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tickets',
        foreignKey: {
          name: 'tickets_event_id_fkey',
          columns: ['event_id'],
          references: { schema: 'public', table: 'events', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
