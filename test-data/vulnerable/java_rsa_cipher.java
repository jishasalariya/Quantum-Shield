import javax.crypto.Cipher;
public class RsaCipher {
    public void encrypt() throws Exception {
        Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
    }
}
