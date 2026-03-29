import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';   // Cookie解析
import multer from 'multer';
import { PrivateKey } from 'symbol-sdk';


//関数読み込み
import DBPerf from '../Tools/DBPerf.js';
import SaveIcon from '../Tools/SaveIcon.js';
import CreateTransferTx from '../Tools/CreateTransferTx.js';
import SignAndAnnounce from '../Tools/SignAndAnnounce.js';
import CreateSupplyTx from '../Tools/SupplyMosaic.js';
import LeftToken from '../Tools/LeftToken.js';
import GetCurrencyMosaicId from '../Tools/GetCurrencyMosaicId.js';
import GetAddress from '../Tools/GetAddress.js';
import CreateTournament from '../Tools/CreateTournament.js';
import GetMetaData from '../Tools/GetMetaData.js';

// ==========================
// 環境変数の読み込み
// ==========================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

router.use(express.json());

// cookieを使う
router.use(cookieParser());
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const MAX_UPLOAD_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_UPLOAD_PHOTO_SIZE_BYTES },
});

const uploadPhotoMiddleware = (req, res, next) => {
    upload.single('photo')(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: "写真サイズが上限を超えています（上限: 5MB）" });
        }

        console.error("[Upload] Multer Error:", err);
        return res.status(400).json({ message: "写真アップロードに失敗しました" });
    });
};

function getErrorMessage(error) {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'トランザクションエラーが発生しました。';
}

function classifyTxError(error) {
    const rawMessage = getErrorMessage(error);
    const normalized = rawMessage.toLowerCase();

    const isAccountNotReady =
        normalized.includes('resource_not_found') ||
        normalized.includes('account not found') ||
        normalized.includes('address not found') ||
        normalized.includes('unknown account') ||
        normalized.includes('unrecognized account') ||
        normalized.includes('state cache');

    if (isAccountNotReady) {
        return {
            status: 409,
            message: 'アカウント情報の反映待ちです。ページをリロードして再試行してください。'
        };
    }

    if (normalized.includes('insufficient_balance')) {
        return {
            status: 400,
            message: '手数料用XYMが不足しています。テストネットXYMを受け取って再試行してください。'
        };
    }

    if (normalized.includes('timeout')) {
        return {
            status: 504,
            message: 'トランザクション確認がタイムアウトしました。ページをリロードして状態を確認してください。'
        };
    }

    return {
        status: 500,
        message: `トランザクションエラー: ${rawMessage}`
    };
}

let isGiveVoteProcessing = false;
const voteProcessingUsers = new Set();

// =====================================================================
// HTML送信API
// =====================================================================
router.get('/', (req, res) => {
    console.log("/Tournament-API is running");

    // フロントエンドのビルド済みHTMLを返す
    res.sendFile(
        path.join(__dirname, "..", "public", "index.html")
    );
}
);

