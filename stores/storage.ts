import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { getDefaultStore } from 'jotai/vanilla';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

const getItem = (key: string): string | null => {
  const value = storage.getString(key);
  return value ?? null;
};

const setItem = (key: string, value: string): void => {
  storage.set(key, value);
};

const removeItem = (key: string): void => {
  storage.remove(key);
};

// oxlint-disable eslint/prefer-await-to-callbacks
const subscribe = (
  key: string,
  callback: (value: string | null) => void
): (() => void) => {
  const listener = (changedKey: string) => {
    if (changedKey === key) {
      // oxlint-disable eslint/prefer-await-to-callbacks
      callback(getItem(key));
    }
  };

  const { remove } = storage.addOnValueChangedListener(listener);

  return () => {
    remove();
  };
};

export const atomWithMMKV = <T>(key: string, initialValue: T) =>
  atomWithStorage<T>(
    key,
    initialValue,
    createJSONStorage<T>(() => ({
      getItem,
      removeItem,
      setItem,
      subscribe,
    })),
    { getOnInit: true }
  );

export const store = getDefaultStore();
