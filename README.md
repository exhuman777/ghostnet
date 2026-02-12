# GhostNet — Ephemeral Encrypted Chat on Arkiv L3

> Self-destructing chat rooms with AES-256-GCM encryption. Zero servers. Zero accounts. Zero trace.

Messages are encrypted client-side, stored on Arkiv L3 with built-in TTL, and automatically purged after 1-24 hours. No one — not even Arkiv — can read your messages without the passphrase.

---

## How It Works

```
Create room ──▶ Arkiv entity (room metadata, TTL)
Send msg    ──▶ AES-256-GCM encrypt ──▶ Arkiv entity (same TTL)
Read msgs   ◀── Arkiv query ◀── decrypt ◀── display
                                              ↑
                                       2s polling (real-time)
```

**Crypto stack:**
- PBKDF2 (100k iterations, SHA-256) derives AES-256 key from `passphrase + roomId`
- AES-GCM per message with random 12-byte IV
- Web Crypto API — zero dependencies, works in Node.js and browser

---

## Use Cases

| Use Case | Description |
|----------|-------------|
| **Secure team sync** | Create a room before a sensitive meeting. Share passphrase verbally. Room self-destructs after. |
| **Whistleblower drops** | Journalist creates room, shares invite link. Source sends info. No server logs, no metadata. |
| **Ephemeral dev coordination** | Quick encrypted channel for incident response. No Slack history, no audit trail. |
| **CTF/hackathon collab** | Temporary war room for competition teams. Auto-cleanup when done. |
| **Dead drops** | Leave encrypted messages in a room. Recipient joins later with passphrase. |
| **AI agent coordination** | Claude Code creates rooms for multi-agent task coordination with built-in expiry. |

---

## Quick Start

### Web UI (recommended for testing with friends)

