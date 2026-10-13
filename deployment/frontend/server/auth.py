"""Database-backed sessions and server-enforced page/location/task permissions."""
from datetime import datetime,timedelta,timezone
from http.cookies import SimpleCookie
from hashlib import sha256,pbkdf2_hmac
from hmac import compare_digest
from urllib.parse import parse_qs,urlencode
from uuid import uuid4
import asyncio,json,os,secrets
from fastapi import APIRouter,Depends,Request,Response,HTTPException
from pydantic import BaseModel,Field,ConfigDict
from sqlalchemy import insert,select,update,delete,func
from sqlalchemy.orm import Session
from app.db import get_session,runtime_engine,get_table
from app.config import settings
from app.analytics.repository import location_tree
from app.engine.scopes import entity_nodes
from server.storage import tables

COOKIE='terranexus_session'
router=APIRouter(prefix='/auth')
def demo_mode():return os.environ.get('DASHBOARD_DEMO_MODE','false').lower()=='true'
def utcnow():return datetime.now(timezone.utc)
def aware(value):return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
def password_hash(password):
    salt=secrets.token_hex(16)
    digest=pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),600000).hex()
    return f'pbkdf2_sha256$600000${salt}${digest}'
def verify_password(password,encoded):
    try:
        algorithm,rounds,salt,digest=encoded.split('$')
        return algorithm=='pbkdf2_sha256' and compare_digest(pbkdf2_hmac('sha256',password.encode(),bytes.fromhex(salt),int(rounds)).hex(),digest)
    except (ValueError,TypeError):return False

def provision(session,user_id,email,password,role,nodes,owners=(),demo=False):
    if role not in {'admin','head','staff'} or not nodes:raise ValueError('A valid role and assigned location are required')
    for node in nodes:location_tree(session,node)
    profile={'key':role,'name':{'admin':'Campus Administrator','head':'Academic Department Head','staff':'Academic Operations Staff'}[role],
        'role':{'admin':'Administrator','head':'Department Head','staff':'Staff'}[role],'avatarInitials':role[0].upper(),
        'nodes':list(nodes),'owners':list(owners),'demo':demo,'active':True}
    values={'email':email.lower(),'password_hash':password_hash(password),'profile':json.dumps(profile)}
    table=tables().tables['app_users']
    if session.execute(select(table.c.user_id).where(table.c.user_id==user_id)).first():
        session.execute(update(table).where(table.c.user_id==user_id).values(**values))
        session.execute(delete(tables().tables['app_sessions']).where(tables().tables['app_sessions'].c.user_id==user_id))
    else:session.execute(insert(table).values(user_id=user_id,**values))

def bootstrap_demo(session):
    if not demo_mode():return
    users=tables().tables['app_users']
    for key,email,nodes,owners in [('admin','admin@campusa.edu',['F01'],[]),('head','head.science@campusa.edu',['building:Academic'],[]),('staff','staff.facilities@campusa.edu',['building:Academic'],['Facilities','Plumbing'])]:
        if not session.execute(select(users.c.user_id).where(users.c.user_id==key)).first():provision(session,key,email,key,key,nodes,owners,True)
    session.commit()

def public_user(row):
    profile=json.loads(row['profile'])
    return {**profile,'id':row['user_id'],'email':row['email'],'assignedLocations':profile['nodes'],
        'canAccessSustainabilityPage':profile['key']!='staff','canAccessCopilot':profile['key']!='staff',
        'canAssignLead':profile['key']!='staff','canScheduleInspection':profile['key']!='staff','canSendAdvisory':profile['key']!='staff','canUseWorkOrder':profile['key']!='staff','canEditTargets':profile['key']=='admin'}

def token_user(session,token):
    sessions=tables().tables['app_sessions'];users=tables().tables['app_users']
    row=session.execute(select(sessions,users.c.email,users.c.password_hash,users.c.profile).join(users,users.c.user_id==sessions.c.user_id).where(sessions.c.token_hash==sha256(token.encode()).hexdigest())).mappings().first()
    now=utcnow()
    if not row or aware(row['expires_at'])<=now or aware(row['last_seen_at'])<=now-timedelta(minutes=30):return None
    user=public_user(row)
    if not user.get('active') or (user.get('demo') and not demo_mode()):return None
    if aware(row['last_seen_at'])<now-timedelta(minutes=1):
        session.execute(update(sessions).where(sessions.c.token_hash==row['token_hash']).values(last_seen_at=now));session.commit()
    return user

class Login(BaseModel):
    model_config=ConfigDict(extra='forbid')
    email:str=Field(min_length=3,max_length=200)
    password:str=Field(min_length=1,max_length=256)

