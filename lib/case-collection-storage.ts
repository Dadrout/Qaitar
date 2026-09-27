import { CASE_COLLECTION_KEY, LEGACY_CASE_KEY, restoreCaseCollection, type CaseCollection } from "./case-history.ts";

export type CaseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function acquireCaseStorage(getStorage: () => CaseStorage, onPersistenceError?: () => void): CaseStorage | null {
  try {
    return getStorage();
  } catch {
    onPersistenceError?.();
    return null;
  }
}

export function readCaseCollection(storage: CaseStorage | null, onPersistenceError?: () => void): CaseCollection {
  if (!storage) return restoreCaseCollection("", "");
  let current: string | null = null;
  let legacy: string | null = null;
  let currentReadable = true;
  try {
    current = storage.getItem(CASE_COLLECTION_KEY);
  } catch {
    currentReadable = false;
    onPersistenceError?.();
  }
  try {
    legacy = storage.getItem(LEGACY_CASE_KEY);
  } catch {
    onPersistenceError?.();
  }
  const collection = restoreCaseCollection(current ?? "", legacy ?? "");
  if (currentReadable && current === null && legacy !== null && collection.cases.length > 0) {
    try {
      storage.setItem(CASE_COLLECTION_KEY, JSON.stringify(collection));
      storage.removeItem(LEGACY_CASE_KEY);
    } catch {
      onPersistenceError?.();
    }
  }
  return collection;
}

export function writeCaseCollection(storage: CaseStorage | null, collection: CaseCollection): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CASE_COLLECTION_KEY, JSON.stringify(collection));
    return true;
  } catch {
    return false;
  }
}
