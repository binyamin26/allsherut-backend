// Reclassifies providers wrongly bucketed into `catering` at the 2026-07-13
// private_chef split, whose entire cuisine_types list is pastry-only items
// (no actual catering items: meat/salads/sushi/dairy/kosher-shabbat/fish).
// Renames service_details.cuisine_types -> product_types (same Hebrew values,
// PastryForm's field name) and moves service_type to `pastry` everywhere it's
// denormalized: service_providers, users, reviews.
const { transaction } = require('../../config/database');

const PROVIDER_IDS = [189, 284, 318, 333, 354, 355, 361, 362, 390, 401, 446, 458];

(async () => {
  await transaction(async (conn) => {
    for (const id of PROVIDER_IDS) {
      const [rows] = await conn.query(
        'SELECT id, user_id, service_details FROM service_providers WHERE id = ? AND service_type = ?',
        [id, 'catering']
      );
      const row = rows[0];
      if (!row) {
        console.log(`skip ${id}: not found or no longer catering`);
        continue;
      }

      let details = row.service_details;
      if (typeof details === 'string') details = JSON.parse(details);
      const cuisineTypes = details.cuisine_types || [];
      delete details.cuisine_types;
      details.product_types = cuisineTypes;

      await conn.query(
        'UPDATE service_providers SET service_type = ?, service_details = ? WHERE id = ?',
        ['pastry', JSON.stringify(details), id]
      );
      await conn.query('UPDATE users SET service_type = ? WHERE id = ?', ['pastry', row.user_id]);
      await conn.query('UPDATE reviews SET service_type = ? WHERE provider_id = ?', ['pastry', id]);

      console.log(`reclassified provider ${id} (user ${row.user_id}) catering -> pastry, product_types=${JSON.stringify(cuisineTypes)}`);
    }
  });
  console.log('done');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
