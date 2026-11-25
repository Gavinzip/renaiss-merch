import { digest } from "./encoding.js";
/** The manifest's existing identity commitment now binds both printed name and X destination. */
export function identityHash(value) {
    return digest({ name: value.name, xUsername: value.xUsername });
}
