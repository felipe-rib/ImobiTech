-- DRS 2.1: RN-007..RN-014 and RNF-009/RNF-011.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 broker_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 participant_name varchar(120) NOT NULL CHECK(length(trim(participant_name)) >= 3),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
 status varchar(16) NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at > starts_at AND ends_at <= starts_at + interval '8 hours'),
 CONSTRAINT visits_property_overlap EXCLUDE USING gist
 (property_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE(status <> 'cancelled'),
 CONSTRAINT visits_broker_overlap EXCLUDE USING gist
 (broker_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE(status <> 'cancelled')
);
CREATE INDEX visits_start_idx ON visits(starts_at);

CREATE TABLE contracts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
 owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 tenant_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 start_date date NOT NULL, end_date date NOT NULL CHECK(end_date >= start_date),
 monthly_rent numeric(12,2) NOT NULL CHECK(monthly_rent > 0),
 due_day smallint NOT NULL CHECK(due_day BETWEEN 1 AND 31),
 status varchar(16) NOT NULL DEFAULT 'active' CHECK(status IN ('active','closed')),
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='active' AND closed_at IS NULL) OR (status='closed' AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX contracts_one_active_per_property ON contracts(property_id) WHERE status='active';
CREATE INDEX contracts_owner_idx ON contracts(owner_id);
CREATE INDEX contracts_tenant_idx ON contracts(tenant_id);
CREATE INDEX contracts_end_idx ON contracts(end_date) WHERE status='active';

CREATE TABLE payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
 competence date NOT NULL CHECK(extract(day FROM competence)=1),
 amount numeric(12,2) NOT NULL CHECK(amount > 0), due_date date NOT NULL,
 paid_at date,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT payments_one_per_competence UNIQUE(contract_id,competence)
);
CREATE INDEX payments_due_idx ON payments(due_date) WHERE paid_at IS NULL;
CREATE TABLE audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity_type varchar(16) NOT NULL CHECK(entity_type IN ('contract','payment')),
 entity_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 action varchar(16) NOT NULL CHECK(action IN ('created','updated','closed')),
 before_data jsonb, after_data jsonb NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entity_idx ON audit_events(entity_type,entity_id,occurred_at);

CREATE FUNCTION validate_visit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.broker_id<>OLD.broker_id OR NEW.property_id<>OLD.property_id) THEN
  RAISE EXCEPTION 'Visit links are immutable' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND (OLD.status='cancelled' OR OLD.starts_at<=now()) THEN
  RAISE EXCEPTION 'Only future non-cancelled visits may change' USING ERRCODE='23514';
 END IF;
 IF NEW.starts_at<=now() AND NEW.status<>'cancelled' THEN
  RAISE EXCEPTION 'Visit must be in the future' USING ERRCODE='23514';
 END IF;
 IF NEW.status<>'cancelled' THEN
  PERFORM 1 FROM properties WHERE id=NEW.property_id AND status='available' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property unavailable' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM users WHERE id=NEW.broker_id AND role='broker' AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active broker required' USING ERRCODE='23514'; END IF;
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER visits_validate BEFORE INSERT OR UPDATE ON visits FOR EACH ROW EXECUTE FUNCTION validate_visit();

CREATE FUNCTION validate_contract() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p properties%ROWTYPE;
BEGIN
 SELECT * INTO p FROM properties WHERE id=NEW.property_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Property missing' USING ERRCODE='23503'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.status<>'active' OR p.status<>'available' OR NEW.owner_id<>p.owner_id THEN
   RAISE EXCEPTION 'Property or owner mismatch' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM users WHERE id=NEW.owner_id AND role='owner' AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active owner required' USING ERRCODE='23514'; END IF;
  PERFORM 1 FROM users WHERE id=NEW.tenant_id AND role='tenant' AND active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active tenant required' USING ERRCODE='23514'; END IF;
 ELSE
  IF OLD.status='closed' OR NEW.property_id<>OLD.property_id OR NEW.owner_id<>OLD.owner_id OR NEW.tenant_id<>OLD.tenant_id THEN
   RAISE EXCEPTION 'Contract links and closed contracts are immutable' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM payments WHERE contract_id=NEW.id AND
   (competence<date_trunc('month',NEW.start_date)::date OR competence>date_trunc('month',NEW.end_date)::date)) THEN
   RAISE EXCEPTION 'Contract period would exclude existing payments' USING ERRCODE='23514';
  END IF;
 END IF;
 IF NEW.status='closed' THEN NEW.closed_at=now(); END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER contracts_validate BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION validate_contract();

