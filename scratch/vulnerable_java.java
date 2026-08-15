import javax.crypto.Cipher;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;

public class VulnerableCrypto {
    public void executeCrypto() throws Exception {
        // Vulnerable: RSA key generation
        KeyPairGenerator keyGen = KeyPairGenerator.getInstance("RSA");
        keyGen.initialize(2048);
        KeyPair pair = keyGen.generateKeyPair();

        // Vulnerable: RSA Cipher initialization
        Cipher cipher = Cipher.getInstance("RSA/ECB/PKCS1Padding");
        cipher.init(Cipher.ENCRYPT_MODE, pair.getPublic());
        byte[] encrypted = cipher.doFinal("Sensitive Data".getBytes());

        // Vulnerable: Signature with classical algorithms
        Signature sig = Signature.getInstance("SHA256withRSA");
        sig.initSign(pair.getPrivate());
        sig.update("Data to sign".getBytes());
        byte[] signature = sig.sign();
    }
}
