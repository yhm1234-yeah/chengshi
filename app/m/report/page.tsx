'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Upload,
  Wand2,
  X,
  Info,
  ShieldCheck
} from 'lucide-react';
import { EvidencePhoto } from '@/components/EvidencePhoto';
import { CityMap } from '@/components/CityMap';
import { ConfidenceBar, TypeBadge, SeverityBadge } from '@/components/ui/kit';
import { toast } from '@/components/ui/toast';
import { apiGet, apiPost, streamPost } from '@/lib/client';
import type { ClassifyResult, EvidenceBox, FindingDraft, ProblemType, QualityFlag } from '@/domain/types';
import { DEPARTMENT_BASE, GRIDS, SEVERITY_META, TYPE_META } from '@/domain/constants';
import { cn } from '@/lib/utils';

const STEPS = ['现场照片', 'AI 识别', '位置描述', '分派预览', '确认提交'];

const SAMPLES: { key: string; label: string; url: string; desc: string; tone: string }[] = [
  { key: 'manhole', label: '破损井盖', url: '/images/manhole.jpg', desc: '紧急 · 清晰单问题', tone: 'bg-danger-500' },
  { key: 'dual', label: '井盖 + 违停', url: '/images/dual.jpg', desc: '双问题 · 自动拆单', tone: 'bg-brand-500' },
  { key: 'parking', label: '违停占道', url: '/images/parking.jpg', desc: '较重 · 交通类', tone: 'bg-amber-500' },
  { key: 'garbage', label: '垃圾堆积', url: '/images/garbage.jpg', desc: '较重 · 环卫类', tone: 'bg-teal-500' },
  { key: 'flood', label: '道路积水', url: '/images/flood.jpg', desc: '紧急 · 水务类', tone: 'bg-sky-500' },
  { key: 'lowconfidence', label: '模糊画面', url: '/images/lowconfidence.jpg', desc: '低置信 · 转人工', tone: 'bg-ink-400' }
];

interface Photo {
  url: string;
  width: number;
  height: number;
  demoCase?: string;
  label?: string;
}

function nearestDistrict(lng: number, lat: number) {
  const grid = GRIDS.reduce((best, g) => {
    const d = Math.hypot(g.center.lng - lng, g.center.lat - lat);
    const bd = Math.hypot(best.center.lng - lng, best.center.lat - lat);
    return d < bd ? g : best;
  }, GRIDS[0]);
  return grid;
}

