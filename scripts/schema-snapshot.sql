-- T-0.3 — un instantané déterministe du schéma `azimut`, pour comparer deux
-- états : tables et colonnes, contraintes, index, politiques, déclencheurs,
-- fonctions (empreinte de leur définition) et droits. Une ligne par élément,
-- triée. Le registre des migrations est exclu : il compte les passages.
SELECT 'col ' || c.relname || '.' || a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
       || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END
       || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_attribute a
JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE n.nspname = 'azimut' AND c.relkind IN ('r', 'p', 'v') AND a.attnum > 0 AND NOT a.attisdropped
  AND c.relname <> '_migrations'
UNION ALL
SELECT 'rls ' || c.relname || ' ' || c.relrowsecurity || ' ' || c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'azimut' AND c.relkind IN ('r', 'p') AND c.relname <> '_migrations'
UNION ALL
SELECT 'con ' || c.relname || ' ' || k.conname || ' ' || pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'azimut' AND c.relname <> '_migrations'
UNION ALL
SELECT 'idx ' || indexdef FROM pg_indexes WHERE schemaname = 'azimut' AND tablename <> '_migrations'
UNION ALL
SELECT 'pol ' || tablename || ' ' || policyname || ' ' || permissive || ' ' || cmd || ' ' || roles::text
       || ' ' || coalesce(qual, '') || ' / ' || coalesce(with_check, '')
FROM pg_policies WHERE schemaname = 'azimut'
UNION ALL
SELECT 'trg ' || c.relname || ' ' || pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'azimut' AND NOT t.tgisinternal
UNION ALL
SELECT 'fn ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ') ' || md5(pg_get_functiondef(p.oid))
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'azimut' AND p.prokind IN ('f', 'p')
UNION ALL
SELECT 'grant ' || table_name || ' ' || grantee || ' ' || privilege_type
FROM information_schema.role_table_grants WHERE table_schema = 'azimut' AND table_name <> '_migrations'
UNION ALL
SELECT 'fngrant ' || routine_name || ' ' || grantee || ' ' || privilege_type
FROM information_schema.role_routine_grants WHERE routine_schema = 'azimut'
ORDER BY 1;
