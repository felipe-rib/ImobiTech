CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(120) NOT NULL CHECK (length(trim(name)) >= 3),
 email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
 identifier varchar(40) UNIQUE,
 phone varchar(25),
 role varchar(20) NOT NULL CHECK (role IN ('admin','broker','owner','tenant')),
 active boolean NOT NULL DEFAULT true,
 password_hash text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE properties (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(160) NOT NULL,
 type varchar(20) NOT NULL CHECK (type IN ('apartment','house','commercial','land')),
 street varchar(180) NOT NULL, number varchar(20) NOT NULL, complement varchar(100),
 neighborhood varchar(100) NOT NULL, city varchar(100) NOT NULL,
 state char(2) NOT NULL, postal_code varchar(8) NOT NULL CHECK (postal_code ~ '^[0-9]{8}$'),
 description varchar(3000), rent numeric(12,2) CHECK (rent >= 0),
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 status varchar(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','unavailable')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX properties_owner_idx ON properties(owner_id);
CREATE TABLE sessions (
 token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
-- Lock the referenced user to serialize property links against role changes.
CREATE FUNCTION enforce_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.owner_id AND role='owner' FOR UPDATE) THEN
  RAISE EXCEPTION 'Owner role required' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER property_owner BEFORE INSERT OR UPDATE OF owner_id ON properties FOR EACH ROW EXECUTE FUNCTION enforce_owner();
CREATE FUNCTION protect_owner_role() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role <> 'owner' AND EXISTS (SELECT 1 FROM properties WHERE owner_id=NEW.id) THEN
  RAISE EXCEPTION 'Linked owner cannot change role' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER user_owner_role BEFORE UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION protect_owner_role();
