export function hydrantOutletFlow(diameterInches:number, pitotPsi:number, coefficient:number) {
  if (![diameterInches,pitotPsi,coefficient].every(Number.isFinite) || diameterInches <= 0 || pitotPsi < 0 || coefficient <= 0) return 0;
  return 29.83 * coefficient * diameterInches ** 2 * Math.sqrt(pitotPsi);
}

export function availableHydrantFlow(measuredGpm:number, staticPsi:number, residualPsi:number, desiredResidualPsi=20) {
  if (![measuredGpm,staticPsi,residualPsi,desiredResidualPsi].every(Number.isFinite) || measuredGpm <= 0 || staticPsi <= residualPsi || staticPsi <= desiredResidualPsi) return 0;
  return measuredGpm * ((staticPsi - desiredResidualPsi) / (staticPsi - residualPsi)) ** 0.54;
}

export function nfpa291FlowClass(gpm:number) {
  if (gpm >= 1500) return { code:"AA", label:"1,500+ GPM", color:"light-blue" };
  if (gpm >= 1000) return { code:"A", label:"1,000–1,499 GPM", color:"green" };
  if (gpm >= 500) return { code:"B", label:"500–999 GPM", color:"orange" };
  return { code:"C", label:"Under 500 GPM", color:"red" };
}
