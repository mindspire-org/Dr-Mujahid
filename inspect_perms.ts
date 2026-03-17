import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Define models locally to avoid import issues
const AccessNodeSchema = new mongoose.Schema({
    key: String,
    portalKey: String,
    path: String,
    type: String,
    label: String
}, { strict: false });

const UserSchema = new mongoose.Schema({
    username: String,
    role: String,
    portals: mongoose.Schema.Types.Mixed
}, { strict: false });

const AccessNode = mongoose.model('HospitalAccessNode', AccessNodeSchema);
const User = mongoose.model('HospitalUser', UserSchema);

async function inspect() {
    dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hms';

    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const receptionNodes = await AccessNode.find({ portalKey: 'reception' }).lean();
    console.log('Reception Nodes in DB:', receptionNodes.length);
    receptionNodes.forEach((n: any) => {
        console.log(`  [${n.key}] ${n.label} -> ${n.path}`);
    });

    const users = await User.find({}).lean();
    console.log('\nUsers and their portal permissions:');
    users.forEach((u: any) => {
        console.log(`User: ${u.username} (${u.role})`);
        console.log(`  Portals:`, JSON.stringify(u.portals));
    });

    await mongoose.disconnect();
}

inspect();
