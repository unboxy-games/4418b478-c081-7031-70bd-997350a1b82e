import { Unboxy } from '@unboxy/phaser-sdk';

/**
 * Platform services promise — initialized once at module load.
 * Resolves to an Unboxy instance, or null if initialization fails
 * (e.g. standalone mode, no host).
 * Import this from any scene that needs platform APIs to avoid
 * circular dependency with main.ts.
 */
export const unboxyReady = Unboxy.init({ standaloneGameId: 'cat-tower-defense' }).catch(() => null);
