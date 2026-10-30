import type { Storage } from './types';
import { mockStorage } from './mock';

// 数据层统一入口：业务代码只依赖 Storage 接口。
// STORAGE_DRIVER=mock 时使用内存 + 种子数据（默认，现场零依赖）；
// STORAGE_DRIVER=pg 时由 PostgreSQL + pgvector 适配层提供同一接口（schema 见 src/db/schema.sql）。
let instance: Storage | null = null;

export function getStorage(): Storage {
  if (!instance) instance = mockStorage;
  return instance;
}

export type { Storage };
