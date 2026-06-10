import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const repoRoot = process.cwd();

function findWorkspaceRoot(start) {
  let current = start;
  for (let i = 0; i < 10; i += 1) {
    if (
      existsSync(join(current, 'AGENTS.md')) &&
      existsSync(join(current, 'L4_Deliverables'))
    ) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error('Could not find Claude Cowork workspace root from site repo');
}

function fileHash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

const workspaceRoot = findWorkspaceRoot(repoRoot);

const draftMappings = [
  {
    label: 'Rebirth brief',
    source: 'L4_Deliverables/How_The_Library_Works/School_Trust_Rebirth_Brief_v4_5_9_2026-06-09.docx',
    targets: ['public/drafts/school-trust-rebirth-latest.docx'],
  },
  {
    label: 'Forgotten Forever Gift',
    source: 'L4_Deliverables/Book_Revision/FFG/FFG_v30_2026-06-08.docx',
    targets: [
      'public/drafts/ffg-v30.docx',
      'public/drafts/schools-of-the-republic-latest.docx',
    ],
  },
  {
    label: 'A Law That Says Nothing New',
    source: 'L4_Deliverables/_family_builds/uptea_public_FAMILY_REVIEW_2026-06-08.docx',
    targets: ['public/drafts/a-law-that-says-nothing-new-latest.docx'],
  },
  {
    label: 'UPTEA converged packet',
    source: 'L4_Deliverables/Renewal_Program/UPTEA_v2_Converged_Packet_2026-06-07.docx',
    targets: ['public/drafts/uptea-converged-packet-latest.docx'],
  },
  {
    label: 'Stewards of the Republic',
    source: 'L4_Deliverables/_family_builds/stewards_FAMILY_REVIEW_2026-06-08.docx',
    targets: ['public/drafts/stewards-of-the-republic-latest.docx'],
  },
  {
    label: 'Hornbook working edition',
    source: 'L4_Deliverables/Hornbook/Hornbook_WORKING_EDITION_v1_2026-06-07.docx',
    targets: ['public/drafts/hornbook-working-edition-v1.docx'],
  },
  {
    label: 'Who Steals from Children',
    source: 'L4_Deliverables/_family_builds/wsfc_FAMILY_REVIEW_2026-06-08.docx',
    targets: [
      'public/drafts/who-steals-from-children-latest.docx',
      'public/drafts/who-steals-from-children-vol1-latest.docx',
    ],
  },
  {
    label: 'A Useful Life',
    source: 'L4_Deliverables/Autobiography/Autobiography_Booklet_v2.docx',
    targets: ['public/drafts/a-useful-life-latest.docx'],
  },
  {
    label: 'The Accidental Plaintiff',
    source: 'L4_Deliverables/Oregon_Origin_Story/Oregon_Origin_Booklet_v2.docx',
    targets: ['public/drafts/the-accidental-plaintiff-latest.docx'],
  },
  {
    label: 'Make School Trusts for Schools',
    source: 'L4_Deliverables/Strategy/Make_School_Trusts_For_Schools_2026-06-08/Make_School_Trusts_For_Schools_Citizen_Repair_Booklet_v2_CREAM_2026-06-08.docx',
    targets: ['public/drafts/make-school-trusts-for-schools-latest.docx'],
  },
];

let updated = 0;
let current = 0;

for (const mapping of draftMappings) {
  const sourcePath = join(workspaceRoot, mapping.source);
  if (!existsSync(sourcePath)) {
    throw new Error(`${mapping.label}: missing source ${sourcePath}`);
  }
  const sourceHash = fileHash(sourcePath);

  for (const target of mapping.targets) {
    const targetPath = join(repoRoot, target);
    mkdirSync(dirname(targetPath), { recursive: true });
    const targetMatches = existsSync(targetPath) && fileHash(targetPath) === sourceHash;

    if (!targetMatches) {
      copyFileSync(sourcePath, targetPath);
      updated += 1;
      const size = statSync(targetPath).size;
      console.log(`updated ${target} from ${mapping.label} (${size} bytes)`);
    } else {
      current += 1;
      console.log(`current ${target}`);
    }
  }
}

console.log(`writing draft sync complete: ${updated} updated, ${current} already current`);
