import { ulid } from "ulid";

export function newId(): string {
  return ulid();
}

/**
 * 招待コード生成: 大文字英数6桁。O/0, I/1 の紛らわしい文字は除外。
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function newInvitationCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}
