'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

type EChartsOption = Record<string, unknown>;

export function EChart({ option, className, height = 240, dark = false }: { option: EChartsOption; className?: string; height?: number; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let instance: { setOption: (o: EChartsOption, notMerge?: boolean) => void; resize: () => void; dispose: () => void } | null = null;
    let disposed = false;

    const init = async () => {
      const echarts = await import('echarts');
      if (disposed || !ref.current) return;
      instance = echarts.init(ref.current, undefined, { renderer: 'canvas' });
      instance.setOption(option);
    };
    init();

    const onResize = () => instance?.resize();
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(() => instance?.resize());
    if (ref.current) ro.observe(ref.current);

    return () => {
      disposed = true;
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      instance?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let instance: { setOption: (o: EChartsOption, notMerge?: boolean) => void } | null = null;
    const apply = async () => {
      const echarts = await import('echarts');
      if (ref.current) {
        const existing = echarts.getInstanceByDom(ref.current);
        if (existing) {
          instance = existing;
          instance.setOption(option);
        }
      }
    };
    apply();
  }, [option]);

  return (
    <div
      ref={ref}
      className={cn('w-full', className)}
      style={{ height, background: dark ? 'transparent' : undefined }}
    />
  );
}

export function lineOption(data: { date: string; reports: number; closed: number }[], dark = false): EChartsOption {
  return {
    grid: { left: 34, right: 16, top: 24, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: dark ? 'rgba(10,20,36,.92)' : 'rgba(255,255,255,.96)',
      borderColor: dark ? '#18304F' : '#E6EAF2',
      textStyle: { color: dark ? '#D8E7FB' : '#101828', fontSize: 11 }
    },
    legend: {
      right: 0,
      top: 0,
      icon: 'circle',
      itemWidth: 6,
      itemHeight: 6,
      textStyle: { color: dark ? 'rgba(160,190,230,.7)' : '#667085', fontSize: 11 }
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.date.slice(5)),
      axisLine: { lineStyle: { color: dark ? 'rgba(54,229,255,.15)' : '#E6EAF2' } },
      axisTick: { show: false },
      axisLabel: { color: dark ? 'rgba(160,190,230,.55)' : '#98A2B3', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: dark ? 'rgba(54,229,255,.08)' : '#F1F4F9' } },
      axisLabel: { color: dark ? 'rgba(160,190,230,.5)' : '#98A2B3', fontSize: 10 }
    },
    series: [
      {
        name: '上报',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: data.map((d) => d.reports),
        lineStyle: { width: 2, color: '#4C5DF0' },
        itemStyle: { color: '#4C5DF0' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(76,93,240,.22)' },
              { offset: 1, color: 'rgba(76,93,240,0)' }
            ]
          }
        }
      },
      {
        name: '办结',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        data: data.map((d) => d.closed),
        lineStyle: { width: 2, color: '#12A38F' },
        itemStyle: { color: '#12A38F' }
      }
    ]
  };
}

export function barOption(data: { label: string; count: number; color?: string }[], dark = false): EChartsOption {
  return {
    grid: { left: 8, right: 28, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: dark ? 'rgba(160,190,230,.75)' : '#475467', fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.count,
          itemStyle: { color: d.color ?? '#4C5DF0', borderRadius: [0, 6, 6, 0] }
        })),
        barWidth: 10,
        label: { show: true, position: 'right', color: dark ? 'rgba(160,190,230,.7)' : '#98A2B3', fontSize: 10 }
      }
    ]
  };
}

export function donutOption(data: { label: string; count: number; color: string }[], dark = false): EChartsOption {
  return {
    tooltip: { trigger: 'item' },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'middle',
      icon: 'circle',
      itemWidth: 7,
      itemHeight: 7,
      textStyle: { color: dark ? 'rgba(190,215,245,.75)' : '#475467', fontSize: 11 }
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '76%'],
        center: ['34%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: dark ? '#081120' : '#fff', borderWidth: 2 },
        label: { show: false },
        data: data.map((d) => ({ name: d.label, value: d.count, itemStyle: { color: d.color } }))
      }
    ]
  };
}
