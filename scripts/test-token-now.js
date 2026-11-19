const userId = 'a9470e4e-4213-4563-adaf-c180cafe19fe';
const key = '642e8eff5f3e77b5997acfb6d5ff96ad086f1c91d073855544cdacc208e3f211';
const timestamp = Date.now();
const rawToken = `${userId}:${timestamp}:${key}`;
const token = Buffer.from(rawToken).toString('base64');
console.log('Token gerado:', token);
console.log('Raw token:', rawToken);
console.log('Timestamp:', timestamp);

