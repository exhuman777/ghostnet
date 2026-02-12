#!/usr/bin/env node
import { GhostNet } from './room.js';
import { queryRooms, queryRoom, queryMessages } from './query.js';
import { generateWallet } from './client.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const cmd = args[0];

function flag(name: string): string | undefined {
  const prefix = `--${name}=`;
  const eq = args.find(a => a.startsWith(prefix));
  if (eq) return eq.slice(prefix.length);
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function getKey(): `0x${string}` {
  const k = flag('key') ?? process.env.GHOSTNET_PRIVATE_KEY;
  if (!k) { console.error('Need --key or GHOSTNET_PRIVATE_KEY'); process.exit(1); }
  return k as `0x${string}`;
}

async function main() {
  switch (cmd) {
    case 'create': {
      const gn = new GhostNet(getKey());
      const name = flag('name') ?? 'unnamed';
      const ttl = Number(flag('ttl') ?? 1);
      const nick = flag('nick') ?? 'anon';
      const pass = flag('pass');
      if (!pass) { console.error('Need --pass'); process.exit(1); }
      const { roomId, entityKey, txHash } = await gn.createRoom(name, ttl, nick);
      console.log(`Room created: ${name}`);
      console.log(`  roomId: ${roomId}`);
      console.log(`  entity: ${entityKey}`);
      console.log(`  tx:     ${txHash}`);
      console.log(`  TTL:    ${ttl}h`);
      console.log(`\nShare: --room=${roomId} --pass=${pass}`);
      break;
    }

    case 'send': {
      const gn = new GhostNet(getKey());
      const roomId = flag('room');
      const pass = flag('pass');
      const nick = flag('nick') ?? 'anon';
      const msg = flag('msg');
      if (!roomId || !pass || !msg) { console.error('Need --room, --pass, --msg'); process.exit(1); }

      const room = await queryRoom(roomId);
      if (!room) { console.error('Room not found'); process.exit(1); }

      const { entityKey, txHash } = await gn.sendMessage(roomId, nick, msg, pass, room.ttlHours);
      console.log(`Sent as ${nick}: ${msg}`);
      console.log(`  entity: ${entityKey}`);
      console.log(`  tx:     ${txHash}`);
      break;
    }

    case 'read': {
      const roomId = flag('room');
      const pass = flag('pass');
      if (!roomId || !pass) { console.error('Need --room, --pass'); process.exit(1); }

      const room = await queryRoom(roomId);
      if (!room) { console.error('Room not found'); process.exit(1); }

      console.log(`Room: ${room.name} (TTL: ${room.ttlHours}h, by ${room.createdBy})`);
      const msgs = await queryMessages(roomId, pass);
      if (!msgs.length) { console.log('No messages (or wrong passphrase).'); break; }
      for (const m of msgs) {
        const t = new Date(m.ts * 1000).toLocaleTimeString();
        console.log(`[${t}] ${m.nick}: ${m.text}`);
      }
      break;
    }

    case 'rooms': {
      const rooms = await queryRooms(Number(flag('limit') ?? 20));
      if (!rooms.length) { console.log('No active rooms.'); break; }
      console.table(rooms.map(r => ({
        roomId: r.roomId,
        name: r.name,
        by: r.createdBy,
        ttl: r.ttlHours + 'h',
        created: new Date(r.createdAt).toLocaleString(),
      })));
      break;
    }

    case 'wallet': {
      const w = generateWallet();
      console.log('Generated wallet:');
      console.log(`  Address:     ${w.address}`);
      console.log(`  Private key: ${w.privateKey}`);
      console.log(`\nFund at: https://mendoza.hoodi.arkiv.network/faucet/`);
      console.log(`\nExport: GHOSTNET_PRIVATE_KEY=${w.privateKey}`);
      break;
    }

    case 'chat': {
      const dir = resolve(fileURLToPath(import.meta.url), '../../..');
      console.log(`Open in browser: ${resolve(dir, 'chat.html')}`);
      break;
    }

    default:
      console.log('Usage: ghostnet <create|send|read|rooms|wallet|chat>');
      console.log('  create  --name NAME --ttl HOURS --nick NICK --pass PASSPHRASE');
      console.log('  send    --room ID --pass PASSPHRASE --nick NICK --msg TEXT');
      console.log('  read    --room ID --pass PASSPHRASE');
      console.log('  rooms   [--limit N]');
      console.log('  wallet  Generate new wallet');
      console.log('  chat    Show path to web UI');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
