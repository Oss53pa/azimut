#!/usr/bin/env node

/**
 * Validates the internal dependency graph per A4.1:
 * - engine-* depends only on core-model and rules
 * - core-model has no internal dependencies
 * - No cross-dependencies between engine-* packages
 * - No reverse dependencies from core-model/rules to engines/apps
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname
  ? join(import.meta.dirname, '..')
  : process.cwd();

const PACKAGES_DIR = join(ROOT, 'packages');
const APPS_DIR = join(ROOT, 'apps');

const ALLOWED_ENGINE_DEPS = new Set([
  '@azimut/core-model',
  '@azimut/rules',
]);

const engineNames = new Set();
const appNames = new Set();

function readPkg(dir, entry) {
  const pkgPath = join(dir, entry, 'package.json');
  if (!existsSync(pkgPath)) return null;
  return JSON.parse(readFileSync(pkgPath, 'utf-8'));
}

for (const dir of [PACKAGES_DIR, APPS_DIR]) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    const pkg = readPkg(dir, entry);
    if (!pkg) continue;
    if (dir === APPS_DIR) appNames.add(pkg.name);
    if (entry.startsWith('engine-')) engineNames.add(pkg.name);
  }
}

const errors = [];

for (const dir of [PACKAGES_DIR, APPS_DIR]) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    const pkg = readPkg(dir, entry);
    if (!pkg) continue;

    const internalDeps = Object.keys(pkg.dependencies ?? {}).filter(
      (d) => d.startsWith('@azimut/'),
    );

    if (pkg.name === '@azimut/core-model') {
      for (const dep of internalDeps) {
        errors.push(
          `${pkg.name} must have no internal dependencies, but depends on ${dep}`,
        );
      }
    }

    if (entry.startsWith('engine-')) {
      for (const dep of internalDeps) {
        if (!ALLOWED_ENGINE_DEPS.has(dep)) {
          errors.push(
            `${pkg.name} depends on ${dep} — engine-* may only depend on core-model and rules`,
          );
        }
      }
    }

    if (
      pkg.name === '@azimut/core-model' ||
      pkg.name === '@azimut/rules'
    ) {
      for (const dep of internalDeps) {
        if (engineNames.has(dep) || appNames.has(dep)) {
          errors.push(
            `${pkg.name} must not depend on ${dep} (reverse dependency)`,
          );
        }
      }
    }

    if (engineNames.has(pkg.name)) {
      for (const dep of internalDeps) {
        if (engineNames.has(dep)) {
          errors.push(
            `${pkg.name} must not depend on ${dep} (cross-dependency between engines)`,
          );
        }
      }
    }
  }
}

if (errors.length > 0) {
  console.error('Dependency graph violations:');
  for (const e of errors) {
    console.error(`  - ${e}`);
  }
  process.exit(1);
} else {
  console.log('Dependency graph: OK');
}
