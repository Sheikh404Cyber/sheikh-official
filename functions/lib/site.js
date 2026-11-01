// Site-wide settings (sales numbers, hero photos) and tool ownership.
// Settings live in the `settings` key/value table; the defaults below apply
// whenever a key is missing or empty, so a freshly-migrated database works
// without any seed changes.

export const SITE_SETTING_KEYS = [
  'whatsapp_number',
  'bkash_number',
  'nagad_number',
  'photo_1',
  'photo_2',
  'photo_3',
];

export const SITE_DEFAULTS = {
  whatsapp_number: '8801957566098', // the owner's public WhatsApp (already on the site)
  bkash_number: '',
  nagad_number: '',
  photo_1: '/media/photo-1.jpg',
  photo_2: '/media/photo-2.jpg',
  photo_3: '/media/photo-3.jpg',
};

export const PHOTO_KEYS = ['photo_1', 'photo_2', 'photo_3'];

/** Read the public site settings, defaults merged in. Never leaks other keys. */
export async function getSiteSettings(DB) {
  const out = { ...SITE_DEFAULTS };
  try {
    const rows = await DB.prepare(
      'SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?, ?, ?)'
    )
      .bind(...SITE_SETTING_KEYS)
      .all();
    for (const row of rows.results || []) {
      if (SITE_SETTING_KEYS.includes(row.key) && String(row.value || '').trim() !== '') {
        out[row.key] = String(row.value);
      }
    }
  } catch {
    // settings table missing (pre-0002 DB): fall back to pure defaults.
  }
  return out;
}

/** Store one setting (empty string clears it back to the default). */
export async function setSiteSetting(DB, key, value) {
  await DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .bind(key, String(value ?? ''))
    .run();
}

/**
 * Does this user own this tool? Ownership = admin, OR the legacy
 * all-tools flag (users.can_download = 1), OR a user_tools grant row.
 */
export async function ownsTool(DB, user, toolId) {
  if (!user) return false;
  if (user.is_admin || user.can_download) return true;
  const row = await DB.prepare('SELECT user_id FROM user_tools WHERE user_id = ? AND tool_id = ?')
    .bind(user.id, toolId)
    .first();
  return !!row;
}

/** Set of tool ids the user owns (all ids for admins / can_download users). */
export async function ownedToolIds(DB, user) {
  if (!user) return new Set();
  if (user.is_admin || user.can_download) {
    const rows = await DB.prepare('SELECT id FROM tools').all();
    return new Set((rows.results || []).map((r) => r.id));
  }
  const rows = await DB.prepare('SELECT tool_id FROM user_tools WHERE user_id = ?')
    .bind(user.id)
    .all();
  return new Set((rows.results || []).map((r) => r.tool_id));
}
