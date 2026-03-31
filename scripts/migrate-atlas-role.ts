/**
 * Phase 7 — Atlas Role Migration
 *
 * Migrates users where isPhotographer == true to role: 'atlas'.
 *
 * Migration rules:
 *   role === 'admin'              → SKIP (keep as-is)
 *   role === 'technician'         → { role: 'atlas', atlasRoles: ['repair'], isPhotographer: true }
 *   role === 'moderator'          → { role: 'atlas', atlasRoles: [],         isPhotographer: true }
 *   role === 'user'               → { role: 'atlas', atlasRoles: [],         isPhotographer: true }
 *   anything else                 → log UNKNOWN, skip
 *
 * isPhotographer: true is preserved on all migrated users.
 * Phase 8 cleanup will remove isPhotographer once all consumers are updated.
 *
 * Usage:
 *   # Install dependencies first (one-time):
 *   npm install --save-dev dotenv ts-node
 *
 *   # Dry run (safe — no writes):
 *   npx ts-node -P tsconfig.scripts.json scripts/migrate-atlas-role.ts
 *
 *   # Execute migration:
 *   npx ts-node -P tsconfig.scripts.json scripts/migrate-atlas-role.ts --execute
 */

import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// ---------------------------------------------------------------------------
// 1. Load environment from .env.local (same pattern as seed_knowledge.js)
// ---------------------------------------------------------------------------
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error(
    '[FATAL] Missing Firebase credentials in .env.local.\n' +
    'Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Init Firebase Admin
// ---------------------------------------------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

// ---------------------------------------------------------------------------
// 3. Types
// ---------------------------------------------------------------------------
type UserRole = 'user' | 'technician' | 'facility_technician' | 'admin' | 'moderator' | 'atlas';

interface MigrationTarget {
  uid: string;
  email: string;
  currentRole: UserRole;
  action: 'migrate' | 'skip_admin' | 'skip_unknown';
  newAtlasRoles?: string[];
  reason?: string;
}

// ---------------------------------------------------------------------------
// 4. Derive migration action for a single user
// ---------------------------------------------------------------------------
function planMigration(uid: string, email: string, role: UserRole): MigrationTarget {
  switch (role) {
    case 'admin':
      return { uid, email, currentRole: role, action: 'skip_admin', reason: 'admin role preserved' };

    case 'technician':
      return { uid, email, currentRole: role, action: 'migrate', newAtlasRoles: ['repair'] };

    case 'moderator':
    case 'user':
      return { uid, email, currentRole: role, action: 'migrate', newAtlasRoles: [] };

    default:
      return {
        uid, email, currentRole: role,
        action: 'skip_unknown',
        reason: `role '${role}' not in migration map`,
      };
  }
}

// ---------------------------------------------------------------------------
// 5. Main migration function
// ---------------------------------------------------------------------------
async function runMigration(isDryRun: boolean): Promise<void> {
  const mode = isDryRun ? 'DRY RUN' : 'EXECUTE';
  console.log(`\n========================================`);
  console.log(` Phase 7 — Atlas Role Migration [${mode}]`);
  console.log(`========================================\n`);

  // Query: all users where isPhotographer == true
  const snapshot = await db
    .collection('users')
    .where('isPhotographer', '==', true)
    .get();

  if (snapshot.empty) {
    console.log('No users found with isPhotographer == true. Nothing to do.');
    return;
  }

  console.log(`Found ${snapshot.docs.length} user(s) with isPhotographer == true.\n`);

  const plans: MigrationTarget[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return planMigration(doc.id, data.email ?? '(no email)', data.role as UserRole);
  });

  // ---------------------------------------------------------------------------
  // 6. Print DRY RUN summary (always — even in execute mode, print before writing)
  // ---------------------------------------------------------------------------
  const toMigrate = plans.filter((p) => p.action === 'migrate');
  const skippedAdmin = plans.filter((p) => p.action === 'skip_admin');
  const skippedUnknown = plans.filter((p) => p.action === 'skip_unknown');

  console.log('--- PLAN SUMMARY ---');
  console.log(`  Will migrate  : ${toMigrate.length} user(s)`);
  console.log(`  Skip (admin)  : ${skippedAdmin.length} user(s)`);
  console.log(`  Skip (unknown): ${skippedUnknown.length} user(s)`);
  console.log('');

  if (toMigrate.length > 0) {
    console.log('Users to be MIGRATED:');
    for (const p of toMigrate) {
      console.log(
        `  [MIGRATE] ${p.email} (${p.uid})\n` +
        `            ${p.currentRole} → atlas, atlasRoles: [${(p.newAtlasRoles ?? []).join(', ')}]`
      );
    }
    console.log('');
  }

  if (skippedAdmin.length > 0) {
    console.log('Users to be SKIPPED (admin, kept as-is):');
    for (const p of skippedAdmin) {
      console.log(`  [SKIP]    ${p.email} (${p.uid}) — ${p.reason}`);
    }
    console.log('');
  }

  if (skippedUnknown.length > 0) {
    console.log('Users to be SKIPPED (unknown role):');
    for (const p of skippedUnknown) {
      console.log(`  [UNKNOWN] ${p.email} (${p.uid}) — ${p.reason}`);
    }
    console.log('');
  }

  // ---------------------------------------------------------------------------
  // 7. If dry run, stop here
  // ---------------------------------------------------------------------------
  if (isDryRun) {
    console.log('--- DRY RUN COMPLETE — no writes performed ---');
    console.log('Run with --execute to apply the migration.\n');
    return;
  }

  // ---------------------------------------------------------------------------
  // 8. Execute: batch writes (Firestore limit 500 per batch)
  // ---------------------------------------------------------------------------
  if (toMigrate.length === 0) {
    console.log('No users to migrate. Nothing written.');
    return;
  }

  const BATCH_SIZE = 500;
  let migratedCount = 0;
  let batchNum = 0;

  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const chunk = toMigrate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    batchNum++;

    for (const plan of chunk) {
      const ref = db.collection('users').doc(plan.uid);
      batch.update(ref, {
        role: 'atlas',
        atlasRoles: plan.newAtlasRoles ?? [],
        isPhotographer: true,
      });
    }

    await batch.commit();
    migratedCount += chunk.length;
    console.log(`  Batch ${batchNum}: committed ${chunk.length} update(s).`);
  }

  const skippedCount = skippedAdmin.length + skippedUnknown.length;

  console.log('');
  console.log(`========================================`);
  console.log(` Migration complete.`);
  console.log(`   Migrated : ${migratedCount} user(s)`);
  console.log(`   Skipped  : ${skippedCount} user(s)`);
  console.log(`========================================\n`);
}

// ---------------------------------------------------------------------------
// 9. Entry point
// ---------------------------------------------------------------------------
const isDryRun = !process.argv.includes('--execute');

runMigration(isDryRun).catch((err) => {
  console.error('[ERROR]', err);
  process.exit(1);
});
