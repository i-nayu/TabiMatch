/*==========Manual(/Profile/:UserID)==========
# Input
label: ログをコンソールに表示する際のわかりやすいラベルを設定する
例: "Select From Identify To Login"
query: SQL文を入力する
例: "SELECT Address, Password FROM Identify WHERE UserID = ?;"
elements: プレースホルダー用の配列を入力する
例: [userId]

# Output
JSON
例:
{
    { UserID: int, Password: "string", Status: 0 or 1},
    { UserID: int, Password: "string", Status: 0 or 1},
    { UserID: int, Password: "string", Status: 0 or 1},
    ...
}
========== Manual ==========*/
import mysql from 'mysql2/promise';

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
});

// DBPerf.js
async function DBPerf(label, query, elements) {
    // Startup Log
    const logOwner = "DBPerf";
    console.log(`\n${logOwner}-Function is running!\n`);
    // I/O Log
    console.log(`[${logOwner}] Input => label: ${label}, query: ${query}, elements: ${elements}`);

    try{
        // 計測と実行
        const start = Date.now();
        const [result] = await db.query(query, elements);
        const end = Date.now();
        // 計測結果の表示
        console.log(`[${logOwner}] ${label} is executed!: ${end - start} ms`);

        // I/O Log(JSON.stringify(表示するJSON, 表示項目指定, インデックス空白数指定))
        console.log(`[${logOwner}] Output => ${JSON.stringify(result, null, 2)}`);
        // Shutdown Log
        console.log(`[${logOwner}] Shutdown!`);
        return result;
    }catch(err){
        console.error(`[${logOwner}] Error executing "${label}":`, err);
        console.log(`[${logOwner}] Shutdown!`);
        throw err;
    }
}

export default DBPerf;
