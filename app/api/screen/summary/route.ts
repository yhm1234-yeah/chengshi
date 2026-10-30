import { ok } from '@/lib/api';
import { computeScreen } from '@/server/stats';

export async function GET() {
  return ok(computeScreen());
}
