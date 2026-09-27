import { CASE_COLLECTION_KEY, LEGACY_CASE_KEY, restoreCaseCollection, type CaseCollection } from "./case-history.ts";

type CaseStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readCaseCollection(storage: CaseStorage, onPersistenceError?: () => void): CaseCollection {
  const current = storage.getItem(CASE_COLLECTION_KEY);
  const legacy = storage.getItem(LEGACY_CASE_KEY);
  const collection = restoreCaseCollection(current ?? "", legacy ?? "");
  if (current === null && legacy !== null && collection.cases.length > 0) {
    try {
      storage.setItem(CASE_COLLECTION_KEY, JSON.stringify(collection));
      storage.removeItem(LEGACY_CASE_KEY);
    } catch {
      onPersistenceError?.();
    }
  }
  return collection;
}

export function writeCaseCollection(storage: CaseStorage, collection: CaseCollection): boolean {
  try {
    storage.setItem(CASE_COLLECTION_KEY, JSON.stringify(collection));
    return true;
  } catch {
    return false;
  }
}
