/**
 * 直连 LibreChat MongoDB 的 mongoose 单例连接。
 *
 * 仅供 server function 使用 —— 千万不要在 client bundle 链路中
 * 引用本文件，否则 Vite 会把 Node 内置模块打进浏览器侧。
 *
 * 通过 `globalThis` 缓存连接，避免 Vite dev 热重载 / TanStack
 * Start serverFn 拆包时反复建立连接。
 */

import mongoose from 'mongoose';

declare global {
  var __adminPanelMongoose: typeof mongoose | null | undefined;
  var __adminPanelMongoosePromise: Promise<typeof mongoose> | null | undefined;
}

const DEFAULT_URI = 'mongodb://localhost:27017/LibreChat';

function readUri(): string {
  const uri = process.env.MONGO_URI?.trim();
  if (uri) return uri;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '未配置 MONGO_URI 环境变量；余额管理与用户角色修改功能需要直连 MongoDB',
    );
  }
  return DEFAULT_URI;
}

/**
 * 获取已连接的 mongoose 实例。多次调用复用同一连接。
 */
export async function getDb(): Promise<typeof mongoose> {
  if (globalThis.__adminPanelMongoose) {
    return globalThis.__adminPanelMongoose;
  }
  if (!globalThis.__adminPanelMongoosePromise) {
    const uri = readUri();
    globalThis.__adminPanelMongoosePromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 5,
      })
      .then((m) => {
        globalThis.__adminPanelMongoose = m;
        return m;
      })
      .catch((err) => {
        globalThis.__adminPanelMongoosePromise = null;
        throw err;
      });
  }
  return globalThis.__adminPanelMongoosePromise;
}
