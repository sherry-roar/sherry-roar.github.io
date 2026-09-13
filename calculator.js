/** Historical quick presets, not a live policy feed. All bases and rates are editable. */
const preset = (u, f, extra = {}) => ({
  p: 8, m: 2, u, o: 0, f, medicalFixed: 0,
  socialMin: 0, socialMax: Number.MAX_SAFE_INTEGER,
  fundMin: 0, fundMax: Number.MAX_SAFE_INTEGER, ...extra,
});

export const cityPresets = {
  beijing: preset(0.5, 12, { socialMin: 7162, socialMax: 35811, fundMin: 2540, fundMax: 35811, medicalFixed: 3 }),
  shanghai: preset(0.5, 7), shenzhen: preset(0.2, 5), guangzhou: preset(0.2, 5),
  hangzhou: preset(0.5, 12), chengdu: preset(0.4, 6), nanjing: preset(0.5, 8), wuhan: preset(0.3, 8),
  custom: preset(0, 0, { p: 0, m: 0 }),
};

const brackets = [
  [36000, 0.03, 0], [144000, 0.10, 2520], [300000, 0.20, 16920],
  [420000, 0.25, 31920], [660000, 0.30, 52920], [960000, 0.35, 85920],
  [Infinity, 0.45, 181920],
];

export function annualTax(taxable) {
  if (!Number.isFinite(taxable)) throw new Error('应纳税所得额必须是有限数字');
  const amount = Math.max(0, taxable);
  const [, rate, deduction] = brackets.find(([limit]) => amount <= limit);
  return amount * rate - deduction;
}

export function bonusTax(amount) {
  if (!Number.isFinite(amount)) throw new Error('奖金必须是有限数字');
  if (amount <= 0) return 0;
  const [, rate, deduction] = brackets.find(([limit]) => amount <= limit);
  return amount * rate - deduction / 12;
}

export function rateOffer(hourly) {
  if (!Number.isFinite(hourly)) throw new Error('等效时薪必须是有限数字');
  if (hourly >= 200) return { label: '夯', comment: '等效回报很亮眼，再确认兑现条件和工作强度。' };
  if (hourly >= 120) return { label: '顶级', comment: '时间回报有竞争力，成长空间也值得一起看。' };
  if (hourly >= 70) return { label: '人上人', comment: '等效收入不错，关注奖金与权益的兑现比例。' };
  if (hourly >= 35) return { label: 'NPC', comment: '回报中规中矩，可以继续谈薪或争取更好的工时。' };
  return { label: '拉完了', comment: '按当前假设回报偏低，建议重新核对收入与时间成本。' };
}

