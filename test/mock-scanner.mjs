#!/usr/bin/env node
// Mock-virusscanner voor tests: markeert bestanden die "EICAR" bevatten als
// besmet (exitcode 1), net als clamscan.
import fs from 'node:fs';
const file = process.argv[process.argv.length - 1];
try {
  const data = fs.readFileSync(file, 'utf8');
  if (data.includes('EICAR')) {
    process.stdout.write(`${file}: Win.Test.EICAR FOUND\n`);
    process.exit(1);
  }
} catch { /* niet leesbaar: als schoon behandelen */ }
process.exit(0);
