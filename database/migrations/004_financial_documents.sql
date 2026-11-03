ALTER TABLE payments ADD COLUMN review_status varchar(16) NOT NULL DEFAULT 'none'
  CHECK (review_status IN ('none','submitted','approved','rejected'));
ALTER TABLE payments ADD COLUMN proof_key text;
ALTER TABLE payments ADD COLUMN proof_type varchar(32);
ALTER TABLE payments ADD COLUMN submitted_at timestamptz;
ALTER TABLE contracts ADD COLUMN document_key text;
ALTER TABLE contracts ADD COLUMN document_type varchar(32);
UPDATE payments SET review_status='approved' WHERE paid_at IS NOT NULL;
