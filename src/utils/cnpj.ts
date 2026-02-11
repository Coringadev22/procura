/** Remove formatting from CNPJ (keeps only digits) */
export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/** Format CNPJ as XX.XXX.XXX/XXXX-XX */
export function formatCnpj(cnpj: string): string {
  const clean = cleanCnpj(cnpj);
  return clean.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/** Validate CNPJ (digit check) */
export function isValidCnpj(cnpj: string): boolean {
  const clean = cleanCnpj(cnpj);
  if (clean.length !== 14) return false;
  if (/^(\d)\1+$/.test(clean)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const calcDigit = (digits: string, weights: number[]) => {
    const sum = weights.reduce(
      (acc, w, i) => acc + Number(digits[i]) * w,
      0
    );
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(clean, weights1);
  if (d1 !== Number(clean[12])) return false;

  const d2 = calcDigit(clean, weights2);
  return d2 === Number(clean[13]);
}
