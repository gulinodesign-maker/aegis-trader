export function calculateWithdrawableProfit(input: { equity: number; authorizedCapital: number; threshold: number; sweepPercent: number; enabled: boolean }) {
  if (!input.enabled || input.equity <= input.threshold || input.equity <= input.authorizedCapital) return 0;
  const profitAboveCapital = input.equity - input.authorizedCapital;
  const excessAboveThreshold = input.equity - input.threshold;
  const eligibleProfit = Math.min(profitAboveCapital, excessAboveThreshold);
  return Math.max(0, eligibleProfit * (input.sweepPercent / 100));
}
