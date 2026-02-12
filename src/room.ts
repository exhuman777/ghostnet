import { jsonToPayload } from '@arkiv-network/sdk';
import { ExpirationTime } from '@arkiv-network/sdk/utils';
import { getWalletClient } from './client.js';
import { deriveKey, encrypt } from './crypto.js';
import { ATTR, GHOSTNET_TYPE, KIND_ROOM, KIND_MSG } from './types.js';
import type { RoomMeta } from './types.js';

export class GhostNet {
  private client;

  constructor(privateKey: `0x${string}`) {
    this.client = getWalletClient(privateKey);
  }

  async createRoom(name: string, ttlHours: number, nick: string): Promise<{ roomId: string; entityKey: string; txHash: string }> {
    const roomId = crypto.randomUUID();
    const meta: RoomMeta = { name, createdBy: nick, ttlHours, createdAt: Date.now() };
    const result = await this.client.createEntity({
      payload: jsonToPayload(meta),
      attributes: [
        { key: ATTR.TYPE, value: GHOSTNET_TYPE },
        { key: ATTR.KIND, value: KIND_ROOM },
        { key: ATTR.ROOM_ID, value: roomId },
        { key: ATTR.NICK, value: nick },
        { key: ATTR.TS, value: String(Math.floor(Date.now() / 1000)) },
      ],
      contentType: 'application/json',
      expiresIn: ExpirationTime.fromHours(ttlHours),
    });
    return { roomId, ...result };
  }

  async sendMessage(roomId: string, nick: string, text: string, passphrase: string, ttlHours: number) {
    const key = await deriveKey(passphrase, roomId);
    const encrypted = await encrypt(text, key);
    return this.client.createEntity({
      payload: jsonToPayload(JSON.parse(encrypted)),
      attributes: [
        { key: ATTR.TYPE, value: GHOSTNET_TYPE },
        { key: ATTR.KIND, value: KIND_MSG },
        { key: ATTR.ROOM_ID, value: roomId },
        { key: ATTR.NICK, value: nick },
        { key: ATTR.TS, value: String(Math.floor(Date.now() / 1000)) },
      ],
      contentType: 'application/json',
      expiresIn: ExpirationTime.fromHours(ttlHours),
    });
  }
}