def create_session(session,user_id,response):
    token=secrets.token_urlsafe(32);now=utcnow()
    session.execute(insert(tables().tables['app_sessions']).values(token_hash=sha256(token.encode()).hexdigest(),user_id=user_id,expires_at=now+timedelta(hours=8),last_seen_at=now))
    session.commit()
    response.set_cookie(COOKIE,token,max_age=28800,httponly=True,secure=not demo_mode(),samesite='strict',path='/')

@router.get('/config')
def config():return {'demo_mode':demo_mode(),'managed_accounts':True}

@router.post('/login')
def login(command:Login,response:Response,request:Request,session:Session=Depends(get_session)):
    attempts=tables().tables['auth_attempts'];now=utcnow()
    identity=sha256(f'{command.email.lower()}|{request.client.host if request.client else "unknown"}'.encode()).hexdigest()
    count=session.scalar(select(func.count()).select_from(attempts).where(attempts.c.identity_hash==identity,attempts.c.created_at>=now-timedelta(minutes=10)))
    if count>=10:raise HTTPException(429,'Too many sign-in attempts. Try again later.')
    row=session.execute(select(tables().tables['app_users']).where(tables().tables['app_users'].c.email==command.email.lower())).mappings().first()
    valid=verify_password(command.password,row['password_hash'] if row else 'pbkdf2_sha256$600000$00000000000000000000000000000000$'+'0'*64)
    if not row or not valid or not json.loads(row['profile']).get('active') or (json.loads(row['profile']).get('demo') and not demo_mode()):
        session.execute(insert(attempts).values(attempt_id=str(uuid4()),identity_hash=identity,created_at=now));session.commit()
        raise HTTPException(401,'Email or password is incorrect')
    session.execute(delete(attempts).where(attempts.c.identity_hash==identity))
    create_session(session,row['user_id'],response)
    return {'user':public_user(row),'demo_mode':demo_mode()}

@router.get('/me')
def me(request:Request,session:Session=Depends(get_session)):
    return {'user':token_user(session,request.cookies.get(COOKIE,'')),'demo_mode':demo_mode()}

@router.post('/logout')
def logout(request:Request,response:Response,session:Session=Depends(get_session)):
    token=request.cookies.get(COOKIE,'')
    session.execute(delete(tables().tables['app_sessions']).where(tables().tables['app_sessions'].c.token_hash==sha256(token.encode()).hexdigest()));session.commit()
    response.delete_cookie(COOKIE,path='/')
    return {'signed_out':True}

class DemoRole(BaseModel):role:str
@router.post('/demo-role')
def demo_role(command:DemoRole,response:Response,session:Session=Depends(get_session)):
    if not demo_mode():raise HTTPException(403,'Demo switching is disabled')
    row=session.execute(select(tables().tables['app_users']).where(tables().tables['app_users'].c.user_id==command.role)).mappings().first()
    if not row or not json.loads(row['profile']).get('demo'):raise HTTPException(403,'Unknown demo role')
    create_session(session,row['user_id'],response)
    return {'user':public_user(row),'demo_mode':True}

def permitted_locations(session,user):
    return {row['node_id'] for root in user['nodes'] for row in location_tree(session,root)}

