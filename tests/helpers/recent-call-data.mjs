import { readFileSync } from 'node:fs';

// Execute the application's actual bounded history query against ephemeral PostgreSQL.
const source = readFileSync(new URL('../../app/api/respond/route.ts', import.meta.url), 'utf8');
export const recentCallQuery = source.match(/"(SELECT report_number reportNumber[^"\n]+WHERE trim\(time_in\)<>''[^"\n]+)"/)[1];
export async function seedRecentCalls(pg) {
  await pg.exec(`CREATE TABLE daily_log_calls (
    id text PRIMARY KEY, report_number text, call_type text, address text,
    responding_units text, time_out text, time_in text, log_date text, sort_order int
  );
  INSERT INTO daily_log_calls
  SELECT 'fixture-'||n, 'TEST-'||n, 'PREVIEW CALL '||n,
    'Fictional location '||n, 'TEST ENGINE', '1200', '1230',
    to_char(date '2026-09-01'+(n/10), 'YYYY-MM-DD'), n
  FROM generate_series(1,40) n;
  INSERT INTO daily_log_calls VALUES ('open','OPEN','Not completed','Fixture','TEST','1300','', '2026-10-01',100);
  INSERT INTO daily_log_calls VALUES ('blank','BLANK','Not completed','Fixture','TEST','1300','  ', '2026-10-01',101);`);
}
export async function recentCallRows(pg) {
  const { rows } = await pg.query(recentCallQuery);
  // The production SQL adapter restores camel-case aliases; reproduce that JSON
  // shape here without initializing any hosted connection or credentials.
  return rows.map(row => ({reportNumber:row.reportnumber, callType:row.calltype,
    address:row.address, respondingUnits:row.respondingunits, timeOut:row.timeout,
    timeIn:row.timein, logDate:row.logdate}));
}