1. Open `chat.html` in browser (or visit GitHub Pages URL)
2. Wallet auto-generates in localStorage
3. Fund wallet at [Arkiv Mendoza Faucet](https://mendoza.hoodi.arkiv.network/faucet/) (CAPTCHA, ~10s)
4. Create room → share invite link → friends join → chat

### CLI

```bash
# Install
cd ~/ghostnet && npm install

# Generate wallet
npx tsx src/cli.ts wallet
# → Fund the address at https://mendoza.hoodi.arkiv.network/faucet/

# Set key
export GHOSTNET_PRIVATE_KEY=0x...

# Create room
npx tsx src/cli.ts create --name="ops" --ttl=1 --nick=alice --pass=secret123

# Send message
npx tsx src/cli.ts send --room=ROOM_ID --pass=secret123 --nick=alice --msg="hello from the other side"

# Read messages
npx tsx src/cli.ts read --room=ROOM_ID --pass=secret123

# Wrong passphrase = no messages (silent decrypt failure)
npx tsx src/cli.ts read --room=ROOM_ID --pass=wrong

# List active rooms
npx tsx src/cli.ts rooms
```

---

## Testing Guide

### Prerequisites
- Modern browser (Chrome/Firefox/Safari/Edge)
- ~30s to get testnet ETH per wallet

### Two-Browser Test (solo or with friend)

> **Key: each browser tab has its own wallet. Both wallets need testnet ETH.**

**Tab 1 — Creator:**
1. Open `chat.html` (local or GitHub Pages)
2. Click **GET TESTNET ETH** → CAPTCHA → wait ~10s
3. **CREATE ROOM** → name, passphrase, nick, TTL
4. Click **INVITE** → link copied

**Tab 2 — Joiner (incognito or different browser):**
1. Open invite link (room ID + passphrase auto-fill)
2. Click **GET TESTNET ETH** → fund THIS wallet too
3. Enter nick → **JOIN ROOM**

**Verify:**
- [ ] Both see "CONNECTED TO..." + system messages
- [ ] Tab 1 sends msg → green locally + "delivered" status
- [ ] Tab 2 sees msg in 2-4s (gray text)
- [ ] Tab 2 replies → Tab 1 sees it in 2-4s
- [ ] Join with wrong passphrase → "COULD NOT DECRYPT" warning
- [ ] Initial join shows "LOADED N MESSAGES" or "NO MESSAGES YET"
- [ ] After TTL → room + msgs auto-purge from Arkiv

### CLI Test
```bash
# Terminal 1: create room
export GHOSTNET_PRIVATE_KEY=0x...  # funded wallet
npx tsx src/cli.ts create --name="test" --ttl=1 --nick=alice --pass=s3cret
# → note roomId

# Terminal 2: send message (different funded wallet)
export GHOSTNET_PRIVATE_KEY=0x...
npx tsx src/cli.ts send --room=ROOM_ID --pass=s3cret --nick=bob --msg="hey"

# Terminal 1: read
npx tsx src/cli.ts read --room=ROOM_ID --pass=s3cret
# → [time] bob: hey

# Wrong passphrase → no messages
npx tsx src/cli.ts read --room=ROOM_ID --pass=wrong
```

### Common Issues
| Problem | Cause | Fix |
|---------|-------|-----|
| "insufficient funds" | Wallet not funded | Click GET TESTNET ETH (each tab needs own funding) |
| No messages appear | Wrong passphrase | Passphrase must match exactly (case-sensitive) |
| "COULD NOT DECRYPT" | Passphrase mismatch | Re-join with correct passphrase |
| Room not found | TTL expired or wrong ID | Create new room |
| Messages delayed >5s | Arkiv indexing lag | Normal on testnet, retry |

---

## File Map

| File | Lines | Purpose |
|------|-------|---------|
| `src/types.ts` | ~35 | Entity constants (`GHOSTNET_TYPE`, `KIND_ROOM`, `KIND_MSG`), interfaces |
| `src/client.ts` | ~22 | Arkiv SDK client factory (public + wallet), wallet generation |
| `src/crypto.ts` | ~35 | PBKDF2 key derivation, AES-GCM encrypt/decrypt (Web Crypto API) |
| `src/room.ts` | ~45 | `GhostNet` class — `createRoom()`, `sendMessage()` |
| `src/query.ts` | ~65 | `queryRooms()`, `queryRoom()`, `queryMessages()` with decrypt |
| `src/cli.ts` | ~90 | CLI: create, send, read, rooms, wallet, chat |
| `src/index.ts` | ~8 | Package exports |
| `chat.html` | ~400 | **Main web app** — landing page + encrypted chat UI |
| `package.json` | — | ESM config, single dep: `@arkiv-network/sdk` |
| `tsconfig.json` | — | ES2022, NodeNext, strict |

---

## Architecture

### Entity Schema (Arkiv L3)

**Room** — `type=ghostnet, kind=room, roomId=<uuid>`
```json
{
  "name": "ops-room",
  "createdBy": "alice",
  "ttlHours": 6,
  "createdAt": 1707700000000
}
```
TTL: `ExpirationTime.fromHours(ttlHours)` — Arkiv auto-purges after expiry.

**Message** — `type=ghostnet, kind=msg, roomId=<uuid>, nick=<sender>`
```json
{
  "iv": "base64...",
  "ct": "base64..."
}
```
Payload is AES-256-GCM ciphertext. Nick is plaintext in attributes (for display). TTL matches room.

### Security Model
- Passphrase + roomId → PBKDF2 (100k iterations) → AES-256 key
- Each message gets random 12-byte IV (AES-GCM)
- Keys never leave the client (browser localStorage / CLI env var)
- Room metadata (name, creator, TTL) is public — messages are encrypted
- Wrong passphrase = silent decrypt failure = no messages shown

### Limitations
- Room directory is public (names visible, messages encrypted)
- Arkiv entity payload size limit (fine for chat messages, not file transfer)
- 2-second polling (not WebSocket — good enough for chat)
- Testnet only (Mendoza) — free but requires faucet CAPTCHA

---

## Network

- **Chain:** Arkiv Mendoza Testnet (Chain ID: 60138453056)
- **RPC:** https://mendoza.hoodi.arkiv.network/rpc
- **Explorer:** https://explorer.mendoza.hoodi.arkiv.network
- **Faucet:** https://mendoza.hoodi.arkiv.network/faucet/

---

## License

MIT
