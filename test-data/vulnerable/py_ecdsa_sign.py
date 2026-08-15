import ecdsa
sk = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
vk = sk.verifying_key
signature = sk.sign(b"message")
