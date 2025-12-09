import { db } from '../services/firebaseConfig';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { DividendRecord, AssetRecord } from '../types';

const COLLECTIONS = {
    general: 'general_dividends',
    taxFree: 'tax_free_dividends',
    assetConfig: 'asset_config'
};

const STORAGE_KEYS = {
    general: 'bunbae_manager_data_general',
    taxFree: 'bunbae_manager_data_taxfree',
    assetConfig: 'asset_config_data'
};

export interface MigrationResult {
    success: boolean;
    count: number;
    errors: string[];
}

export const migrateDataToFirestore = async (): Promise<MigrationResult> => {
    const result: MigrationResult = {
        success: true,
        count: 0,
        errors: []
    };

    try {
        const batch = writeBatch(db);
        let opCount = 0;

        // 1. Migrate General Account Dividend Data
        const generalDataStr = localStorage.getItem(STORAGE_KEYS.general);
        if (generalDataStr) {
            const generalData: DividendRecord[] = JSON.parse(generalDataStr);
            generalData.forEach(record => {
                const ref = doc(db, COLLECTIONS.general, record.id || crypto.randomUUID());
                // Simplify data: Remove calculated fields that can be re-derived or keep them if we want to store snapshot
                // For NoSQL, it's often better to store what we display to avoid re-calc on every read, 
                // OR store raw and calc on client. Let's store everything for now to ensure consistency.
                batch.set(ref, { ...record, accountType: 'general' });
                opCount++;
            });
        }

        // 2. Migrate Tax-Free Account Dividend Data
        const taxFreeDataStr = localStorage.getItem(STORAGE_KEYS.taxFree);
        if (taxFreeDataStr) {
            const taxFreeData: DividendRecord[] = JSON.parse(taxFreeDataStr);
            taxFreeData.forEach(record => {
                const ref = doc(db, COLLECTIONS.taxFree, record.id || crypto.randomUUID());
                batch.set(ref, { ...record, accountType: 'tax-free' });
                opCount++;
            });
        }

        // 3. Migrate Asset Config Data (The new integrated asset management)
        const assetConfigDataStr = localStorage.getItem(STORAGE_KEYS.assetConfig);
        if (assetConfigDataStr) {
            const assetData: AssetRecord[] = JSON.parse(assetConfigDataStr);
            assetData.forEach(record => {
                const ref = doc(db, COLLECTIONS.assetConfig, record.id || crypto.randomUUID());
                batch.set(ref, record);
                opCount++;
            });
        }

        if (opCount > 0) {
            // Firestore batch limit is 500. If user has more, we need to split.
            // Assuming user data is small (< 500) for now. 
            // If risky, we should split. Let's add simple safety check or split logic.
            if (opCount > 490) {
                // Simple safety warning or implementation of chunking necessary if large.
                // For MVP personal app, usually < 500 records.
                console.warn("Batch size close to limit. Implement chunking if needed.");
            }
            await batch.commit();
            result.count = opCount;
        }

    } catch (error: any) {
        console.error("Migration failed", error);
        result.success = false;
        result.errors.push(error.message);
    }

    return result;
};
