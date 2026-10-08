#!/usr/bin/env node
// Mock-OCR voor tests: `node mock-ocr.mjs <bestand> stdout`. Schrijft "S" en "E"
// naar OCR_MOCK_LOG (om gelijktijdigheid te controleren) en geeft tekst terug.
import fs from 'node:fs';
import path from 'node:path';
const file = process.argv[2];
const log = process.env.OCR_MOCK_LOG;
if (log) fs.appendFileSync(log, 'S');
await new Promise((r) => setTimeout(r, 40));
if (log) fs.appendFileSync(log, 'E');
process.stdout.write('MOCKOCR ' + path.basename(file) + '\n');