// =====================================================================
// 画面表示API
// =====================================================================
router.post('/PhotoList', async (req, res) => {
    console.log("Tournament-/List-API is running");
    const nodeUrl = 'https://sym-test-01.opening-line.jp:3001';
    const currencyVote = await GetCurrencyMosaicId(nodeUrl);
    const tournamentPrivateKeyText = process.env.TOURNAMENT_PRIVATE_KEY?.trim();
    if (!tournamentPrivateKeyText) {
        return res.status(500).json({ message: "TOURNAMENT_PRIVATE_KEY が未設定です" });
    }
    const tournamentPrivateKey = new PrivateKey(tournamentPrivateKeyText);
    const serverAddress = GetAddress("testnet", tournamentPrivateKeyText);

    try {
        let address;
        const textPrivateKey = req.body.qrFromSession;
            if (!textPrivateKey) {
                console.log("Missing required fields in Upload request");
                return res.status(400).json({ message: "privateKey are required" });
            }
            address = GetAddress("testnet", textPrivateKey);
        /*トーナメント作成*/
        const createResults = await DBPerf(
            "Get Active Tournament",
            `SELECT MosaicID, CreateTime, ExpireTime FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1`,
            []
        );
        if (!createResults || createResults.length === 0) {
            if (address) {
                await DBPerf(
                    "Update vote",
                    "UPDATE Vote SET Vote = false, Give = false WHERE Address = ?",
                    [address]
                );
            }
            console.log("[Tournament] No Mosaic Found. Create Tournament.");
            await CreateTournament();
        }

        //現在のトークン数を取得
        try {

            const voteResult = await DBPerf(
                "Get Vote",
                "SELECT Vote, Give FROM Vote WHERE Address = ?; ",
                [address]
            );

            const vote = voteResult[0].Vote; //投票したかどうか
            const give = voteResult[0].Give; //配布されたかどうか

            const mosaicId = await DBPerf(
                "Get Active MosaicId",
                "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
                []
            );
            if (!mosaicId.length) {
                return res.status(400).json({ message: "現在開催中のトーナメントがありません" });
            }
            const mosaicIdHex = mosaicId[0].MosaicID;
            const userVote = await LeftToken(address, mosaicIdHex, nodeUrl);
            console.log(`User ${address} has ${userVote} vote tokens left.`);

            //投票権が配布されているかどうか
            if (userVote == 0 && vote == false && give == false) {
                if (isGiveVoteProcessing) {
                    return res.status(429).json({ message: "投票権配布処理中です。少し待って再試行してください。" });
                }
                isGiveVoteProcessing = true;
                try {
                    console.log("[Give Vote] Give Vote To Server Transaction...");
                    const { tx, keyPair, voteFacade } = CreateTransferTx({
                        networkType: 'testnet',
                        senderPrivateKey: tournamentPrivateKeyText,
                        recipientRawAddress: address,
                        messageText: `Give Vote`,
                        fee: 100_000n,
                        mosaics: [
                            {
                                mosaicId: BigInt(`0x${mosaicIdHex}`),
                                amount: 1n
                            }
                        ],
                        deadlineHours: 2,
                    });

                    //投票の署名とアナウンス
                    console.log("[Give Vote] Announcing Give Vote Transaction...");
                    let serverVoteBalance = await LeftToken(serverAddress, mosaicIdHex, nodeUrl);
                    console.log("ServerVoteBalance:", serverVoteBalance.toString());

                    //手数料が足りているかどうか
                    const currencyMosaicId = await GetCurrencyMosaicId(nodeUrl);
                    const xymAmount = await LeftToken(serverAddress, currencyMosaicId, nodeUrl);
                    const transferFee = BigInt(tx.fee);
                    console.log(`[Give Vote] Fee Check: Server=${serverAddress}, XYM Balance=${xymAmount.toString()}, Fee=${transferFee.toString()}`);
                    if (xymAmount < transferFee) {
                        throw new Error(`手数料用XYM不足です: 必要=${transferFee.toString()} / 保有=${xymAmount.toString()}`);
                    }
                    if (serverVoteBalance < 1n) {
                        console.log("[Give Vote] Server vote mosaic is empty. Supply top-up starts...");
                        const { supplyTx } = CreateSupplyTx({
                            networkType: 'testnet',
                            privateKey: tournamentPrivateKey,
                            mosaicId: mosaicIdHex,
                            supply: 10000n,
                            deadlineHours: 2,
                        });

                        const totalRequiredFee = transferFee + BigInt(supplyTx.fee);
                        if (xymAmount < totalRequiredFee) {
                            throw new Error(`手数料用XYM不足です(供給追加込み): 必要=${totalRequiredFee.toString()} / 保有=${xymAmount.toString()}`);
                        }

                        const supplyResult = await SignAndAnnounce(
                            supplyTx,
                            tournamentPrivateKey,
                            'https://sym-test-01.opening-line.jp:3001',
                            {
                                waitForConfirmation: true,
                                confirmationTimeoutMs: 180000,
                                pollIntervalMs: 2000
                            }
                        );
                        console.log("[Give Vote] Supply top-up TX Hash:", supplyResult.hash);

                        serverVoteBalance = await LeftToken(serverAddress, mosaicIdHex, nodeUrl);
                        console.log("[Give Vote] ServerVoteBalance(after top-up):", serverVoteBalance.toString());
                        if (serverVoteBalance < 1n) {
                            throw new Error(`投票モザイク不足です: 必要=1 / 保有=${serverVoteBalance.toString()}`);
                        }
                    }

                    const voteResult = await SignAndAnnounce(
                        tx,
                        tournamentPrivateKey,
                        'https://sym-test-01.opening-line.jp:3001',
                        {
                            waitForConfirmation: true,
                            confirmationTimeoutMs: 180000,
                            pollIntervalMs: 2000
                        }
                    );

                    console.log("[Give Vote] Give Vote To Server TX Hash:", voteResult.hash);
                    console.log("[Give Vote] Give Vote To Server TX Announced Successfully!");

                    const result = await DBPerf(
                        "Update Give",
                        "UPDATE Vote SET Give = true WHERE Address = ? AND Give = false",
                        [address]
                    );
                    if (result.affectedRows === 0) {
                        console.log("Already given");
                    }
                } finally {
                    isGiveVoteProcessing = false;
                }


            }

        } catch (txErr) {
            console.error("[Give Vote] Error:", txErr);
            const txError = classifyTxError(txErr);
            return res.status(txError.status).json({ message: txError.message });
        }

        // バックエンドで定義するテーマと終了日時
        const theme = "知床";
        const mosaicId = await DBPerf(
            "Get Active MosaicId",
            "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
            []
        );
        if (!mosaicId.length) {
            return res.status(400).json({ message: "現在開催中のトーナメントがありません" });
        }
        const mosaicIdHex = mosaicId[0].MosaicID;
        if (address) {
            const userVote = await LeftToken(address, mosaicIdHex, nodeUrl) ?? 0;
            console.log(`User ${address} has ${userVote} vote tokens left.`);
        }

        // すでに取得している mosaicIdHex を利用
        let photos = await DBPerf(
            "Get Photo List",
            `SELECT PhotoID, PhotoPath, Comment, PhotoTime, PhotoLat, PhotoLng 
            FROM Photos 
            WHERE MosaicID = ?`,
            [mosaicIdHex]
        );

        const expireResult = await DBPerf(
            "Get ExpireTime",
            `SELECT ExpireTime 
            FROM Mosaic 
            WHERE CreateTime <= NOW() AND ExpireTime >= NOW() 
            ORDER BY CreateTime DESC 
            LIMIT 1`,
            []
        );

        const expireTime = expireResult[0]?.ExpireTime ?? null;

        // 残り投票数（userVoteが1以上なら1、0なら0）
        const votesResult = await DBPerf(
            "Get Vote Left",
            `SELECT (NOT Vote) + 0 AS VoteNumber FROM Vote WHERE Address = ?`,
            [address]
        );
        const votesLeft = votesResult[0]?.VoteNumber ?? 0;

        res.status(200).json({
            theme,
            expireTime,
            photos,
            votesLeft
        });

    } catch (err) {
        console.error("Error: Tournament-/List", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// =====================================================================
// 写真追加API
// =====================================================================
router.post('/Upload', uploadPhotoMiddleware, async (req, res) => {
    console.log("Tournament-/Upload-API is running");

    try {
        const privateKey = req.body.privateKey;
        const comment = req.body.comment;
        if (!privateKey || !comment) {
            console.log("Missing required fields in Upload request");
            return res.status(400).json({ message: "privateKey and Comment are required" });
        }

        if (!req.file) {
            console.log("Missing required fields in Upload request");
            return res.status(400).json({ message: "Photo is required" });
        }

        const { takenAt, location } = await GetMetaData(req.file.buffer);

        const address = GetAddress("testnet", privateKey);

        //すでに写真を投稿していないかチェック
        const mosaicIdResult = await DBPerf(
            "Get Active MosaicId",
            "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
            []
        );
        const mosaicIdPhoto = mosaicIdResult[0].MosaicID;
        const photoResult = await DBPerf("Get Photos",
            `SELECT PhotoID FROM Photos WHERE Address = ? AND MosaicID = ?`,
            [address, mosaicIdPhoto]
        );
        if (photoResult.length > 0) {
            console.log("[Upload] User has already uploaded a photo");
            return res.status(400).json({ message: "このアドレスは既に写真を投稿しています" });
        }

        const userResult = await DBPerf("Get BidUserID",
            "SELECT Address FROM Identify WHERE Address = ?",
            [address]
        );
        if (!userResult.length) {
            return res.status(404).json({ message: "ユーザーが存在しません" });
        }
        const PhotoPath = SaveIcon(req.file);
        console.log("Photo saved at:", PhotoPath);

        const mosaicId = await DBPerf(
                "Get Active MosaicId",
                "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
                []
            );
        const mosaicIdHex = mosaicId[0].MosaicID;
        //写真投稿をDBに保存
        const result = await DBPerf(
            "INSERT Photos",
            `INSERT INTO Photos(Address, PhotoPath, Comment, MosaicID, PhotoTime, PhotoLat, PhotoLng)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [address, PhotoPath, comment, mosaicIdHex, takenAt, location.lat, location.lng]
        );

        res.status(201).json({
            message: "Uploaded successfully",
            photoId: result.insertId,
            PhotoPath,
            takenAt,
            location
        });
    } catch (err) {
        console.error("Error: Tournament-/Upload", err);
        res.status(500).json({ message: "Internal Server Error: サーバーエラーが発生しました。" });
    }

});



// =====================================================================
// 投票処理API
// =====================================================================
router.post('/Vote', async (req, res) => {
    console.log("Tournament-/Vote-API is running");

    const { textPrivateKey, photoId } = req.body;
    const privateKey = new PrivateKey(textPrivateKey);
    if (!privateKey || !photoId) {
        console.log("Missing required fields in Upload request");
        return res.status(400).json({ message: "privateKey and photoId are required" });
    }
    const userAddress = GetAddress("testnet", textPrivateKey); //投票者のアドレス
    const nodeUrl = 'https://sym-test-01.opening-line.jp:3001';

    if (voteProcessingUsers.has(userAddress)) {
        return res.status(429).json({ message: "投票処理中です。完了までお待ちください。" });
    }
    voteProcessingUsers.add(userAddress);


    try {
        //投票先のaddressを取得
        const Address = await DBPerf(
            "Get address",
            "SELECT Address FROM Photos WHERE PhotoID = ?; ",
            [photoId]
        );
        if (!Address.length) {
            console.log("[Vote] Photo Not Found");
            return res.status(404).json({ message: "投票できる写真がありません" });
        }
        const SendToAddress = Address[0].Address;

        //投票者の情報を取得
        const users = await DBPerf(
            "Get users",
            "SELECT Address, Vote FROM Vote WHERE Address = ?; ",
            [userAddress]
        );

        const mosaicId = await DBPerf(
            "Get Active MosaicId",
            "SELECT MosaicID FROM Mosaic WHERE CreateTime <= NOW() AND ExpireTime >= NOW() ORDER BY CreateTime DESC LIMIT 1",
            []
        );
        if (!mosaicId.length) {
            console.log("[Vote] MosaicId Not Found");
            return res.status(400).json({ message: "現在開催されているトーナメントがありません" });
        }
        const mosaicIdHex = mosaicId[0].MosaicID;

        let voteReserved = false;

        //投票権があるかどうか
        try {
            if (!users.length) {
                return res.status(404).json({ message: "ユーザーが見つかりません" });
            }

            if (users[0].Vote === true || users[0].Vote === 1) {
                console.log("Already voted");
                return res.status(400).json({ message: "このトーナメントでは既に投票済みです" });
            }

            const userVote = await LeftToken(userAddress, mosaicIdHex, nodeUrl);

            if (userVote == 0n) {
                console.log("No Vote to Right");
                return res.status(400).json({ message: "投票権がありません" });
            }

            const reserveVoteResult = await DBPerf(
                "Reserve vote",
                "UPDATE Vote SET Vote = true WHERE Address = ? AND Vote = false",
                [userAddress]
            );

            if (!reserveVoteResult || reserveVoteResult.affectedRows !== 1) {
                return res.status(400).json({ message: "このトーナメントでは既に投票済みです" });
            }
            voteReserved = true;


        } catch (txErr) {
            console.error("[Vote] Vote Get Error:", txErr);
            const txError = classifyTxError(txErr);
            return res.status(txError.status).json({ message: txError.message });
        }

        //投票（トークン送信）トランザクションを作成
        try {
            console.log("[Vote] Creating Vote To Server Transaction...");
            const { tx, keyPair, facade } = CreateTransferTx({
                networkType: 'testnet',
                senderPrivateKey: textPrivateKey,
                recipientRawAddress: SendToAddress,
                messageText: `Vote`,
                fee: 100_000n,
                mosaics: [
                    {
                        mosaicId: BigInt(`0x${mosaicIdHex}`),
                        amount: 1n
                    }
                ],
                deadlineHours: 2,
            });

            //投票の署名とアナウンス
            console.log("[Vote] Announcing Vote Transaction...");

            //手数料が足りているかどうか
            const currencyMosaicId = await GetCurrencyMosaicId(nodeUrl);
            const xymAmount = await LeftToken(userAddress, currencyMosaicId, nodeUrl);
            const transferFee = tx.fee;
            if (xymAmount < transferFee) {
                throw new Error(`手数料用XYM不足です: 必要=${transferFee.toString()} / 保有=${xymAmount.toString()}`);
            }

            const voteResult = await SignAndAnnounce(
                tx,
                privateKey,
                'https://sym-test-01.opening-line.jp:3001',
                {
                    waitForConfirmation: true,
                    confirmationTimeoutMs: 180000,
                    pollIntervalMs: 2000
                }
            );

            console.log("[Vote] Vote To Server TX Hash:", voteResult.hash);
            console.log("[Vote] Vote To Server TX Announced Successfully!");

            res.json({
                message: "投票しました",
                txHash: voteResult.hash
            });
        } catch (txErr) {
            if (voteReserved) {
                try {
                    await DBPerf(
                        "Rollback vote",
                        "UPDATE Vote SET Vote = false WHERE Address = ? AND Vote = true",
                        [userAddress]
                    );
                } catch (rollbackErr) {
                    console.error("[Vote] Rollback Error:", rollbackErr);
                }
            }
            console.error("[Vote] Vote To Server TX Error:", txErr);
            const txError = classifyTxError(txErr);
            return res.status(txError.status).json({ message: txError.message });
        }



    } catch (txErr) {
        console.error("[Vote] Vote TX Error:", txErr);
        const txError = classifyTxError(txErr);
        return res.status(txError.status).json({ message: txError.message });
    } finally {
        voteProcessingUsers.delete(userAddress);
    }
});

export default router;