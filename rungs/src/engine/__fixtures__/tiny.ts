import { createDictionary } from '../dictionary';

/**
 * A tiny hand-made dictionary, so logic tests don't depend on the real word list.
 *   cat - cot - cog - dog        (main route)
 *   cat - bat - bot - bog - dog  (longer route, uses a rare word "bog")
 *   zzz                          (island: no neighbours)
 */
export const tinyDictionary = createDictionary({
  version: 0,
  lengths: {
    '3': {
      endpoint: 'cat dog',
      path: 'bat bot cog cot',
      valid: 'bog zzz',
    },
  },
});
