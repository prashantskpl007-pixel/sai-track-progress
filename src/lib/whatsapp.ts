export const SAI_WHATSAPP_NUMBER = "919702279566";
export const SAI_WHATSAPP_DISPLAY = "+91 97022 79566";

export function buildWhatsAppLink(opts: {
  applicationNumber?: string | null;
  customerName?: string | null;
  mobile?: string | null;
}) {
  const parts = ["Hello Sai Enterprise,", "", "I need assistance regarding my agreement registration."];
  if (opts.applicationNumber) parts.push("", `Application Number: ${opts.applicationNumber}`);
  if (opts.customerName) parts.push(`Customer Name: ${opts.customerName}`);
  if (!opts.applicationNumber && opts.mobile) parts.push("", `Mobile: ${opts.mobile}`);
  parts.push("", "Please assist me.");
  const msg = encodeURIComponent(parts.join("\n"));
  return `https://wa.me/${SAI_WHATSAPP_NUMBER}?text=${msg}`;
}
