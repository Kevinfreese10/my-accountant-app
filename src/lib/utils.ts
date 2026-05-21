import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function serializeForServerAction<T>(val: T): T {
    if (val === null || val === undefined) return val;
    
    // Check if it is a Firestore Timestamp (has toDate function)
    if (typeof (val as any).toDate === 'function') {
        return (val as any).toDate().toISOString() as any;
    }
    if (val instanceof Date) {
        return val.toISOString() as any;
    }
    if (Array.isArray(val)) {
        return val.map(serializeForServerAction) as any;
    }
    if (typeof val === 'object') {
        const res: any = {};
        for (const k of Object.keys(val)) {
            res[k] = serializeForServerAction((val as any)[k]);
        }
        return res;
    }
    return val;
}