function uniqBoxes(boxes: EvidenceBox[]): EvidenceBox[] {
  const seen = new Set<string>();
  return boxes.filter((b) => {
    const key = `${b.x}-${b.y}-${b.w}-${b.h}-${b.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ReportPage() {
  const router = useRouter();
  const params = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [stageText, setStageText] = useState('');
  const [boxes, setBoxes] = useState<EvidenceBox[]>([]);
  const [qualityFlags, setQualityFlags] = useState<QualityFlag[]>([]);
  const [candidates, setCandidates] = useState<ClassifyResult['candidates']>([]);
  const [classification, setClassification] = useState<ClassifyResult | null>(null);
  const [selectedType, setSelectedType] = useState<ProblemType | null>(null);

  const [lng, setLng] = useState(GRIDS[0].center.lng);
  const [lat, setLat] = useState(GRIDS[0].center.lat);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [normText, setNormText] = useState('');
  const [normLoading, setNormLoading] = useState(false);
  const [hints, setHints] = useState<{ text: string; type: string; lng: number; lat: number }[]>([]);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const grid = useMemo(() => nearestDistrict(lng, lat), [lng, lat]);
  const lowConfidence = Boolean(classification && (classification.confidence < 0.75 || classification.degraded));

  const demoCase = params.get('demo');
  useEffect(() => {
    if (!demoCase) return;
    const sample = SAMPLES.find((s) => s.key === demoCase);
    if (sample) {
      const p = { url: sample.url, width: 1280, height: 960, demoCase: sample.key, label: sample.label };
      setPhotos([p]);
      void startClassify([p]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoCase]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    if (photos.length + files.length > 3) return toast('最多上传 3 张照片', 'error');
    const items: Photo[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 8_000_000) {
        toast(`${file.name} 超过 8MB，请压缩后上传`, 'error');
        continue;
      }
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const size = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 1280, h: 960 });
        img.src = url;
      });
      items.push({ url, width: size.w, height: size.h, label: file.name });
    }
    if (items.length) {
      setPhotos((prev) => [...prev, ...items].slice(0, 3));
      toast('照片已添加', 'success', '下一步开始 AI 识别');
    }
  }

  function pickSample(s: (typeof SAMPLES)[number]) {
    const p: Photo = { url: s.url, width: 1280, height: 960, demoCase: s.key, label: s.label };
    setPhotos([p]);
    setStep(2);
    void startClassify([p]);
  }

  async function startClassify(list: Photo[]) {
    if (!list.length) return;
    abortRef.current?.();
    setScanning(true);
    setClassification(null);
    setSelectedType(null);
    setBoxes([]);
    setCandidates([]);
    setQualityFlags([]);
    setStageText('准备识别…');
    const collected: EvidenceBox[] = [];

    abortRef.current = await streamPost(
      '/api/ai/classify',
      { imageUrls: list.map((p) => p.url), demoCase: list[0]?.demoCase, hint: description },
      (msg) => {
        if (msg.event === 'stage') setStageText(String(msg.data.text ?? ''));
        else if (msg.event === 'box') {
          const box = msg.data.box as EvidenceBox;
          collected.push(box);
          setBoxes(uniqBoxes(collected));
        } else if (msg.event === 'quality') setQualityFlags(msg.data.flags as QualityFlag[]);
        else if (msg.event === 'candidates') setCandidates(msg.data.candidates as ClassifyResult['candidates']);
        else if (msg.event === 'result') {
          const result = msg.data.result as ClassifyResult;
          setClassification(result);
          setQualityFlags(result.qualityFlags ?? []);
          setCandidates(result.candidates ?? []);
          const allBoxes = [...(result.evidence ?? []), ...result.findings.flatMap((f) => f.evidence ?? [])];
          setBoxes(uniqBoxes(allBoxes.length ? allBoxes : collected));
          if (result.confidence >= 0.75 && !result.degraded) setSelectedType(null);
        } else if (msg.event === 'error') {
          toast(String(msg.data.message ?? '识别失败'), 'error');
        }
      },
      () => setScanning(false)
    );
  }

  async function generateText() {
    if (!classification && !selectedType) return;
    setNormLoading(true);
    setNormText('');
    const findings: FindingDraft[] = classification?.findings ?? [
      { type: selectedType ?? 'T07', severity: 'medium', confidence: 0.5, evidence: [], desc: selectedType ? TYPE_META[selectedType].label : '待研判' }
    ];
    await streamPost(
      '/api/ai/describe',
      {
        raw: description,
        address: address || `${grid.district}${grid.street}`,
        district: grid.district,
        findings,
        severity: classification?.severity ?? 'medium',
        confidence: classification?.confidence ?? 0.5
      },
      (msg) => {
        if (msg.event === 'delta') setNormText((prev) => prev + String(msg.data.text ?? ''));
        else if (msg.event === 'result') setNormText(String(msg.data.text ?? ''));
        else if (msg.event === 'error') toast(String(msg.data.message ?? '生成失败'), 'error');
      },
      () => setNormLoading(false)
    );
  }

  async function loadHints() {
    try {
      const d = await apiGet<{ hints: { text: string; type: string; lng: number; lat: number }[] }>(
        `/api/ai/location-hints?lng=${lng}&lat=${lat}`
      );
      setHints(d.hints);
      toast('已从照片中提取 2 条定位线索', 'success');
    } catch {
      toast('定位线索提取失败', 'error');
    }
  }

  async function submit() {
    if (!agreed) return toast('请先确认照片真实性', 'error');
    if (!classification && !selectedType) return toast('请先完成 AI 识别', 'error');
    setSubmitting(true);
    try {
      const res = await apiPost<{ code: string; detail: unknown }>('/api/report', {
        images: photos.map((p) => ({ url: p.url, width: p.width, height: p.height, demoCase: p.demoCase })),
        description: (normText || description).slice(0, 500),
        lng,
        lat,
        address: address || undefined,
        demoCase: photos[0]?.demoCase,
        runId: classification?.runId,
        selectedType: selectedType ?? undefined,
        clientToken: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });
      toast('上报成功', 'success', `工单编号 ${res.code}`);
      router.push(`/m/tickets/${res.code}?new=1`);
    } catch (err) {
      toast(err instanceof Error ? err.message : '提交失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const findings = classification?.findings ?? [];
  const previewItems = findings.length
    ? findings
    : selectedType
      ? [{ type: selectedType, severity: 'medium' as const, confidence: 0.5, evidence: [], desc: TYPE_META[selectedType].label }]
      : [];
  const canNext = step === 1 ? photos.length > 0 : step === 2 ? Boolean(classification) && (!lowConfidence || selectedType) : true;

  return (
    <div className="min-h-full pb-4">
      {/* 顶部 */}
      <div className="sticky top-0 z-30 bg-white/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={() => (step > 1 ? setStep(step - 1) : router.push('/m'))} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-600">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="text-[15px] font-semibold text-ink-900">随手拍上报</div>
          <Link href="/m/chat" className="text-[11px] text-ink-400">需要帮助</Link>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-1">
              <div className="flex flex-1 flex-col gap-1">
                <div className={cn('h-1 rounded-full transition-all', i + 1 <= step ? 'bg-brand-500' : 'bg-ink-200')} />
                <span className={cn('text-[9px]', i + 1 === step ? 'font-medium text-brand-600' : 'text-ink-400')}>{i + 1}. {s}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pt-4">
        {/* Step 1 */}
        {step === 1 ? (
          <div className="animate-rise">
            <div className="text-[20px] font-semibold text-ink-900">先拍一张现场照片</div>
            <div className="mt-1 text-[12px] leading-relaxed text-ink-500">
              拍清楚问题主体，不用拍摄人脸、车牌等敏感信息。最多 3 张，支持 JPG / PNG。
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 py-9 transition active:scale-[.99]"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">
                <Camera className="h-5 w-5" />
              </div>
              <div className="text-[14px] font-semibold text-brand-800">拍照 / 从相册选择</div>
              <div className="text-[10px] text-brand-500/70">建议开启定位，AI 将结合位置判断责任网格</div>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

            {photos.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {photos.map((p, i) => (
                  <div key={`${p.url.slice(0, 30)}-${i}`} className="relative aspect-square overflow-hidden rounded-xl bg-ink-100">
                    <img src={p.url} alt={p.label ?? '现场照片'} className="h-full w-full object-cover" />
                    <button
                      onClick={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 3 ? (
                  <button onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border border-dashed border-ink-200 bg-white text-ink-400">
                    <Plus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between">
              <div className="text-[12px] font-semibold text-ink-700">没有现场照片？试试示例</div>
              <span className="text-[10px] text-ink-400">共 6 个场景</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {SAMPLES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => pickSample(s)}
                  className="group overflow-hidden rounded-xl border border-ink-200/70 bg-white text-left shadow-soft transition active:scale-[.98]"
                >
                  <div className="relative h-[92px]">
                    <img src={s.url} alt={s.label} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    <span className={cn('absolute left-2 top-2 h-1.5 w-1.5 rounded-full', s.tone)} />
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] font-semibold text-ink-800">{s.label}</div>
                    <div className="mt-0.5 text-[9px] text-ink-400">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-ink-100/70 p-3 text-[10px] leading-relaxed text-ink-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
              示例照片为演示用虚构场景，不包含真实车牌与人脸。您可以放心体验完整流程。
            </div>
          </div>
        ) : null}

        {/* Step 2 */}
        {step === 2 ? (
          <div className="animate-rise">
            <div className="flex items-center justify-between">
              <div className="text-[20px] font-semibold text-ink-900">AI 正在看这张照片</div>
              {scanning ? (
                <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] text-brand-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> 识别中
                </span>
              ) : classification ? (
                <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] text-teal-600">
                  <Check className="h-3 w-3" /> 识别完成
                </span>
              ) : null}
            </div>

            {photos[0] ? (
              <EvidencePhoto
                src={photos[0].url}
                alt="现场照片"
                scanning={scanning}
                boxes={boxes}
                qualityFlags={qualityFlags}
                className="mt-3 aspect-[4/3] w-full"
              />
            ) : null}

            {scanning && !classification ? (
              <div className="mt-3 rounded-2xl border border-ink-200/70 bg-white p-4">
                <div className="flex items-center gap-2 text-[12px] font-medium text-ink-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-500" /> {stageText || '正在分析…'}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full w-1/2 animate-shimmer rounded-full bg-[linear-gradient(90deg,#EEF1FF,#4C5DF0,#EEF1FF)] bg-[length:200%_100%]" />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1.5 text-[9px] text-ink-400">
                  <span>① 画质与角度</span>
                  <span>② 问题主体检测</span>
                  <span>③ 七类标准比对</span>
                </div>
              </div>
            ) : null}

            {classification ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-ink-200/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={selectedType ?? classification.type} />
                      <SeverityBadge severity={classification.severity} />
                    </div>
                    <span className="num text-[11px] text-ink-400">{classification.latencyMs}ms</span>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[10px] text-ink-400">
                      <span>AI 置信度</span>
                      <span>{classification.degraded ? '已降级' : classification.confidence >= 0.75 ? '可直接立案' : '低于闸门 → 人工复核'}</span>
                    </div>
                    <ConfidenceBar value={selectedType ? 0.5 : classification.confidence} />
                  </div>
                  {classification.reason ? (
                    <div className="mt-3 rounded-xl bg-ink-50 p-3 text-[11px] leading-relaxed text-ink-600">
                      <span className="mr-1 font-semibold text-ink-800">判定依据：</span>
                      {classification.reason}
                    </div>
                  ) : null}
                </div>

                {findings.length > 1 ? (
                  <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-800">
                      <Sparkles className="h-3.5 w-3.5" /> 识别到 {findings.length} 个独立问题
                    </div>
                    <div className="mt-2 space-y-2">
                      {findings.map((f, i) => (
                        <div key={`${f.type}-${i}`} className="flex items-start justify-between gap-2 rounded-xl bg-white p-2.5">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="num text-[9px] text-brand-400">#{i + 1}</span>
                              <TypeBadge type={f.type} size="sm" />
                            </div>
                            <div className="mt-1 text-[10px] leading-relaxed text-ink-500">{f.desc}</div>
                          </div>
                          <span className="num text-[10px] text-teal-600">{Math.round(f.confidence * 100)}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2.5 text-[9px] leading-relaxed text-brand-700/70">
                      多问题将自动拆单，分别派发给不同承办部门，避免职责混派。
                    </div>
                  </div>
                ) : null}

                {lowConfidence ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="text-[12px] font-semibold text-amber-800">置信度不足，请您帮 AI 确认类型</div>
                    <div className="mt-1 text-[10px] leading-relaxed text-amber-700/80">
                      系统不会在低置信度下自动定责。请选择最接近的类型，工单将进入人工复核。
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {(candidates.length ? candidates.map((c) => ({ type: c.type, label: c.label, score: c.score })) : Object.values(TYPE_META).map((t) => ({ type: t.code, label: t.label, score: 0 }))).map((c) => (
                        <button
                          key={c.type}
                          onClick={() => setSelectedType(c.type as ProblemType)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1.5 text-[11px] transition',
                            selectedType === c.type
                              ? 'border-brand-500 bg-brand-500 text-white'
                              : 'border-ink-200 bg-white text-ink-600'
                          )}
                        >
                          {c.label}
                          {c.score ? <span className="ml-1 opacity-60">{Math.round(c.score * 100)}%</span> : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 rounded-xl border border-ink-200/70 bg-white p-2.5 text-[10px] text-ink-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
                  AI 只提供判定建议，最终由网格坐席复核确认，责任可追溯。
                </div>
              </div>
            ) : null}

            {!scanning && !classification ? (
              <button onClick={() => startClassify(photos)} className="btn-primary mt-4 w-full">
                重新识别
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Step 3 */}
        {step === 3 ? (
          <div className="animate-rise">
            <div className="text-[20px] font-semibold text-ink-900">确认位置，补充描述</div>
            <div className="mt-1 text-[12px] text-ink-500">位置决定责任网格，请尽量准确。</div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
              <CityMap className="h-[190px]" points={[]} activePoint={{ lng, lat }} onPick={(nlng, nlat) => { setLng(nlng); setLat(nlat); }} showLabels={false} />
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-600">
                  <MapPin className="h-3.5 w-3.5 text-brand-500" />
                  {grid.district} · {grid.street} · {grid.code}
                </div>
                <span className="num text-[9px] text-ink-400">{lng.toFixed(5)}, {lat.toFixed(5)}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-500">
                <span>详细地址</span>
                <button onClick={loadHints} className="flex items-center gap-1 text-brand-600">
                  <Wand2 className="h-3 w-3" /> 从照片提取线索
                </button>
              </div>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例如：青梧路 128 号附近" className="field" />
              {hints.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {hints.map((h) => (
                    <button
                      key={h.text}
                      onClick={() => {
                        setAddress(h.text);
                        setLng(h.lng);
                        setLat(h.lat);
                      }}
                      className="rounded-lg border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] text-brand-700"
                    >
                      {h.text}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-ink-500">
                <span>现场描述（选填）</span>
                <span className="num text-[10px] text-ink-300">{description.length}/500</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="简单说说看到的情况，例如：井盖裂了，晚上骑车差点摔倒。"
                className="field resize-none"
              />
              <button onClick={generateText} disabled={normLoading} className="btn-soft mt-2 w-full">
                {normLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {normLoading ? 'AI 正在规范化…' : 'AI 帮我写成规范描述'}
              </button>
            </div>

            {normText ? (
              <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-teal-700">
                    <Sparkles className="h-3.5 w-3.5" /> AI 规范描述
                  </div>
                  <button
                    onClick={() => {
                      setDescription(normText);
                      toast('已采用规范描述', 'success');
                    }}
                    className="text-[10px] text-teal-700 underline underline-offset-2"
                  >
                    采用
                  </button>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-ink-700">{normText}</div>
                {normLoading ? <span className="mt-1 inline-block h-3 w-1 animate-breathe bg-teal-500" /> : null}
              </div>
            ) : null}

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-ink-100/70 p-3 text-[10px] leading-relaxed text-ink-500">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
              描述中的手机号、身份证号会自动脱敏，不会进入工单正文。
            </div>
          </div>
        ) : null}

        {/* Step 4 */}
        {step === 4 ? (
          <div className="animate-rise">
            <div className="text-[20px] font-semibold text-ink-900">AI 已准备好分派方案</div>
            <div className="mt-1 text-[12px] text-ink-500">以下方案将在提交后由 Agent 正式执行，并经坐席复核。</div>

            <div className="mt-3 space-y-2.5">
              {(previewItems.length ? previewItems : [{ type: 'T07' as ProblemType, severity: 'medium' as const, confidence: 0.5, evidence: [], desc: '' }]).map((f, i) => (
                <div key={`${f.type}-${i}`} className="rounded-2xl border border-ink-200/70 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="num grid h-5 w-5 place-items-center rounded-md bg-brand-50 text-[10px] font-semibold text-brand-600">{i + 1}</span>
                      <TypeBadge type={f.type} />
                    </div>
                    <SeverityBadge severity={f.severity} size="sm" />
                  </div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">承办部门</span>
                      <span className="font-medium text-ink-800">{grid.district}{DEPARTMENT_BASE[f.type]}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">承诺时限</span>
                      <span className="font-medium text-ink-800">{SEVERITY_META[f.severity].slaHours} 小时</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-ink-400">责任网格</span>
                      <span className="num text-ink-700">{grid.code}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl bg-screen-bg p-4 text-white">
              <div className="flex items-center gap-1.5 text-[11px] text-screen-cyan">
                <Sparkles className="h-3.5 w-3.5" /> Agent 执行计划
              </div>
              <div className="mt-2.5 space-y-1.5">
                {[
                  '感知：读取工单与照片证据',
                  '规划：判断是否拆单',
                  '工具：辖区匹配 + 职责检索（RAG）',
                  '工具：网格负载查询（MCP）',
                  '决策：生成分派方案与时限',
                  '工具：派单 + 督办提醒（MCP）',
                  '反思：一致性自检并提交复核'
                ].map((s, i) => (
                  <div key={s} className="flex items-center gap-2 text-[10px] text-slate-300">
                    <span className="num w-4 text-screen-cyan/60">{String(i + 1).padStart(2, '0')}</span>
                    {s}
                  </div>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-screen-line bg-[#07101F] px-2.5 py-2 font-mono text-[9px] leading-relaxed text-screen-lime/80">
                gate: confidence ≥ 0.75 → auto file; review: human-in-the-loop; split: ≥ 0.7
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              本方案为 AI 建议。网格坐席可在复核台确认、改派或驳回；紧急工单采用先派后审并 100% 强制复审。
            </div>
          </div>
        ) : null}

        {/* Step 5 */}
        {step === 5 ? (
          <div className="animate-rise">
            <div className="text-[20px] font-semibold text-ink-900">确认信息并提交</div>
            <div className="mt-1 text-[12px] text-ink-500">提交后将生成工单编号，可在「工单」中实时查看进度。</div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-ink-200/70 bg-white">
              {photos[0] ? <img src={photos[0].url} alt="现场照片" className="h-[150px] w-full object-cover" /> : null}
              <div className="space-y-2.5 p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(previewItems.length ? previewItems : []).map((f) => (
                    <TypeBadge key={f.type} type={f.type} size="sm" />
                  ))}
                  {selectedType ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">市民确认类型</span> : null}
                </div>
                <div className="text-[13px] font-semibold text-ink-900">{address || `${grid.district}${grid.street}附近`}</div>
                <div className="text-[11px] leading-relaxed text-ink-500">{normText || description || '市民未补充文字描述。'}</div>
                <div className="divider" />
                <div className="flex items-center justify-between text-[10px] text-ink-400">
                  <span>承办部门</span>
                  <span className="font-medium text-ink-700">{grid.district}{DEPARTMENT_BASE[previewItems[0]?.type ?? 'T07']}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-ink-400">
                  <span>预计响应</span>
                  <span className="font-medium text-ink-700">{SEVERITY_META[previewItems[0]?.severity ?? 'medium'].slaHours} 小时内到场</span>
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-white p-3.5 shadow-soft">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-500" />
              <span className="text-[10px] leading-relaxed text-ink-500">
                我确认照片为本人拍摄的真实现场，未提交虚假信息；知悉恶意上报将影响信用分。
              </span>
            </label>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-teal-50 px-3.5 py-2.5 text-[11px] text-teal-700">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> 提交成功预计获得 5 积分
              </span>
              <span className="num font-semibold">+5</span>
            </div>

            <button
              onClick={submit}
              disabled={submitting || !agreed || (!classification && !selectedType)}
              className="btn-primary mt-4 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting
                ? '提交中…'
                : !agreed
                  ? '请先勾选照片真实性承诺'
                  : !classification && !selectedType
                    ? 'AI 识别未完成，请返回重试'
                    : '确认提交工单'}
            </button>
          </div>
        ) : null}
      </div>

      {/* 底部按钮 */}
      {step < 5 ? (
        <div className="sticky bottom-0 z-20 mt-5 border-t border-ink-200/70 bg-white/95 px-5 py-3 backdrop-blur">
          <button
            onClick={() => {
              if (step === 1) {
                if (!photos.length) return toast('请先选择照片', 'error');
                setStep(2);
                startClassify(photos);
              } else if (step === 2) {
                if (!canNext) return toast('请先完成 AI 识别', 'error');
                setStep(3);
              } else if (step === 3) {
                setStep(4);
              } else if (step === 4) {
                setStep(5);
              }
            }}
            disabled={step === 2 && scanning}
            className="btn-primary w-full"
          >
            {step === 1 ? '下一步：AI 识别' : step === 2 ? '下一步：确认位置' : step === 3 ? '下一步：查看分派方案' : '下一步：确认提交'}
            <ArrowRight className="h-4 w-4" />
          </button>
          {step === 2 && lowConfidence && !selectedType ? (
            <div className="mt-2 text-center text-[10px] text-amber-600">请先选择问题类型</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
