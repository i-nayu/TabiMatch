// CreateSupplyTx.js
import { PrivateKey } from 'symbol-sdk';
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