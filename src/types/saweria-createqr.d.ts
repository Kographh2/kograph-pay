declare module "saweria-createqr" {
  export class SumshiiySawer {
    constructor(opts: { username: string; email: string; password: string });
    login(): Promise<unknown>;
    createPaymentQr(
      amount: number,
      durationMinutes: number,
    ): Promise<{
      trx_id: string;
      status: string;
      status_simbolic?: string;
      message?: string;
      amount: number;
      qr_string: string;
      created_at: string;
      invoice_url: string;
      total_dibayar?: number;
      saweria_username?: string;
      saweria_apikey?: string;
      qr_image: string;
      expired_in: string;
    }>;
    cekPaymentV1(trxId: string): Promise<unknown>;
    cekPaymentV2(trxId: string): Promise<{
      status: string;
      amount?: number;
      trx_id: string;
      invoice_url?: string;
    }>;
    cekpayment(trxId: string): Promise<unknown>;
    setWebhook(): Promise<unknown>;
    getSaldo(): Promise<unknown>;
    setFee(who: "buyer" | "seller"): Promise<unknown>;
  }
}