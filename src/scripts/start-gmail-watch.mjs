import 'dotenv/config';
import { google } from "googleapis";

const {
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI,
  GMAIL_ACCESS_TOKEN,
  GMAIL_REFRESH_TOKEN,
  GMAIL_EXPIRY_DATE,
  GMAIL_WATCH_EMAIL, // optional; defaults to "me"
} = process.env;

if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET || !GOOGLE_OAUTH_REDIRECT_URI) {
  throw new Error("Missing GOOGLE_OAUTH_* envs");
}
if (!GMAIL_REFRESH_TOKEN) {
  throw new Error("Missing GMAIL_REFRESH_TOKEN");
}

const oAuth2 = new google.auth.OAuth2(
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI
);
oAuth2.setCredentials({
  access_token: GMAIL_ACCESS_TOKEN,
  refresh_token: GMAIL_REFRESH_TOKEN,
  expiry_date: GMAIL_EXPIRY_DATE ? Number(GMAIL_EXPIRY_DATE) : undefined,
});

const gmail = google.gmail({ version: "v1", auth: oAuth2 });

// Topic from your setup
const topicName = "projects/finances-tracker-468805/topics/transact-dog";

const res = await gmail.users.watch({
  userId: GMAIL_WATCH_EMAIL || "me",
  requestBody: {
    topicName,
    labelIds: ["INBOX"], // optional: limit to INBOX
    // labelIds: ["Label_123"], // you can scope further if you have a Gmail label
  },
});

console.log("Watch started. Google returned:");
console.log(JSON.stringify(res.data, null, 2));
console.log("\nSave this start historyId if you want (optional).");
