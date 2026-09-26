import { fileURLToPath } from 'url';
import { dirname } from 'path';

export default function fileDirName(metaUrl) {
  const __filename = fileURLToPath(metaUrl);
  const __dirname = dirname(__filename);
  return { __filename, __dirname };
}
