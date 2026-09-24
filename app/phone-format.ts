/** Format complete US numbers without guessing missing digits or discarding extensions. */
export function formatPhoneNumber(value: string | null | undefined): string {
  const input = value?.trim() ?? "";
  if (!input) return "";
  const parts = input.match(/^(\+?[\d\s().-]+?)(\s*(?:extension|ext\.?|x|#)\s*\d+)?$/i);
  if (!parts) return input;
  let digits = parts[1].replace(/\D/g, "");
  if (parts[1].startsWith("+") && !(digits.length === 11 && digits.startsWith("1"))) return input;
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return input;
  const extension = parts[2]?.trim();
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}${extension ? ` ${extension}` : ""}`;
}
