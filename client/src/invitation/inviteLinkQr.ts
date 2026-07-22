import QRCode from "qrcode";

export function buildInvitationInviteUrl(token: string): string {
  const url = new URL(import.meta.env.BASE_URL, window.location.origin);
  url.searchParams.set("invite", token);
  return url.toString();
}

export async function invitationInviteQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 1024,
    color: { dark: "#243a30", light: "#ffffff" }
  });
}

export async function downloadInvitationInviteQr(url: string, guestName: string): Promise<void> {
  const anchor = document.createElement("a");
  anchor.href = await invitationInviteQrDataUrl(url);
  anchor.download = `wedding-invite-${guestName.replace(/[^0-9A-Za-z가-힣_-]+/g, "-") || "guest"}.png`;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
