#include <openssl/rsa.h>
void genKey() {
    RSA *rsa = RSA_generate_key(2048, RSA_F4, nullptr, nullptr);
}
