// Migration: split event_entertainment into 3 categories (data migration half)
// Date: 2026-07-27
// Run once against production via: flyctl ssh console + base64-encoded eval
// (see memory project_prod_db_migrations.md for the technique).
// Schema half (services rows + ENUM alters) is in split-event-entertainment-service.sql,
// must run BEFORE this script.
//
// For every event_entertainment provider whose work_types included equipment
// rental and/or food stands, creates a new event_equipment_rental and/or
// event_food_stands listing (copying general profile fields, active + verified),
// strips those fields from the original event_entertainment row, and deactivates
// that row if nothing (entertainment_types/other_types) is left in it.
//
// Result on 2026-07-27: 9 event_equipment_rental created, 1 event_food_stands
// created, 1 event_entertainment row kept active (id 90), 8 deactivated
// (ids 89, 93, 307, 312, 359, 407, 416, 488).
//
// IMPORTANT: also copies each new listing's provider_working_areas rows from
// its source listing (separate table, not part of service_providers — missed
// on the first run, which made every new listing invisible to any
// city/neighborhood-filtered search until backfilled).
//
// IMPORTANT: if the source listing ends up deactivated (nothing left in
// entertainment_types/other_types), its reviews (keyed by provider_id, not
// user) move to the new listing too — otherwise they become invisible along
// with the deactivated listing. Only moves reviews when the source is fully
// deactivated AND there's exactly one new listing to move them to (ambiguous
// otherwise — e.g. a source that spawned both a rental and a food-stand
// listing needs a manual call on which one the reviews are actually about).

const { transaction, query } = require('/app/config/database');

const AFFECTED_IDS = [89, 90, 93, 307, 312, 359, 407, 416, 488];

const PROFILE_COLS = [
  'title', 'description', 'experience_years', 'hourly_rate', 'currency',
  'location_city', 'location_area', 'location_address', 'latitude', 'longitude',
  'availability', 'languages', 'certifications', 'profile_images', 'profile_image',
  'verification_status', 'verification_date', 'is_featured', 'seeking_type'
];

