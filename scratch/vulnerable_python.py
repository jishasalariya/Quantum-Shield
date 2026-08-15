# Classical Cryptography test code for python
import rsa
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes

def rsa_operations():
    # Vulnerable: RSA key generation
    (pubkey, privkey) = rsa.newkeys(512)
    message = b"Secret Message"
    
    # Vulnerable: RSA encryption
    crypto = rsa.encrypt(message, pubkey)
    decrypted = rsa.decrypt(crypto, privkey)
    return decrypted

def ecc_operations(message):
    # Vulnerable: ECDSA key generation
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Vulnerable: ECDSA signing
    signature = private_key.sign(
        message,
        ec.ECDSA(hashes.SHA256())
    )
    return signature
