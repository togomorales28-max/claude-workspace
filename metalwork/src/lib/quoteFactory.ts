import { computeBudget } from '../domain/budget';
import { nowIso, repos, todayIso, uid } from '../data/repo';
import type { CutPlan, Quote, Settings } from '../data/types';
import { planToMaterialLines } from './cutPlan';

export function quoteSnapshot(q: Quote): Quote['snapshot'] {
  try {
    const t = computeBudget(q);
    return { cost: t.cost, profit: t.profit, total: t.total, weightKg: t.weightKg };
  } catch {
    return null;
  }
}

export async function createQuote(settings: Settings, patch: Partial<Quote> = {}): Promise<Quote> {
  const number = await repos.nextQuoteNumber();
  const b = settings.budget;
  const q: Quote = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    number, title: 'Trabajo de herrería', description: '', clientId: null, status: 'borrador',
    date: todayIso(), validDays: b.validDays, terms: b.terms, cutPlanId: null, pdfDetail: 'conceptos',
    materials: [],
    labor: [{ id: uid(), description: 'Fabricación y soldadura', mode: 'horas', workers: 1, hours: 0, rate: b.laborRate, amount: 0 }],
    expenses: [],
    wastePct: b.wastePct, profitPct: b.profitPct, profitMode: b.profitMode,
    ivaEnabled: b.ivaEnabled, ivaPct: b.ivaPct, roundTo: b.roundTo,
    snapshot: null,
    ...patch,
  };
  q.snapshot = quoteSnapshot(q);
  return repos.quotes.save(q);
}

export async function createQuoteFromPlan(plan: CutPlan, settings: Settings) {
  const { lines, warnings } = planToMaterialLines(plan);
  const quote = await createQuote(settings, {
    title: plan.name, description: plan.notes, clientId: plan.clientId, cutPlanId: plan.id, materials: lines,
  });
  return { quote, warnings };
}