(async () => {
  try {
    const summary = await transaction(async (connection) => {
      const result = { rental_created: [], food_stands_created: [], entertainment_updated: [], entertainment_deactivated: [] };

      for (const id of AFFECTED_IDS) {
        const [rows] = await connection.query('SELECT * FROM service_providers WHERE id = ?', [id]);
        const row = rows[0];
        if (!row) { throw new Error(`Row ${id} not found`); }

        let d = {};
        try { d = typeof row.service_details === 'string' ? JSON.parse(row.service_details) : (row.service_details || {}); } catch (e) { d = {}; }

        const hasRental = (d.work_types || []).includes('השכרת ציוד לאירועים');
        const hasFoodStands = (d.work_types || []).includes('דוכני מזון לאירועים');

        const copyWorkingAreas = async (sourceProviderId, newProviderId) => {
          const [areas] = await connection.query(
            'SELECT city, neighborhood FROM provider_working_areas WHERE provider_id = ?',
            [sourceProviderId]
          );
          for (const area of areas) {
            await connection.query(
              'INSERT INTO provider_working_areas (provider_id, city, neighborhood, created_at) VALUES (?, ?, ?, NOW())',
              [newProviderId, area.city, area.neighborhood]
            );
          }
        };

        // mysql2's query() expands raw JS Array bind params into "IN (?)"-style lists,
        // which corrupts a single positional placeholder (esp. empty arrays -> nothing).
        // Stringify any array/object JSON-column values before binding.
        const profileValues = PROFILE_COLS.map(c => {
          const v = row[c];
          if (Array.isArray(v) || (v !== null && typeof v === 'object')) return JSON.stringify(v);
          return v;
        });

        let newRentalId = null;
        let newFoodStandId = null;

        // --- Create event_equipment_rental listing ---
        if (hasRental) {
          const rentalDetails = {};
          if (d.equipment_rental_types) rentalDetails.equipment_rental_types = d.equipment_rental_types;
          if (d.food_machine_types) rentalDetails.food_machine_types = d.food_machine_types;
          if (d.inflatable_game_types) rentalDetails.inflatable_game_types = d.inflatable_game_types;
          if (d.effect_machine_types) rentalDetails.effect_machine_types = d.effect_machine_types;
          if (d.availability_days) rentalDetails.availability_days = d.availability_days;
          if (d.availability_hours) rentalDetails.availability_hours = d.availability_hours;

          const insertSql = `INSERT INTO service_providers (user_id, service_type, ${PROFILE_COLS.join(', ')}, service_details, created_at)
            VALUES (?, 'event_equipment_rental', ${PROFILE_COLS.map(() => '?').join(', ')}, ?, NOW())`;
          const [insertResult] = await connection.query(insertSql, [row.user_id, ...profileValues, JSON.stringify(rentalDetails)]);
          await copyWorkingAreas(id, insertResult.insertId);
          newRentalId = insertResult.insertId;
          result.rental_created.push({ source_id: id, new_id: insertResult.insertId, user_id: row.user_id });
        }

        // --- Create event_food_stands listing ---
        if (hasFoodStands) {
          const foodStandDetails = {};
          if (d.food_stand_types) foodStandDetails.food_stand_types = d.food_stand_types;
          if (d.availability_days) foodStandDetails.availability_days = d.availability_days;
          if (d.availability_hours) foodStandDetails.availability_hours = d.availability_hours;

          const insertSql = `INSERT INTO service_providers (user_id, service_type, ${PROFILE_COLS.join(', ')}, service_details, created_at)
            VALUES (?, 'event_food_stands', ${PROFILE_COLS.map(() => '?').join(', ')}, ?, NOW())`;
          const [insertResult] = await connection.query(insertSql, [row.user_id, ...profileValues, JSON.stringify(foodStandDetails)]);
          await copyWorkingAreas(id, insertResult.insertId);
          newFoodStandId = insertResult.insertId;
          result.food_stands_created.push({ source_id: id, new_id: insertResult.insertId, user_id: row.user_id });
        }

        // --- Strip migrated fields from the original event_entertainment row ---
        const newDetails = { ...d };
        delete newDetails.equipment_rental_types;
        delete newDetails.food_machine_types;
        delete newDetails.inflatable_game_types;
        delete newDetails.effect_machine_types;
        delete newDetails.food_stand_types;
        newDetails.work_types = (d.work_types || []).filter(
          w => w !== 'השכרת ציוד לאירועים' && w !== 'דוכני מזון לאירועים'
        );

        const hasEntertainment = (newDetails.entertainment_types || []).length > 0;
        const hasOther = (newDetails.other_types || []).length > 0;
        const stillHasContent = hasEntertainment || hasOther;

        if (stillHasContent) {
          await connection.query(
            'UPDATE service_providers SET service_details = ? WHERE id = ?',
            [JSON.stringify(newDetails), id]
          );
          result.entertainment_updated.push(id);
        } else {
          await connection.query(
            'UPDATE service_providers SET service_details = ?, is_active = 0 WHERE id = ?',
            [JSON.stringify(newDetails), id]
          );
          result.entertainment_deactivated.push(id);

          // Move reviews off the now-deactivated listing so they don't go dark.
          // Only when unambiguous: exactly one new listing was created for this source.
          const targetIds = [newRentalId, newFoodStandId].filter(Boolean);
          if (targetIds.length === 1) {
            const [target] = targetIds;
            const newServiceType = target === newRentalId ? 'event_equipment_rental' : 'event_food_stands';
            const [moved] = await connection.query(
              'UPDATE reviews SET provider_id = ?, service_type = ? WHERE provider_id = ?',
              [target, newServiceType, id]
            );
            if (moved.affectedRows > 0) {
              result.reviews_moved = result.reviews_moved || [];
              result.reviews_moved.push({ source_id: id, new_id: target, count: moved.affectedRows });

              // service_providers.average_rating is a stored column, only ever
              // recalculated when a review is created (Review.js) — moving rows
              // directly in SQL leaves the source stuck at its old value and the
              // target stuck at 0/NULL. Recalculate both sides here.
              for (const providerId of [id, target]) {
                const [avgResult] = await connection.query(
                  `SELECT AVG(rating) as avg_rating FROM reviews WHERE provider_id = ? AND is_verified = TRUE AND is_published = TRUE`,
                  [providerId]
                );
                const avgRating = avgResult[0].avg_rating !== null ? parseFloat(avgResult[0].avg_rating).toFixed(1) : null;
                await connection.query('UPDATE service_providers SET average_rating = ? WHERE id = ?', [avgRating, providerId]);
              }
            }
          } else if (targetIds.length > 1) {
            result.reviews_needs_manual_call = result.reviews_needs_manual_call || [];
            result.reviews_needs_manual_call.push({ source_id: id, candidates: targetIds });
          }
        }
      }

      return result;
    });

    console.log('MIGRATION_RESULT:', JSON.stringify(summary, null, 2));

    const rentalRows = await query("SELECT id, user_id, is_active, verification_status, service_details FROM service_providers WHERE service_type = 'event_equipment_rental'");
    console.log('AFTER_RENTAL:', JSON.stringify(rentalRows));
    const foodStandRows = await query("SELECT id, user_id, is_active, verification_status, service_details FROM service_providers WHERE service_type = 'event_food_stands'");
    console.log('AFTER_FOOD_STANDS:', JSON.stringify(foodStandRows));
    const entertainmentRows = await query("SELECT id, user_id, is_active, service_details FROM service_providers WHERE service_type = 'event_entertainment'");
    console.log('AFTER_ENTERTAINMENT:', JSON.stringify(entertainmentRows));
  } catch (e) {
    console.error('MIGRATION_ERROR:', e.message);
  }
  process.exit(0);
})();
