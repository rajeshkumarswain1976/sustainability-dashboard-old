"""College OIDC identities, with no local passwords or editable profiles."""
from datetime import timedelta
from hashlib import sha256
from ipaddress import ip_address, ip_network
import os, secrets
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy import select, insert, update, delete
from sqlalchemy.orm import Session
from app.db import get_session
from app.config import settings
from server.storage import tables
from server.auth import token_user, COOKIE as DASHBOARD_COOKIE, demo_mode, utcnow, aware

router = APIRouter(prefix='/campus-care/auth')
COOKIE = 'campuscare_session'

def values(name): return [value.strip() for value in os.getenv(name, '').split(',') if value.strip()]

def member(request, session):
    token = request.cookies.get(COOKIE, '')
    sessions, members = tables().tables['care_sessions'], tables().tables['care_members']
    row = session.execute(select(members, sessions.c.expires_at).join(sessions, members.c.id == sessions.c.member_id)
        .where(sessions.c.token_hash == sha256(token.encode()).hexdigest())).mappings().first() if token else None
    if row and aware(row['expires_at']) > utcnow() and (demo_mode() or not row['id'].startswith('demo:')):
        return {'id': row['id'], 'email': row['email'], 'name': row['name'], 'manager': False, 'nodes': ['F01']}
    user = token_user(session, request.cookies.get(DASHBOARD_COOKIE, ''))
    if user:
        identity = {'id': 'dashboard:' + user['id'], 'email': user['email'], 'name': user['name']}
        save_member(session, identity)
        return {**identity, 'manager': user['key'] in {'admin', 'head'}, 'nodes': user['nodes'], 'dashboard': True}
    raise HTTPException(401, 'Sign in with your college account')

def save_member(session, identity):
    table = tables().tables['care_members']
    if session.execute(select(table.c.id).where(table.c.id == identity['id'])).first():
        session.execute(update(table).where(table.c.id == identity['id']).values(email=identity['email'], name=identity['name']))
    else: session.execute(insert(table).values(**identity))
    session.commit()

def sign_in(session, identity, response):
    save_member(session, identity)
    token = secrets.token_urlsafe(32)
    session.execute(insert(tables().tables['care_sessions']).values(token_hash=sha256(token.encode()).hexdigest(), member_id=identity['id'], expires_at=utcnow()+timedelta(hours=8)))
    session.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=not demo_mode(), samesite='lax', max_age=28800, path='/')

def campus_check(request):
    # Never trust client-supplied forwarded IPs. Configure uvicorn's trusted
    # proxy allowlist when deploying behind a reverse proxy.
    try: address = ip_address(request.client.host)
    except (ValueError, AttributeError): return {'inside': False, 'configured': bool(values('CAMPUS_IP_CIDRS')), 'demo': False}
    networks = values('CAMPUS_IP_CIDRS')
    local_demo = demo_mode() and address.is_loopback
    return {'inside': local_demo or any(address in ip_network(cidr, strict=False) for cidr in networks),
            'configured': bool(networks), 'demo': local_demo}

def require_campus(request):
    if not campus_check(request)['inside']: raise HTTPException(403, 'Join the campus network to raise or support a complaint. Tracking is available anywhere.')

def oauth_client(provider):
    if provider not in {'google', 'microsoft'}: raise HTTPException(404, 'Unknown sign-in provider')
    prefix = 'CARE_' + provider.upper()
    if not all(os.getenv(key) for key in (prefix+'_CLIENT_ID', prefix+'_CLIENT_SECRET', 'CARE_SESSION_SECRET', 'CARE_PUBLIC_URL', 'COLLEGE_EMAIL_DOMAINS')):
        raise HTTPException(503, 'College SSO is not configured yet')
    from authlib.integrations.starlette_client import OAuth
    tenant = os.getenv('CARE_MICROSOFT_TENANT', '')
    if provider == 'microsoft' and (not tenant or tenant in {'common', 'organizations', 'consumers'}):
        raise HTTPException(503, 'A specific college Microsoft tenant is required')
    metadata = 'https://accounts.google.com/.well-known/openid-configuration' if provider == 'google' else f'https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration'
    return OAuth().register(provider, client_id=os.environ[prefix+'_CLIENT_ID'], client_secret=os.environ[prefix+'_CLIENT_SECRET'],
        server_metadata_url=metadata, client_kwargs={'scope': 'openid email profile', 'code_challenge_method': 'S256'})

@router.get('/login/{provider}')
async def login(provider: str, request: Request):
    client = oauth_client(provider)
    return await client.authorize_redirect(request, os.environ['CARE_PUBLIC_URL'].rstrip('/') + '/api/campus-care/auth/callback/' + provider)

@router.get('/callback/{provider}')
async def callback(provider: str, request: Request, session: Session = Depends(get_session)):
    client = oauth_client(provider)
    try: token = await client.authorize_access_token(request)
    except Exception: raise HTTPException(401, 'College sign-in could not be verified') from None
    claims = token.get('userinfo') or {}
    email = str(claims.get('email') or '').lower()
    allowed = {value.lower() for value in values('COLLEGE_EMAIL_DOMAINS')}
    if '@' not in email or email.rsplit('@', 1)[1] not in allowed or not claims.get('sub'):
        raise HTTPException(403, 'Use your college account')
    if provider == 'google' and (not claims.get('email_verified') or claims.get('hd') not in allowed):
        raise HTTPException(403, 'A verified college Google Workspace account is required')
    if provider == 'microsoft' and (claims.get('tid') != os.getenv('CARE_MICROSOFT_TENANT') or claims.get('acct') == 1):
        raise HTTPException(403, 'Use a member account from the college tenant')
    identifier = sha256(f"{claims.get('iss')}|{claims['sub']}".encode()).hexdigest()
    response = RedirectResponse(os.environ['CARE_PUBLIC_URL'].rstrip('/') + '/campus-care', status_code=303)
    sign_in(session, {'id': identifier, 'email': email, 'name': str(claims.get('name') or 'Campus member')[:200]}, response)
    return response

@router.post('/demo')
def demo(response: Response, session: Session = Depends(get_session)):
    if not demo_mode(): raise HTTPException(404, 'Not found')
    sign_in(session, {'id': 'demo:student', 'email': 'student@campusa.example', 'name': 'Demo student'}, response)
    return {'signed_in': True, 'demo': True}

@router.post('/logout')
def logout(request: Request, response: Response, session: Session = Depends(get_session)):
    session.execute(delete(tables().tables['care_sessions']).where(tables().tables['care_sessions'].c.token_hash == sha256(request.cookies.get(COOKIE, '').encode()).hexdigest()))
    session.commit(); response.delete_cookie(COOKIE, path='/')
    return {'signed_out': True}
