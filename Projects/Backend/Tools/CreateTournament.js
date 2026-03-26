import express from 'express';
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
import SendTokens from './SendTokens.js'; //複数の相手にまとめて送信する関数
import GetCurrencyMosaicId from './GetCurrencyMosaicId.js';
import GetAddress from './GetAddress.js';
import LeftToken from './LeftToken.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function CreateTournament() {
    console.log(`[Create tournament] Job started `);



    // =====================================================================
    // トーナメント作成処理
    // =====================================================================
    try {
        const privateKey = new PrivateKey(process.env.TOURNAMENT_PRIVATE_KEY);

        // ===== Mosaic定義トランザクション作成 =====
        const { mosaicId, mosaicDefinitionTx, keyPair, createFacade } = CreateMosaicTx({
            networkType: 'testnet',
            privateKey,
            transferable: true,
            deadlineHours: 24
        });


        //供給変更トランザクションを作成
        console.log("[Create tournament] Creating Supply Change Transaction...");
        const { supplyTx, keyPair: supplyKeyPair, supplyFacade } = CreateSupplyTx({
            networkType: 'testnet',
            privateKey,
            mosaicId: mosaicId,
            supply: 1000000n, // 100万枚供給
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
                console.log("[Create tournament] Announcing Mosaic Definition Transaction...");

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
                console.log("[Create tournament] Mosaic Definition TX Hash:", definitionResult.hash);
                console.log("[Create tournament] Mosaic Definition TX Announced Successfully!");
            } catch (txErr) {
                console.log("[Create tournament] Mosaic Definition TX Error", txErr);
                return;
            }


            //供給変更の署名とアナウンス
            try {
                console.log("[Create tournament] Announcing Supply Change Transaction...");


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
                console.log("[Create tournament] Supply Change TX Hash:", supplyResult.hash);
                console.log("[Create tournament] Supply Change TX Announced Successfully!");
                

                await DBPerf(
                    "Update voteRight",
                    "UPDATE Vote SET Vote = false, Give = false"
                );
            } catch (txErr) {
                console.log("[Create tournament] Supply Change TX Error", txErr);
                return;
            }

            // Mosaicテーブルに新規トーナメント情報を追加
            try {
                const now = new Date();
                const createTime = now.toISOString().slice(0, 19).replace('T', ' ');
                // 例: 24時間後をExpireTimeとする
                const expireTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
                await DBPerf(
                    "Insert Tournament Mosaic",
                    "INSERT INTO Mosaic (MosaicId, CreateTime, ExpireTime) VALUES (?, ?, ?)",
                    [mosaicId, createTime, expireTime]
                );
                console.log(`[Create tournament] Mosaic info inserted to DB: ${mosaicId}`);
            } catch (dbErr) {
                console.error("[Create tournament] Failed to insert Mosaic info to DB", dbErr);
            }



        } catch (txErr) {
            console.error("Error: Tournament-Announce", txErr);
            return;
        }


    } catch (err) {
        console.error("Error: Tournament-Create", err);
        return;
    }
}




console.log('[Create tournament] Cron job registered');

export default CreateTournament;
