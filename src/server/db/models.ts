/**
 * 与 LibreChat 主库共用的 mongoose 模型最小子集。
 *
 * 字段对齐 LibreChat 源码：
 *   - api/models/schema/balanceSchema.js
 *   - api/models/schema/userSchema.js
 *
 * 我们只声明本管理面板会读写的字段；其余字段 LibreChat 端自治。
 * `strict: false` 让额外字段透传不报错。
 */

import mongoose from 'mongoose';
import type { Model } from 'mongoose';

export interface BalanceDoc {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  tokenCredits: number;
  autoRefillEnabled?: boolean;
  refillIntervalValue?: number;
  refillIntervalUnit?: 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  refillAmount?: number;
  lastRefill?: Date;
}

export interface UserDoc {
  _id: mongoose.Types.ObjectId;
  email: string;
  name?: string;
  role?: string;
}

const balanceSchema = new mongoose.Schema<BalanceDoc>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenCredits: { type: Number, default: 0 },
    autoRefillEnabled: { type: Boolean, default: false },
    refillIntervalValue: { type: Number, default: 30 },
    refillIntervalUnit: { type: String, default: 'days' },
    refillAmount: { type: Number, default: 0 },
    lastRefill: { type: Date, default: () => new Date() },
  },
  { collection: 'balances', strict: false, timestamps: false },
);

const userSchema = new mongoose.Schema<UserDoc>(
  {
    email: { type: String },
    name: { type: String },
    role: { type: String },
  },
  { collection: 'users', strict: false, timestamps: false },
);

/**
 * 返回已注册到当前 mongoose 实例的模型。
 * 避免 hot reload 下重复 `model()` 抛 OverwriteModelError。
 */
export function getModels(m: typeof mongoose): {
  Balance: Model<BalanceDoc>;
  User: Model<UserDoc>;
} {
  const Balance =
    (m.models.AdminBalance as Model<BalanceDoc> | undefined) ??
    m.model<BalanceDoc>('AdminBalance', balanceSchema);
  const User =
    (m.models.AdminUser as Model<UserDoc> | undefined) ??
    m.model<UserDoc>('AdminUser', userSchema);
  return { Balance, User };
}
