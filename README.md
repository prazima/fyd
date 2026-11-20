# FYD · Namma Namakkal

## Run locally

1. Install Node.js 20 or newer.
2. From this project folder, run `npm start`.
3. Open `http://localhost:4173` in a browser.

The website uses no npm dependencies. QR creation and camera scanning load QRCode.js and html5-qrcode from their public CDNs, so the browser needs internet access for those features. Camera access is available on `localhost` or when deployed over HTTPS.

## Admin check-in

Open **Admin check-in** at the bottom of the event page.

- Username: `FYD`
- Password: `FYDDANCE`

Set `ADMIN_USER`, `ADMIN_PASS`, and optionally `PORT` as environment variables before starting the server to override the local defaults. Use a unique password if this server is made reachable by anyone else.

## Registration data

Registration records are written by the server to `data/registrations.json`. Keep this file backed up. It is a local file-backed store for this single-server setup; it is not a hosted database service. The admin scanner looks up each QR pass against those records and can mark a participant checked in.

The submitted transaction ID is recorded as awaiting organizer verification. The supplied QR image is included on the registration page, but its card says “Scan to Register”; confirm its destination with FYD before using it to pay. The site does not verify bank payments.

## Event details used

- Sunday, 6 December 2026. Reporting: 9:00 AM; battles start: 10:00 AM sharp.
- Hip Hop Battle, Open Style Battle, Tamil Song Battle, and Kids Battle (under 14; age proof required).
- Early offer through 30 November: Registration ₹500; Solo 3 Battles ₹1,200; Group of 3 ₹1,200; Group of 5 ₹2,000.
- After 30 November: full payment; spot registration ₹799.
- Venue and contact details are shown on the event page.
