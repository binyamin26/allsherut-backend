// One-off fix: provider 93's 2 reviews were re-pointed to its new
// event_equipment_rental listing (see migrate-event-entertainment-split.js),
// but service_providers.average_rating was never recalculated on either side
// (that column is a stored value, only touched at review-creation time in
// Review.js) — so it was stuck at 0/NULL on both rows, hiding the rating on
// listing cards (search.js reads the column directly) even though the
// profile page still showed it correctly (computed live from reviews).
const { query } = require('/app/config/database');

(async () => {
  try {
    const before = await query(
      "SELECT id, service_type, average_rating FROM service_providers WHERE id = 93 OR (user_id = (SELECT user_id FROM service_providers WHERE id = 93) AND service_type = 'event_equipment_rental')"
    );
    console.log('BEFORE:', JSON.stringify(before));

    for (const row of before) {
      const avgResult = await query(
        'SELECT AVG(rating) as avg_rating FROM reviews WHERE provider_id = ? AND is_verified = TRUE AND is_published = TRUE',
        [row.id]
      );
      const avgRating = avgResult[0].avg_rating !== null ? parseFloat(avgResult[0].avg_rating).toFixed(1) : null;
      await query('UPDATE service_providers SET average_rating = ? WHERE id = ?', [avgRating, row.id]);
      console.log(`Updated provider ${row.id} (${row.service_type}) -> average_rating = ${avgRating}`);
    }

    const after = await query(
      "SELECT id, service_type, average_rating FROM service_providers WHERE id = 93 OR (user_id = (SELECT user_id FROM service_providers WHERE id = 93) AND service_type = 'event_equipment_rental')"
    );
    console.log('AFTER:', JSON.stringify(after));
  } catch (e) {
    console.error('FIX_ERROR:', e.message);
  }
  process.exit(0);
})();
