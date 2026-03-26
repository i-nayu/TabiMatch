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

async function GetCurrencyMosaicId(nodeUrl) {
    try {
        const result = await axios.get(`${nodeUrl}/network/currencyMosaicId`);
        const rawId = result?.data?.mosaicId;
        if (!rawId) {
            return DEFAULT_TESTNET_CURRENCY_MOSAIC_ID;
        }

        return String(rawId)
            .replace(/^0x/, '')
            .toUpperCase();
    } catch (err) {
        console.warn('[Warn] Failed to fetch currency mosaic id. Fallback to testnet default.', err?.message);
        return DEFAULT_TESTNET_CURRENCY_MOSAIC_ID;
    }
}

export default GetCurrencyMosaicId;