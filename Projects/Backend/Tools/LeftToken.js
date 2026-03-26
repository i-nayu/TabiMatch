/*========== Manual ==========
# Input
address: 残高を確認したいSymbolアドレス
mosaicIdHex: 確認したいモザイクID（16進数 / 0x付き・なし両対応）
nodeUrl: 使用するSymbolノードのURL

# Output
指定モザイクの残高を BigInt 型で返す
（所持していない場合は 0n を返す）

# Description
- 戻り値は BigInt 型なので number と比較しないこと
========== Manual ==========*/

import axios from 'axios';

const DEFAULT_TESTNET_CURRENCY_MOSAIC_ID = '72C0212E67A08BCE';


async function LeftToken(address, mosaicIdHex, nodeUrl) {
    const result = await axios.get(`${nodeUrl}/accounts/${address}`);
    console.log("[Debug] LeftToken API result:", result.data);
    const mosaics = result.data.account.mosaics

    const normalizedSearchId = String(mosaicIdHex)
        .replace(/^0x/, '')
        .toUpperCase();

    const target = mosaics.find((m) => {
        // id が string か object か両対応
        const rawId =
            typeof m.id === 'string'
                ? m.id
                : typeof m.id === 'object' && m.id !== null
                    ? m.id.id
                    : '';

        const currentId = String(rawId)
            .replace(/^0x/, '')
            .toUpperCase();

        console.log(`Comparing: API(${currentId}) vs Search(${normalizedSearchId})`);

        return currentId === normalizedSearchId;
    });

    console.log(`[Debug] LeftTokenAmount - Target Mosaic Found:`, target);

    return target ? BigInt(target.amount) : 0n;
}

export default LeftToken;