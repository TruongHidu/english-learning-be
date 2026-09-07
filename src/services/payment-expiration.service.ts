import type { IPaymentTransactionRepository } from "../repositories/interfaces/payment-transaction.repository.interface.js";

export class PaymentExpirationService {
    private timer?: ReturnType<typeof setInterval>;
    private running = false;
    constructor(private readonly payments: Pick<IPaymentTransactionRepository, "expireAllPending">,
        private readonly now: () => Date = () => new Date()) {}

    async sweep(): Promise<void> {
        if (this.running) return;
        this.running = true;
        try { await this.payments.expireAllPending(this.now()); }
        catch { console.error("Unable to expire pending payments"); }
        finally { this.running = false; }
    }
    start(): void {
        if (this.timer) return;
        void this.sweep();
        this.timer = setInterval(() => void this.sweep(), 30_000);
        this.timer.unref();
    }
    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }
}
