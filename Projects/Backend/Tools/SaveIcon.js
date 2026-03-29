/*========== Manual ==========
# Input
buffer: アイコンファイルのバッファ
originalname: アイコンファイルの元の名前（拡張子を取得するため）
folder: 保存先フォルダ名

# Output
DBに入れる用の「相対パス」を返す
認証失敗の場合はエラーを返す

#Description
アップロードされたアイコン画像を指定フォルダに保存する処理
========== Manual ==========*/
import CreateFileName from "./CreateFileName.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===アイコン保存処理===
function SaveIcon(buffer, originalname){
    const fileName = CreateFileName(originalname);
    const dir = path.join(__dirname, "..", "icons");

    // フォルダが存在しない場合は作成
    fs.mkdirSync(dir, { recursive: true });

    // ファイルを保存
    const fullPath = path.join(dir, fileName);
    fs.writeFileSync(fullPath, buffer);

    console.log(`Icon saved to ${fullPath}`);

    // DBに入れる用の「相対パス」
    return `/icons/${fileName}`;
}

export default SaveIcon;