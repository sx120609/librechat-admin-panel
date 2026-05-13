/**
 * 用户余额（tokenCredits）管理 server functions。
 *
 * 通过 mongoose 直接读写 LibreChat 的 `balances` 集合 ——
 * LibreChat 官方 Admin API 暂未暴露余额端点。
 *
 * 所有写操作要求调用方持有 MANAGE_USERS 能力，由
 * `requireAnyCapability` 在 handler 入口校验。
 */

import { z } from 'zod';
import mongoose from 'mongoose';
import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { SystemCapabilities } from './constants';
import { requireAnyCapability } from './capabilities';
import { getModels } from './db/models';
import { getDb } from './db/connection';

const objectIdString = z.string().refine((v) => mongoose.isValidObjectId(v), {
  message: '不是合法的 MongoDB ObjectId',
});

export interface UserBalanceInfo {
  userId: string;
  tokenCredits: number;
  autoRefillEnabled: boolean;
  refillIntervalValue: number;
  refillIntervalUnit: string;
  refillAmount: number;
  lastRefill?: string;
}

async function loadBalances(): Promise<UserBalanceInfo[]> {
  const m = await getDb();
  const { Balance } = getModels(m);
  const docs = await Balance.find({}).lean<
    Array<{
      user: mongoose.Types.ObjectId;
      tokenCredits?: number;
      autoRefillEnabled?: boolean;
      refillIntervalValue?: number;
      refillIntervalUnit?: string;
      refillAmount?: number;
      lastRefill?: Date;
    }>
  >();
  return docs.map((d) => ({
    userId: String(d.user),
    tokenCredits: d.tokenCredits ?? 0,
    autoRefillEnabled: d.autoRefillEnabled ?? false,
    refillIntervalValue: d.refillIntervalValue ?? 30,
    refillIntervalUnit: d.refillIntervalUnit ?? 'days',
    refillAmount: d.refillAmount ?? 0,
    lastRefill: d.lastRefill ? new Date(d.lastRefill).toISOString() : undefined,
  }));
}

/**
 * 一次性读取所有用户余额。返回数组而非对象映射，
 * 因为 react-query 缓存对数组更友好；前端再按 userId 归并。
 */
export const getBalancesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ balances: UserBalanceInfo[] }> => {
    await requireAnyCapability([SystemCapabilities.MANAGE_USERS]);
    const balances = await loadBalances();
    return { balances };
  },
);

export const balancesQueryOptions = queryOptions({
  queryKey: ['balances'],
  queryFn: () => getBalancesFn().then((r) => r.balances),
  staleTime: 30_000,
});

async function applyDelta(userId: string, delta: number): Promise<UserBalanceInfo> {
  const m = await getDb();
  const { Balance } = getModels(m);
  const userObjId = new mongoose.Types.ObjectId(userId);
  const updated = await Balance.findOneAndUpdate(
    { user: userObjId },
    {
      $inc: { tokenCredits: delta },
      $setOnInsert: { user: userObjId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean<{
    user: mongoose.Types.ObjectId;
    tokenCredits?: number;
    autoRefillEnabled?: boolean;
    refillIntervalValue?: number;
    refillIntervalUnit?: string;
    refillAmount?: number;
    lastRefill?: Date;
  } | null>();
  if (!updated) {
    throw new Error('调整余额失败：未返回余额文档');
  }
  return {
    userId: String(updated.user),
    tokenCredits: updated.tokenCredits ?? 0,
    autoRefillEnabled: updated.autoRefillEnabled ?? false,
    refillIntervalValue: updated.refillIntervalValue ?? 30,
    refillIntervalUnit: updated.refillIntervalUnit ?? 'days',
    refillAmount: updated.refillAmount ?? 0,
    lastRefill: updated.lastRefill ? new Date(updated.lastRefill).toISOString() : undefined,
  };
}

/**
 * 给用户余额加（delta>0）或减（delta<0）一个数额。
 * 余额可降到负数 —— 由调用方根据业务决定是否再 clamp。
 */
export const adjustBalanceFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: objectIdString,
      delta: z.number().int(),
    }),
  )
  .handler(async ({ data }): Promise<{ balance: UserBalanceInfo }> => {
    await requireAnyCapability([SystemCapabilities.MANAGE_USERS]);
    if (data.delta === 0) {
      throw new Error('增量不能为 0');
    }
    const balance = await applyDelta(data.userId, data.delta);
    return { balance };
  });

/**
 * 直接覆盖某个用户的 tokenCredits。
 */
export const setBalanceFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: objectIdString,
      tokenCredits: z.number().int().min(0),
    }),
  )
  .handler(async ({ data }): Promise<{ balance: UserBalanceInfo }> => {
    await requireAnyCapability([SystemCapabilities.MANAGE_USERS]);
    const m = await getDb();
    const { Balance } = getModels(m);
    const userObjId = new mongoose.Types.ObjectId(data.userId);
    const updated = await Balance.findOneAndUpdate(
      { user: userObjId },
      { $set: { tokenCredits: data.tokenCredits }, $setOnInsert: { user: userObjId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<{
      user: mongoose.Types.ObjectId;
      tokenCredits?: number;
      autoRefillEnabled?: boolean;
      refillIntervalValue?: number;
      refillIntervalUnit?: string;
      refillAmount?: number;
      lastRefill?: Date;
    } | null>();
    if (!updated) {
      throw new Error('设置余额失败：未返回余额文档');
    }
    return {
      balance: {
        userId: String(updated.user),
        tokenCredits: updated.tokenCredits ?? 0,
        autoRefillEnabled: updated.autoRefillEnabled ?? false,
        refillIntervalValue: updated.refillIntervalValue ?? 30,
        refillIntervalUnit: updated.refillIntervalUnit ?? 'days',
        refillAmount: updated.refillAmount ?? 0,
        lastRefill: updated.lastRefill
          ? new Date(updated.lastRefill).toISOString()
          : undefined,
      },
    };
  });
