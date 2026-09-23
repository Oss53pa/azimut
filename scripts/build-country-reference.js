#!/usr/bin/env node

/**
 * Régénère le référentiel des pays de la section Q9.
 *
 * Q9 : « Aucune liste de pays, aucun fuseau et aucune correspondance entre les
 * deux n'est écrite dans le code. » Ce script n'écrit aucune de ces trois
 * choses : il les lit là où elles font autorité, et rend un fichier.
 *
 * Trois sources, toutes citables et toutes présentes sur la machine :
 *  · `iso3166.tab` de la base de données des fuseaux — les codes et les noms
 *    anglais, que le fichier tient d'ISO 3166-1 ;
 *  · `zone.tab` de la même base — les fuseaux de chaque pays ;
 *  · CLDR, par l'ICU du moteur d'exécution — les noms français.
 *
 * La devise par défaut reste absente : aucune source de la machine ne porte la
 * correspondance d'un pays vers sa devise, et l'inventer serait une faute. La
 * colonne existe, elle attend son fichier, comme `rules-packs/` attend le sien.
 *
 * Le fichier produit est committé : c'est lui qui fait foi ensuite, pas la
 * machine qui l'a produit. Le régénérer sur une autre version de la base de
 * données des fuseaux produit un fichier différent, et c'est voulu — la
 * référence documentaire le dit.
 *
 * Usage : node scripts/build-country-reference.js [répertoire zoneinfo]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ZONEINFO = process.argv[2] ?? '/usr/share/zoneinfo';
const OUT = join(import.meta.dirname, '..', 'packages', 'db', 'src', 'reference', 'country.json');

function rows(file) {
  return readFileSync(join(ZONEINFO, file), 'utf-8')
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((line) => line.split('\t'));
}

function tzdbVersion() {
  const first = readFileSync(join(ZONEINFO, 'tzdata.zi'), 'utf-8').split('\n')[0];
  const match = /^# version (\S+)$/.exec(first ?? '');
  if (match === null) throw new Error('version de la base des fuseaux introuvable');
  return match[1];
}

const version = tzdbVersion();
const icu = process.versions.icu;
const sourceRef = `IANA tzdb ${version} (iso3166.tab, zone.tab) ; CLDR via ICU ${icu}`;

const zones = new Map();
for (const [code, , zone] of rows('zone.tab')) {
  if (code === undefined || zone === undefined) continue;
  const list = zones.get(code) ?? [];
  list.push(zone);
  zones.set(code, list);
}

const frenchName = new Intl.DisplayNames(['fr'], { type: 'region' });

const countries = [];
for (const [code, englishName] of rows('iso3166.tab')) {
  if (code === undefined || englishName === undefined) continue;
  const fr = frenchName.of(code);
  countries.push({
    code,
    name_fr: fr === code ? englishName : fr,
    name_en: englishName,
    // Triés : deux régénérations doivent rendre le même fichier, octet pour
    // octet (A9), et l'ordre de `zone.tab` n'est pas garanti.
    timezones: [...(zones.get(code) ?? [])].sort(),
    default_currency_code: null,
    source_ref: sourceRef,
  });
}
countries.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));

const missing = countries.filter((c) => c.timezones.length === 0).map((c) => c.code);
writeFileSync(OUT, JSON.stringify({ source_ref: sourceRef, countries }, null, 2) + '\n');
console.log(`${countries.length} pays écrits dans ${OUT}`);
console.log(`référence : ${sourceRef}`);
if (missing.length > 0) console.log(`sans fuseau déclaré : ${missing.join(', ')}`);
