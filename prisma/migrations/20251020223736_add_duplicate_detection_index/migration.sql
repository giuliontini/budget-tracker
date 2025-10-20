-- This is an empty migration.
CREATE INDEX "Transaction_date_description_amount_idx" 
ON "Transaction"("date", "description", "amount");