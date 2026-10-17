import { addCalendarDays } from './operational-day.ts';

export class StaffingTimeError extends Error {
  constructor(message: string) { super(message); this.name = 'StaffingTimeError'; }
}
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const offsets = new Map<string, number[]>();
function wallLabel(date: Date) {
  const parts = formatter.formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function chicagoLocalCandidates(date: string, time: string) {
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !Number.isFinite(wall) || new Date(wall).toISOString().slice(0,16) !== `${date}T${time}`) throw new StaffingTimeError('Enter a valid staffing date and HH:MM time.');
  let choices = offsets.get(date);
  if (!choices) {
    choices = [...new Set([-36,-24,-12,0,12,24,36].map(hours => {
      const sample = Date.parse(`${date}T12:00:00Z`) + hours * 3600000;
      return Date.parse(`${wallLabel(new Date(sample))}:00Z`) - sample;
    }))];
    if (offsets.size > 512) offsets.clear();
    offsets.set(date, choices);
  }
  const matches = choices.map(offset => wall - offset).filter(instant => wallLabel(new Date(instant)) === `${date}T${time}`);
  return matches.sort((a,b)=>a-b);
}
export function chicagoLocalInstant(date: string, time: string, selected?: unknown) {
  const matches = chicagoLocalCandidates(date,time);
  if (!matches.length) throw new StaffingTimeError(`${date} ${time} does not occur during the spring-forward clock change (nonexistent time). Enter an actual recorded time.`);
  if (selected != null && selected !== '') {
    if (typeof selected !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(selected) || !matches.includes(Date.parse(selected))) throw new StaffingTimeError(`The selected occurrence does not match ${date} ${time}. Choose its occurrence again.`);
    return Date.parse(selected);
  }
  if (matches.length !== 1) throw new StaffingTimeError(`${date} ${time} is ambiguous during the repeated fall-back hour. Choose first or second occurrence.`);
  return matches[0];
}
export type TimeSelection = {timeInInstant?: unknown; timeOutInstant?: unknown};
export function intervalDates(date: string,timeIn: string,timeOut: string,operational=false) {
  chicagoLocalCandidates(date,timeIn);
  const startDate = operational && timeIn < '06:00' ? addCalendarDays(date,1) : date;
  return {startDate,endDate:timeOut<=timeIn?addCalendarDays(startDate,1):startDate};
}
export function endpointChoices(date: string,timeIn: string,timeOut: string,endpoint:'in'|'out',operational=false) {
  if (!date || !timeIn || endpoint==='out'&&!timeOut) return [];
  try {
    const {startDate,endDate}=intervalDates(date,timeIn,timeOut,operational);
    const days=endpoint==='in'?[startDate]:[...new Set(timeOut<=timeIn&&chicagoLocalCandidates(startDate,timeOut).length===2?[startDate,endDate]:[endDate])];
    return days.flatMap(day=>chicagoLocalCandidates(day,endpoint==='in'?timeIn:timeOut).map((instant,index,all)=>({value:new Date(instant).toISOString(),label:`${all.length===2?(index===0?'First occurrence':'Second occurrence'):day!==startDate?'Next day':'Recorded time'} · ${day} ${endpoint==='in'?timeIn:timeOut} · ${new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant))} (${new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',timeZoneName:'longOffset'}).formatToParts(new Date(instant)).find(p=>p.type==='timeZoneName')!.value.replace('GMT','UTC')})`})));
  } catch { return []; }
}
function resolvedInterval(date:string,timeIn:string,timeOut:string,selections:TimeSelection,operational:boolean) {
  const {startDate,endDate}=intervalDates(date,timeIn,timeOut,operational);
  const start=chicagoLocalInstant(startDate,timeIn,selections.timeInInstant);
  const options=endpointChoices(date,timeIn,timeOut,'out',operational);
  let end:number;
  if (selections.timeOutInstant != null && selections.timeOutInstant !== '') {
    if (typeof selections.timeOutInstant!=='string'||!options.some(option=>option.value===selections.timeOutInstant)) throw new StaffingTimeError('The selected time-out occurrence no longer matches this interval. Choose it again.');
    end=Date.parse(selections.timeOutInstant);
  } else {
    if(options.length>1)throw new StaffingTimeError('Time out is ambiguous during the repeated fall-back hour. Choose its occurrence and date.');
    end=chicagoLocalInstant(endDate,timeOut);
  }
  if(end<=start)throw new StaffingTimeError('Time out must be after time in. Check the selected occurrences and dates.');
  return {start,end};
}
export function calendarWorkedHours(date: string, timeIn: string, timeOut: string, timeInInstant?:unknown,timeOutInstant?:unknown) {
  const interval=resolvedInterval(date,timeIn,timeOut,{timeInInstant,timeOutInstant},false);
  return (interval.end-interval.start)/3600000;
}
export function staffingInterval(logDate: string, row: { timeIn?: unknown; timeOut?: unknown } & TimeSelection) {
  const start=String(row.timeIn??''),end=String(row.timeOut??'');
  if(!start||!end)return null;
  return resolvedInterval(logDate,start,end,row,true);
}
export type ActingCoverage = { employeeId?: unknown; timeIn?: unknown; timeOut?: unknown; actingOfficer?: unknown; logDate?: string } & TimeSelection;
export function assertActingOfficerCoverage(logDate: string, rows: ActingCoverage[], nearby: ActingCoverage[] = []) {
  const candidates = rows.filter(row => Boolean(row.actingOfficer)).map(row => {
    const interval = staffingInterval(logDate, row);
    if (!row.employeeId || !interval) throw new StaffingTimeError('Acting Officer coverage needs an employee and complete start/end times.');
    return interval;
  });
  const existing = nearby.filter(row => row.actingOfficer).map(row => {
    const interval = staffingInterval(row.logDate!, row);
    if (!interval) throw new StaffingTimeError('Nearby Acting Officer coverage has incomplete times; review the saved log before assigning another officer.');
    return interval;
  });
  for (const [index, interval] of candidates.entries()) {
    for (const other of [...candidates.slice(index + 1), ...existing]) {
      // Half-open intervals: the outgoing officer ends exactly when relief begins.
      if (interval.start < other.end && other.start < interval.end) throw new StaffingTimeError('Acting Officer coverage overlaps. Only one acting officer may cover the department at a time; consecutive handoffs are allowed.');
    }
  }
}

export function selectedInstantLabel(value:string) {
  const instant=Date.parse(value);if(!Number.isFinite(instant))return 'Invalid saved occurrence';
  const label=wallLabel(new Date(instant)),date=label.slice(0,10),time=label.slice(11);
  return endpointChoices(date,time,'','in').find(option=>option.value===value)?.label ?? value;
}
