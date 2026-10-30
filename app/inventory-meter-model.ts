/** Fields transcribed from Aladtec Meter Weekly Inspection, form 458. */
export type MeterTemplate = { version: 1; title: string; instructions: string; source: string };
export type MeterResponse = {
  inspectionDate: string; meterId: string; batteryCharge: string; stationLights: string[];
  actions: string[]; endOfLife: string; sensitOperational: string; sensitLowBattery: string;
  memberName: string; notes: string;
};
export const meterChoices = {
  batteryCharge: [['yes','At least 75% charged'],['no','Below 75% charged']],
  stationLights: [['green','Both LED rings green'],['yellow','At least one yellow LED ring'],['red','At least one red LED ring']],
  actions: [['bumped','Meter bumped'],['calibrated','Meter calibrated'],['failed','Meter failed bump and calibration']],
  endOfLife: [['none','No blinking heart'],['orange','Yes — orange blinking heart'],['red','Yes — red blinking heart']],
  sensitOperational: [['yes','Powered on and operational'],['no','Not operational']],
  sensitLowBattery: [['no','No low battery indication'],['yes','Low battery — change batteries']],
} as const;
export const emptyMeterResponse = (): MeterResponse => ({ inspectionDate:'',meterId:'',batteryCharge:'',stationLights:[],actions:[],endOfLife:'',sensitOperational:'',sensitLowBattery:'',memberName:'',notes:'' });
function object(text: unknown): Record<string, unknown> | null {
  try { const value = typeof text === 'string' ? JSON.parse(text) : text; return value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch { return null; }
}
export function meterTemplate(text: unknown): MeterTemplate | null {
  const value = object(text);
  return value?.version === 1 && typeof value.title === 'string' && typeof value.instructions === 'string' && typeof value.source === 'string' ? value as MeterTemplate : null;
}
export function meterResponse(text: unknown): MeterResponse {
  const value = object(text); const result = emptyMeterResponse();
  for (const key of Object.keys(result) as (keyof MeterResponse)[]) {
    if (key === 'stationLights' || key === 'actions') result[key] = Array.isArray(value?.[key]) ? value[key].filter((v: unknown) => typeof v === 'string') : [];
    else result[key] = typeof value?.[key] === 'string' ? value[key] : '';
  }
  return result;
}
export function meterIssues(response: MeterResponse): string[] {
  return [response.batteryCharge === 'no' ? 'MSA battery below 75%' : '',
    response.stationLights.includes('yellow') ? 'Calibration station: yellow LED ring' : '',
    response.stationLights.includes('red') ? 'Calibration station: red LED ring' : '',
    response.actions.includes('failed') ? 'MSA failed bump and calibration' : '',
    ['orange','red'].includes(response.endOfLife) ? `MSA end-of-life indicator: ${response.endOfLife} blinking heart` : '',
    response.sensitOperational === 'no' ? 'Sensit not operational' : '',
    response.sensitLowBattery === 'yes' ? 'Sensit low battery — change batteries' : ''].filter(Boolean);
}
export function meterErrors(response: MeterResponse, today: string): string[] {
  const errors: string[] = [];
  const date = new Date(response.inspectionDate + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(response.inspectionDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== response.inspectionDate || response.inspectionDate > today) errors.push('Enter the actual inspection date, today or earlier.');
  if (!['M1','M2'].includes(response.meterId)) errors.push('Choose the identification on the back of the MSA meter.');
  for (const key of ['batteryCharge','endOfLife','sensitOperational','sensitLowBattery'] as const) {
    if (!meterChoices[key].some(([id]) => id === response[key])) errors.push(`Answer ${key === 'batteryCharge' ? 'the MSA battery question' : key === 'endOfLife' ? 'the blinking-heart question' : key === 'sensitOperational' ? 'the Sensit operational question' : 'the Sensit battery question'}.`);
  }
  for (const key of ['stationLights','actions'] as const) {
    if (!response[key].length || response[key].some(id => !meterChoices[key].some(([choice]) => choice === id))) errors.push(key === 'stationLights' ? 'Record the calibration station LED rings.' : 'Record the bump or calibration result.');
  }
  if (response.stationLights.includes('green') && response.stationLights.length > 1) errors.push('Both rings cannot be green when a yellow or red ring is selected.');
  if (response.actions.includes('failed') && response.actions.length > 1) errors.push('Choose failed or successful bump/calibration results.');
  if (!response.memberName.trim()) errors.push('Enter the member performing this check.');
  if (response.memberName.length > 160 || response.notes.length > 4000) errors.push('Member name or comments are too long.');
  if (meterIssues(response).length && !response.notes.trim()) errors.push('Describe the issue in comments.');
  return errors;
}
export function meterSummary(response: MeterResponse): string {
  const label = (key: keyof typeof meterChoices, ids: string | string[]) => (Array.isArray(ids) ? ids : [ids]).map(id => meterChoices[key].find(([choice]) => choice === id)?.[1] || 'Not recorded').join('; ');
  return [`Inspection date: ${response.inspectionDate || 'Not recorded'}`, `MSA Altair 5 identification: ${response.meterId || 'Not recorded'}`,
    `MSA battery: ${label('batteryCharge',response.batteryCharge)}`, `Calibration station: ${label('stationLights',response.stationLights) || 'Not recorded'}`,
    `Bump / calibration: ${label('actions',response.actions) || 'Not recorded'}`, `End of life: ${label('endOfLife',response.endOfLife)}`,
    `Sensit: ${label('sensitOperational',response.sensitOperational)}`, `Sensit battery: ${label('sensitLowBattery',response.sensitLowBattery)}`,
    `Member performing check: ${response.memberName || 'Not recorded'}`, response.notes.trim() ? `Comments: ${response.notes.trim()}` : ''].filter(Boolean).join('\n');
}
