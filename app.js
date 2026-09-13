import { calculate, cityPresets } from './calculator.js';
const $ = id => document.getElementById(id);
const fmt = x => '¥ ' + Math.round(x).toLocaleString('zh-CN');
const wan = x => (x / 10000).toFixed(1) + ' 万';
const controls = [...document.querySelectorAll('input,select')];
const defaults = Object.fromEntries(controls.map(el => [el.id, el.value]));
let lastResult;
// Link the original form labels without duplicating business field definitions.
document.querySelectorAll('.field').forEach(field => {
  const label = field.querySelector('label');
  const control = field.querySelector('input,select');
  if (label && control) label.htmlFor = control.id;
});
document.querySelectorAll('.income-table tbody tr').forEach(row => {
  const name = row.querySelector('b').textContent;
  row.querySelectorAll('input,select').forEach((el, i) => el.setAttribute('aria-label', name + ['金额', '价值折算', '税务处理'][i]));
});
function calc() {
  let r;
  try {
    const input = Object.fromEntries(controls.map(el => [el.id, el.value]));
    r = calculate(input);
  } catch (error) {
    $('inputError').hidden = false;
    let message = error.message;
    for (const el of controls) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      message = message.replace(el.id, label?.textContent.trim() || el.getAttribute('aria-label') || el.id);
    }
    $('inputError').textContent = message;
    $('ratingLabel').textContent = '待完善';
    $('ratingComment').textContent = '请先修正输入，再查看这份 Offer 的点评。';
    $('copyBtn').disabled = true;
    document.querySelector('.grid').classList.add('invalid-results');
    lastResult = null;
    return;
  }
  $('inputError').hidden = true;
  $('copyBtn').disabled = false;
  document.querySelector('.grid').classList.remove('invalid-results');
  for (const id of ['socialBase','fundBase']) $(id).readOnly = $('baseMode').value === 'salary';
  if ($('baseMode').value === 'salary') {
    $('socialBase').value = r.appliedSocialBase;
    $('fundBase').value = r.appliedFundBase;
  }
  const {salary,allowance,bonus,sign,stock,option,other,benefits,nominalTC,adjustedTC,taxTotal,socialTotal,afterTaxValue,eqPretax,eqAfter,eqAfterHourly,wh,taxComp,taxBonus,taxEquity,pension,medical,unemployment,otherSocial,fund} = r;
  $('nominalTC').textContent = wan(nominalTC);
  $('adjustedTC').textContent = wan(adjustedTC);
  $('taxTotal').textContent = wan(taxTotal);
  $('socialTotal').textContent = wan(socialTotal);
  $('afterTaxValue').textContent = wan(afterTaxValue);
  $('monthlyAfter').textContent = fmt(afterTaxValue/12);

  $('sumSalary').textContent = fmt(salary);
  $('sumAllowance').textContent = fmt(allowance);
  $('sumBonus').textContent = fmt(bonus);
  $('sumSign').textContent = fmt(sign);
  $('sumStock').textContent = fmt(stock);
  $('sumOption').textContent = fmt(option);
  $('sumOther').textContent = fmt(other);
  $('sumBenefits').textContent = fmt(benefits);

  $('taxComp').textContent = fmt(taxComp);
  $('taxBonus').textContent = fmt(taxBonus);
  $('taxEquity').textContent = fmt(taxEquity);
  $('pension').textContent = fmt(pension);
  $('medical').textContent = fmt(medical);
  $('unemployment').textContent = fmt(unemployment);
  $('otherSocial').textContent = fmt(otherSocial);
  $('fund').textContent = fmt(fund);

  $('actualWeekly').textContent = wh.actual.toFixed(1)+' h';
  $('weightedWeekly').textContent = wh.weighted.toFixed(1)+' h';
  $('eqPretax').textContent = wan(eqPretax);
  $('eqAfterTax').textContent = '¥ '+wan(eqAfter);
  $('eqAfterTax2').textContent = wan(eqAfter);
  $('eqAfterHourly').textContent = fmt(eqAfterHourly) + ' / 小时';

  $('ratingLabel').textContent = r.rating.label;
  $('ratingComment').textContent = r.rating.comment;
  $('appliedBases').textContent = `实际社保基数：${fmt(r.appliedSocialBase)} / 月；公积金基数：${fmt(r.appliedFundBase)} / 月。`;
  lastResult = r;
}

function applyCity() {
  const preset = cityPresets[$('city').value];
  if (preset && $('city').value !== 'custom') {
    const rateFields = {pensionRate:'p', medicalRate:'m', unemploymentRate:'u', otherSocialRate:'o', fundRate:'f'};
    for (const [field, key] of Object.entries(rateFields)) $(field).value = preset[key];
    for (const key of ['socialMin','socialMax','fundMin','fundMax','medicalFixed']) $(key).value = preset[key];
  }
  calc();
}
controls.forEach(el => el.addEventListener('input', () => el.id === 'city' ? applyCity() : calc()));
$('city').addEventListener('change', applyCity);
$('resetBtn').addEventListener('click', () => {
  for (const el of controls) el.value = defaults[el.id];
  applyCity();
});
$('copyBtn').addEventListener('click',async()=>{
  const r=lastResult;
  if (!r) return;
  const city=$('city').options[$('city').selectedIndex].text;
  const text =
`Offer 计算结果
城市：${city}
点评：${r.rating.label} · ${r.rating.comment}
实际月缴费基数：社保 ${fmt(r.appliedSocialBase)}，公积金 ${fmt(r.appliedFundBase)}
缴费参数为可修改参考值，请核对实际年度与单位口径。
固定工资：${wan(r.salary)}
年终奖：${wan(r.bonus)}
签字费：${wan(r.sign)}
股票/RSU：${wan(r.stock)}
期权：${wan(r.option)}
名义税前总包：${wan(r.nominalTC)}
价值折算总包：${wan(r.adjustedTC)}
个人所得税：${wan(r.taxTotal)}
个人五险一金：${wan(r.socialTotal)}
预计税后价值：${wan(r.afterTaxValue)}
实际周工时：${r.wh.actual.toFixed(1)} h
加权周工时：${r.wh.weighted.toFixed(1)} h
税前855等效：${wan(r.eqPretax)}
税后855等效：${wan(r.eqAfter)}
等效税后时薪：${fmt(r.eqAfterHourly)}/小时`;
  try{
    await navigator.clipboard.writeText(text);
    const old=$('copyBtn').textContent;
    $('copyBtn').textContent='已复制';
    setTimeout(()=>$('copyBtn').textContent=old,1200);
  }catch(e){alert(text);}
});

applyCity();
