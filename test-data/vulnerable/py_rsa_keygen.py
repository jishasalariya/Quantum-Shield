from cryptography.hazmat.primitives.asymmetric import rsa
# Generate a classic private key
private_key = rsa.generate_private_key(
    public_exponent=65537,
    key_size=2048
)
