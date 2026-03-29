/*========== Manual ==========
# Input
nodeUrl: 使用するSymbolノードのURL

# Output
ノードから取得したID

# Description
-手数料が足りているかを足りているかの確認をするために取得している

========== Manual ==========*/

import axios from 'axios';

const DEFAULT_TESTNET_CURRENCY_MOSAIC_ID = '72C0212E67A08BCE';

function normalizeMosaicId(rawId) {
    if (!rawId) {
        return null;
    }

    const normalized = String(rawId)
        .replace(/^0x/i, '')
        .replace(/'/g, '')
        .toUpperCase();

    return normalized || null;
}

async function GetCurrencyMosaicId(nodeUrl) {
    try {
        // New Symbol REST returns currencyMosaicId via /network/properties.
        const propertiesResult = await axios.get(`${nodeUrl}/network/properties`);
        const propertiesMosaicId = normalizeMosaicId(propertiesResult?.data?.chain?.currencyMosaicId);
        if (propertiesMosaicId) {
            return propertiesMosaicId;
        }

        // Legacy fallback for environments that still expose /network/currencyMosaicId.
        const legacyResult = await axios.get(`${nodeUrl}/network/currencyMosaicId`);
        const legacyMosaicId = normalizeMosaicId(legacyResult?.data?.mosaicId);
        return legacyMosaicId ?? DEFAULT_TESTNET_CURRENCY_MOSAIC_ID;
    } catch (err) {
        console.warn('[Warn] Failed to fetch currency mosaic id. Fallback to testnet default.', err?.message);
        return DEFAULT_TESTNET_CURRENCY_MOSAIC_ID;
    }
}

export default GetCurrencyMosaicId;