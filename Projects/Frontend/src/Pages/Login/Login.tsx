import "./Login.css";
import { useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../Components/InputField/InputField";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";

function Login() {
    const navigate = useNavigate();
    const [privateKey, setPrivateKey] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [, setIsSubmitting] = useState(false);
    const [qrCode, setQrCode] = useState("");
    const [registeredAddress, setRegisteredAddress] = useState("");

    async function handleCopyAddress(address: string) {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(address);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = address;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setSuccess("Addressをコピーしました。");
        } catch (err) {
            setError("Addressのコピーに失敗しました。");
        }
    }

    // 修正ポイント1: アロー関数に変更し、Reactのフォームイベント型を明示（TSの場合）
    async function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        // エラー表示をリセット
        setError("");
        setSuccess("");

        if (!privateKey) {
            setError("秘密鍵を入力してください。");
            return;
        }

        try {
            setIsSubmitting(true);
            console.log("送信データ:", { privateKey });
            const res = await fetch("/Login/Submit", {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ privateKey }),
            });

            const data = await res.json();
            console.log("サーバーからのレスポンス:", data);

            if (!res.ok) {
                setError("登録に失敗しました。もう一度お試しください。");
            } else {
                const generatedQrCode = await QRCode.toDataURL(privateKey, { errorCorrectionLevel: "H" });
                setQrCode(generatedQrCode);
                setRegisteredAddress(data.address ?? "");
                setSuccess("登録しました。");
            }
        } catch (err) {
            console.error(err);
            setError("通信エラーが発生しました。");
        } finally {
            setIsSubmitting(false);
        }
    }

    // DataURL形式のQRコードから文字列を取得する関数
    async function decodeQRCodeFromDataURL(dataURL: string): Promise<string | null> {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;

                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Canvasの2Dコンテキストが取得できません"));
                    return;
                }

                ctx.drawImage(image, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                resolve(code?.data || null);
            };
            image.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
            image.src = dataURL;
        });
    }

    return (
        <div className="register-page">
            <div className="login-tab">
                <h1>新規登録</h1>
            </div>
            <div className="login-tab">
                <ConfirmButton
                    label="秘密鍵を持っていない方はこちら"
                    type="button"
                    onClick={async () => {
                        navigate("/");
                    }}
                />
                <ConfirmButton
                    label="QRコードをダウンロード済みの方はこちら"
                    type="button"
                    onClick={async () => {
                        navigate("/Tournament");
                    }}
                />
            </div>

            {/* エラーメッセージや成功メッセージの表示領域があると親切です */}
            {error && <p className="error-message" style={{ color: "red" }}>{error}</p>}
            {success && <p className="success-message" style={{ color: "green" }}>{success}</p>}

            <form onSubmit={handleSubmit}>
                <div className="register-container">
                    <div className="register-form">
                        <div className="input-group">
                            <label htmlFor="username">秘密鍵を入力してください</label>
                            <InputField
                                name="username"
                                placeholder="秘密鍵を入力"
                                type="text"
                                value={privateKey} // 追記: 制御コンポーネントにするためvalueを指定
                                onChange={(e) => setPrivateKey(e.target.value)}
                            />
                        </div>
                        <div className="button-group">
                            <ConfirmButton label="登録" type="submit" />
                        </div>
                    </div>

                    {qrCode && (
                        <div className="qr-code-area">
                            <p>生成された秘密鍵QRコードを保存してください</p>
                            {registeredAddress && (
                                <>
                                    <p>発行されたAddress: {registeredAddress}</p>
                                    <ConfirmButton
                                        label="Addressをコピー"
                                        type="button"
                                        onClick={() => handleCopyAddress(registeredAddress)}
                                    />
                                    <p>
                                        手数料用のXYMを受け取るため、以下のfaucetからこのAddressへ送金してください。
                                    </p>
                                    <a
                                        className="qr-download-link"
                                        href="https://testnet.symbol.tools"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Faucetを開く（https://testnet.symbol.tools）
                                    </a>
                                </>
                            )}
                            <img className="qr-code-image" src={qrCode} alt="秘密鍵QRコード" />
                            <a
                                className="qr-download-link"
                                href={qrCode}
                                download={`${registeredAddress || "user"}-private-key-qr.png`}
                            >
                                QRコードをダウンロード
                            </a>
                            <ConfirmButton
                                label="ホームへ"
                                type="button"
                                onClick={async () => {
                                    try {
                                        const result = await decodeQRCodeFromDataURL(qrCode);
                                        if (result) {
                                            // sessionStorageに保存
                                            sessionStorage.setItem("qrCodeData", result);
                                        }
                                        navigate("/tournament");
                                    } catch (err) {
                                        console.error(err);
                                    }
                                }}
                            />
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
}

export default Login;