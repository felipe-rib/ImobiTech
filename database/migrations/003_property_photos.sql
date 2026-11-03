CREATE TABLE property_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 content_type varchar(20) NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 5242880),
 storage_key varchar(80) NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX property_photos_property_idx ON property_photos(property_id,created_at,id);
