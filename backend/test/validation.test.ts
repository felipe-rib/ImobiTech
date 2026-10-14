import { test } from 'node:test';
import assert from 'node:assert/strict';
import { userPatchSchema, userSchema, propertySchema } from '../src/shared/domain.js';
test('PATCH não reativa usuário nem altera campos omitidos', () => {
  assert.deepEqual(userPatchSchema.parse({ name: 'Nome atualizado' }), { name: 'Nome atualizado' });
  assert.equal(userPatchSchema.safeParse({}).success, false);
});
test('Cadastro exige senha forte em tamanho e perfil único', () => {
  const base = {
    name: 'Pessoa Teste',
    email: 'person@test.example',
    role: 'owner',
    password: 'senha longa de teste',
  };
  assert.equal(userSchema.parse(base).active, true);
  assert.equal(userSchema.safeParse({ ...base, password: 'curta' }).success, false);
  assert.equal(userSchema.safeParse({ ...base, role: ['owner', 'admin'] }).success, false);
  assert.equal(userSchema.safeParse({ ...base, password_hash: 'override' }).success, false);
});
test('Imóvel não aceita situação inicial enviada pelo cliente', () => {
  assert.equal(propertySchema.safeParse({ status: 'unavailable' }).success, false);
});
