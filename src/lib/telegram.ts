import { formatIDR } from "@/lib/api";

type TelegramPayment = {
  transactionId: string;
  referenceId: string;
  amount: number;
  customerName?: string | null;
  customerEmail?: string | null;
  description?: string | null;
  paidAt?: Date | null;
};

function formatWIB(d = new Date()): string {
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";
}

export async function sendPaymentTelegram(payload: TelegramPayment): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    // Telegram is optional; silently skip.
    return false;
  }

  const text = [
    "💰 *PAYMENT RECEIVED*",
    "",
    "━━━━━━━━━━━━━━━━",
    "",
    `💵 *Amount*\n${formatIDR(payload.amount)}`,
    "",
    `👤 *Customer*\n${payload.customerName ?? "-"}`,
    "",
    `📧 *Email*\n${payload.customerEmail ?? "-"}`,
    payload.description ? `\n📝 *Note*\n${payload.description}\n` : "",
    `🧾 *Reference*\n${payload.referenceId}`,
    "",
    `🆔 *Transaction*\n\`${payload.transactionId}\``,
    "",
    "💳 *Provider*\nSaweria",
    "",
    "✅ *Status*\nPAID",
    "",
    `🕐 *Time*\n${formatWIB(payload.paidAt ?? new Date())}`,
    "",
    "━━━━━━━━━━━━━━━━",
  ].join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[telegram] failed:", err instanceof Error ? err.message : err);
    return false;
  }
}