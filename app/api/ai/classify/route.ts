import { BIZ, fail, readJson } from '@/lib/api';
import { sseResponse, type SseMessage } from '@/lib/sse';
import { runClassify } from '@/ai/chains/classify';
import { sleep } from '@/lib/utils';
import { THRESHOLDS } from '@/domain/constants';

interface Body {
  imageUrls?: string[];
  demoCase?: string;
  hint?: string;
}

export async function POST(req: Request) {
  const body = await readJson<Body>(req, {});
  const imageUrls = (body.imageUrls ?? []).filter((u) => typeof u === 'string' && u.length > 0);
  if (!imageUrls.length) return fail(BIZ.VALIDATION, '请上传照片后再识别');
  if (imageUrls.length > THRESHOLDS.maxImage) return fail(BIZ.VALIDATION, `最多 ${THRESHOLDS.maxImage} 张照片`);

  async function* events(): AsyncGenerator<SseMessage> {
    yield { event: 'start', data: { model: 'qwen-vl-max', images: imageUrls.length } };
    yield { event: 'stage', data: { stage: 'quality', text: '正在校验图像质量与拍摄角度…' } };
    await sleep(320);

    const work = runClassify({ imageUrls, demoCase: body.demoCase, hint: body.hint });

    yield { event: 'stage', data: { stage: 'detect', text: '正在检测问题主体并生成证据框…' } };
    await sleep(300);
    const result = await work;

    yield { event: 'stage', data: { stage: 'classify', text: '正在比对七类判定标准…' } };
    await sleep(260);

    for (const box of result.evidence) {
      yield { event: 'box', data: { box } };
    }
    if (result.findings.length > 1) {
      for (const f of result.findings) {
        for (const box of f.evidence) yield { event: 'box', data: { box, findingType: f.type } };
      }
    }

    yield { event: 'findings', data: { findings: result.findings, confidence: result.confidence, type: result.type } };
    if (result.candidates.length) {
      yield { event: 'candidates', data: { candidates: result.candidates, reason: result.reason } };
    }
    if (result.qualityFlags.length) {
      yield { event: 'quality', data: { flags: result.qualityFlags } };
    }
    await sleep(200);
    yield { event: 'result', data: { result } };
    yield { event: 'end', data: { latencyMs: result.latencyMs, model: result.model, degraded: result.degraded } };
  }

  return sseResponse(events());
}
