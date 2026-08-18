declare module "baileys" {
  export const Browsers: {
    ubuntu(name: string): unknown;
  };
  export const DisconnectReason: {
    loggedOut: number;
  };
  export function makeWASocket(options: {
    auth: unknown;
    browser: unknown;
    logger: unknown;
    markOnlineOnConnect: boolean;
    syncFullHistory: boolean;
    generateHighQualityLinkPreview: boolean;
  }): unknown;
  export function useMultiFileAuthState(
    folder: string,
  ): Promise<{
    state: unknown;
    saveCreds: (update: unknown) => void;
  }>;
}