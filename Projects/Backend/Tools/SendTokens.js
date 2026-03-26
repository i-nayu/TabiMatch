/*========== Manual ==========
# Input
originalPrivateKey: 配布元の秘密鍵
mosaicId: 配布するモザイクID
users: 配布対象ユーザー [{ address, amount }]
# Output
生成した Aggregate Complete Transaction
========== Manual ==========*/

import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

async function SendTokens({ originalPrivateKey, mosaicId, users }) {
    // === 入力チェック ===
    if (!originalPrivateKey) throw new Error('originalPrivateKey is undefined');
    if (!mosaicId) throw new Error('mosaicId is undefined');
    if (!Array.isArray(users) || users.length === 0) throw new Error('users array is empty');

    // Facade 初期化
    const facade = new SymbolFacade('testnet');

    // サイン用 KeyPair 作成
    const privateKey = new PrivateKey(originalPrivateKey);
    const signer = facade.createAccount(privateKey);

    // === innerTx（送信トランザクション）作成 ===
    const innerTxs = users.map(user => {
        if (!user.address) throw new Error('User address missing');
        if (user.amount === undefined) throw new Error('User amount missing');

        // mosaicId と amount を BigInt に変換
        const mosaicIdBigInt = BigInt(mosaicId.startsWith('0x') ? mosaicId : '0x' + mosaicId);
        const amountBigInt = BigInt(user.amount);

        return facade.transactionFactory.createEmbedded({
            type: 'transfer_transaction_v1',
            signerPublicKey: signer.publicKey,   // innerTx signer は aggregate signer と同じ
            recipientAddress: user.address,
            mosaics: [{ mosaicId: mosaicIdBigInt, amount: amountBigInt }]
        });
    });

    if (innerTxs.length === 0) throw new Error('No transactions to aggregate');

    // === Aggregate Complete Transaction 作成 ===
    // deadline は SDK v3 方式（BigInt の timestamp）
    const networkTimestamp = facade.network.fromDatetime(new Date(Date.now() + 60 * 60 * 1000)); // 1時間後
    const deadline = BigInt(networkTimestamp.timestamp);

    const aggregateTx = facade.transactionFactory.create({
        type: 'aggregate_complete_transaction_v1',
        signerPublicKey: signer.publicKey,
        transactions: innerTxs,
        deadline
    });

    // fee 計算（size * 100）
    aggregateTx.fee = BigInt(aggregateTx.size) * 100n;

    return aggregateTx;
}

export default SendTokens;