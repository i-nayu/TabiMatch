

import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// symbol-sdk v3
import { PrivateKey } from 'symbol-sdk';

//関数読み込み
import DBPerf from './DBPerf.js';
import { CreateMosaicTx } from './CreateMosaicTx.js';
import SignAndAnnounce from './SignAndAnnounce.js';
import CreateSupplyTx from './SupplyMosaic.js';
import GetCurrencyMosaicId from './GetCurrencyMosaicId.js';
import GetAddress from './GetAddress.js';
import LeftToken from './LeftToken.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function IssueMosaic(supply, originalPrivateKey, label) {
    console.log(`[Issue ${label}] Job started `);
    let definitionHash = null;



    // =====================================================================
    // モザイク作成処理
    // =====================================================================
    try {
        const privateKey = new PrivateKey(originalPrivateKey);

        // ===== Mosaic定義トランザクション作成 =====
        const { mosaicId, mosaicDefinitionTx, keyPair, createFacade } = CreateMosaicTx({
            networkType: 'testnet',
            privateKey,
            transferable: true,
            deadlineHours: 24
        });


        //供給変更トランザクションを作成
        console.log(`[Issue ${label}] Creating Supply Change Transaction...`);
        const { supplyTx, keyPair: supplyKeyPair, supplyFacade } = CreateSupplyTx({
            networkType: 'testnet',
            privateKey,
            mosaicId: mosaicId,
            supply: supply, // 1枚供給
            deadlineHours: 24
        });





        try {
            // =============================
            // まとめて手数料確認
            // =============================
            const nodeUrl = 'https://sym-test-01.opening-line.jp:3001';
            const serverAddress = GetAddress("testnet", process.env.TOURNAMENT_PRIVATE_KEY);
            const currencyMosaicId = await GetCurrencyMosaicId(nodeUrl);
            const xymAmount = BigInt(await LeftToken(serverAddress, currencyMosaicId, nodeUrl));

            const createFee = BigInt(mosaicDefinitionTx.fee);
            const supplyFee = BigInt(supplyTx.fee);

            const totalFee = createFee + supplyFee + 1_000_000n;

            console.log("====== Fee Check ======");
            console.log("Create Fee :", createFee.toString());
            console.log("Supply Fee :", supplyFee.toString());
            console.log("Total Fee  :", totalFee.toString());
            console.log("Balance    :", xymAmount.toString());

            if (xymAmount < totalFee) {
                throw new Error(
                    `手数料不足: 必要=${totalFee.toString()} / 保有=${xymAmount.toString()}`
                );
            }

            // =============================
            // それぞれのアナウンス
            // =============================

            //モザイク定義の署名とアナウンス
            try {
                console.log(`[Issue ${label}] Announcing Mosaic Definition Transaction...`);

                const definitionResult = await SignAndAnnounce(
                    mosaicDefinitionTx,
                    privateKey,
                    'https://sym-test-01.opening-line.jp:3001',
                    {
                        waitForConfirmation: true,
                        confirmationTimeoutMs: 180000,
                        pollIntervalMs: 2000
                    }
                );
                definitionHash = definitionResult.hash;
                console.log(`[Issue ${label}] Mosaic Definition TX Hash:`, definitionResult.hash);
                console.log(`[Issue ${label}] Mosaic Definition TX Announced Successfully!`);
            } catch (txErr) {
                console.log(`[Issue ${label}] Mosaic Definition TX Error`, txErr);
                return;
            }


            //供給変更の署名とアナウンス
            try {
                console.log(`[Issue ${label}] Announcing Supply Change Transaction...`);


                const supplyResult = await SignAndAnnounce(
                    supplyTx,
                    privateKey,
                    'https://sym-test-01.opening-line.jp:3001',
                    {
                        waitForConfirmation: true,
                        confirmationTimeoutMs: 180000,
                        pollIntervalMs: 2000
                    }
                );
                console.log(`[Issue ${label}] Supply Change TX Hash:`, supplyResult.hash);
                console.log(`[Issue ${label}] Supply Change TX Announced Successfully!`);

                // =============================================================
                // 【重要】呼び出し元に返す値を決定
                // =============================================================
                const result = {
                    success: true,
                    mosaicId: mosaicId.toString(16).toUpperCase(), // DB保存用に16進数文字列にする
                    definitionHash,
                    supplyHash: supplyResult.hash,
                    label: label
                };

                return result;

            } catch (txErr) {
                console.log(`[Issue ${label}] Supply Change TX Error`, txErr);
                return;
            }



        } catch (txErr) {
            console.error(`Error: ${label}-Announce`, txErr);
            return;
        }


    } catch (err) {
        console.error(`Error: ${label}-Create`, err);
        return;
    }
}




console.log('[Issue mosaic] Cron job registered');

export default IssueMosaic;
