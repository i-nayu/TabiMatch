/*========== Manual ==========
# Input
type: ネットワークタイプ
originalPrivateKey: 秘密鍵

# Output
生成したアドレスを返す
========== Manual ==========*/

// symbol-sdk v3
import { SymbolFacade } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';


function GetAddress(type,originalPrivateKey) {
    const privateKey = new PrivateKey(originalPrivateKey);
    const facade = new SymbolFacade(type);

    // 公開鍵を取得
    const account = facade.createAccount(privateKey);

    // アドレス生成
    const address = account.address;

    console.log(address.toString());

    return address.toString();
}

export default GetAddress;

