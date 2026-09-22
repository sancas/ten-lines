import { useEffect, useState, useCallback, useRef } from "react";

export default function useLocalStorage<T>(key: string, defaultValue: T) {
    const [value, setValue] = useState<T>(() => {
        try {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                const parsed = JSON.parse(storedValue);
                if (
                    typeof defaultValue === "object" &&
                    defaultValue !== null &&
                    !Array.isArray(defaultValue) &&
                    typeof parsed === "object" &&
                    parsed !== null &&
                    !Array.isArray(parsed)
                ) {
                    return { ...defaultValue, ...parsed };
                }
                return parsed;
            }
            return defaultValue;
        } catch (error) {
            console.error(error);
            return defaultValue;
        }
    });

    const valueRef = useRef(value);
    valueRef.current = value;

    const setStoredValue = useCallback(
        (newValueOrFn: T | ((val: T) => T)) => {
            try {
                const nextValue =
                    typeof newValueOrFn === "function"
                        ? (newValueOrFn as (val: T) => T)(valueRef.current)
                        : newValueOrFn;

                valueRef.current = nextValue;
                setValue(nextValue);
                localStorage.setItem(key, JSON.stringify(nextValue));
                window.dispatchEvent(
                    new CustomEvent(`local-storage-${key}`, {
                        detail: nextValue,
                    })
                );
            } catch (error) {
                console.error(error);
            }
        },
        [key]
    );

    useEffect(() => {
        const handleCustomEvent = (e: Event) => {
            const customEvent = e as CustomEvent<T>;
            if (JSON.stringify(customEvent.detail) !== JSON.stringify(valueRef.current)) {
                valueRef.current = customEvent.detail;
                setValue(customEvent.detail);
            }
        };

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === key && e.newValue !== null) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    if (JSON.stringify(parsed) !== JSON.stringify(valueRef.current)) {
                        valueRef.current = parsed;
                        setValue(parsed);
                    }
                } catch (err) {
                    console.error(err);
                }
            }
        };

        window.addEventListener(`local-storage-${key}`, handleCustomEvent);
        window.addEventListener("storage", handleStorageChange);

        return () => {
            window.removeEventListener(`local-storage-${key}`, handleCustomEvent);
            window.removeEventListener("storage", handleStorageChange);
        };
    }, [key]);

    return [value, setStoredValue] as const;
}