class AccessMiddleware:
    def __init__(self,app):self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http':return await self.app(scope,receive,send)
        path=scope['path'];method=scope['method'];headers=dict(scope['headers'])
        async def fail(status,message):
            body=json.dumps({'detail':message}).encode()
            await send({'type':'http.response.start','status':status,'headers':[(b'content-type',b'application/json')]})
            await send({'type':'http.response.body','body':body})
        if method=='OPTIONS':return await self.app(scope,receive,send)
        origins={'',settings.frontend_origin}
        if demo_mode():origins.update({'http://localhost:5173','http://127.0.0.1:5173'})
        if method in {'POST','PATCH','PUT','DELETE'} and headers.get(b'origin',b'').decode() not in origins:
            return await fail(403,'Untrusted request origin')
        if path in {'/health','/auth/login','/auth/config','/auth/me'}:return await self.app(scope,receive,send)
        # CampusCare has its own reporter identity and ticket-level authorization.
        if path.startswith('/campus-care/'):
            original_receive = receive
            if method in {'POST','PATCH','PUT'}:
                body = b''
                while True:
                    message = await original_receive()
                    if message['type'] == 'http.disconnect': return
                    body += message.get('body', b'')
                    if len(body) > 1048576: return await fail(413, 'Request body is too large')
                    if not message.get('more_body'): break
                consumed = False
                async def campus_receive():
                    nonlocal consumed
                    if not consumed:
                        consumed = True
                        return {'type':'http.request','body':body,'more_body':False}
                    return await original_receive()
                receive = campus_receive
            async def campus_send(message):
                if message['type'] == 'http.response.start':
                    message['headers'] = [(key,value) for key,value in message['headers'] if key != b'cache-control'] + [(b'cache-control',b'private, no-store')]
                await send(message)
            return await self.app(scope,receive,campus_send)
        cookie=SimpleCookie()
        try:cookie.load(headers.get(b'cookie',b'').decode())
        except Exception:return await fail(401,'Sign in to access campus data')
        token=cookie.get(COOKIE)
        engine=runtime_engine()
        if not engine:return await fail(503,'Database is not configured')
        def authorize():
            with Session(engine) as session:
                user=token_user(session,token.value if token else '')
                if not user:return None,None
                return user,permitted_locations(session,user)
        user,allowed=await asyncio.to_thread(authorize)
        if not user:return await fail(401,'Sign in to access campus data')
        scope.setdefault('state',{})['user']=user
        role=user['key']
        if role=='staff' and (path in {'/copilot','/simulate','/agent/run'} or path.startswith('/targets')):
            return await fail(403,'This feature requires a Department Head or Administrator')
        if role!='admin' and path.startswith('/replay/') and method!='GET':
            return await fail(403,'Only the Administrator can control the shared replay clock')
        query=parse_qs(scope.get('query_string',b'').decode(),keep_blank_values=True)
        requested=query.get('node',[user['nodes'][0]])[0]
        if requested not in allowed:return await fail(403,'Location is outside your assigned scope')
        if 'node' not in query and not path.startswith('/auth'):
            query['node']=[requested];scope['query_string']=urlencode(query,doseq=True).encode()
        body=b''
        if method in {'POST','PATCH','PUT'}:
            while True:
                message=await receive()
                if message['type']=='http.disconnect':return
                body+=message.get('body',b'')
                if len(body)>1048576:return await fail(413,'Request body is too large')
                if not message.get('more_body'):break
            try:payload=json.loads(body) if body else {}
            except ValueError:return await fail(400,'Invalid JSON')
            if payload.get('node',requested) not in allowed:return await fail(403,'Location is outside your assigned scope')
            consumed=False
            async def replacement_receive():
                nonlocal consumed
                if not consumed:consumed=True;return {'type':'http.request','body':body,'more_body':False}
                return await receive()
            actual_receive=replacement_receive
        else:payload={};actual_receive=receive
        if path.startswith('/actions/'):
            identifier=path.split('/')[2]
            def action_access():
                with Session(engine) as session:
                    row=session.execute(select(get_table('actions')).where(get_table('actions').c.action_id==identifier)).mappings().first()
                    if not row:return False
                    entities=set().union(*(entity_nodes(session,node) for node in user['nodes']))
                    return row['node_id'] in entities and (role!='staff' or row['owner'] in user['owners'])
            if not await asyncio.to_thread(action_access):return await fail(403,'Action is outside your assigned tasks')
            if role=='staff' and payload.get('status') not in {'in_progress','done'}:return await fail(403,'Staff can mark assigned work In progress or Done')
        scope['headers']=[(key,value) for key,value in scope['headers'] if key not in {b'x-role',b'x-user-id'}]+[(b'x-role',b'staff' if role=='staff' else b'head'),(b'x-user-id',user['id'].encode())]
        messages=[]
        async def filtered_send(message):
            if path=='/stream':return await send(message)
            messages.append(message)
            if message['type']!='http.response.body' or message.get('more_body'):return
            start=next((item for item in messages if item['type']=='http.response.start'),None)
            content=b''.join(item.get('body',b'') for item in messages if item['type']=='http.response.body')
            try:data=json.loads(content)
            except ValueError:
                for item in messages:await send(item)
                return
            if path=='/locations':data['locations']=[item for item in data.get('locations',[]) if item['node_id'] in allowed]
            if role=='staff':
                from server.agent.tools import redact_financial
                approval_flags={item.get('id'):item.get('needs_head_approval') for item in data.get('actions',[])} if path=='/actions' else {}
                data=redact_financial(data,'staff')
                if path=='/actions':data['actions']=[{**item,'needs_head_approval':approval_flags.get(item['id'],True)} for item in data.get('actions',[]) if item.get('owner') in user['owners']]
                if path=='/decisions/queue':
                    data['items']=[item for item in data.get('items',[]) if (item.get('facts',{}).get('decisions',{}).get('owner.assign',{}).get('label') in user['owners'])];data['count']=len(data['items'])
            content=json.dumps(data,default=str).encode()
            start['headers']=[(key,value) for key,value in start['headers'] if key not in {b'content-length',b'cache-control'}]+[(b'content-length',str(len(content)).encode()),(b'cache-control',b'no-store')]
            await send(start);await send({'type':'http.response.body','body':content})
        return await self.app(scope,actual_receive,filtered_send)
