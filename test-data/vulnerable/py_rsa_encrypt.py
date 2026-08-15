import rsa
(pubkey, privkey) = rsa.newkeys(512)
message = b"hello"
crypto = rsa.encrypt(message, pubkey)
