/*========== Manual ==========
# Input
{
  networkType?: string, // ネットワーク種別（例: 'testnet' / 'mainnet'）
  privateKey: PrivateKey, // 送信者の秘密鍵（symbol-sdkのPrivateKeyインスタンス）
  supply?: number | bigint, // 増加させるモザイク供給量（デフォルト: 1,000,000）
  mosaicId: string, // 対象モザイクID（16進数文字列・0xなし）
  fee?: number | bigint, // トランザクション手数料（デフォルト: 1,000,000）
  deadlineHours?: number // 有効期限（時間、1〜2時間に自動補正）
}

# Output
{
  supplyTx: object, // モザイク供給変更トランザクションオブジェクト
  keyPair: object, // 署名用アカウント（facade.createAccountの戻り値）
  facade: SymbolFacade // 使用したSymbolFacadeインスタンス
}

# Description
Symbolブロックチェーン上で既存モザイクの供給量を増加させるトランザクションを生成する関数。
この関数はトランザクションの生成のみを担当し、署名やアナウンスは行わない。
署名やアナウンスは行わず、トランザクション生成のみを担当する。


## 注意点
- `mosaicId` は 16進数文字列（0xなし）で渡す必要がある
- 内部で `BigInt('0x' + mosaicId)` に変換される
- `supply` は必ず 0 より大きい値である必要がある
- 本関数は supply増加（action: 1）のみ対応（減少は未対応）
- deadlineHours は 1〜2時間に強制制限される
========== Manual ==========*/

import { SymbolFacade } from 'symbol-sdk/symbol';

export const CreateSupplyTx = ({
    networkType = 'testnet',
    privateKey,
    supply = 1_000_000n,
    mosaicId,
    fee = 1_000_000n,
    deadlineHours = 2
}) => {

    const logOwner = "CreateSupplyTx";
    console.log(`\n[${logOwner}] Starting...`);

    if (!privateKey)
        throw new Error("senderPrivateKey is undefined");

    if (!mosaicId)
        throw new Error("mosaicId is undefined");

    const supplyDelta = BigInt(supply);
    if (supplyDelta <= 0n)
        throw new Error("supply must be greater than 0");

    // Facade
    const facade = new SymbolFacade(networkType);

    // Account
    const keyPair = facade.createAccount(privateKey);

    // Deadline
    const safeDeadlineHours = Math.min(Math.max(Number(deadlineHours) || 2, 1), 2);
    const deadline = facade.network
        .fromDatetime(new Date())
        .addHours(safeDeadlineHours)
        .timestamp;

    // ★ ここ重要
    const supplyTx = facade.transactionFactory.create({
        type: 'mosaic_supply_change_transaction_v1',
        signerPublicKey: keyPair.publicKey,
        fee: BigInt(fee),

        mosaicId: BigInt('0x' + mosaicId), // 必ずBigInt
        delta: supplyDelta,                // 必ずBigInt
        action: 1,                         // increase は 1

        deadline
    });

    console.log(`[${logOwner}] Transaction created.`);
    console.log(`[${logOwner}] Shutdown!`);

    return {
        supplyTx,
        keyPair,
        facade
    };
};

export default CreateSupplyTx;