CREATE FUNCTION sync_contract_property() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE properties SET status=CASE WHEN NEW.status='active' THEN 'unavailable' ELSE 'available' END,
 updated_at=now() WHERE id=NEW.property_id;
 RETURN NEW;
END $$;
CREATE TRIGGER contracts_property_sync AFTER INSERT OR UPDATE OF status ON contracts FOR EACH ROW EXECUTE FUNCTION sync_contract_property();

CREATE FUNCTION protect_active_property() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM contracts WHERE property_id=NEW.id AND status='active')
 AND (NEW.owner_id<>OLD.owner_id OR NEW.status<>'unavailable') THEN
  RAISE EXCEPTION 'Active contract protects property owner and availability' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER property_contract_guard BEFORE UPDATE OF owner_id,status ON properties FOR EACH ROW EXECUTE FUNCTION protect_active_property();

CREATE FUNCTION validate_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c contracts%ROWTYPE;
BEGIN
 SELECT * INTO c FROM contracts WHERE id=NEW.contract_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contract required' USING ERRCODE='23503'; END IF;
 IF TG_OP='UPDATE' AND NEW.contract_id<>OLD.contract_id THEN
  RAISE EXCEPTION 'Payment contract is immutable' USING ERRCODE='23514';
 END IF;
 IF NEW.competence<date_trunc('month',c.start_date)::date OR NEW.competence>date_trunc('month',c.end_date)::date THEN
  RAISE EXCEPTION 'Competence outside contract period' USING ERRCODE='23514';
 END IF;
 IF NEW.paid_at>(now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
  RAISE EXCEPTION 'Payment cannot be in the future' USING ERRCODE='23514';
 END IF;
 NEW.updated_at=now(); RETURN NEW;
END $$;
CREATE TRIGGER payments_validate BEFORE INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION validate_payment();

CREATE FUNCTION record_critical_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor uuid;
BEGIN
 actor=nullif(current_setting('imobitech.actor_id',true),'')::uuid;
 IF actor IS NULL THEN RAISE EXCEPTION 'Audit actor required' USING ERRCODE='23514'; END IF;
 INSERT INTO audit_events(entity_type,entity_id,actor_id,action,before_data,after_data)
 VALUES(CASE WHEN TG_TABLE_NAME='contracts' THEN 'contract' ELSE 'payment' END,NEW.id,actor,
 CASE WHEN TG_OP='INSERT' THEN 'created' WHEN TG_TABLE_NAME='contracts' AND to_jsonb(NEW)->>'status'='closed' THEN 'closed' ELSE 'updated' END,
 CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END $$;
CREATE TRIGGER contracts_audit AFTER INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION record_critical_change();
CREATE TRIGGER payments_audit AFTER INSERT OR UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION record_critical_change();
CREATE FUNCTION prevent_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'History cannot be erased or rewritten' USING ERRCODE='23514'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER contracts_no_delete BEFORE DELETE ON contracts FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
CREATE TRIGGER payments_no_delete BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();

CREATE FUNCTION protect_linked_roles() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.role<>OLD.role AND (
 EXISTS(SELECT 1 FROM contracts WHERE owner_id=NEW.id OR tenant_id=NEW.id) OR
 EXISTS(SELECT 1 FROM visits WHERE broker_id=NEW.id)) THEN
  RAISE EXCEPTION 'Historical links require preserving this role' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_linked_roles BEFORE UPDATE OF role ON users FOR EACH ROW EXECUTE FUNCTION protect_linked_roles();
