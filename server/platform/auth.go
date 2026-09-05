package platform

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/argon2"
)

type Principal struct {
	OrganizationID string
	UserID         string
	Role           string
}

type principalKey struct{}

func WithPrincipal(ctx context.Context, principal Principal) context.Context {
	return context.WithValue(ctx, principalKey{}, principal)
}
func PrincipalFromContext(ctx context.Context) (Principal, bool) {
	value, ok := ctx.Value(principalKey{}).(Principal)
	return value, ok
}
func IsAdmin(principal Principal) bool {
	return principal.Role == "org_owner" || principal.Role == "org_admin"
}

func HashPassword(password string) (string, error) {
	if len(password) < 12 {
		return "", errors.New("password must contain at least 12 characters")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, 32)
	return fmt.Sprintf("argon2id$v=19$m=65536,t=3,p=4$%s$%s", base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(hash)), nil
}

func CheckPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[0] != "argon2id" {
		return false
	}
	salt, saltErr := base64.RawStdEncoding.DecodeString(parts[3])
	expected, hashErr := base64.RawStdEncoding.DecodeString(parts[4])
	if saltErr != nil || hashErr != nil {
		return false
	}
	actual := argon2.IDKey([]byte(password), salt, 3, 64*1024, 4, uint32(len(expected)))
	return subtleEqual(actual, expected)
}

func subtleEqual(left, right []byte) bool {
	if len(left) != len(right) {
		return false
	}
	var value byte
	for i := range left {
		value |= left[i] ^ right[i]
	}
	return value == 0
}

func IssueAccessToken(secret []byte, principal Principal, ttl time.Duration) (string, error) {
	claims := jwt.MapClaims{"org": principal.OrganizationID, "sub": principal.UserID, "role": principal.Role, "exp": time.Now().Add(ttl).Unix(), "iat": time.Now().Unix()}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
}

func ParseAccessToken(secret []byte, raw string) (Principal, error) {
	token, err := jwt.Parse(raw, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})
	if err != nil || !token.Valid {
		return Principal{}, errors.New("invalid access token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return Principal{}, errors.New("invalid claims")
	}
	org, orgOK := claims["org"].(string)
	user, userOK := claims["sub"].(string)
	role, roleOK := claims["role"].(string)
	if !orgOK || !userOK || !roleOK {
		return Principal{}, errors.New("incomplete claims")
	}
	return Principal{OrganizationID: org, UserID: user, Role: role}, nil
}

func NewRefreshToken() (raw, hash string, err error) {
	bytes := make([]byte, 32)
	if _, err = rand.Read(bytes); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(bytes)
	digest := sha256.Sum256([]byte(raw))
	return raw, base64.RawStdEncoding.EncodeToString(digest[:]), nil
}

func HashRefreshToken(raw string) string {
	digest := sha256.Sum256([]byte(raw))
	return base64.RawStdEncoding.EncodeToString(digest[:])
}

func ValidateMembership(ctx context.Context, db *sql.DB, principal Principal) error {
	var status string
	err := db.QueryRowContext(ctx, `SELECT m.status FROM organization_members m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ? AND m.user_id = ? AND u.status = 'active'`, principal.OrganizationID, principal.UserID).Scan(&status)
	if err != nil {
		return err
	}
	if status != "active" {
		return errors.New("inactive membership")
	}
	return nil
}
