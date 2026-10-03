import type { HistoryStats } from './client-history';

export type DealQuality = {
  state: 'building' | 'excellent' | 'good' | 'normal' | 'high';
  title: string;
  detail: string;
  score?: number;
  vsAveragePct?: number;
};

function clamp(value:number,min:number,max:number){
  return Math.max(min,Math.min(max,value));
}

export function assessDeal(history: HistoryStats | null, currentPrice: number): DealQuality {
  if (!history || history.samples < 3 || !Number.isFinite(currentPrice) || currentPrice <= 0) {
    return {
      state:'building',
      title:'Árhistorika épül',
      detail:'Legalább 3 külön napi mérés után értékeljük az árat.'
    };
  }

  const vsAveragePct = Math.round(((currentPrice - history.average) / history.average) * 100);
  const range = Math.max(1, history.maximum - history.minimum);
  const rangePosition = clamp((currentPrice - history.minimum) / range, 0, 1);
  const score = clamp(Math.round(100 - rangePosition * 45 - Math.max(0,vsAveragePct) * 1.5), 35, 100);

  if (currentPrice <= history.minimum || vsAveragePct <= -12) {
    return {
      state:'excellent',
      title:'Kiemelkedően kedvező',
      detail:`${Math.abs(vsAveragePct)}%-kal a ${history.samples} mért nap átlaga alatt.`,
      score,
      vsAveragePct
    };
  }

  if (vsAveragePct <= -4) {
    return {
      state:'good',
      title:'Kedvezőbb a szokásosnál',
      detail:`${Math.abs(vsAveragePct)}%-kal a mért átlag alatt.`,
      score,
      vsAveragePct
    };
  }

  if (vsAveragePct <= 5) {
    return {
      state:'normal',
      title:'Átlagos árszint',
      detail:'A mostani ár közel van a saját mért átlaghoz.',
      score,
      vsAveragePct
    };
  }

  return {
    state:'high',
    title:'Nem különösebben olcsó',
    detail:`${vsAveragePct}%-kal a saját mért átlag felett.`,
    score,
    vsAveragePct
  };
}
