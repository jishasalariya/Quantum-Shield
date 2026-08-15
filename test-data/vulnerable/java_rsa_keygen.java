import java.security.KeyPairGenerator;
public class RsaKeyGen {
    public void generate() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("RSA");
        kpg.initialize(2048);
    }
}
