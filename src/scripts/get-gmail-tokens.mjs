import readline from "node:readline/promises";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

// Desktop app flow uses this redirect
const REDIRECT_URI = "http://localhost"; 

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in your shell before running.");
  process.exit(1);
}

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Minimal scopes for reading new mail + history
const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("\nOpen this URL, approve access, and paste the code below:\n");
console.log(authUrl, "\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const code = await rl.question("Auth code: ");
rl.close();

const { tokens } = await oAuth2Client.getToken(code);
console.log("\n✅ Success. Put these in your .env:\n");
console.log(`GMAIL_ACCESS_TOKEN="${tokens.access_token || ""}"`);
console.log(`GMAIL_REFRESH_TOKEN="${tokens.refresh_token || ""}"`);
console.log(`GMAIL_EXPIRY_DATE="${tokens.expiry_date || ""}"`);
console.log(`GOOGLE_OAUTH_REDIRECT_URI="${REDIRECT_URI}"`);
