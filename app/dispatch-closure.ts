type CallResponse = {
  reportNumber?: unknown;
  timeIn?: unknown;
};

export function completedDispatchReportNumbers(calls: CallResponse[]) {
  return [...new Set(calls.flatMap((call) => {
    const reportNumber = String(call.reportNumber ?? "").trim();
    const timeIn = String(call.timeIn ?? "").trim();
    return reportNumber && timeIn ? [reportNumber] : [];
  }))];
}
