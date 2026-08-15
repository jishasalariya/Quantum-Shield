#include <openssl/rsa.h>
#include <openssl/pem.h>
#include <openssl/ec.h>
#include <openssl/obj_mac.h>

void generate_keys() {
    // Vulnerable: OpenSSL RSA generation
    int bits = 2048;
    unsigned long exp = RSA_F4;
    BIGNUM *bn = BN_new();
    BN_set_word(bn, exp);
    
    RSA *rsa = RSA_new();
    RSA_generate_key_ex(rsa, bits, bn, NULL);
    
    // Vulnerable: OpenSSL ECC generation
    EC_KEY *key = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
    EC_KEY_generate_key(key);
    
    // Free resources
    RSA_free(rsa);
    BN_free(bn);
    EC_KEY_free(key);
}
