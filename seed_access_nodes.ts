import mongoose from 'mongoose';
import { HospitalAccessNode } from './backend/src/modules/hospital/models/AccessNode';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hms';

async function run() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const therapyNodes = [
      { key: 'therapy-token-gen', portalKey: 'therapy', type: 'page', label: 'Token Generator', path: '/therapy/token-generator', order: 1, active: true },
      { key: 'therapy-today-tokens', portalKey: 'therapy', type: 'page', label: 'Today\'s Tokens', path: '/therapy/today-tokens', order: 2, active: true },
      { key: 'therapy-token-history', portalKey: 'therapy', type: 'page', label: 'Token History', path: '/therapy/token-history', order: 3, active: true },
      { key: 'therapy-appointments', portalKey: 'therapy', type: 'page', label: 'Appointments', path: '/therapy/appointments', order: 4, active: true },
      { key: 'therapy-credit-patients', portalKey: 'therapy', type: 'page', label: 'Credit Patients', path: '/therapy/credit-patients', order: 5, active: true }
    ];

    const counsellingNodes = [
      { key: 'counselling-token-gen', portalKey: 'counselling', type: 'page', label: 'Token Generator', path: '/counselling/token-generator', order: 1, active: true },
      { key: 'counselling-today-tokens', portalKey: 'counselling', type: 'page', label: 'Today\'s Tokens', path: '/counselling/today-tokens', order: 2, active: true },
      { key: 'counselling-token-history', portalKey: 'counselling', type: 'page', label: 'Token History', path: '/counselling/token-history', order: 3, active: true },
      { key: 'counselling-appointments', portalKey: 'counselling', type: 'page', label: 'Appointments', path: '/counselling/appointments', order: 4, active: true },
      { key: 'counselling-credit-patients', portalKey: 'counselling', type: 'page', label: 'Credit Patients', path: '/counselling/credit-patients', order: 5, active: true }
    ];

    const allNodes = [...therapyNodes, ...counsellingNodes];
    for (const n of allNodes) {
      await HospitalAccessNode.updateOne({ key: n.key }, n, { upsert: true });
      console.log(`Upserted: ${n.key}`);
    }

    console.log('Seed completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

run();
