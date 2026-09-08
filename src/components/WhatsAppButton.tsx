import { MessageCircle } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function WhatsAppFloatingButton(props: {
  applicationNumber?: string | null;
  customerName?: string | null;
  mobile?: string | null;
}) {
  const href = buildWhatsAppLink(props);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:brightness-110 sm:bottom-6 sm:right-6"
      aria-label="Chat with SMART FUTURE GROUP on WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Need Help? Chat with SMART FUTURE GROUP</span>
      <span className="sm:hidden">Need Help?</span>
    </a>
  );
}
