import fs from "fs";
import path from "path";
import sharp from "sharp";
import convert from "heic-convert";

import SaveIcon from "./SaveIcon.js";

export async function AddWatermark(inputPath) {
    // 1. パスの解決
    // inputPathが "/icons/xxx.HEIC" の場合、先頭の "/" を取ってから結合する
    const relativePath = inputPath.startsWith('/') ? inputPath.slice(1) : inputPath;
    const fullPath = path.resolve(process.cwd(), relativePath);

    // デバッグログ: 実際にどのパスを探しているか確認
    console.log("Target Full Path:", fullPath);

    // 2. ファイルの存在確認（Sharpに渡す前にチェック）
    if (!fs.existsSync(fullPath)) {
        console.error("File NOT found at:", fullPath);
        throw new Error(`Input file is missing: ${fullPath}`);
    }

    let inputBuffer = fs.readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();

    // HEIC/HEIF は sharp が読めない環境があるため JPEG に変換してから処理する
    if (ext === '.heic' || ext === '.heif') {
        inputBuffer = await convert({
            buffer: inputBuffer, // HEICファイルの内容
            format: 'JPEG',      // JPEGに変換
        quality: 1        // 0〜1
        });
    }

    const metadata = await sharp(inputBuffer).metadata();
    const width = metadata.width || 1200;   // 定義！
    const height = metadata.height || 1200; // 定義！

    const quality = 70;

    const bandHeight = Math.max(40, Math.floor(height * 0.12));
    const fontSize = Math.floor(bandHeight * 0.6); // 帯の高さの60%の文字サイズ
    const watermarkText = "見本";

    const svg = `
    <svg width="${width}" height="${height}">
      <g transform="rotate(-28 ${width / 2} ${height / 2})" opacity="0.4">
        <!-- 1本目の帯と文字 -->
        <rect x="${-width * 0.2}" y="${height * 0.18}" width="${width * 1.4}" height="${bandHeight}" fill="white" />
        <text x="${width / 2}" y="${height * 0.18 + bandHeight / 2}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="black" font-size="${fontSize}px" font-family="sans-serif" font-weight="bold">
          ${watermarkText}
        </text>

        <!-- 2本目の帯と文字（中央） -->
        <rect x="${-width * 0.2}" y="${height * 0.46}" width="${width * 1.4}" height="${bandHeight}" fill="white" />
        <text x="${width / 2}" y="${height * 0.46 + bandHeight / 2}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="black" font-size="${fontSize}px" font-family="sans-serif" font-weight="bold">
          ${watermarkText}
        </text>

        <!-- 3本目の帯と文字 -->
        <rect x="${-width * 0.2}" y="${height * 0.74}" width="${width * 1.4}" height="${bandHeight}" fill="white" />
        <text x="${width / 2}" y="${height * 0.74 + bandHeight / 2}" 
              text-anchor="middle" dominant-baseline="middle" 
              fill="black" font-size="${fontSize}px" font-family="sans-serif" font-weight="bold">
          ${watermarkText}
        </text>
      </g>
    </svg>
  `;

    const buffer = await sharp(inputBuffer)
        .composite([
            {
                input: Buffer.from(svg),
                gravity: "center",
            },
        ])
        .jpeg({ quality })
        .toBuffer();

    const PhotoPath = SaveIcon(buffer, "watermark.jpg");

    return PhotoPath;
};

export default AddWatermark;