import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrivateKey } from 'symbol-sdk';

// symbol-sdk v3

//関数読み込み
import DBPerf from '../Tools/DBPerf.js';
import SignAndAnnounce from '../Tools/SignAndAnnounce.js';
import CreateTransferTx from '../Tools/CreateTransferTx.js';
import GetAddress from '../Tools/GetAddress.js';
import LeftToken from '../Tools/LeftToken.js';
import GetCurrencyMosaicId from '../Tools/GetCurrencyMosaicId.js';

// ==========================
// 環境変数の読み込み
// ==========================

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.use(express.json());



// =====================================================================
// 購入処理・送信API
// =====================================================================
router.post('/AuctionBuy', async (req, res) => {
    try {
        console.log("aquctionBuy-API is running");
        const nodeUrl = 'https://sym-test-01.opening-line.jp:3001';

        // //終了日時
        // const expireResult = await DBPerf("Get ExpireTime",
        //     "SELECT ExpireTime FROM Mosaic"
        // );
        // const now = new Date();
        // const expireTime = expireResult[0]?.ExpireTime;
        // const expire = new Date(expireTime);
        // console.log("now:", now);
        // console.log("expire:", expire);

        // if (!expireTime || now <= expire) {
        //     return res.status(400).json({ message: "オークション期間中です" });
        // }



        try {
            const { privateKey } = req.body;

            //必須項目チェック
            if (!privateKey) {
                console.log("[Auction] Not privateKey");
                return res.status(400).json({ message: "Bad Request: privateKey が不足しています" });
            }

            const buyAddress = GetAddress("testnet", privateKey); //入札者のアドレス
            const buyResult = await DBPerf("Get Buyer Address",
                "SELECT Address FROM Identify WHERE Address = ?",
                [buyAddress]
            );
            if (!buyResult.length) {
                return res.status(404).json({ message: "ユーザーが存在しません" });
            }


            //購入できるものを探す
            const userData = await DBPerf("Search amount",
                `SELECT p.PhotoID, p.NFTMosaicID, p.PhotoPath, p.Amount, p.Address, p.MosaicID
                FROM Photos p
                WHERE p.BidUserID = ? 
                AND p.Purchased = false
                AND p.MosaicID IS NOT NULL`,
                [buyAddress]
            );
            if (!userData.length) {
                console.log("[AuctionBuy] Not Found: photos");
                return res.status(200).json({ message: "購入できる写真がありません" });
            }

            const txHashes = [];
            const currencyMosaicId = await GetCurrencyMosaicId(nodeUrl);

            for (const photo of userData) {
                //支払いトランザクション作成
                console.log("[Buy Photo] Buy Photo Transaction...");
                const sendAmount = BigInt(photo.Amount) * 1_000_000n; // XYM → micro-XYM
                const { tx } = CreateTransferTx({
                    networkType: 'testnet',
                    senderPrivateKey: privateKey,
                    recipientRawAddress: photo.Address,
                    messageText: 'Auction Buy',
                    fee: 100_000n,
                    mosaics: [
                        {
                            mosaicId: BigInt(`0x${currencyMosaicId}`), // XYM を送る
                            amount: sendAmount,
                        },
                    ],
                    deadlineHours: 2,
                });

                //NFTトランザクション作成
                if (!photo.NFTMosaicID) {
                    throw new Error(`NFTMosaicID がありません: PhotoID=${photo.PhotoID}`);
                }

                const { tx: nftTx } = CreateTransferTx({
                    networkType: 'testnet',
                    senderPrivateKey: process.env.TOURNAMENT_PRIVATE_KEY,
                    recipientRawAddress: buyAddress,
                    messageText: 'Auction Buy',
                    fee: 100_000n,
                    mosaics: [
                        {
                            mosaicId: BigInt(`0x${photo.NFTMosaicID}`), // NFTを送る
                            amount: 1n,
                        },
                    ],
                    deadlineHours: 2,
                });

                //手数料が足りているかどうか
                const xymAmount = await LeftToken(buyAddress, currencyMosaicId, nodeUrl); // XYM残高取得
                const transferFee = tx.fee;
                const NFTFee = nftTx.fee;
                const totalFee = transferFee + NFTFee + 1_000_000n; // 予備の手数料も考慮
                console.log("[DEBUG] XYM Amount:", xymAmount.toString());
                console.log("[DEBUG] Transfer Fee:", transferFee.toString());
                console.log("[DEBUG] NFT Fee:", NFTFee.toString());
                console.log("[DEBUG] BuyAddress:", buyAddress);
                if (BigInt(xymAmount) < totalFee) {
                    throw new Error(`手数料用XYM不足です: 必要=${totalFee.toString()} / 保有=${xymAmount.toString()}`);
                }


                //写真購入のアナウンス
                console.log("[Buy Photo] Announcing Buy Photo Transaction...");
                const sendResult = await SignAndAnnounce(
                    tx,
                    new PrivateKey(privateKey),
                    'https://sym-test-01.opening-line.jp:3001',
                        {
                            waitForConfirmation: true,
                            confirmationTimeoutMs: 180000,
                            pollIntervalMs: 2000
                        }
                );
                txHashes.push(sendResult.hash);
                console.log("[Auction Buy] Send XYM TX Hash:", sendResult.hash);

                //NFTのアナウンス
                console.log("[Buy Photo] Announcing NFT Transfer Transaction...");
                const NFTResult = await SignAndAnnounce(
                    nftTx,
                    new PrivateKey(process.env.TOURNAMENT_PRIVATE_KEY),
                    'https://sym-test-01.opening-line.jp:3001',
                        {
                            waitForConfirmation: true,
                            confirmationTimeoutMs: 180000,
                            pollIntervalMs: 2000
                        }
                );
                txHashes.push(NFTResult.hash);
                console.log("[Auction Buy] Send NFT TX Hash:", NFTResult.hash);
            }
            console.log("[Auction Buy] All transfer transactions announced successfully!");

            // DB保存
            for (const photo of userData) {
                await DBPerf(
                    "Insert Into Bought",
                    "INSERT INTO Bought (PhotoID, Address, PhotoPath, BoughtAmount) VALUES (?, ?, ?, ?)",
                    [photo.PhotoID, buyAddress, photo.PhotoPath, photo.Amount]
                );

                // PhotosテーブルのPurchasedフラグをtrueに更新
                await DBPerf(
                    "Update Purchased Flag",
                    "UPDATE Photos SET Purchased = true WHERE PhotoID = ?",
                    [photo.PhotoID]
                );

            }


            // 登録成功
            res.status(200).json({
                message: "購入成功",
                userData,
                txHashes
            });
        } catch (txErr) {
            console.log("Error: Auction Buy", txErr);
            return res.status(500).json({ message: "Internal Server Error: サーバーエラーが発生しました。" });
        }

    } catch (err) {
        console.error("Error: AuctionBuy", err);
        res.status(500).json({ message: "Internal Server Error: サーバーエラーが発生しました。" });
    }
});

export default router;
