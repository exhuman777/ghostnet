export const GHOSTNET_TYPE = 'ghostnet';
export const KIND_ROOM = 'room';
export const KIND_MSG = 'msg';

export const ATTR = {
  TYPE: 'type',
  KIND: 'kind',
  ROOM_ID: 'roomId',
  NICK: 'nick',
  TS: 'ts',
} as const;

export interface RoomMeta {
  name: string;
  createdBy: string;
  ttlHours: number;
  createdAt: number;
}

export interface EncryptedPayload {
  iv: string;  // base64
  ct: string;  // base64
}

export interface DecryptedMessage {
  key: string;
  nick: string;
  text: string;
  ts: number;
}

export interface RoomInfo {
  key: string;
  roomId: string;
  name: string;
  createdBy: string;
  ttlHours: number;
  createdAt: number;
}
