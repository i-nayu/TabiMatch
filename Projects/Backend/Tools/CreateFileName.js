/*========== Manual ==========
# Input
originalName: アップロードされたファイル名

# Output
被らないファイル名を返す
========== Manual ==========*/


// ===被らないファイル名を作成=== //
import path from "path";
import { randomUUID } from "crypto";

function CreateFileName(originalName) {
  //拡張子取り出し(extname: .pngなど)
  const ext = path.extname(originalName);
  const Refilename = `${randomUUID()}${ext}`;
  console.log(`Generated unique filename: ${Refilename}`);
  //タイムスタンプを付与して被らないようにする
  return Refilename;
}

export default CreateFileName;