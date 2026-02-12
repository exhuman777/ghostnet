import { eq, and } from '@arkiv-network/sdk/query';
import { getPublicClient } from './client.js';
import { ATTR, GHOSTNET_TYPE, KIND_ROOM, KIND_MSG } from './types.js';
import { deriveKey, decrypt } from './crypto.js';
import type { RoomInfo, DecryptedMessage } from './types.js';

const client = getPublicClient();

function decodePayload(payload: Uint8Array | undefined): any {
  if (!payload) return {};
  return JSON.parse(new TextDecoder().decode(payload));
}

function attrsToMap(attrs: { key: string; value: string | number }[]): Record<string, string> {
  const m: Record<string, string> = {};
  for (const a of attrs) m[a.key] = String(a.value);
  return m;
}

export async function queryRooms(limit = 20): Promise<RoomInfo[]> {
  const result = await client.buildQuery()
    .where(and([eq(ATTR.TYPE, GHOSTNET_TYPE), eq(ATTR.KIND, KIND_ROOM)]))
    .withAttributes().withPayload().limit(limit).fetch();

  return result.entities.map(e => {
    const attrs = attrsToMap(e.attributes);
    const payload = decodePayload(e.payload);
    return {
      key: e.key,
      roomId: attrs[ATTR.ROOM_ID],
      name: payload.name,
      createdBy: payload.createdBy,
      ttlHours: payload.ttlHours,
      createdAt: payload.createdAt,
    };
  });
}

export async function queryRoom(roomId: string): Promise<RoomInfo | null> {
  const result = await client.buildQuery()
    .where(and([eq(ATTR.TYPE, GHOSTNET_TYPE), eq(ATTR.KIND, KIND_ROOM), eq(ATTR.ROOM_ID, roomId)]))
    .withAttributes().withPayload().limit(1).fetch();

  if (!result.entities.length) return null;
  const e = result.entities[0];
  const attrs = attrsToMap(e.attributes);
  const payload = decodePayload(e.payload);
  return {
    key: e.key,
    roomId: attrs[ATTR.ROOM_ID],
    name: payload.name,
    createdBy: payload.createdBy,
    ttlHours: payload.ttlHours,
    createdAt: payload.createdAt,
  };
}

export async function queryMessages(roomId: string, passphrase: string, limit = 100): Promise<DecryptedMessage[]> {
  const result = await client.buildQuery()
    .where(and([eq(ATTR.TYPE, GHOSTNET_TYPE), eq(ATTR.KIND, KIND_MSG), eq(ATTR.ROOM_ID, roomId)]))
    .withAttributes().withPayload().limit(limit).fetch();

  const key = await deriveKey(passphrase, roomId);
  const messages: DecryptedMessage[] = [];

  for (const e of result.entities) {
    const attrs = attrsToMap(e.attributes);
    const payload = decodePayload(e.payload);
    try {
      const json = JSON.stringify(payload);
      const text = await decrypt(json, key);
      messages.push({
        key: e.key,
        nick: attrs[ATTR.NICK],
        text,
        ts: Number(attrs[ATTR.TS]),
      });
    } catch {
      // wrong passphrase — skip silently
    }
  }

  return messages.sort((a, b) => a.ts - b.ts);
}
