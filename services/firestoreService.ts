import { db } from './firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    writeBatch,
    onSnapshot,
    query,
    orderBy,
    QuerySnapshot,
    DocumentData
} from 'firebase/firestore';
import { DividendRecord, AssetRecord, CashHolding } from '../types';

// Collection Names
export const COLLECTIONS = {
    generalDividends: 'general_dividends',
    taxFreeDividends: 'tax_free_dividends',
    assetConfig: 'asset_config',
    cashHoldings: 'cash_holdings'
};

// ... (previous code)

// --- Specific Helpers for Cash Holdings ---

export const loadCashHoldings = async (): Promise<CashHolding | null> => {
    const records = await loadCollection<CashHolding>(COLLECTIONS.cashHoldings);
    return records.length > 0 ? records[0] : null;
};

export const saveCashHoldings = async (record: CashHolding): Promise<void> => {
    return saveDocument(COLLECTIONS.cashHoldings, record);
};

export const subscribeToCashHoldings = (
    callback: (data: CashHolding | null) => void
): (() => void) => {
    return subscribeToCollection<CashHolding>(COLLECTIONS.cashHoldings, (data) => {
        callback(data.length > 0 ? data[0] : null);
    });
};


// --- Generic Firestore Operations ---

// Load all documents from a collection
export const loadCollection = async <T>(collectionName: string): Promise<T[]> => {
    try {
        const ref = collection(db, collectionName);
        const snapshot = await getDocs(ref);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (error) {
        console.error(`Failed to load ${collectionName}:`, error);
        return [];
    }
};

// Save a single document (create or update)
export const saveDocument = async <T extends { id: string }>(
    collectionName: string,
    data: T
): Promise<void> => {
    try {
        const ref = doc(db, collectionName, data.id);
        await setDoc(ref, data);
    } catch (error) {
        console.error(`Failed to save to ${collectionName}:`, error);
        throw error;
    }
};

// Delete a single document
export const deleteDocument = async (
    collectionName: string,
    docId: string
): Promise<void> => {
    try {
        const ref = doc(db, collectionName, docId);
        await deleteDoc(ref);
    } catch (error) {
        console.error(`Failed to delete from ${collectionName}:`, error);
        throw error;
    }
};

// Batch save multiple documents (for reset/import operations)
export const batchSave = async <T extends { id: string }>(
    collectionName: string,
    records: T[]
): Promise<void> => {
    try {
        const batch = writeBatch(db);
        records.forEach(record => {
            const ref = doc(db, collectionName, record.id);
            batch.set(ref, record);
        });
        await batch.commit();
    } catch (error) {
        console.error(`Failed to batch save to ${collectionName}:`, error);
        throw error;
    }
};

// Clear all documents in a collection
export const clearCollection = async (collectionName: string): Promise<void> => {
    try {
        const ref = collection(db, collectionName);
        const snapshot = await getDocs(ref);
        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    } catch (error) {
        console.error(`Failed to clear ${collectionName}:`, error);
        throw error;
    }
};

// --- Real-time Listeners ---

// Subscribe to real-time updates for a collection
export const subscribeToCollection = <T>(
    collectionName: string,
    callback: (data: T[]) => void
): (() => void) => {
    const ref = collection(db, collectionName);
    const unsubscribe = onSnapshot(ref, (snapshot: QuerySnapshot<DocumentData>) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        callback(data);
    }, (error) => {
        console.error(`Real-time listener error for ${collectionName}:`, error);
    });
    return unsubscribe;
};

// --- Specific Helpers for Dividend Records ---

export const loadDividendRecords = async (accountType: 'general' | 'tax-free'): Promise<DividendRecord[]> => {
    const collectionName = accountType === 'general' ? COLLECTIONS.generalDividends : COLLECTIONS.taxFreeDividends;
    return loadCollection<DividendRecord>(collectionName);
};

export const saveDividendRecord = async (accountType: 'general' | 'tax-free', record: DividendRecord): Promise<void> => {
    const collectionName = accountType === 'general' ? COLLECTIONS.generalDividends : COLLECTIONS.taxFreeDividends;
    return saveDocument(collectionName, record);
};

export const deleteDividendRecord = async (accountType: 'general' | 'tax-free', recordId: string): Promise<void> => {
    const collectionName = accountType === 'general' ? COLLECTIONS.generalDividends : COLLECTIONS.taxFreeDividends;
    return deleteDocument(collectionName, recordId);
};

export const subscribeToDividends = (
    accountType: 'general' | 'tax-free',
    callback: (data: DividendRecord[]) => void
): (() => void) => {
    const collectionName = accountType === 'general' ? COLLECTIONS.generalDividends : COLLECTIONS.taxFreeDividends;
    return subscribeToCollection<DividendRecord>(collectionName, callback);
};

// --- Specific Helpers for Asset Records ---

export const loadAssetRecords = async (): Promise<AssetRecord[]> => {
    return loadCollection<AssetRecord>(COLLECTIONS.assetConfig);
};

export const saveAssetRecord = async (record: AssetRecord): Promise<void> => {
    return saveDocument(COLLECTIONS.assetConfig, record);
};

export const deleteAssetRecord = async (recordId: string): Promise<void> => {
    return deleteDocument(COLLECTIONS.assetConfig, recordId);
};

export const subscribeToAssets = (
    callback: (data: AssetRecord[]) => void
): (() => void) => {
    return subscribeToCollection<AssetRecord>(COLLECTIONS.assetConfig, callback);
};
