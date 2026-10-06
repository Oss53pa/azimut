-- J4 — l'annotation en révision : une remarque de relecture portée sur une
-- ligne du tableau des messages, une face, un support ou une zone, dans le
-- circuit de validation (R7.4).
--
-- Modèle soumis à l'utilisateur et retenu le 2026-10-06 (A2.2, point 2 : J4
-- ne figure pas en A5) :
--
--   · l'ancre est l'une des quatre clés étrangères, exactement une
--     (« ancrée sur l'entité concernée, jamais flottante ») : la base garantit
--     que l'entité visée existe, ce qu'une ancre polymorphe ne ferait pas ;
--   · trois états, ouverte, traitée, refusée ; une annotation ouverte bloque
--     la clôture d'une revue (REVIEW.ANNOTATION_OPEN) ;
--   · le texte se saisit au clavier ; le tracé au stylet, facultatif, est
--     gardé tel quel, comme l'esquisse (J0) — aucune reconnaissance
--     d'écriture, décision de l'utilisateur ;
--   · l'auteur est pris en base ; le fil de réponses a sa table.
--
-- Propriété du module 02, qui possède le tableau des messages et son circuit
-- d'approbation. Une annotation n'entre dans aucun livrable (J4, R10).
--
-- Additive : deux tables neuves, aucune ligne existante touchée (A2.2, point 7).

CREATE TABLE azimut.review_annotation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES azimut.site(id) ON DELETE RESTRICT,
  message_line_id uuid REFERENCES azimut.message_line(id) ON DELETE RESTRICT,
  support_face_id uuid REFERENCES azimut.support_face(id) ON DELETE RESTRICT,
  support_id uuid REFERENCES azimut.support(id) ON DELETE RESTRICT,
  zone_id uuid REFERENCES azimut.zone(id) ON DELETE RESTRICT,
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'resolved', 'rejected')),
  body text NOT NULL DEFAULT '',
  ink jsonb CHECK (ink IS NULL OR jsonb_typeof(ink) = 'array'),
  author_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  -- Jamais flottante : une ancre, et une seule.
  CONSTRAINT review_annotation_one_anchor
    CHECK (num_nonnulls(message_line_id, support_face_id, support_id, zone_id) = 1),
  -- Une annotation dit quelque chose : un texte, un tracé, ou les deux.
  CONSTRAINT review_annotation_not_empty
    CHECK (btrim(body) <> '' OR ink IS NOT NULL),
  -- Traitée ou refusée, elle porte qui l'a close et quand.
  CONSTRAINT review_annotation_closed_signed
    CHECK (state = 'open' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX idx_review_annotation_org ON azimut.review_annotation(org_id);
CREATE INDEX idx_review_annotation_site ON azimut.review_annotation(site_id);
CREATE INDEX idx_review_annotation_line ON azimut.review_annotation(message_line_id);
CREATE INDEX idx_review_annotation_face ON azimut.review_annotation(support_face_id);
CREATE INDEX idx_review_annotation_support ON azimut.review_annotation(support_id);
CREATE INDEX idx_review_annotation_zone ON azimut.review_annotation(zone_id);

CREATE TABLE azimut.review_annotation_reply (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES azimut.organization(id) ON DELETE RESTRICT,
  annotation_id uuid NOT NULL REFERENCES azimut.review_annotation(id) ON DELETE RESTRICT,
  body text NOT NULL CHECK (btrim(body) <> ''),
  author_id uuid NOT NULL DEFAULT azimut.current_user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX idx_review_annotation_reply_org ON azimut.review_annotation_reply(org_id);
CREATE INDEX idx_review_annotation_reply_annotation ON azimut.review_annotation_reply(annotation_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.review_annotation
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- Qui clôt, et quand, la base le pose : le studio ne connaît pas l'identité
-- de l'utilisateur, et une signature fournie par l'appelant se falsifierait.
-- Au passage d'ouverte à traitée ou refusée, la signature est posée ; au retour
-- à ouverte (l'annulation d'une clôture), elle est effacée.
CREATE FUNCTION azimut.review_annotation_sign() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state = 'open' THEN
    NEW.resolved_by := NULL;
    NEW.resolved_at := NULL;
  ELSIF OLD.state = 'open' THEN
    NEW.resolved_by := azimut.current_user_id();
    NEW.resolved_at := now();
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER review_annotation_sign BEFORE UPDATE OF state ON azimut.review_annotation
  FOR EACH ROW EXECUTE FUNCTION azimut.review_annotation_sign();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON azimut.review_annotation_reply
  FOR EACH ROW EXECUTE FUNCTION azimut.set_updated_at();

-- A6.1 : cloisonnement par organisation, forcé comme sur toute table portant
-- `org_id` (0025).
ALTER TABLE azimut.review_annotation ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.review_annotation_reply ENABLE ROW LEVEL SECURITY;
ALTER TABLE azimut.review_annotation FORCE ROW LEVEL SECURITY;
ALTER TABLE azimut.review_annotation_reply FORCE ROW LEVEL SECURITY;

CREATE POLICY review_annotation_org_policy ON azimut.review_annotation
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
CREATE POLICY review_annotation_reply_org_policy ON azimut.review_annotation_reply
  FOR ALL TO authenticated
  USING (org_id IN (SELECT azimut.user_org_ids()))
  WITH CHECK (org_id IN (SELECT azimut.user_org_ids()));
