import json
import base64
import logging
import urllib.request
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import ECAlgorithm
from data.schemas.df_schemas import User

logger = logging.getLogger(__name__)

_jwks_cache: dict = {}


def _fetch_jwks(jwks_url: str, api_key: str) -> dict:
    """Fetch all keys from the JWKS endpoint and return as {kid: key_data}."""
    req = urllib.request.Request(jwks_url)
    req.add_header('apikey', api_key)
    with urllib.request.urlopen(req, timeout=5) as response:
        jwks_data = json.loads(response.read().decode())
    return {k['kid']: k for k in jwks_data.get('keys', []) if 'kid' in k}


def get_es256_public_key(supabase_url: str, api_key: str, kid: str):
    """Return the cached ECAlgorithm public key for kid, fetching JWKS if needed."""
    global _jwks_cache

    if kid not in _jwks_cache:
        jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        try:
            keys = _fetch_jwks(jwks_url, api_key)
        except Exception as e:
            logger.error("Failed to fetch JWKS from %s: %s", jwks_url, e)
            raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable")

        if not keys:
            logger.error("JWKS response contained no keys from %s", jwks_url)
            raise HTTPException(status_code=503, detail="Authentication service temporarily unavailable")

        for k_id, key_data in keys.items():
            _jwks_cache[k_id] = ECAlgorithm.from_jwk(json.dumps(key_data))

    if kid not in _jwks_cache:
        raise HTTPException(status_code=401, detail="Invalid token: unknown key ID")

    return _jwks_cache[kid]


def create_get_current_user(security: HTTPBearer, supabase_url: str, supabase_key: str, supabase_jwt_secret: str | None):
    async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
        token = credentials.credentials

        try:
            token_parts = token.split('.')
            if len(token_parts) != 3:
                raise HTTPException(status_code=401, detail="Invalid token format")

            header = json.loads(base64.urlsafe_b64decode(token_parts[0] + '=='))
            alg = header.get('alg')
            kid = header.get('kid')

            if alg == 'ES256':
                if not kid:
                    raise HTTPException(status_code=401, detail="Invalid token: missing key ID")
                public_key = get_es256_public_key(supabase_url, supabase_key, kid)
                try:
                    payload = jwt.decode(
                        token,
                        public_key,  # type: ignore
                        algorithms=["ES256"],
                        audience="authenticated",
                        options={"verify_exp": True}
                    )
                except jwt.InvalidTokenError:
                    raise HTTPException(status_code=401, detail="Invalid token")
            elif alg == 'HS256':
                if not supabase_jwt_secret:
                    raise HTTPException(
                        status_code=500,
                        detail="JWT secret not configured. Please set SUPABASE_JWT_SECRET in backend/.env"
                    )
                payload = jwt.decode(
                    token,
                    supabase_jwt_secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                    options={"verify_exp": True}
                )
            else:
                raise HTTPException(
                    status_code=401,
                    detail=f"Unsupported token algorithm: {alg}. Supported: HS256, ES256"
                )
            
            user_id = payload.get("sub")
            email = payload.get("email")
            user_metadata = payload.get("user_metadata", {})
            
            if not user_id:
                raise HTTPException(status_code=401, detail="Invalid token: missing user ID")
            
            return User(id=user_id, email=email, user_metadata=user_metadata)
            
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    
    return get_current_user

