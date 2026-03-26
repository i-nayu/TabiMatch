/*========== Manual ==========
# Input(obj)
networkType: 'testnet' または 'mainnet'

senderPrivateKey: モザイク発行者の秘密鍵（.env から）

transferable (default: true):
  true  → 他アカウントへ送信可能
  false → 発行者のみ保有可能

deadlineHours (default: 2):
  トランザクションの有効期限（1〜2時間に自動制限）


# Output (Object)
{
  mosaicId: string (16桁HEX),
    → 生成されたモザイクID

  mosaicDefinitionTx: Transaction,
    → MosaicDefinitionTransaction（未署名）

  keyPair: Account,
    → 署名用アカウント情報

  facade: SymbolFacade
    → SDK操作用オブジェクト
}

#Description
実際にブロックチェーンへ反映するには署名とアナウンスが別途必要。
========== Manual ==========*/

import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';
import { generateMosaicId } from 'symbol-sdk/symbol';

export function CreateMosaicTx({
    networkType = 'testnet',
    privateKey,
    transferable = true,
    duration = 86400n,
    fee = 1_000_000n,
    deadlineHours = 2
}) {

    const facade = new SymbolFacade(networkType);

    const keyPair = facade.createAccount(privateKey);

    const safeDeadlineHours = Math.min(Math.max(Number(deadlineHours) || 2, 1), 2);
    const deadline = facade.network
        .fromDatetime(new Date())
        .addHours(safeDeadlineHours)
        .timestamp;

    // uint32 nonce
    const nonce = (Math.random() * 0xffffffff) >>> 0;

    // flags
    let flags = 0;
    flags |= 0x01; // supplyMutable
    if (transferable) flags |= 0x02;

    // ★ mosaicIdは計算だけする（Txには入れない）
    const ownerAddress = facade.network.publicKeyToAddress(keyPair.publicKey);
    const mosaicIdBigInt = generateMosaicId(ownerAddress, nonce);
    const mosaicIdHex = mosaicIdBigInt
        .toString(16)
        .toUpperCase()
        .padStart(16, '0');

    const mosaicDefinitionTx = facade.transactionFactory.create({
        type: 'mosaic_definition_transaction_v1',
        signerPublicKey: keyPair.publicKey,
        fee: BigInt(fee),
        duration: BigInt(duration),
        nonce: nonce,
        flags: flags,
        divisibility: 0,
        deadline: deadline
    });

    return {
        mosaicId: mosaicIdHex,
        mosaicDefinitionTx,
        keyPair,
        facade
    };
}