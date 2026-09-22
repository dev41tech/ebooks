export function emailList(value: unknown): string[] {
  return String(value || "").split(/[,;\n]/).map(x => x.trim().toLowerCase()).filter(Boolean);
}
export function accessFor(email: string | undefined, admins: unknown, participants: unknown, openBeta: unknown = false) {
  const normalized = email?.trim().toLowerCase();
  const admin = Boolean(normalized && emailList(admins).includes(normalized));
  return { admin, participant: admin || Boolean(normalized && (openBeta === "true" || emailList(participants).includes(normalized))) };
}
export function isValidProgress(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;
}
