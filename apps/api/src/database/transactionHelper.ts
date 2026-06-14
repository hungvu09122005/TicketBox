// src/database/transactionHelper.ts
import { Knex } from 'knex';

export async function runInTransaction<T>(knex: Knex, callback: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
  return knex.transaction(async (trx) => {
    return await callback(trx);
  });
}

// Cách dùng SELECT FOR UPDATE trong service:
// const ticket = await trx('tickets').where({ id: ticketId }).forUpdate().first();