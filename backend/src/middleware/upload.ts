import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { UPLOADS_DIR } from '../lib/storage';

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  // The original filename is never trusted as a path on disk (a user could
  // name a file "../../etc/passwd") - a random name sidesteps that
  // entirely. The original name is preserved separately, in the DB row, for
  // display and for what the file downloads as.
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
});
