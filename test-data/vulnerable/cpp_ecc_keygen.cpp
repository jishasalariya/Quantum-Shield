#include <openssl/ec.h>
void genEcc() {
    EC_KEY *key = EC_KEY_new_by_curve_name(NID_X9_62_prime256v1);
}
