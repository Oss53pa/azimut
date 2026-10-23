-- Retour de 0075 : la politique de 0025 et ses droits reviennent.
--
-- Ce retour rouvre l'auto-rattachement que 0075 ferme. Il ne touche à aucune
-- ligne et ne sert qu'à revenir sur une base de développement.
GRANT INSERT, UPDATE, DELETE ON azimut.membership TO authenticated;

DROP POLICY IF EXISTS membership_own_rows_select ON azimut.membership;

CREATE POLICY membership_own_rows ON azimut.membership
  FOR ALL TO authenticated
  USING (user_id = azimut.current_user_id())
  WITH CHECK (user_id = azimut.current_user_id());
