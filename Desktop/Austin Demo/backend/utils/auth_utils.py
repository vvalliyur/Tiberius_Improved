import json
import base64
import urllib.request
import jwt
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jwt.algorithms import ECAlgorithm
from data.schemas.df_schemas import User

def fetch_jwks_key(jwks_url: str, kid: str, api_key: str):
    req = urllib.request.Request(jwks_url)
    req.add_header('apikey', api_key)
    with urllib.request.urlopen(req, timeout=5) as response:
        jwks_data = json.loads(response.read().decode())
        for key_data in jwks_data.get('keys', []):
            if key_data.get('kid') == kid:
                return key_data
        raise ValueError(f"Key with kid '{kid}' not found in JWKS")


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
                try:
                    payload = jwt.decode(token, options={"verify_signature": False})
                except Exception:
                    jwks_url = f"{supabase_url}/.well-known/jwks.json"
                    if kid and supabase_key:
                        try:
                            key_data = fetch_jwks_key(jwks_url, kid, supabase_key)
                            public_key = ECAlgorithm.from_jwk(json.dumps(key_data))
                            payload = jwt.decode(
                                token,
                                public_key,  # type: ignore
                                algorithms=["ES256"],
                                audience="authenticated",
                                options={"verify_exp": True}
                            )
                        except:
                            payload = jwt.decode(token, options={"verify_signature": False})
                    else:
                        payload = jwt.decode(token, options={"verify_signature": False})
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

