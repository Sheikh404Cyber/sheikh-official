-- v3.2: structured pricing (amount + period + optional compare-at) replacing free-text-only price.
-- One-shot ALTERs: apply exactly once.
ALTER TABLE tools ADD COLUMN price_amount INTEGER;
ALTER TABLE tools ADD COLUMN price_period TEXT NOT NULL DEFAULT 'once';
ALTER TABLE tools ADD COLUMN price_compare INTEGER;
-- Backfill ElevenRec from its legacy free-text price (100/month).
UPDATE tools SET price_amount = 100, price_period = 'month' WHERE id = 4 AND price = '৳100/month';
