import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

//関数読み込み
import DBPerf from '../Tools/DBPerf.js';
import LeftToken from '../Tools/LeftToken.js';
import GetAddress from '../Tools/GetAddress.js';

// ==========================
// 環境変数の読み込み
// ==========================

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();


// JSONボディを解析可能にする
router.use(express.json());

// =====================================================================
// 画面表示API
// =====================================================================
router.get('/', (req, res) => {
    console.log("/Auction-API is running");

    // フロントエンドのビルド済みHTMLを返す
    res.sendFile(
        path.join(__dirname, "..", "public", "index.html")
    );
}
);

// =====================================================================
// 画面表示API
// =====================================================================
router.get('/Auction', async (req, res) => {
    console.log("Auction-/Auction is running");
    const nodeUrl = 'https://sym-test-01.opening-line.jp:3001';

    try {
        const expireResult = await DBPerf(
            "Get expireTime",
            "SELECT ExpireTime FROM Mosaic LIMIT 1", []
        );
        const expireTime = expireResult[0]?.ExpireTime || null;

        //写真リスト + 入札額を取得
        const mosaicId = await DBPerf(
            "Get Active MosaicId",
            "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
            []
        );
        const tournamentMosaicId = mosaicId[0].MosaicID;

        // すでに取得している mosaicIdHex を利用
        let photos = await DBPerf(
            "Get Photo List",
            `SELECT PhotoID, Address, PhotoPath, Comment, Amount 
            FROM Photos 
            WHERE MosaicID = ?`,
            [tournamentMosaicId]
        );

        const photosList = await Promise.all(
            photos.map(async (photo) => {
                const userAddress = photo.Address || null;


                const voteCountBigInt = (userAddress && tournamentMosaicId)
                    ? await LeftToken(userAddress, tournamentMosaicId, nodeUrl)
                    : 0n;
                const voteCount = Number(voteCountBigInt);
                console.log(`VoteCount: ${voteCount}`);

                // voteCountを追加して返す
                return { ...photo, voteCount };
            })
        );

        // voteCount の降順でソート
        photosList.sort((a, b) => b.voteCount - a.voteCount);


        res.status(200).json({
            expireTime,
            photosList
        });

    } catch (err) {
        console.error("Error: Auction-/Auction", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// =====================================================================
// 入札処理
// =====================================================================
router.post('/Bid', async (req, res) => {
    console.log("Bit-API is running");
    try {
        //フロントからの入力値を取得
        const privateKey = req.body.privateKey ?? req.body.textPrivateKey ?? req.body.qrFromSession;
        const { photoId, amount } = req.body;

        //必須項目チェック
        if (privateKey == null || photoId == null || amount == null) {
            console.log("[Auction] Missing required fields: privateKey/photoId/amount");
            return res.status(400).json({ message: "Bad Request: privateKey, photoId, amount が不足しています" });
        }

        const bidAddress = GetAddress("testnet", privateKey); //入札者のアドレス
        const bidResult = await DBPerf("Get Bid Address",
            "SELECT Address FROM Identify WHERE Address = ?",
            [bidAddress]
        );
        if (!bidResult.length) {
            return res.status(404).json({ message: "ユーザーが存在しません" });
        }

        const bidAmount = parseInt(amount, 10);
        if (isNaN(bidAmount) || bidAmount <= 0) {
            console.log("[Auction] Number Error: amount");
            return res.status(400).json({ message: "Error: amount は正の数字である必要があります" });
        }


        const result = await DBPerf(
            "Update amount",
            "UPDATE Photos SET BidUserId = ?, Amount = ? WHERE PhotoID = ? AND (Amount IS NULL OR Amount < ?)",
            [bidAddress, bidAmount, photoId, bidAmount]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                message: "すでにより高い入札があります"
            });
        }

        // 登録成功
        res.status(200).json({
            message: "入札成功!",
            amount: bidAmount
        });

    } catch (err) {
        console.error("Error: Auction-/Bid", err);
        res.status(500).json({ message: "Internal Server Error: サーバーエラーが発生しました。" });
    }
});


export default router;