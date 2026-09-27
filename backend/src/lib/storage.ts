import fs from 'node:fs';
import path from 'node:path';

// Local disk for now - there's no cloud storage yet (that's a Phase 8 concern).
// Every other file in the app only ever imports UPLOADS_DIR from here, so
// swapping this for S3 later means changing this one module, not every
// route that reads or writes a file.
export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
