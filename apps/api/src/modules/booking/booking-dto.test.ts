import assert from 'node:assert/strict';
import { test } from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBookingDto } from './booking.module';

const nameErrors = async (name: string) => {
  const dto = plainToInstance(CreateBookingDto, { service: 'kitchens', date: '2026-11-02', time: '10:00', name, email: 'a@example.com' });
  const errors = await validate(dto);
  return { dto, messages: errors.filter((error) => error.property === 'name').flatMap((error) => Object.values(error.constraints ?? {})) };
};

test('a name of only spaces is refused like an empty one', async () => {
  assert.deepEqual((await nameErrors('   ')).messages, ['Enter your name.']);
  assert.deepEqual((await nameErrors('')).messages, ['Enter your name.']);
});

test('a padded name is kept trimmed', async () => {
  const { dto, messages } = await nameErrors('  Ann Lee  ');
  assert.deepEqual(messages, []);
  assert.equal(dto.name, 'Ann Lee');
});
