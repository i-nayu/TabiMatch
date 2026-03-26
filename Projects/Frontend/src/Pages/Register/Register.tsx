import "./Register.css";
import { useState } from "react";
import jsQR from "jsqr";
import { useNavigate } from "react-router-dom";
import ConfirmButton from "../../Components/ConfirmButton/ConfirmButton";

function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  async function handleSubmit() {
    // エラー表示をリセット
    setError("");
    setSuccess("");

    try {
      setIsSubmitting(true);
      const res = await fetch("/Register/Submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      console.log("サーバーからのレスポンス:", data);

      if (!res.ok) {
        setError("登録に失敗しました。もう一度お試しください。");
      } else {
        setQrCode(data.qrCode);
        setRegisteredAddress(data.address ?? "");
        setSuccess("アカウントを作成しました。ログインしてください。");
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
      <div className="register-tab">
        <h1>新規登録</h1>
      </div>
      <div className="register-tab">
        <ConfirmButton
          label="秘密鍵を持っている方はこちら"
          type="button"
          onClick={async () => {
            navigate("/Login");
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

      <div className="register-container">
        {!qrCode && (
          <div className="register-form">
            <div className="button-group">
              <ConfirmButton label={isSubmitting ? "生成中..." : "アカウント生成"} type="button" onClick={handleSubmit} />
            </div>
          </div>
        )}

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
    </div>
  );
}

export default Register;