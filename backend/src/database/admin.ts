import { getConfig } from '../shared/config.js';
import { createPool } from './pool.js';
import { UserService } from '../users/service.js';
const pool = createPool(getConfig().DATABASE_URL);
try {
  if ((await pool.query("SELECT 1 FROM users WHERE role='admin' AND active")).rowCount)
    throw new Error('Já existe administrador ativo. Use o gerenciamento de usuários.');
  await new UserService(pool).create({
    name: process.env.ADMIN_NAME,
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
    role: 'admin',
    active: true,
  });
  console.log('Administrador inicial cadastrado.');
} finally {
  await pool.end();
}
