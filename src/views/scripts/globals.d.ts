interface TempleAuthClient {
  getToken(): string;
  authenticate(token: string): Promise<boolean>;
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  fetchAudioBlobUrl(url: string): Promise<string>;
  logout(): void;
}

interface Window {
  TempleAuth: TempleAuthClient;
  TempleAudioEngine: new (...args: any[]) => any;
  TempleParticleEngine: new (...args: any[]) => any;
  webkitAudioContext?: typeof AudioContext;
}
