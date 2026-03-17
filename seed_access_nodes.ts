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

    const therapyLabNodes = [
      { key: 'therapy-lab-dashboard', portalKey: 'therapyLab', type: 'page', label: 'Dashboard', path: '/therapy-lab', order: 1, active: true },
      { key: 'therapy-lab-token-generator', portalKey: 'therapyLab', type: 'page', label: 'Token Generator', path: '/therapy-lab/token-generator', order: 2, active: true },
      { key: 'therapy-lab-today-tokens', portalKey: 'therapyLab', type: 'page', label: "Today's Tokens", path: '/therapy-lab/today-tokens', order: 3, active: true },
      { key: 'therapy-lab-token-history', portalKey: 'therapyLab', type: 'page', label: 'Token History', path: '/therapy-lab/token-history', order: 4, active: true },
      { key: 'therapy-lab-credit-patients', portalKey: 'therapyLab', type: 'page', label: 'Credit Patients', path: '/therapy-lab/credit-patients', order: 5, active: true },
      { key: 'therapy-lab-packages', portalKey: 'therapyLab', type: 'page', label: 'Packages', path: '/therapy-lab/packages', order: 6, active: true },
      { key: 'therapy-lab-appointments', portalKey: 'therapyLab', type: 'page', label: 'Appointments', path: '/therapy-lab/appointments', order: 7, active: true },
      { key: 'therapy-lab-lab-reports-entry', portalKey: 'therapyLab', type: 'page', label: 'Lab Reports Entry', path: '/therapy-lab/lab-reports-entry', order: 8, active: true },
      { key: 'therapy-lab-manage-petty-cash', portalKey: 'therapyLab', type: 'page', label: 'Manage Petty Cash', path: '/therapy-lab/manage-petty-cash', order: 9, active: true },
      { key: 'therapy-lab-manage-bank-balance', portalKey: 'therapyLab', type: 'page', label: 'Manage Bank Balance', path: '/therapy-lab/manage-bank-balance', order: 10, active: true },
      { key: 'therapy-lab-notifications', portalKey: 'therapyLab', type: 'page', label: 'Notifications', path: '/therapy-lab/notifications', order: 11, active: true }
    ];

    const counsellingNodes = [
      { key: 'counselling-dashboard', portalKey: 'counselling', type: 'page', label: 'Dashboard', path: '/counselling', order: 1, active: true },
      { key: 'counselling-token-gen', portalKey: 'counselling', type: 'page', label: 'Token Generator', path: '/counselling/token-generator', order: 2, active: true },
      { key: 'counselling-today-tokens', portalKey: 'counselling', type: 'page', label: "Today's Tokens", path: '/counselling/today-tokens', order: 3, active: true },
      { key: 'counselling-token-history', portalKey: 'counselling', type: 'page', label: 'Token History', path: '/counselling/token-history', order: 4, active: true },
      { key: 'counselling-appointments', portalKey: 'counselling', type: 'page', label: 'Appointments', path: '/counselling/appointments', order: 5, active: true },
      { key: 'counselling-credit-patients', portalKey: 'counselling', type: 'page', label: 'Credit Patients', path: '/counselling/credit-patients', order: 6, active: true },
      { key: 'counselling-packages', portalKey: 'counselling', type: 'page', label: 'Packages', path: '/counselling/packages', order: 7, active: true },
      { key: 'counselling-manage-petty-cash', portalKey: 'counselling', type: 'page', label: 'Manage Petty Cash', path: '/counselling/manage-petty-cash', order: 8, active: true },
      { key: 'counselling-manage-bank-balance', portalKey: 'counselling', type: 'page', label: 'Manage Bank Balance', path: '/counselling/manage-bank-balance', order: 9, active: true },
      { key: 'counselling-notifications', portalKey: 'counselling', type: 'page', label: 'Notifications', path: '/counselling/notifications', order: 10, active: true }
    ];

    const allNodes = [...therapyLabNodes, ...counsellingNodes];
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
