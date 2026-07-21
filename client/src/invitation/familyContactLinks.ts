import { buildTelephoneHref } from "./directions";

export type FamilyContactLinks = {
  telephone: string | null;
  sms: string | null;
};

export function buildFamilyContactLinks(phone: string): FamilyContactLinks {
  const digits = phone.replace(/\D/g, "");
  const telephone = buildTelephoneHref(phone);
  const sms = telephone && /^01\d{8,9}$/.test(digits) ? `sms:${digits}` : null;

  return { telephone, sms };
}
