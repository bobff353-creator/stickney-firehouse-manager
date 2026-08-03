export function splitEmployeeName(value: string) {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return { lastName: "", firstName: "" };
  if (cleaned.includes(",")) {
    const [lastName, ...firstParts] = cleaned.split(",");
    return { lastName: lastName.trim(), firstName: firstParts.join(",").trim() };
  }
  const parts = cleaned.split(" ");
  if (parts.length === 1) return { lastName: parts[0], firstName: "" };
  return { lastName: parts.at(-1) ?? "", firstName: parts.slice(0, -1).join(" ") };
}

export function formatEmployeeName(value: string) {
  const { lastName, firstName } = splitEmployeeName(value);
  return firstName ? `${lastName}, ${firstName}` : lastName;
}

export function employeeNameFromParts(lastName: string, firstName: string) {
  return formatEmployeeName(`${lastName.trim()}, ${firstName.trim()}`);
}

export function compareEmployeeNames(a: string, b: string) {
  return formatEmployeeName(a).localeCompare(formatEmployeeName(b), "en", { sensitivity: "base" });
}
