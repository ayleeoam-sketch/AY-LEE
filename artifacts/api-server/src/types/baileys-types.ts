export type GroupParticipant = {
  id: string;
  admin?: "admin" | "superadmin" | null;
};

export type MessageKey = {
  remoteJid?: string;
  fromMe?: boolean;
  id?: string;
  participant?: string;
};

export type WASocket = {
  ev: {
    on(
      event: "messages.upsert",
      listener: (value: {
        messages: proto.IWebMessageInfo[];
        type: string;
      }) => void | Promise<void>,
    ): void;
    on(
      event: "connection.update",
      listener: (value: {
        connection?: "open" | "close";
        lastDisconnect?: { error?: unknown };
        qr?: string;
      }) => void | Promise<void>,
    ): void;
    on(event: "creds.update", listener: (value: unknown) => void): void;
  };
  sendMessage(
    jid: string,
    content: {
      text?: string;
      mentions?: string[];
      delete?: MessageKey;
    },
  ): Promise<unknown>;
  groupMetadata(jid: string): Promise<{
    subject: string;
    participants: GroupParticipant[];
  }>;
  groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: "add" | "remove" | "promote" | "demote",
  ): Promise<unknown>;
  groupInviteCode(jid: string): Promise<string>;
  user?: { id?: string };
  end(error?: unknown): void;
};

export namespace proto {
  export type MessageContent = {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
      contextInfo?: MessageContextInfo;
    };
    imageMessage?: { caption?: string; contextInfo?: MessageContextInfo };
    videoMessage?: { caption?: string; contextInfo?: MessageContextInfo };
    documentMessage?: { caption?: string; contextInfo?: MessageContextInfo };
    stickerMessage?: { contextInfo?: MessageContextInfo };
  };

  export type MessageContextInfo = {
    participant?: string;
    stanzaId?: string;
    remoteJid?: string;
    fromMe?: boolean;
    mentionedJid?: string[];
    quotedMessage?: unknown;
    groupMentions?: Array<{ groupJid?: string; groupSubject?: string }>;
  };

  export interface IWebMessageInfo {
    key: {
      fromMe?: boolean;
      remoteJid?: string;
      participant?: string;
      id?: string | null;
    };
    message?: MessageContent;
    pushName?: string | null;
  }
}