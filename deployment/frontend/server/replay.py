"""One backend-owned clock; browser streams subscribe without advancing it."""
import asyncio,json,time
from datetime import datetime,timedelta
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from fastapi.responses import StreamingResponse
from app.db import runtime_engine
from app.engine import replay,pipeline
from app.api.routes import _calendar_state,_normalize_time
from app.replay_calendar import bounds

class ReplayWorker:
    def __init__(self):
        self.subscribers=set();self.task=None;self.processing=False;self.error=None;self.last=None
    def next_step(self):
        engine=runtime_engine()
        if not engine:return None
        with Session(engine) as session:
            state=_calendar_state(session)
            if not state['running']:return None
            previous=state.get('last_processed_at')
            target=_normalize_time(datetime.fromisoformat(previous))+timedelta(hours=1) if previous else _normalize_time(datetime.fromisoformat(state['cursor']))
            if target>bounds()[1]:replay.pause(session);return None
            return target,float(state['speed']),state['node']
    def process(self,target,node):
        with Session(runtime_engine()) as session:return pipeline.tick(target,node,session)
    async def publish(self,event):
        self.last=event
        for queue in tuple(self.subscribers):
            if queue.full():queue.get_nowait()
            queue.put_nowait(event)
    async def run(self):
        due=0
        while True:
            try:
                step=await asyncio.to_thread(self.next_step)
                if not step or time.monotonic()<due:
                    await asyncio.sleep(.25);continue
                target,speed,node=step
                self.processing=True
                result=await asyncio.to_thread(self.process,target,node)
                self.error=None
                if result.get('ticks') or result.get('new_alerts'):await self.publish(result)
                due=time.monotonic()+3600/speed
            except asyncio.CancelledError:raise
            except Exception as error:
                self.error=type(error).__name__
                await asyncio.sleep(2)
            finally:self.processing=False
    @asynccontextmanager
    async def lifespan(self):
        self.task=asyncio.create_task(self.run())
        try:yield
        finally:
            self.task.cancel()
            try:await self.task
            except asyncio.CancelledError:pass
    def scoped_event(self,event,node):
        with Session(runtime_engine()) as session:
            cutoff=_normalize_time(datetime.fromisoformat(event['as_of']))
            allowed={row['alert_id'] for row in pipeline.list_alerts(session,as_of=cutoff,node=node)}
        return {**event,'ticks':[],'new_alerts':[row for row in event.get('new_alerts',[]) if row['alert_id'] in allowed]}
    def stream(self,node='F01',as_of=None,limit=None):
        async def events():
            queue=asyncio.Queue(maxsize=32);self.subscribers.add(queue);sent=0
            try:
                while limit is None or sent<limit:
                    try:event=await asyncio.wait_for(queue.get(),timeout=15)
                    except asyncio.TimeoutError:
                        yield ': keep-alive\n\n';continue
                    scoped=await asyncio.to_thread(self.scoped_event,event,node)
                    yield 'event: tick\ndata: '+json.dumps(scoped,default=str)+'\n\n';sent+=1
            finally:self.subscribers.discard(queue)
        return StreamingResponse(events(),media_type='text/event-stream',headers={'Cache-Control':'no-cache','X-Accel-Buffering':'no'})

worker=ReplayWorker()
