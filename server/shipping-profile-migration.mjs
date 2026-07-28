const SHIPPING_PROFILE_BACKFILL_MIGRATION_ID =
  '2026-07-28-backfill-submitted-claims-to-shipping-profiles-v1';

const requiredProfileFields = [
  'addressLine1',
  'city',
  'country',
  'email',
  'firstName',
  'lastName',
  'phone',
  'postalCode',
  'region'
];

export function runShippingProfileBackfillMigration(database, options = {}) {
  const appliedAt = options.appliedAt || new Date().toISOString();
  const applyMigration = database.transaction(() => {
    const existingMigration = database
      .prepare(
        `
          SELECT 1
          FROM merch_data_migrations
          WHERE id = ?
          LIMIT 1
        `
      )
      .get(SHIPPING_PROFILE_BACKFILL_MIGRATION_ID);

    if (existingMigration) {
      return {
        status: 'already_applied',
        insertedProfiles: 0,
        skippedClaims: 0
      };
    }

    const submittedClaims = database
      .prepare(
        `
          SELECT
            id,
            user_sub,
            user_json,
            wallet_address,
            shipping_json,
            first_name,
            last_name,
            email,
            phone,
            country,
            address_line_1,
            address_line_2,
            city,
            region,
            postal_code,
            delivery_notes
          FROM shipping_claims
          WHERE claim_status = 'submitted'
          ORDER BY
            COALESCE(submitted_at, created_at) DESC,
            created_at DESC,
            id DESC
        `
      )
      .all();
    const insertProfile = database.prepare(
      `
        INSERT OR IGNORE INTO shipping_profiles (
          user_sub,
          wallet_address,
          profile_json,
          created_at,
          updated_at
        ) VALUES (
          @userSub,
          @walletAddress,
          @profileJson,
          @appliedAt,
          @appliedAt
        )
      `
    );
    const processedUsers = new Set();
    let insertedProfiles = 0;
    let skippedClaims = 0;

    for (const claim of submittedClaims) {
      const userSub = readClaimUserSub(claim);

      if (!userSub || processedUsers.has(userSub)) {
        skippedClaims += 1;
        continue;
      }

      const profile = readClaimShippingProfile(claim);

      if (!profile) {
        skippedClaims += 1;
        continue;
      }

      processedUsers.add(userSub);

      const result = insertProfile.run({
        appliedAt,
        profileJson: JSON.stringify(profile),
        userSub,
        walletAddress: readOptionalString(claim.wallet_address)
      });

      insertedProfiles += result.changes;
    }

    const metadata = {
      insertedProfiles,
      skippedClaims,
      submittedClaims: submittedClaims.length
    };

    database
      .prepare(
        `
          INSERT INTO merch_data_migrations (
            id,
            applied_at,
            metadata_json
          ) VALUES (?, ?, ?)
        `
      )
      .run(
        SHIPPING_PROFILE_BACKFILL_MIGRATION_ID,
        appliedAt,
        JSON.stringify(metadata)
      );

    return {
      status: 'applied',
      ...metadata
    };
  });

  return applyMigration();
}

function readClaimUserSub(claim) {
  const storedUserSub = readOptionalString(claim.user_sub);

  if (storedUserSub) {
    return storedUserSub;
  }

  const user = readJsonObject(claim.user_json);
  return readOptionalString(user?.sub);
}

function readClaimShippingProfile(claim) {
  const shipping = readJsonObject(claim.shipping_json) || {};
  const profile = {
    addressLine1: readFirstString(
      shipping.addressLine1,
      claim.address_line_1
    ),
    addressLine2: readFirstString(
      shipping.addressLine2,
      claim.address_line_2
    ),
    city: readFirstString(shipping.city, claim.city),
    country: readFirstString(shipping.country, claim.country),
    deliveryNotes: readFirstString(
      shipping.deliveryNotes,
      claim.delivery_notes
    ),
    email: readFirstString(shipping.email, claim.email),
    firstName: readFirstString(shipping.firstName, claim.first_name),
    lastName: readFirstString(shipping.lastName, claim.last_name),
    phone: readFirstString(shipping.phone, claim.phone),
    postalCode: readFirstString(
      shipping.postalCode,
      claim.postal_code
    ),
    region: readFirstString(shipping.region, claim.region)
  };

  if (requiredProfileFields.some((field) => !profile[field])) {
    return null;
  }

  return profile;
}

function readFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function readOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readJsonObject(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}
