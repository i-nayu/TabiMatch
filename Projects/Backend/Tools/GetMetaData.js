/*========== Manual ==========
# Input
input: 写真（ファイルかパス）

# Output
{
  takenAt: Date, //撮影日時
  location: { //撮影場所
    lat: number, //緯度
    lng: number //経度
  }
}
========== Manual ==========*/

import exifr from "exifr";
async function GetMetadata(input) {
  try {
    const data = await exifr.parse(input, {
      gps: true,
      translateValues: true,
    });

    if (!data) {
      throw new Error("メタデータ取得エラー: 写真からデータが取得できません");
    }

    const takenAt = data.DateTimeOriginal || data.CreateDate;
    const lat = data.latitude;
    const lng = data.longitude;

    if (!takenAt) {
      throw new Error("メタデータ取得エラー: 撮影日時の情報が取得できません");
    }

    if (lat == null || lng == null) {
      throw new Error("メタデータ取得エラー: 緯度・経度の情報が取得できません");
    }

    return {
      takenAt,
      location: {
        lat,
        lng,
      },
    };
  } catch (err) {
    throw new Error(`メタデータ取得エラー: ${err.message}`);
  }
}

export default GetMetadata;