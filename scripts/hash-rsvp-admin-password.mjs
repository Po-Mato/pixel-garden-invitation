const password = process.env.RSVP_ADMIN_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("RSVP_ADMIN_PASSWORD must contain at least 12 characters");
}

const encoder = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iterations = 100_000;
const material = await crypto.subtle.importKey(
  "raw",
  encoder.encode(password),
  "PBKDF2",
  false,
  ["deriveBits"]
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations },
  material,
  256
);
const encodedSalt = Buffer.from(salt).toString("base64url");
const encodedHash = Buffer.from(bits).toString("base64url");
process.stdout.write(`pbkdf2-sha256$${iterations}$${encodedSalt}$${encodedHash}`);
