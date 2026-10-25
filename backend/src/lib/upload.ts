import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';

// Pasta servida estaticamente em /uploads (ver server.ts)
export const UPLOADS_DIR = path.resolve(__dirname, '..', '..', 'uploads');
const FOTOS_DIR = path.join(UPLOADS_DIR, 'recursos');

fs.mkdirSync(FOTOS_DIR, { recursive: true });

const EXTENSOES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const TAMANHO_MAXIMO_FOTO = 2 * 1024 * 1024; // 2 MB

export const uploadFoto = multer({
  storage: multer.diskStorage({
    destination: FOTOS_DIR,
    filename: (req, file, cb) =>
      cb(null, `${crypto.randomUUID()}${EXTENSOES[file.mimetype]}`),
  }),
  limits: { fileSize: TAMANHO_MAXIMO_FOTO },
  fileFilter: (req, file, cb) => cb(null, file.mimetype in EXTENSOES),
}).single('foto');

// Caminho público salvo no banco, ex.: /uploads/recursos/<uuid>.jpg
export function caminhoPublico(nomeArquivo: string) {
  return `/uploads/recursos/${nomeArquivo}`;
}

// Remove do disco a foto antiga; ignora se o arquivo já não existir
export function apagarFoto(caminho: string | null) {
  if (!caminho?.startsWith('/uploads/recursos/')) return;
  fs.promises.unlink(path.join(FOTOS_DIR, path.basename(caminho))).catch(() => {});
}
