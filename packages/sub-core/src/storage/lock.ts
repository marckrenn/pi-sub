/**
 * File lock helpers for storage-backed locks.
 */

import { getStorage } from "../storage.js";

interface LockRecord {
	acquiredAt: number;
	token?: string;
}

export function tryAcquireFileLock(lockPath: string, staleAfterMs: number): string | null {
	const storage = getStorage();
	const token = createLockToken();
	if (tryCreateLock(storage, lockPath, token)) {
		return token;
	}

	const observed = readLockRecord(storage, lockPath);
	if (!observed) {
		return null;
	}
	if (!isLockStale(observed.acquiredAt, staleAfterMs)) {
		return null;
	}
	if (!removeObservedStaleLock(storage, lockPath, observed)) {
		return null;
	}
	if (tryCreateLock(storage, lockPath, token)) {
		return token;
	}

	return null;
}

export function releaseFileLock(lockPath: string, token?: string): void {
	const storage = getStorage();
	try {
		if (!storage.exists(lockPath)) {
			return;
		}
		if (token) {
			const current = readLockRecord(storage, lockPath);
			if (!current?.token || current.token !== token) {
				return;
			}
		}
		storage.removeFile(lockPath);
	} catch {
		// Ignore
	}
}

export async function waitForLockRelease(
	lockPath: string,
	maxWaitMs: number,
	pollMs: number = 100
): Promise<boolean> {
	const storage = getStorage();
	const startTime = Date.now();

	while (Date.now() - startTime < maxWaitMs) {
		await new Promise((resolve) => setTimeout(resolve, pollMs));
		if (!storage.exists(lockPath)) {
			return true;
		}
	}

	return false;
}

function tryCreateLock(storage: ReturnType<typeof getStorage>, lockPath: string, token: string): boolean {
	try {
		return storage.writeFileExclusive(lockPath, serializeLockRecord({ token, acquiredAt: Date.now() }));
	} catch {
		return false;
	}
}

function removeObservedStaleLock(
	storage: ReturnType<typeof getStorage>,
	lockPath: string,
	observed: LockRecord
): boolean {
	try {
		const current = readLockRecord(storage, lockPath);
		if (!current) {
			return false;
		}
		if (current.acquiredAt !== observed.acquiredAt) {
			return false;
		}
		if (current.token !== observed.token) {
			return false;
		}
		storage.removeFile(lockPath);
		return !storage.exists(lockPath);
	} catch {
		return false;
	}
}

function readLockRecord(storage: ReturnType<typeof getStorage>, lockPath: string): LockRecord | null {
	try {
		if (!storage.exists(lockPath)) {
			return null;
		}
		const lockContent = storage.readFile(lockPath) ?? "";
		return parseLockRecord(lockContent);
	} catch {
		return null;
	}
}

function parseLockRecord(lockContent: string): LockRecord | null {
	const trimmed = lockContent.trim();
	if (!trimmed) return null;

	const asTimestamp = parseInt(trimmed, 10);
	if (Number.isFinite(asTimestamp) && asTimestamp > 0) {
		return { acquiredAt: asTimestamp };
	}

	try {
		const parsed = JSON.parse(trimmed) as { token?: unknown; acquiredAt?: unknown; createdAt?: unknown };
		const acquiredAt = parsed.acquiredAt ?? parsed.createdAt;
		if (typeof acquiredAt !== "number" || !Number.isFinite(acquiredAt) || acquiredAt <= 0) {
			return null;
		}
		const token = typeof parsed.token === "string" && parsed.token ? parsed.token : undefined;
		return { acquiredAt, token };
	} catch {
		return null;
	}
}

function serializeLockRecord(record: LockRecord): string {
	return JSON.stringify(record);
}

function isLockStale(acquiredAt: number, staleAfterMs: number): boolean {
	if (staleAfterMs <= 0) {
		return true;
	}
	return Date.now() - acquiredAt > staleAfterMs;
}

function createLockToken(): string {
	return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
