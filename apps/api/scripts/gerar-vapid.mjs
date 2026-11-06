// Gera o par de chaves VAPID do Web Push no formato do .env.
// Uso: pnpm --filter api vapid
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLICA=${publicKey}`);
console.log(`VAPID_PRIVADA=${privateKey}`);
console.log('VAPID_CONTATO=mailto:voce@exemplo.com');
