-- CreateTable
CREATE TABLE "GmailState" (
    "emailAddress" TEXT NOT NULL,
    "historyId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailState_pkey" PRIMARY KEY ("emailAddress")
);

-- CreateTable
CREATE TABLE "GmailCredential" (
    "emailAddress" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiryDate" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailCredential_pkey" PRIMARY KEY ("emailAddress")
);
