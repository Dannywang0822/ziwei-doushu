'use server';

import { buildHemingExport, buildNatalExport } from '@/lib/ziwei/chart-export';
import type { ZiweiChart } from '@/lib/ziwei/types';

/** 把已经排好的命盘收成 Markdown。不调用模型。 */
export async function exportNatalChartFile(chart: ZiweiChart) {
  return buildNatalExport(chart);
}

/** 把两张已经排好的盘收成一份合盘 Markdown。不调用模型。 */
export async function exportHemingChartFile(chartA: ZiweiChart, chartB: ZiweiChart) {
  return buildHemingExport(chartA, chartB);
}
