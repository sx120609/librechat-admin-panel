/**
 * 用户管理高权限操作 —— 修改 SystemRole。
 *
 * LibreChat 官方 Admin API 没有 PATCH user role 端点，所以
 * 我们直接通过 mongoose 写 `users` 集合的 role 字段。
 *
 * 需要 MANAGE_USERS 与 MANAGE_ROLES 任一能力。
 */

import { z } from 'zod';
import mongoose from 'mongoose';
import { createServerFn } from '@tanstack/react-start';
import { SystemRoles } from 'librechat-data-provider';
import { SystemCapabilities } from './constants';
import { requireAnyCapability } from './capabilities';
import { getModels } from './db/models';
import { getDb } from './db/connection';

const objectIdString = z.string().refine((v) => mongoose.isValidObjectId(v), {
  message: '不是合法的 MongoDB ObjectId',
});

/**
 * 修改某个用户的 SystemRole。返回新的 role。
 */
export const updateUserRoleFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: objectIdString,
      role: z.nativeEnum(SystemRoles),
    }),
  )
  .handler(async ({ data }): Promise<{ userId: string; role: SystemRoles }> => {
    await requireAnyCapability([
      SystemCapabilities.MANAGE_USERS,
      SystemCapabilities.MANAGE_ROLES,
    ]);
    const m = await getDb();
    const { User } = getModels(m);
    const result = await User.updateOne(
      { _id: new mongoose.Types.ObjectId(data.userId) },
      { $set: { role: data.role } },
    );
    if (result.matchedCount === 0) {
      throw new Error('未找到对应用户');
    }
    return { userId: data.userId, role: data.role };
  });
