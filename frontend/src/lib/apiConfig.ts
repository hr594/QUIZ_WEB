// Dynamic API & Backend Configuration
// Automatically discovers local network IP when accessed from mobile devices on the same Wi-Fi

export function getBackendUrl(): string {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL as string;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // If accessing via localhost or private LAN IP (e.g., 192.168.x.x from mobile phone)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return `http://${host}:5000`;
    }
  }
  return 'https://quiz-web-8fkf.onrender.com';
}
