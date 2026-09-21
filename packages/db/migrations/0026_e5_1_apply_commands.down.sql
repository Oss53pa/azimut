-- Retour en arrière de 0026. Le poste perd alors tout chemin d'écriture
-- transactionnel : n'est là que pour la symétrie du corpus.
DROP FUNCTION IF EXISTS azimut.apply_commands(jsonb);
