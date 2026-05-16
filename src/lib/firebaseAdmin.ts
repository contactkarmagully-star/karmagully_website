import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

let cachedInit: { app: any, db: any } | null = null;

export function getDatabaseIdFromConfig(): string {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    console.log(`[FirebaseAdmin] Checking config at: ${configPath}`);
    if (fs.existsSync(configPath)) {
      const configStr = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configStr);
      if (config.firestoreDatabaseId) {
        console.log(`[FirebaseAdmin] FOUND Database ID: ${config.firestoreDatabaseId}`);
        return config.firestoreDatabaseId;
      }
    }
  } catch (e) {
    console.error("[FirebaseAdmin] Critical error reading config:", e);
  }
  return '(default)';
}

export function getFirebaseAdmin() {
  if (cachedInit) return cachedInit;

  const databaseId = getDatabaseIdFromConfig();

  if (admin.apps.length > 0) {
     const app = admin.app();
     console.log(`[FirebaseAdmin] Using existing app. Database: ${databaseId}`);
     cachedInit = {
       app,
       db: getFirestore(app, databaseId === '(default)' ? undefined : databaseId)
     };
     return cachedInit;
  }

  // Prefer environment variables for flexibility
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (privateKey && clientEmail && projectId) {
    console.log(`[FirebaseAdmin] Initializing for project: ${projectId}, Database: ${databaseId}`);
    
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    cachedInit = {
      app,
      db: getFirestore(app, databaseId === '(default)' ? undefined : databaseId)
    };
    return cachedInit;
  }

  console.warn("[FirebaseAdmin] Missing secrets. Falling back to Application Default Credentials.");

  // Fallback: This only works if running in a Google Cloud environment or with ADC
  try {
    const app = admin.initializeApp();
    cachedInit = {
      app,
      db: getFirestore(app, databaseId === '(default)' ? undefined : databaseId)
    };
    return cachedInit;
  } catch (err) {
    console.error("[FirebaseAdmin] Critical failure initializing Firebase Admin:", err);
    return null;
  }
}

const adminInit = getFirebaseAdmin();
export const adminDb = adminInit ? adminInit.db : null;
export const adminApp = adminInit ? adminInit.app : null;
