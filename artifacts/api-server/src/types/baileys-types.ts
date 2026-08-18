export type GroupParticipant = {
  id: string;
  admin?: "admin" | "superadmin" | null;
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
  sendMessage(jid: string, content: { text: string }): Promise<unknown>;
  groupMetadata(jid: string): Promise<{
    subject: string;
    participants: GroupParticipant[];
  }>;
  user?: { id?: string };
  end(error?: unknown): void;
};

export namespace proto {
  export type MessageContent = {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string };
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