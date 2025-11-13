npx prisma generate
ssh -i ~/.ssh/id_ed25519_citadel -N -L 6543:127.0.0.1:5432 victor_liu@34.29.138.72
npm run dev
npm run server:dev