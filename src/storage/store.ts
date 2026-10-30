import type { Database } from './seed';
import { seedDatabase } from './seed';

// 全局单例：兼容 Next.js dev 模式热更新，避免每次编译重置演示数据
const globalStore = globalThis as unknown as { __chengshiDb?: Database };

export function db(): Database {
  if (!globalStore.__chengshiDb) {
    globalStore.__chengshiDb = seedDatabase();
  }
  return globalStore.__chengshiDb;
}

export function resetDb(): Database {
  globalStore.__chengshiDb = seedDatabase();
  return globalStore.__chengshiDb;
}
