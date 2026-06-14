/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('tickets', (table) => {
    table.increments('id').primary();
    // UNIQUE constraint theo Blueprint
    table.string('qr_token').unique().notNullable(); 
    table.string('owner_id').notNullable();
    table.enum('status', ['VALID', 'USED', 'VOIDED']).defaultTo('VALID');
    table.timestamps(true, true);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tickets');
};