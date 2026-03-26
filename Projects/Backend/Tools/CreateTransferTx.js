/*========== Manual ==========
# Input(obj)
res: (req, res) => {}のres
networkType: 'testnet'
senderPrivateKey: 送信者の秘密鍵
recipientRawAddress: 受信者のadress
messageText: 送信メッセージ `ここに書く`
fee: トランザクション手数料
mosaics: [
            { 
                mosaicId: BigInt('0xXXXXXXXXXXXXXXX'),
                amount: BigInt(100)
            }
          ]
deadlineHours: 有効期限

# Output(obj)
{
    tx: TransferTransactionオブジェクト,
    createTransferTx: TransferTransactionオブジェクト（互換用）,
    keyPair: 生成されたKeyPair,
    facade: SymbolFacadeインスタンス
}

#Description
この関数では署名やアナウンスは行われません
========== Manual ==========*/

import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

function CreateTransferTx({
    networkType = 'testnet',
    senderPrivateKey,
    recipientRawAddress,
    messageText = '',
    fee = 100_000n,
    mosaics = [],
    deadlineHours = 2,
}) {
    // Startup Log
    const logOwner = "CreateTransferTx";
    console.log(`\n${logOwner}-Function is running!\n`);
    
    // I/O Log (mosaicsはBigIntを含むため、そのまま表示するとエラーになるのを回避)
    console.log(`[${logOwner}] Input => networkType: ${networkType}, recipientRawAddress: ${recipientRawAddress}, messageText: ${messageText}, deadlineHours: ${deadlineHours}`);

    // Facade 初期化
    const facade = new SymbolFacade(networkType);
    
    // 秘密鍵 → KeyPair (v3推奨の書き方)
    const privateKeyObject = new PrivateKey(senderPrivateKey.trim());
    const keyPair = facade.createAccount(privateKeyObject);
    
    // Deadline 作成 (v3のfromDatetimeはDateオブジェクトを受け取ります)
    const safeDeadlineHours = Math.min(Math.max(Number(deadlineHours) || 2, 1), 2);
    const deadline = facade.network.fromDatetime(new Date()).addHours(safeDeadlineHours).timestamp;
    console.log(`[${logOwner}] Intermediate => KeyPair created, Deadline calculated`);

    // メッセージの作成
    // Symbolの仕様上、平文メッセージの先頭には「0x00」の1バイトを付与する必要があります。
    // メッセージが空の場合は空の配列(Uint8Array(0))にします。
    const message = messageText 
        ? new Uint8Array([0x00, ...new TextEncoder().encode(messageText)]) 
        : new Uint8Array(0);

    // トランザクション作成
    // v3のファクトリーは宛先に文字列をそのまま渡すことができます。
    const createTransferTx = facade.transactionFactory.create({
        type: 'transfer_transaction_v1',
        signerPublicKey: keyPair.publicKey,
        fee: BigInt(fee),
        recipientAddress: recipientRawAddress,
        mosaics,
        message,
        deadline
    });

    // I/O Log (オブジェクトをテンプレートリテラルで表示しようとすると [object Object] になるので修正)
    console.log(`[${logOwner}] Output => createTransferTx: `, {
        type: createTransferTx.type,
        recipientAddress: createTransferTx.recipientAddress.toString(),
        mosaicsCount: createTransferTx.mosaics.length,
        deadline: createTransferTx.deadline.toString(),
        MaxFee: createTransferTx.fee.toString()
    });
    
    // Shutdown Log
    console.log(`[${logOwner}] Shutdown!`);

    return {
        tx: createTransferTx, // ルーター側の受け取り用 (const { tx } = ...)
        createTransferTx,     // 互換性維持
        keyPair,
        facade
    };
}

export default CreateTransferTx;