export function calculate(input = {}) {
  const city = cityPresets[input.city ?? 'beijing'];
  if (!city) throw new Error('请选择有效城市');
  const number = (key, fallback = 0, max = Number.MAX_SAFE_INTEGER) => {
    const raw = input[key] ?? fallback;
    const value = Number(raw);
    if (raw === '' || (typeof raw === 'string' && !raw.trim()) || !Number.isFinite(value) || value < 0 || value > max) {
      throw new Error(`${key} 必须是 0 至 ${max} 之间的有效数字`);
    }
    return value;
  };
  const mode = (key, fallback, choices) => {
    const value = input[key] ?? fallback;
    if (!choices.includes(value)) throw new Error(`${key} 的选项无效`);
    return value;
  };
  const monthlyBase = number('monthlyBase');
  const salary = monthlyBase * number('salaryMonths', 12);
  const allowance = number('monthlyAllowance') * number('allowanceMonths', 12, 12);
  const bonus = number('annualBonus'), sign = number('signOn'), stock = number('stock');
  const option = number('option'), other = number('otherCash'), benefits = number('benefits');
  const months = number('contribMonths', 12, 12);
  const baseMode = mode('baseMode', 'salary', ['salary', 'custom']);
  const boundedBase = (name) => {
    const min = number(`${name}Min`, city[`${name}Min`]);
    const max = number(`${name}Max`, city[`${name}Max`]);
    if (min > max) throw new Error(`${name} 缴费基数下限不能大于上限`);
    const requested = baseMode === 'salary' ? monthlyBase : number(`${name}Base`, monthlyBase);
    return Math.min(max, Math.max(min, requested));
  };
  const appliedSocialBase = boundedBase('social'), appliedFundBase = boundedBase('fund');
  const contribution = (key, fallback, base = appliedSocialBase) => base * number(key, fallback, 100) / 100 * months;
  const pension = contribution('pensionRate', city.p);
  const medical = contribution('medicalRate', city.m) + number('medicalFixed', city.medicalFixed) * months;
  const unemployment = contribution('unemploymentRate', city.u);
  const otherSocial = contribution('otherSocialRate', city.o);
  const fund = contribution('fundRate', city.f, appliedFundBase);
  const socialTotal = pension + medical + unemployment + otherSocial + fund;
  const buckets = { comprehensive: salary + allowance, separate: 0, equity: 0, none: 0 };
  buckets[mode('bonusTax', 'separate', ['separate', 'comprehensive'])] += bonus;
  buckets[mode('signTax', 'comprehensive', ['comprehensive', 'none'])] += sign;
  buckets[mode('stockTax', 'equity', ['equity', 'comprehensive', 'none'])] += stock;
  buckets[mode('optionTax', 'equity', ['equity', 'comprehensive', 'none'])] += option;
  buckets[mode('otherTax', 'comprehensive', ['comprehensive', 'none'])] += other;
  const taxableComp = Math.max(0, buckets.comprehensive - 60000 - socialTotal - number('specialDeduction') - number('otherDeduction'));
  const taxComp = annualTax(taxableComp), taxBonus = bonusTax(buckets.separate), taxEquity = annualTax(buckets.equity);
  const taxTotal = taxComp + taxBonus + taxEquity;
  const nominalTC = salary + allowance + bonus + sign + stock + option + other + benefits;
  const adjustedTC = salary + allowance + bonus * number('bonusFactor', 1, 1)
    + sign * number('signFactor', 1, 1) + stock * number('stockFactor', 1, 1)
    + option * number('optionFactor', 0.3, 1) + other * number('otherFactor', 1, 1)
    + benefits * number('benefitFactor', 0.5, 1);
  const afterTaxValue = adjustedTC - taxTotal - socialTotal;
  const wd = number('weekdayDays', 5, 5), whours = number('weekdayHours', 8, 24);
  const wed = number('weekendDays', 0, 2), weh = number('weekendHours', 0, 24);
  if (wd + wed > 7) throw new Error('每周总工作天数不能超过 7 天');
  if ((wd > 0 && whours === 0) || (wed > 0 && weh === 0)) throw new Error('工作天数大于 0 时，每天工时必须大于 0');
  const regular = wd * Math.min(8, whours), overtime = wd * Math.max(0, whours - 8), weekend = wed * weh;
  const wh = { actual: regular + overtime + weekend, weighted: regular + 1.5 * overtime + 2 * weekend };
  if (wh.weighted <= 0) throw new Error('每周工时必须大于 0');
  const growth = number('growth', 1), locationFactor = number('locationFactor', 1);
  const timeFactor = 40 / wh.weighted;
  const eqPretax = adjustedTC * growth * locationFactor * timeFactor;
  const eqAfter = afterTaxValue * growth * locationFactor * timeFactor;
  const eqAfterHourly = eqAfter / (40 * 52);
  const result = { salary, allowance, bonus, sign, stock, option, other, benefits, nominalTC, adjustedTC,
    taxTotal, socialTotal, afterTaxValue, eqPretax, eqAfter, eqAfterHourly, wh,
    pension, medical, unemployment, otherSocial, fund, taxComp, taxBonus, taxEquity, taxableComp,
    appliedSocialBase, appliedFundBase, rating: rateOffer(eqAfterHourly) };
  if (Object.values(result).some(value => typeof value === 'number' && !Number.isFinite(value))) throw new Error('输入金额或系数过大，无法计算');
  return result;
}
