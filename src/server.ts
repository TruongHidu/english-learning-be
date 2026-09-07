import "dotenv/config";

import app from "./app.js";
import { adminBootstrapService, paymentExpirationService } from "./config/container.js";
import { connectDatabase } from "./config/database.js";
import { PaymentTransactionModel } from "./models/payment-transaction.model.js";

const PORT = Number(process.env.PORT) || 5000;

const startServer = async (): Promise<void> => {
    try {
        await connectDatabase();
        // Do not accept checkouts before the one-pending constraint is ready.
        // Resolve legacy duplicates with migrate:payment-pending before starting.
        await PaymentTransactionModel.init();
        await adminBootstrapService.ensureDefaultAdmin();
        paymentExpirationService.start();

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};

void startServer();
