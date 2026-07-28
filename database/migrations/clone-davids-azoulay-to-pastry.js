// David's Azoulay (service_providers.id=165, user_id=85) is a genuine dual
// business: catering (salads/pasta) AND pastry (his reviews repeatedly praise
// "עוגות"/cakes and call his business a "קונדיטוריה"/patisserie). Unlike
// reclassify-catering-to-pastry.js (which MOVED providers whose cuisine_types
// were pastry-only), this CLONES a second `pastry` listing alongside the
// existing `catering` one, copying profile columns, working areas and
// reviews so both listings show the same trust signals.
const { transaction } = require('../../config/database');

const SOURCE_ID = 165;

const PROFILE_COLS = [
  'title', 'description', 'experience_years', 'hourly_rate', 'currency',
  'location_city', 'location_area', 'location_address', 'latitude', 'longitude',
  'availability', 'availability_days', 'availability_hours',
  'languages', 'certifications', 'profile_images', 'profile_image',
  'verification_status', 'verification_date', 'is_active', 'profile_completed',
  'average_rating', 'total_reviews',
];

(async () => {
  await transaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM service_providers WHERE id = ?', [SOURCE_ID]);
    const source = rows[0];
    if (!source) throw new Error(`source provider ${SOURCE_ID} not found`);

    const [existing] = await conn.query(
      'SELECT id FROM service_providers WHERE user_id = ? AND service_type = ?',
      [source.user_id, 'pastry']
    );
    if (existing.length) throw new Error(`user ${source.user_id} already has a pastry listing (id ${existing[0].id})`);

    let details = source.service_details;
    if (typeof details === 'string') details = JSON.parse(details);
    const pastryDetails = { ...details };
    delete pastryDetails.cuisine_types;
    delete pastryDetails.provider_type;
    pastryDetails.product_types = (details.cuisine_types || []).filter((v) => v === 'קינוחים');

    // mysql2 expands a raw JS array/object bind param into an IN (?)-style
    // list instead of inserting it as JSON -- stringify first (see memory
    // project_event_entertainment_3way_split.md gotcha #1).
    const values = PROFILE_COLS.map((c) => {
      const v = source[c];
      return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
    });
    const insertSql = `INSERT INTO service_providers (user_id, service_type, ${PROFILE_COLS.join(', ')}, service_details, created_at)
      VALUES (?, 'pastry', ${PROFILE_COLS.map(() => '?').join(', ')}, ?, NOW())`;
    const [result] = await conn.query(insertSql, [source.user_id, ...values, JSON.stringify(pastryDetails)]);
    const newId = result.insertId;
    console.log(`created pastry listing ${newId} for user ${source.user_id}, product_types=${JSON.stringify(pastryDetails.product_types)}`);

    const [areas] = await conn.query('SELECT city, neighborhood FROM provider_working_areas WHERE provider_id = ?', [SOURCE_ID]);
    for (const area of areas) {
      await conn.query('INSERT INTO provider_working_areas (provider_id, city, neighborhood) VALUES (?, ?, ?)', [newId, area.city, area.neighborhood]);
    }
    console.log(`copied ${areas.length} working area(s)`);

    const [reviews] = await conn.query('SELECT * FROM reviews WHERE provider_id = ?', [SOURCE_ID]);
    for (const r of reviews) {
      await conn.query(
        `INSERT INTO reviews (provider_id, reviewer_email, reviewer_name, service_type, rating, title, comment,
          is_verified, is_published, helpful_count, quality_rating, price_rating, availability_rating,
          professionalism_rating, legacy_rating_converted, created_at, updated_at)
        VALUES (?, ?, ?, 'pastry', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, r.reviewer_email, r.reviewer_name, r.rating, r.title, r.comment,
          r.is_verified, r.is_published, r.helpful_count, r.quality_rating, r.price_rating, r.availability_rating,
          r.professionalism_rating, r.legacy_rating_converted, r.created_at, r.updated_at]
      );
    }
    console.log(`copied ${reviews.length} review(s)`);
  });
  console.log('done');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
