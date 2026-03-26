import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

//関数読み込み
import DBPerf from '../Tools/DBPerf.js';
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
    console.log("/Login-API is running");

    // フロントエンドのビルド済みHTMLを返す
    res.sendFile(
        path.join(__dirname, "..", "public", "index.html")
    );
}
);

// =====================================================================
// ユーザー登録処理
// =====================================================================
router.post('/Submit', async (req, res) => {
    console.log("Submit-API is running");
    try {
        //フロントからの入力値を取得
        const { privateKey } = req.body;

        //必須項目チェック
        if (!privateKey) {
            return res.status(400).json({ message: "Bad Request: privateKey が不足しています" })
        }

        const address = GetAddress("testnet", privateKey);



        // DB保存
        await DBPerf(
            "Insert Into Identify",
            "INSERT INTO Identify (Address) VALUES (?)",
            [address]
        );

        await DBPerf(
            "Insert Into Vote",
            "INSERT INTO Vote (Address) VALUES (?)",
            [address]
        );


        // 登録成功
        res.status(200).json({
            address,
            message: "登録成功！"
        });

    } catch (err) {
        console.error("Error: Register-/Submit", err);
        res.status(500).json({ message: "Internal Server Error: サーバーエラーが発生しました。" });
    }
});


export default router;