package platform

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
)

type EncryptedValue struct {
	Ciphertext []byte
	Nonce      []byte
}

func Encrypt(key, plaintext []byte) (EncryptedValue, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return EncryptedValue{}, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return EncryptedValue{}, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return EncryptedValue{}, err
	}
	return EncryptedValue{Ciphertext: gcm.Seal(nil, nonce, plaintext, nil), Nonce: nonce}, nil
}

func Decrypt(key []byte, value EncryptedValue) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(value.Nonce) != gcm.NonceSize() {
		return nil, fmt.Errorf("invalid nonce length")
	}
	return gcm.Open(nil, value.Nonce, value.Ciphertext, nil)
}
