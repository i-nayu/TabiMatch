import { PrivateKey } from 'symbol-sdk';
import { SymbolFacade } from 'symbol-sdk/symbol';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForConfirmation(nodeUrl, hash, {
    timeoutMs = 120000,
    intervalMs = 2000
} = {}) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const confirmedRes = await fetch(`${nodeUrl}/transactions/confirmed/${hash}`);
        if (confirmedRes.ok) {
            return { confirmed: true };
        }

        const statusRes = await fetch(`${nodeUrl}/transactionStatus/${hash}`);
        if (statusRes.ok) {
            const statusJson = await statusRes.json();
            const code = statusJson?.code;
            if (code && code !== 'Success') {
                throw new Error(`Transaction rejected: ${code}`);
            }
        }

        await sleep(intervalMs);
    }

    throw new Error(`Transaction confirmation timeout: ${hash}`);
}

export default async function SignAndAnnounce(tx, privateKey, nodeUrl, options = {}) {
    // Startup Log
    const logOwner = "SignAndAnnounce";
    console.log(`\n${logOwner}-Function is running!\n`);
    const {
        waitForConfirmation: shouldWaitForConfirmation = false,
        confirmationTimeoutMs = 120000,
        pollIntervalMs = 2000
    } = options;
    
    // I/O Log 
    // ※ テンプレートリテラル( `${}` )内でオブジェクトを呼ぶと [object Object] になってしまうため、
    // カンマ区切りでオブジェクトとして安全にコンソールに出力します。
    console.log(`[${logOwner}] Input => tx:`, {
        type: tx.type,
        recipientAddress: tx.recipientAddress ? tx.recipientAddress.toString() : undefined,
        mosaicsCount: tx.mosaics ? tx.mosaics.length : 0,
        deadline: tx.deadline ? tx.deadline.toString() : undefined,
    });
    console.log(`[${logOwner}] Input => nodeUrl: ${nodeUrl}`);

    // Facade 初期化
    const facade = new SymbolFacade('testnet');

    // 秘密鍵 → KeyPair (v3推奨の書き方)
    const account = facade.createAccount(privateKey);

    try {
        // 署名 (v3 SDK)
        const signature = facade.signTransaction(account.keyPair, tx);
        if (!tx.signature?.bytes || !signature?.bytes) {
            throw new Error('Transaction signature buffer is invalid');
        }
        tx.signature.bytes.set(signature.bytes);

        const hash = facade.hashTransaction(tx).toString();
        console.log(`[${logOwner}] Transaction Hash: ${hash}`);
        
        // 署名付きトランザクションペイロード作成 (v3 SDK)
        // ※ v3では attachSignature が JSON形式の文字列（'{"payload": "..."}'）を返すのが標準的です。
        // もし既存の createTransactionPayload が動作している場合はそちらをお使いください。
        let payloadString;
        if (typeof facade.transactionFactory.constructor.attachSignature === 'function') {
            payloadString = facade.transactionFactory.constructor.attachSignature(tx, signature);
        } else {
            // 下位互換・代替ロジック
            const payload = facade.transactionFactory.createTransactionPayload(tx, signature);
            payloadString = JSON.stringify({ payload });
        }

        // アナウンス
        const res = await fetch(`${nodeUrl}/transactions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: payloadString,
        });

        // アナウンスチェック
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Announce failed: ${res.status} ${text}`);
        }

        console.log(`[${logOwner}] Successfully announced transaction!`);

        if (shouldWaitForConfirmation) {
            console.log(`[${logOwner}] Waiting for confirmation...`);
            await waitForConfirmation(nodeUrl, hash, {
                timeoutMs: confirmationTimeoutMs,
                intervalMs: pollIntervalMs
            });
            console.log(`[${logOwner}] Transaction confirmed!`);
        }

        return {
            hash,
            announced: true,
            confirmed: shouldWaitForConfirmation
        };

    } catch (error) {
        console.error(`[${logOwner}] Error:`, error);
        throw error; // ルーター側のcatchで捕まえられるようにエラーを再スローします
    }

    // Shutdown Log
    console.log(`[${logOwner}] Shutdown!`);

    return;
}

